const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const BIN_DIR = path.join(__dirname, '..', 'bin');
const isWin = process.platform === 'win32';
const YT_DLP_URL = isWin
  ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
  : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux';
const BIN_PATH = path.join(BIN_DIR, isWin ? 'yt-dlp.exe' : 'yt-dlp');

if (!fs.existsSync(BIN_DIR)) {
  fs.mkdirSync(BIN_DIR, { recursive: true });
}

console.log('Downloading yt-dlp binary...');

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        return download(response.headers.location, dest).then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) {
        return reject(new Error(`Failed to download, status code: ${response.statusCode}`));
      }
      const file = fs.createWriteStream(dest);
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
      file.on('error', (err) => {
        fs.unlink(dest, () => reject(err));
      });
    }).on('error', reject);
  });
}

download(YT_DLP_URL, BIN_PATH)
  .then(() => {
    console.log('Download complete.');
    try {
      if (process.platform !== 'win32') {
        fs.chmodSync(BIN_PATH, '755');
        console.log('Executable permissions granted.');
      }
    } catch (err) {
      console.warn('Warning: Could not set executable permissions automatically.', err);
    }
  })
  .catch((err) => {
    console.error('Error downloading yt-dlp:', err);
    process.exit(0); // Don't crash the install process
  });
