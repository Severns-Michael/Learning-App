import { app, BrowserWindow, dialog } from "electron";
import { resolve } from "node:path";

import { DjangoSupervisor } from "./django-supervisor";

// out/main/ -> ../../  (repo root)
const REPO_ROOT = resolve(__dirname, "..", "..");

const django = new DjangoSupervisor(REPO_ROOT);

async function createWindow(): Promise<void> {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "Personal LMS",
    webPreferences: {
      preload: resolve(__dirname, "..", "preload", "index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devUrl = process.env.ELECTRON_RENDERER_URL;
  if (devUrl) {
    await win.loadURL(devUrl);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    await win.loadFile(resolve(__dirname, "..", "renderer", "index.html"));
  }
}

app.whenReady().then(async () => {
  try {
    await django.start();
  } catch (err) {
    dialog.showErrorBox(
      "Backend failed to start",
      `Could not reach Django backend.\n\n${err instanceof Error ? err.message : String(err)}\n\nIs Postgres running? (docker compose up -d)`,
    );
    app.quit();
    return;
  }
  await createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  django.stop();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  django.stop();
});
