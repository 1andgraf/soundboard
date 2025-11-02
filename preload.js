const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // reserved for future native bridges
});
