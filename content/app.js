const fs = require('fs');
const os = require('os');
const homedir = os.homedir();
const path = require('path');
const buffertrim = require('buffertrim');
const Handlebars = require('handlebars');
const $ = jQuery = require('jquery');
const alertify = require('alertifyjs');
const customTitlebar = require('custom-electron-titlebar');
const {remote, shell, clipboard, nativeImage} = require('electron');
const { Menu, MenuItem, BrowserWindow, dialog} = remote;

let pictureBackup;
let hashes = JSON.parse(fs.readFileSync('content/photohashes.json'));
function lookUpHash(hash){
    if(hashes[hash] !== undefined){
        return hashes[hash];
    }else{
        return hash;
    }
}

Handlebars.registerHelper('monthString', function(context, options) {
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return monthNames[context-1];
  });

Handlebars.registerHelper('trailzero', function(context, options) {
    let str = context.toString();
    if(str.length == 1){
        str += "0";
    }
    return str;
  });

Handlebars.registerHelper('leadzero', function(context, options) {
    let str = context.toString();
    if(str.length == 1){
        str = "0"+str;
    }
    return str;
  });

Handlebars.registerHelper('hash', function(context, options){
    return lookUpHash(context);
});
Handlebars.registerHelper('IsThere', function(context, options){
    return (context !== undefined && context.length > 0);
});
Handlebars.registerHelper('commaHash', function(context, options){
    return context.map(x=>lookUpHash(x)).join(', ');
});
Handlebars.registerHelper('breakHash', function(context, options){
    return context.map(x=>lookUpHash(x)).join('\r');
});
Handlebars.registerHelper('stringify', function(context, options){
    return JSON.stringify(context, null, 4);
});

$(document).on('click', 'a[href^="http"]', function(event) {
    event.preventDefault();
    shell.openExternal(this.href);
});

let fullscreen = false;
function fullscreenImg(elem){
    if(fullscreen == false){
        elem.requestFullscreen();
        fullscreen = true;
        $(elem).addClass('zoom-out');
    }else{
        document.exitFullscreen();
        fullscreen = false;
        $(elem).removeClass('zoom-out');
    }
}

function gameYXtoLatLng(y, x){
    let conversion = 0.015531808;
    let origin = [4096,-7168];
    let leafY = (y-origin[0])*conversion;
    let leafX = (x-origin[1])*conversion;
    return [leafY,leafX];
}

function initSmallMap(picture){
    let detailed = L.tileLayer('maps/detailed/{z}/{x}_{y}.jpg', {
        attribution: 'tkon99 - Detailed map by <a href="https://rdr2map.com/" target="_blank">RDR2Map</a>',
        maxZoom: 7,
        maxNativeZoom: 7,
        minNativeZoom: 1,
        noWrap: true,
        tileSize: 256
    });
    let dark = L.tileLayer('maps/darkmode/{z}/{x}_{y}.jpg', {
        attribution: 'tkon99 - Dark map by <a href="https://github.com/TDLCTV" target="_blank">TDLCTV</a>',
        maxZoom: 7,
        maxNativeZoom: 7,
        minNativeZoom: 1,
        noWrap: true,
        tileSize: 256
    });
    

    var mymap = L.map('map', {
        crs: L.CRS.Simple,
        center: [0, 0],
        layers: [detailed]
    }).setView([-63.616,111.336],3);

    let baseMaps = {
        "Detailed": detailed,
        "Dark": dark
    }
    L.control.layers(baseMaps).addTo(mymap);

    mymap.on("baselayerchange", function(e){
        if(e.name == "Dark"){
            $(".leaflet-container").addClass("color-Dark");
        }else{
            $(".leaflet-container").removeClass("color-Dark");
        }
    });

    let leafCoords = gameYXtoLatLng(picture.metadata.loc.y, picture.metadata.loc.x);
    console.log(leafCoords);

    setTimeout(function(){
        mymap.invalidateSize();
    },200);

    L.marker(leafCoords).addTo(mymap);
    mymap.setView(leafCoords,4);
}

// Copy and Save functions
function saveImg(e){
    let picture = getPhotoFromUid($(e).attr("data-uid"));
    if(picture !== false){
        let chosenPath = dialog.showSaveDialogSync({
            title: "Save RDR2 Image",
            defaultPath: picture.metadata.title+" - "+picture.metadata.uid+".jpg" 
        });
        if(chosenPath !== undefined){
            fs.writeFile(chosenPath, picture.rawImage, function(){
                alertify.success('Saved!');
            });
        }
    }else{
        alert("An error occurred, please try again or report the issue.");
    }
}

function copyImg(e){
    let picture = getPhotoFromUid($(e).attr("data-uid"));
    if(picture !== false){
        let natImg = nativeImage.createFromBuffer(picture.rawImage);
        clipboard.writeImage(natImg);
        alertify.success('Copied!');
    }else{
        alert("An error occurred, please try again or report the issue.");
    }
}

function getPhotoFromUid(uid){
    for(i in pictureBackup){
        let thisPic = pictureBackup[i];
        if(thisPic.metadata.uid == uid){
            return thisPic;
        }
    }
    return false;
}

function backToGallery(){
    $("#bigPicture").hide();
    $("#gallery").show();
}

function handleGalleryClick(e){
    let uid = $(e).attr("data-uid");
    let picture = getPhotoFromUid(uid);
    console.log(picture);
    displayImage(picture);
}

$(document).ready(function() {
    titlebar = new customTitlebar.Titlebar({
        backgroundColor: customTitlebar.Color.fromHex('#000'),
        drag: true,
    });
    
      let menu = new Menu();
      menu.append(new MenuItem({
        label: 'File',
        submenu: [
            {
                label: 'Export all',
                click: () => this.alert("Not implemented yet")
            }
        ]
      }));
      menu.append(new MenuItem({
        label: 'Gallery',
        click: () => backToGallery()
      }));
      menu.append(new MenuItem({
        label: 'Map',
        click: () => this.alert("The interactive map has not yet been implemented")
      }));
      menu.append(new MenuItem({
        label: 'About',
        click: () => this.alert("Created by tkon99\rInteractive map from RDR2CollectorsMap project\rRed Dead Redemption 2 is a trademark of Rockstar Games")
      }));
    titlebar.updateMenu(menu);

    doImages();
});

function displayGallery(pictures){
    //console.log(pictures);
    var source = document.getElementById("gallery-template").innerHTML;
    var template = Handlebars.compile(source);
    var html    = template({
        rows: pictures
    });
    document.getElementById("gallery").innerHTML = html;
    $("#bigPicture").hide();
    $("#gallery").show();
}

function displayImage(picture){
    var source = document.getElementById("bigpic-template").innerHTML;
    var template = Handlebars.compile(source);
    var html    = template({
        pic: picture
    });
    document.getElementById("bigPicture").innerHTML = html;
    document.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightBlock(block);
      });
    initSmallMap(picture);
    $("#gallery").hide();
    $("#bigPicture").show();
}

function doImages(){
    const ProfilePath = path.join(homedir, 'Documents', 'Rockstar Games', 'Red Dead Redemption 2', 'Profiles');

    if(fs.existsSync(ProfilePath)){
        let profiles = fs.readdirSync(ProfilePath);
        if(profiles.length > 0){
            main(profiles.map(x => path.join(ProfilePath, x)));
        }else{
            $("#error").html("No profiles found, are you sure you launched the game before?");
        }
    }else{
        $("#error").html("No RDR2 installation found in the My Documents folder");
    }

    function removeZeroBytes(buffer){
        // Horendous hack
        return JSON.parse(JSON.stringify(buffertrim.trim(buffer).toString().trim()).replace(/\\u0000/gm,''));
    }

    function main(profilePaths){
        let prdr3s = [];
        for(i in profilePaths){
            let thisFiles = fs.readdirSync(profilePaths[i]);
            for(x in thisFiles){
                if(thisFiles[x].substr(0,5) == "PRDR3"){
                    prdr3s.push(path.join(profilePaths[i],thisFiles[x]));
                }
            }
        }

        console.log("Found "+prdr3s.length+" pictures.");
        console.log("Converting");

        let images = [];

        for(j in prdr3s){
            let thisP = fs.readFileSync(prdr3s[j]);
            let image = buffertrim.trim(thisP.slice(thisP.indexOf('JPEG')+12, thisP.indexOf('JSON')));
            let metadata = removeZeroBytes(thisP.slice(thisP.indexOf('JSON')+5, thisP.indexOf('TITL')));
            metadata = JSON.parse(metadata);
            metadata.title = removeZeroBytes(thisP.slice(thisP.indexOf("TITL")+6, thisP.indexOf("DESC")));
            metadata.description = removeZeroBytes(thisP.slice(thisP.indexOf("DESC")+6, thisP.indexOf("JEND")));
            images.push({
                image: image.toString('base64'),
                rawImage: image,
                metadata: metadata
            });
        }

        images.sort(function(a,b){
            let aC = a.metadata.creat;
            let bC = b.metadata.creat
            return bC-aC; //Sort images newest on top
        });

        fs.mkdir(path.join(homedir, 'Documents','RDR2Exports'), { recursive: true }, (err) => {
            //if (err) throw err;
        });

        pictureBackup = [...images];

        var a = images;
        var chunk;
        var end = [];

        while (a.length > 0) {

            chunk = a.splice(0,3)

            end.push(chunk);

        }

        console.log(images);

        displayGallery(end);

        // for(z in images){
        //     let thisIm = images[z];
        //     //document.write(thisIm.metadata.title);
        //     //fs.writeFileSync(path.join(homedir, 'Documents','RDR2Exports',thisIm.metadata.uid.toString()+'.jpg'), thisIm.image);
        // }
    }
}