const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('moneycontrolDesktop', {
  platform: process.platform
});
