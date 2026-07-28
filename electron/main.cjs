const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'A M Food Processing Manager',
    icon: path.join(__dirname, '../public/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    }
  });

  const startUrl = process.env.ELECTRON_START_URL || `file://${path.join(__dirname, '../dist/index.html')}`;
  mainWindow.loadURL(startUrl);

  // Remove default menu for clean desktop feel
  mainWindow.setMenu(null);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Native Printing IPC Handlers for PC .exe App
ipcMain.handle('get-printers', async () => {
  if (!mainWindow) return [];
  try {
    const printers = await mainWindow.webContents.getPrintersAsync();
    return printers;
  } catch (err) {
    console.error('Error fetching system printers:', err);
    return [];
  }
});

ipcMain.handle('print-document', async (event, options = {}) => {
  if (!mainWindow) return { success: false, message: 'Main window not available' };

  try {
    const { deviceName, silent = false, htmlContent } = options;

    if (htmlContent) {
      // Create a background window for printing specific HTML
      let printWin = new BrowserWindow({
        show: false,
        webPreferences: { nodeIntegration: false, contextIsolation: true }
      });

      await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

      return new Promise((resolve) => {
        printWin.webContents.print(
          {
            silent: silent,
            printBackground: true,
            deviceName: deviceName || ''
          },
          (success, failureReason) => {
            printWin.close();
            if (success) {
              resolve({ success: true, message: 'Document printed successfully!' });
            } else {
              resolve({ success: false, message: failureReason || 'Printing cancelled or failed' });
            }
          }
        );
      });
    } else {
      // Print active main window
      return new Promise((resolve) => {
        mainWindow.webContents.print(
          {
            silent: silent,
            printBackground: true,
            deviceName: deviceName || ''
          },
          (success, failureReason) => {
            if (success) {
              resolve({ success: true, message: 'Printed successfully!' });
            } else {
              resolve({ success: false, message: failureReason || 'Printing failed' });
            }
          }
        );
      });
    }
  } catch (err) {
    console.error('Electron native print error:', err);
    return { success: false, message: err.message || 'Electron print error' };
  }
});
