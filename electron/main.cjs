const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
} = require("electron");

const path = require("path");
const fs = require("fs");

const ffmpeg =
  require("fluent-ffmpeg");

const ffmpegPath =
  require("ffmpeg-static")
    .replace(
      "app.asar",
      "app.asar.unpacked"
    );

console.log(
  "FFMPEG PATH:",
  ffmpegPath
);

ffmpeg.setFfmpegPath(ffmpegPath);

function createWindow() {
  const win = new BrowserWindow({
    width: 1800,
    height: 1000,
    webPreferences: {
      preload: path.join(
        __dirname,
        "preload.cjs"
      ),
      webSecurity: false,
      allowRunningInsecureContent: true,
    },
  });

  win.maximize();

  const isDev =
    !app.isPackaged;

  if (isDev) {
    win.loadURL(
      "http://localhost:5173"
    );
  } else {
    win.loadFile(
      path.join(
        __dirname,
        "../dist/index.html"
      )
    );
  }
}

app.whenReady().then(createWindow);

ipcMain.handle(
  "select-folder",
  async () => {
    const result =
      await dialog.showOpenDialog({
        properties: ["openDirectory"],
      });

    if (result.canceled) {
      return null;
    }

    return result.filePaths[0];
  }
);

ipcMain.handle(
  "read-folder",
  async (_, folderPath) => {
    const files =
      fs.readdirSync(folderPath);

    return files
      .filter((file) =>
        file.toLowerCase().endsWith(".mp4")
      )
      .map((file) => ({
        name: file,
        fullPath: path.join(
          folderPath,
          file
        ),
      }));
  }
);

ipcMain.handle(
  "transcode-video",
  async (_, inputPath) => {
    return new Promise(
      (resolve, reject) => {
        try {
          const outputPath =
            path.join(
              app.getPath("temp"),
              `${Date.now()}.mp4`
            );

          ffmpeg(inputPath)
            .videoCodec("libx264")
            .outputOptions([
              "-preset fast",
              "-crf 18",
            ])
            .on("end", () => {
              console.log(
                "TRANSCODE COMPLETE"
              );

              resolve(outputPath);
            })
            .on("error", (err) => {
              console.log(
                "TRANSCODE ERROR",
                err
              );

              reject(err);
            })
            .save(outputPath);
        } catch (error) {
          reject(error);
        }
      }
    );
  }
);