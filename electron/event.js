const { session, ipcMain, Notification, shell } = require('electron');
const Store = require('electron-store');

const { windowMap } = require('./window');

const store = new Store();

function setCookie() {
  const fn = (type, details) => {
    if (details.url.indexOf(type) !== -1) {
      const { cookie } = (store.get(`${type}-data`) || {}).config;
      details.requestHeaders['Referer'] = null;
      details.requestHeaders['cookie'] = cookie;
    }
  };
  const filter = {
    urls: [],
  };
  session.defaultSession.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
    fn('juejin', details);
    fn('bilibili', details);
    fn('zhihu', details);
    callback({ cancel: false, requestHeaders: details.requestHeaders });
  });
}

function initEvent() {
  setCookie();

  ipcMain.on('set-title', (_, message) => {
    const { key, title } = message;
    const browserWindow = windowMap.get(key);
    browserWindow.setTitle(title);
  });

  ipcMain.on('notify', (_, message) => {
    const { title, url } = message;
    const notification = new Notification({ title, body: '数据发生变动' });
    notification.on('click', () => shell.openExternal(url));
    notification.show();
  });

  ipcMain.on('openURL', (_, message) => {
    const { url } = message;
    shell.openExternal(url);
  });
}

exports.initEvent = initEvent;
