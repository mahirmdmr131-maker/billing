const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ElectronBridge', {
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  printDocument: (options) => ipcRenderer.invoke('print-document', options)
});
