const fs = require('fs');
const os = require('os');
const homedir = os.homedir();
const path = require('path');
const buffertrim = require('buffertrim');

const ProfilePath = path.join(homedir, 'Documents', 'Rockstar Games', 'Red Dead Redemption 2', 'Profiles');

if(fs.existsSync(ProfilePath)){
    let profiles = fs.readdirSync(ProfilePath);
    if(profiles.length > 0){
        main(profiles.map(x => path.join(ProfilePath, x)));
    }else{
        console.log("No profiles found, are you sure you launched the game before?");
    }
}else{
    console.log("No RDR2 installation found in the My Documents folder");
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
            image: image,
            metadata: metadata
        });
    }

    fs.mkdir(path.join(homedir, 'Documents','RDR2Exports'), { recursive: true }, (err) => {
        //if (err) throw err;
    });

    for(z in images){
        let thisIm = images[z];
        fs.writeFileSync(path.join(homedir, 'Documents','RDR2Exports',thisIm.metadata.uid.toString()+'.jpg'), thisIm.image);
    }
}