const { app, BrowserWindow } = require('electron');

function createWindow () {
  // Create the browser window.
  let win = new BrowserWindow({
    width: 800,
    height: 600,
    'minHeight': 300,
    'minWidth': 300,
    webPreferences: {
      nodeIntegration: true
    },
    frame: false
  })

  // and load the index.html of the app.
  win.loadFile('content/index.html')
}

app.on('ready', createWindow)