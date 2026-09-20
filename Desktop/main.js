const { app, BrowserWindow, Menu } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

function resolveAppIcon() {
  const windowsIcon = path.join(__dirname, "Moesha.ico");
  if (process.platform === "win32" && fs.existsSync(windowsIcon)) {
    return windowsIcon;
  }

  const candidates = [
    path.join(__dirname, "..", "img", "Moesha.png"),
    path.join(__dirname, "..", "img", "Moesha.ico"),
    path.join(__dirname, "Moesha.png"),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate));
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 640,
    title: "Moesha | Workspace",
    icon: resolveAppIcon(),
    backgroundColor: "#f7faf5",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const appFile = path.join(__dirname, "..", "index.html");
  window.loadFile(appFile).catch((error) => {
    window.loadURL(`data:text/html,<h1>Moesha could not load</h1><p>${encodeURIComponent(error.message)}</p>`);
  });
}

app.whenReady().then(() => {
  if (process.platform === "win32") {
    app.setAppUserModelId("com.moesha.desktop");
  }
  Menu.setApplicationMenu(null);
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});