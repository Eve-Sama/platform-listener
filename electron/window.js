const { session, BrowserWindow, Notification } = require('electron');
var _ = require('lodash');

const windowList = [];

function createWindow(path, title) {
  if (path === 'bilibili') {
    const filter = {
      urls: [],
    };
    session.defaultSession.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
      if (details.url.startsWith('https://member.bilibili.com')) {
        details.requestHeaders['Referer'] = null;
        details.requestHeaders['cookie'] = `111`;
      }
      callback({ cancel: false, requestHeaders: details.requestHeaders });
    });
  }
  const browserWindow = new BrowserWindow({
    width: 800,
    height: 600,
    alwaysOnTop: true,
    webPreferences: {
      webSecurity: false,
    },
  });
  browserWindow.loadURL(`http://localhost:3000/${path}`);
  browserWindow.webContents.on('did-finish-load', () => browserWindow.setTitle(title));
  browserWindow.webContents.openDevTools();
  browserWindow.addListener('closed', () => _.remove(windowList, v => v === path));
  windowList.push(browserWindow);
}

function trayClick(path, title) {
  const index = windowList.findIndex(v => v === path);
  if (index === -1) {
    createWindow(path, title);
    windowList.push(path);
  } else {
    new Notification({ title: 'Platform Listener', body: '已存在该监听器!' }).show();
  }
}

exports.trayClick = trayClick;
