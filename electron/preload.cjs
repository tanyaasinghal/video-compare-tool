const {
  contextBridge,
  ipcRenderer,
} = require("electron");

contextBridge.exposeInMainWorld(
  "electronAPI",
  {
    selectFolder: () =>
      ipcRenderer.invoke(
        "select-folder"
      ),

    readFolder: (folderPath) =>
      ipcRenderer.invoke(
        "read-folder",
        folderPath
      ),

    transcodeVideo: (inputPath) =>
      ipcRenderer.invoke(
        "transcode-video",
        inputPath
      ),
  }
);