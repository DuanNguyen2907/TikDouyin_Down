const os = require("os");
const fs = require("fs");
const { exec, execSync } = require("child_process");
const XLSX = require("xlsx");
const path = require("path");
const axios = require("axios");
const settings = require("electron-settings");
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const { DownloaderHelper } = require("node-downloader-helper");
const config = {};

/**
 * Add setting here
 */
const defaultSettings = {
  lang: "en_US",
  target: path.join(os.homedir(), "Downloads"),
  record: [],
};

async function createWindow() {
  let isLicensed = await fetchData(); // Chạy hàm fetchData trước

  if (isLicensed === null) {
    config.mainWindow = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
      },
      icon: "resource/favicon.ico",
    });
    // setup user-agent
    config.mainWindow.webContents.userAgent =
      "Mozilla/5.0 (iPad; CPU OS 5_1_1 like Mac OS X) AppleWebKit/534.46 (KHTML, like Gecko) Version/5.1 Mobile/9B206 Safari/7534.48.3";
    config.mainWindow.loadFile("index.html");
  } else {
    let message =
      "You have not registered yet! Please copy the code: " +
      isLicensed +
      " and send it to the administrator.\n(Ctrl+C to copy full message)";
    dialog
      .showMessageBox({
        // option Object
        type: "error",
        buttons: [],
        defaultId: 0,
        icon: "",
        title: "License key",
        detail: message,
        checkboxChecked: false,
        cancelId: 0,
        noLink: false,
        normalizeAccessKeys: false,
      })
      .then(({ response }) => {
        if (response === 0) {
          app.quit(); // Dừng chương trình khi người dùng ấn đóng hoặc cancel
        }
      })
      .catch((err) => {
        console.log(err);
      });
  }

  // open debug
  // config.mainWindow.webContents.openDevTools();
}

function getUnqueFilename(filepath, filename, n = 1) {
  if (fs.existsSync(path.join(filepath, filename + ".mp4"))) {
    filename = filename.replace(/\(\d+\)$/, "") + `(${n})`;
    return getUnqueFilename(filepath, filename, n + 1);
  }
  return filename;
}

async function fetchData() {
  try {
    // Thực thi lệnh và lấy đầu ra trực tiếp vào biến
    const output = execSync("wmic diskdrive get serialNumber").toString();

    // Chia các dòng đầu ra thành mảng dựa trên ký tự xuống dòng
    const lines = output.split("\n");

    // Lấy chuỗi từ dòng thứ 2 và loại bỏ khoảng trắng
    const str = lines[2].replace(/\s/g, "");

    // Thực thi lệnh và lấy đầu ra trực tiếp vào biến
    const outputs = execSync("wmic bios get serialnumber").toString();

    // Chia các dòng đầu ra thành mảng dựa trên ký tự xuống dòng
    const liness = outputs.split("\n");

    // Lấy chuỗi từ dòng thứ 1 và loại bỏ khoảng trắng
    const strs = liness[1].replace(/\s/g, "");

    const keys = strs + str;

    // Đường dẫn đến file Excel trực tuyến
    const fileURL =
      "https://docs.google.com/spreadsheets/d/19EDNBSmQkoFfW0h-PylqPbEy23asf9nOA5NcGobtVhI/edit?usp=sharing";

    // Tải xuống tệp Excel từ URL
    const response = await axios.get(fileURL, { responseType: "arraybuffer" });
    const data = new Uint8Array(response.data);

    // Đọc workbook từ dữ liệu tải xuống
    const workbook = XLSX.read(data, { type: "array" });

    // Truy cập vào bảng dữ liệu cụ thể (worksheet)
    const worksheet = workbook.Sheets["Sheet1"];

    const acs = XLSX.utils.sheet_to_json(worksheet);

    // Mảng để lưu trữ giá trị của cột A
    const columnAValues = [];

    for (let i = 0; i < acs.length; i++) {
      const item = acs[i];
      const valueA = item.A;
      if (valueA !== undefined) {
        columnAValues.push(String(valueA));
      }
    }

    let isLicensed = columnAValues.includes(keys);

    if (!isLicensed) {
      return keys;
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

function initIPC() {
  ipcMain.handle("keepTop", (event, toggle) => {
    config.mainWindow.setAlwaysOnTop(toggle);
  });

  ipcMain.handle("selectFolder", async () => {
    const result = await dialog.showOpenDialog(
      { properties: ["openDirectory"] },
      (folder) => folder
    );
    return result.canceled ? "" : result.filePaths[0];
  });

  ipcMain.handle("exit", () => {
    app.quit();
  });

  ipcMain.handle("getSetting", (event, item) => {
    if (Object.keys(defaultSettings).includes(item)) {
      config[item] = settings.getSync(item) || defaultSettings[item];
      return config[item];
    }
  });

  ipcMain.handle("setSetting", (event, item, value) => {
    if (Object.keys(defaultSettings).includes(item)) {
      config[item] = value;
      settings.setSync(item, config[item]);
    }
  });

  ipcMain.handle("download", (event, data) => {
    const taskId = data.taskId;

    const dl = new DownloaderHelper(data.fileurl, config.target, {
      fileName: getUnqueFilename(config.target, data.filename) + ".mp4",
    });

    dl.on("end", (info) => {
      config.mainWindow.send("downloadEnd", {
        taskId,
        isSuccess: !info.incomplete,
        openpath: info.filePath,
      });
    });
    dl.on("error", (info) => {
      config.mainWindow.send("downloadError", {
        taskId,
        message: info.message,
      });
    });
    dl.on("download", (info) => {
      config.mainWindow.send("downloadStart", {
        taskId,
        size: info.totalSize,
        filename: info.fileName,
      });
    });
    dl.on("progress", (info) => {
      config.mainWindow.send("downloadProgress", {
        taskId,
        progress: info.progress,
      });
    });
    dl.start().catch((info) => {
      config.mainWindow.send("downloadError", {
        taskId,
        message: info.message,
      });
    });
    // config.mainWindow.webContents.downloadURL(data.fileurl + "#" + data.taskId);
  });

  ipcMain.handle("resize", (event, w, h) => {
    config.mainWindow.setSize(w, h, true);
  });
}

const onlyInstance = app.requestSingleInstanceLock();
if (!onlyInstance) {
  app.quit();
}

app.on("ready", () => {
  createWindow();

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  if (process.platform === "darwin") {
    let forceQuit = false;
    app.on("before-quit", () => {
      forceQuit = true;
    });
    config.mainWindow.on("close", (event) => {
      if (!forceQuit) {
        event.preventDefault();
        config.mainWindow.minimize();
      }
    });
  }

  initIPC();
});

// app.on("second-instance", () => config.mainWindow.show());

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
