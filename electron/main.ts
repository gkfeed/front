import { app, BrowserWindow, dialog, shell } from 'electron';
import type { Server } from 'node:http';
import { join } from 'node:path';

import { createHttpServer } from '../server/http/httpServer.js';
import { createApiProxy } from '../server/http/apiProxy.js';
import { handleBffRequest } from '../server/http/apiRouter.js';
import { serveFrontend } from '../server/http/staticServer.js';

const DESKTOP_HOST = '127.0.0.1';
const DESKTOP_PORT = 32_145;

let mainWindow: BrowserWindow | null = null;
let server: Server | null = null;

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) app.quit();

app.on('second-instance', () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

app.whenReady().then(async () => {
  if (!hasSingleInstanceLock) return;

  const appRoot = app.getAppPath();
  if (app.isPackaged && process.platform === 'win32') {
    process.env.GKFEED_ARIA2C_PATH = join(process.resourcesPath, 'aria2', 'aria2c.exe');
  }

  try {
    server = createHttpServer({
      handleApiRequest: createApiProxy(),
      handleBffRequest,
      serveFrontend: (pathname, headOnly, response) => (
        serveFrontend(pathname, headOnly, response, join(appRoot, 'dist'))
      ),
    });
    await listen(server, DESKTOP_PORT, DESKTOP_HOST);
  } catch (error) {
    dialog.showErrorBox(
      'GKFEED could not start',
      `The local desktop service could not bind to ${DESKTOP_HOST}:${DESKTOP_PORT}.\n\n${formatError(error)}`,
    );
    app.quit();
    return;
  }

  const appUrl = `http://${DESKTOP_HOST}:${DESKTOP_PORT}`;
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 360,
    minHeight: 560,
    show: false,
    backgroundColor: '#211c1b',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void openExternalUrl(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isAppUrl(url, appUrl)) return;
    event.preventDefault();
    void openExternalUrl(url);
  });
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  await mainWindow.loadURL(appUrl);
}).catch((error: unknown) => {
  dialog.showErrorBox('GKFEED could not start', formatError(error));
  app.quit();
});

app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => {
  server?.close();
  server = null;
});

function listen(httpServer: Server, port: number, host: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error) => {
      httpServer.off('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      httpServer.off('error', onError);
      resolve();
    };
    httpServer.once('error', onError);
    httpServer.once('listening', onListening);
    httpServer.listen(port, host);
  });
}

function isAppUrl(candidate: string, appUrl: string): boolean {
  try {
    return new URL(candidate).origin === appUrl;
  } catch {
    return false;
  }
}

async function openExternalUrl(candidate: string): Promise<void> {
  try {
    const url = new URL(candidate);
    if (url.protocol === 'http:' || url.protocol === 'https:') await shell.openExternal(url.href);
  } catch {
    // Ignore invalid or unsupported external URLs.
  }
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
