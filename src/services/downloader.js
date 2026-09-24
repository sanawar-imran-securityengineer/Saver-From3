const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { URL } = require('url');

const BIN_DIR = path.join(__dirname, '..', '..', 'bin');
const YT_DLP_PATH = process.platform === 'win32' 
  ? path.join(BIN_DIR, 'yt-dlp.exe') 
  : path.join(BIN_DIR, 'yt-dlp');

// Fallback to global yt-dlp if local binary doesn't exist
const getBinaryPath = () => {
  if (fs.existsSync(YT_DLP_PATH)) {
    try {
      if (process.platform !== 'win32') {
        fs.chmodSync(YT_DLP_PATH, 0o755);
      }
    } catch (err) {
      console.warn('Could not chmod yt-dlp:', err);
    }
    return YT_DLP_PATH;
  }
  return 'yt-dlp';
};

// URL validation to prevent SSRF
function is_valid_url(url_string) {
  try {
    const parsed = new URL(url_string);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    // Block localhost and common private IPs
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./) ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.local')
    ) {
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

function run_yt_dlp(args) {
  return new Promise((resolve, reject) => {
    const bin = getBinaryPath();
    const process = spawn(bin, args, { shell: false });
    
    let stdout = '';
    let stderr = '';
    
    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    process.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`yt-dlp exited with code ${code}\nStderr: ${stderr}`));
      } else {
        resolve({ stdout, stderr });
      }
    });
    
    process.on('error', (err) => {
      reject(err);
    });
  });
}

async function extract_metadata(url) {
  if (!is_valid_url(url)) {
    throw new Error('Invalid URL');
  }

  const args = [
    '--dump-json',
    '--no-playlist',
    '--no-warnings',
    '--socket-timeout', '30',
    url
  ];

  try {
    const { stdout } = await run_yt_dlp(args);
    const info = JSON.parse(stdout);
    return info;
  } catch (err) {
    throw new Error(`Failed to extract metadata: ${err.message}`);
  }
}

async function download_file(url, downloads_dir, format, isMp3) {
  if (!is_valid_url(url)) {
    throw new Error('Invalid URL');
  }

  const fileId = crypto.randomUUID();
  
  // Create output template string safely
  // Note: child_process.spawn without shell escapes automatically
  const outtmpl = path.join(downloads_dir, `${fileId}.%(ext)s`);

  let args = [
    '--no-playlist',
    '--restrict-filenames',
    '--no-warnings',
    '--socket-timeout', '30',
    '-o', outtmpl
  ];

  // Try to use ffmpeg if available in path for merging (e.g. reddit/youtube video + audio)
  // If not available, we can't force it, yt-dlp will fallback to best pre-merged format or fail.
  
  if (isMp3) {
    args.push('--extract-audio');
    args.push('--audio-format', 'mp3');
    args.push('--audio-quality', '192K');
    args.push('-f', 'bestaudio/best');
  } else {
    // Basic format selection based on the original Python FORMAT_MAP logic
    let formatStr = 'best';
    if (format && format.includes('p')) {
      const height = format.replace('p', '');
      formatStr = `bv*[height<=${height}][ext=mp4]+ba/bv*[height<=${height}]+ba[ext=m4a]/bv*[height<=${height}]+ba/b[height<=${height}]/best`;
    }
    
    // Some shared hostings do not have ffmpeg. yt-dlp will try to merge if we use +, 
    // but might fail. We allow yt-dlp to try.
    args.push('-f', formatStr);
    args.push('--merge-output-format', 'mp4');
  }

  args.push(url);

  try {
    await run_yt_dlp(args);
    
    // yt-dlp has finished, let's find the file
    const files = fs.readdirSync(downloads_dir);
    const downloadedFile = files.find(f => f.startsWith(fileId));
    
    if (!downloadedFile) {
      throw new Error('Output file was not created');
    }
    
    const filePath = path.join(downloads_dir, downloadedFile);
    const stats = fs.statSync(filePath);
    
    return {
      filename: downloadedFile,
      filepath: filePath,
      size: stats.size
    };
  } catch (err) {
    throw new Error(`Download failed: ${err.message}`);
  }
}

function format_size(sizeBytes) {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  if (sizeBytes < 1024 * 1024 * 1024) return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(sizeBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

module.exports = {
  extract_metadata,
  download_file,
  is_valid_url,
  format_size
};
