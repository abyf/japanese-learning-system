/**
 * Standalone Launcher
 * 
 * Works both locally (opens browser) and on Render.com (production server).
 * - Locally: binds to 127.0.0.1:3000, opens browser
 * - Production: binds to 0.0.0.0:PORT, no browser open
 */
const { createServer } = require('./server');
const { exec } = require('child_process');
const os = require('os');

const isProduction = process.env.NODE_ENV === 'production';

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('   日本語学習システム - Japanese Learning System');
  console.log('═══════════════════════════════════════════════');
  console.log('');
  console.log('Starting server...');
  console.log(`Environment: ${isProduction ? 'PRODUCTION' : 'LOCAL'}`);

  try {
    const app = await createServer();

    const port = process.env.PORT || 3000;
    const host = isProduction ? '0.0.0.0' : '127.0.0.1';

    const listener = app.listen(port, host, () => {
      const actualPort = listener.address().port;
      console.log(`Server running on ${host}:${actualPort}`);
      console.log('');

      // Only open browser locally
      if (!isProduction) {
        const url = `http://127.0.0.1:${actualPort}`;
        console.log(`Opening browser: ${url}`);
        console.log('(Press Ctrl+C to stop the server)');
        console.log('');

        const platform = os.platform();
        if (platform === 'win32') {
          exec(`start ${url}`);
        } else if (platform === 'darwin') {
          exec(`open ${url}`);
        } else {
          exec(`xdg-open ${url}`);
        }
      } else {
        console.log('Production mode - server ready for connections');
      }
    });

    listener.on('error', (err) => {
      if (err.code === 'EADDRINUSE' && !isProduction) {
        console.log(`Port ${port} in use, trying random port...`);
        const retryListener = app.listen(0, '127.0.0.1', () => {
          const retryPort = retryListener.address().port;
          const url = `http://127.0.0.1:${retryPort}`;
          console.log(`Server running at: ${url}`);
          const platform = os.platform();
          if (platform === 'win32') exec(`start ${url}`);
          else if (platform === 'darwin') exec(`open ${url}`);
          else exec(`xdg-open ${url}`);
        });
      } else {
        throw err;
      }
    });

  } catch (err) {
    console.error('Failed to start:', err.message);
    process.exit(1);
  }
}

main();
