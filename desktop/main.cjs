const { app, BrowserWindow, Tray, Menu, nativeImage, globalShortcut, ipcMain, dialog } = require("electron");
const { spawn } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");

let win = null;
let tray = null;
let worker = null;
let quitting = false;

const root = app.isPackaged ? process.resourcesPath : path.join(__dirname, "..");
const workerPath = path.join(root, "worker", "server.mjs");
const distPath = path.join(root, "dist", "index.html");
const workerUrl = "http://127.0.0.1:8787";

function healthCheck() {
  return new Promise(resolve => {
    const req = http.get(workerUrl + "/health", res => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(1200, () => { req.destroy(); resolve(false); });
  });
}

async function waitForWorker(timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await healthCheck()) return true;
    await new Promise(r => setTimeout(r, 300));
  }
  return false;
}

function startWorker() {
  if (worker) return;
  const env = { ...process.env, PORT: "8787", ALLOWED_ORIGINS: "file://,http://localhost:5173,http://localhost:4173" };
  if (app.isPackaged) env.ELECTRON_RUN_AS_NODE = "1";
  worker = spawn(process.execPath, [workerPath], {
    cwd: root,
    env,
    windowsHide: true,
    stdio: "ignore"
  });
  worker.on("exit", () => { worker = null; });
}

function showJarvis() {
  if (!win) return;
  win.show();
  win.focus();
  win.webContents.send("jarvis:wake");
}

function hideJarvis() {
  if (win && !win.isDestroyed()) win.hide();
}

function createWindow() {
  const loginState = app.getLoginItemSettings();
  const launchHidden = Boolean(loginState.wasOpenedAtLogin);
  win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 980,
    minHeight: 680,
    show: !launchHidden,
    backgroundColor: "#08090c",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });

  win.on("close", event => {
    if (!quitting) {
      event.preventDefault();
      hideJarvis();
    }
  });

  win.webContents.on("did-finish-load", () => {
    win.webContents.send("jarvis:desktop-ready");
  });

  if (app.isPackaged) {
    if (!fs.existsSync(distPath)) {
      dialog.showErrorBox("Agente Zero Desktop", "A versão desktop precisa ser compilada com npm run build antes de iniciar.");
      return;
    }
    win.loadFile(distPath);
  } else {
    win.loadURL("http://localhost:5173");
  }
}

function createTray() {
  tray = new Tray(nativeImage.createEmpty());
  tray.setToolTip("Agente Zero Desktop");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Abrir JARVIS", click: showJarvis },
    { label: "Ocultar JARVIS", click: hideJarvis },
    { type: "separator" },
    { label: "Sair", click: () => { quitting = true; app.quit(); } }
  ]));
  tray.on("double-click", showJarvis);
}

app.whenReady().then(async () => {
  app.setLoginItemSettings({ openAtLogin: true, openAsHidden: true });
  startWorker();
  const online = await waitForWorker();
  if (!online) console.warn("Worker local não respondeu dentro do prazo.");
  createWindow();
  createTray();

  globalShortcut.register("Control+Shift+J", showJarvis);

  ipcMain.on("jarvis:show", showJarvis);
  ipcMain.on("jarvis:hide", hideJarvis);
});

app.on("window-all-closed", event => event.preventDefault());

app.on("before-quit", () => {
  quitting = true;
  globalShortcut.unregisterAll();
  if (worker && !worker.killed) worker.kill();
});
