const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

let mainWindow = null;

/**
 * Starts the Express server on a random available port.
 * Retries on the next available port if the chosen port is in use.
 * Returns a promise that resolves with the port number.
 */
function startServer() {
  return new Promise(async (resolve, reject) => {
    try {
      const { createServer } = require('./server');
      const server = await createServer();

      function tryListen(port) {
        const listener = server.listen(port, '127.0.0.1', () => {
          const actualPort = listener.address().port;
          console.log(`Express server running on port ${actualPort}`);
          resolve(actualPort);
        });

        listener.on('error', (err) => {
          if (err.code === 'EADDRINUSE') {
            console.log(`Port ${port} in use, trying next available port...`);
            tryListen(0); // Let the OS assign a random available port
          } else {
            reject(err);
          }
        });
      }

      // Start with port 0 to let the OS pick a random available port
      tryListen(0);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Creates the main application window.
 */
function createWindow(port) {
  // Hide the default menu bar
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 768,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    title: 'Japanese Learning System',
    show: false
  });

  mainWindow.loadURL(`http://127.0.0.1:${port}`);

  // Show window when ready to avoid visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App lifecycle
app.whenReady().then(async () => {
  try {
    const port = await startServer();
    createWindow(port);
  } catch (err) {
    console.error('Failed to start application:', err);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) {
    // This shouldn't normally happen since we quit on all windows closed
    // but included for macOS convention
  }
});
