const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("jarvisDesktop", {
  show: () => ipcRenderer.send("jarvis:show"),
  hide: () => ipcRenderer.send("jarvis:hide"),
  onWake: (callback) => ipcRenderer.on("jarvis:wake", () => callback())
});
