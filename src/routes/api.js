const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const rateLimit = require('express-rate-limit');
const { PLATFORMS, get_platform } = require('../utils/platforms');
const { detect_platform } = require('../utils/detector');
const { extract_metadata, download_file, is_valid_url, format_size } = require('../services/downloader');

const router = express.Router();

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, // limit each IP to 100 requests per windowMs
});

function get_registry_payload() {
  return PLATFORMS.map(spec => ({
    key: spec.key,
    name: spec.name,
    icon: spec.icon,
    accent_color: spec.accent_color,
    page: `/pages/${spec.page}`,
    route: `/${spec.key}`,
    formats: spec.formats,
    options: spec.option_pairs.map(([v, l]) => ({ value: v, label: l })),
    sample_url: spec.sample_url,
    needs_ffmpeg: spec.needs_ffmpeg,
  }));
}

router.get(['/api/v1/platforms', '/api/platforms'], (req, res) => {
  res.json({
    success: true,
    count: PLATFORMS.length,
    platforms: get_registry_payload()
  });
});

router.post('/api/v1/detect', apiLimiter, (req, res) => {
  const { url } = req.body || {};
  
  const { platform_key, error } = detect_platform(url);
  if (error) {
    return res.status(400).json({ error: "detect_error", message: error });
  }

  const spec = get_platform(platform_key);
  res.json({
    success: true,
    platform: spec.key,
    platform_name: spec.name,
    icon: spec.icon,
    accent_color: spec.accent_color,
    page: `/pages/${spec.page}`,
    formats: spec.formats,
    url: url
  });
});

router.post('/api/v1/download', apiLimiter, async (req, res) => {
  const { url, format, option, quality } = req.body || {};
  const requested = (format || option || quality || 'best').trim().toLowerCase();

  if (!is_valid_url(url)) {
    return res.status(400).json({ error: "validation_error", message: "Invalid URL." });
  }

  const { platform_key, error } = detect_platform(url);
  if (error) {
    return res.status(400).json({ error: "detect_error", message: error });
  }

  const spec = get_platform(platform_key);
  let requestedFormat = requested;
  if (!spec.formats.includes(requestedFormat)) {
    requestedFormat = spec.formats.includes("best") ? "best" : spec.formats[0];
  }

  try {
    if (platform_key === 'tiktok') {
      try {
        const fetchJson = (apiUrl) => new Promise((resolve, reject) => {
          https.get(apiUrl, (resp) => {
            let data = '';
            resp.on('data', chunk => data += chunk);
            resp.on('end', () => resolve(JSON.parse(data)));
          }).on('error', reject);
        });
        const tikwmData = await fetchJson(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`);
        
        if (tikwmData.code === 0 && tikwmData.data) {
          const { title, cover, duration, author, play, music } = tikwmData.data;
          const isMp3 = requestedFormat === 'mp3';
          const directUrl = isMp3 ? music : play;
          const ext = isMp3 ? 'mp3' : 'mp4';
          
          const formatsPayload = spec.option_pairs.map(([val, label]) => ({
            format_id: val,
            quality: label,
            ext: val === 'mp3' ? 'mp3' : 'mp4',
            url: val === 'mp3' ? music : play,
            is_selected: val === requestedFormat
          }));

          return res.json({
            success: true,
            platform: spec.key,
            platform_name: spec.name,
            title: title || `${spec.name} media`,
            thumbnail: cover,
            duration: duration ? `${Math.floor(duration / 60)}:${('0' + (duration % 60)).slice(-2)}` : null,
            uploader: author ? author.nickname : "",
            view_count: null,
            download_url: directUrl,
            url: directUrl,
            stream_url: directUrl,
            filename: `${(title || 'tiktok').replace(/[^a-zA-Z0-9]/g, '_')}.${ext}`,
            quality: requestedFormat,
            format: isMp3 ? "MP3 Audio" : "MP4 Video",
            extension: ext,
            formats: formatsPayload,
            extractor: "tikwm-api",
            source_url: url,
            server_download_required: false
          });
        }
      } catch (err) {
        console.warn('Tikwm API failed, falling back to yt-dlp:', err);
      }
    }

    const info = await extract_metadata(url);
    const title = info.title || `${spec.name} media`;
    const thumbnail = info.thumbnail || info.thumbnails?.[0]?.url;
    
    // Attempt to pick direct url if available
    let directUrl = null;
    if (info.url) {
      directUrl = info.url;
    } else if (info.formats && info.formats.length > 0) {
      // rough heuristic
      directUrl = info.formats[info.formats.length - 1].url;
    }

    const isMp3 = requestedFormat === 'mp3';
    const ext = isMp3 ? 'mp3' : 'mp4';

    // Formats payload for UI
    const formatsPayload = spec.option_pairs.map(([val, label]) => ({
      format_id: val,
      quality: label,
      ext: val === 'mp3' ? 'mp3' : 'mp4',
      url: directUrl || url,
      is_selected: val === requestedFormat
    }));

    // Check if server download required
    let serverRequired = false;
    if (['reddit', 'threads', 'pinterest', 'facebook', 'youtube', 'instagram'].includes(spec.key)) {
      serverRequired = true;
    }

    res.json({
      success: true,
      platform: spec.key,
      platform_name: spec.name,
      title: title,
      thumbnail: thumbnail,
      duration: info.duration ? `${Math.floor(info.duration / 60)}:${('0' + (info.duration % 60)).slice(-2)}` : null,
      uploader: info.uploader || info.channel || "",
      view_count: info.view_count,
      download_url: directUrl,
      url: directUrl,
      stream_url: directUrl,
      filename: `${title.replace(/[^a-zA-Z0-9]/g, '_')}.${ext}`,
      quality: requestedFormat,
      format: isMp3 ? "MP3 Audio" : "MP4 Video",
      extension: ext,
      formats: formatsPayload,
      extractor: "yt-dlp",
      source_url: url,
      server_download_required: serverRequired
    });
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ error: "server_error", message: err.message || "Failed to resolve metadata.", platform: spec.key });
  }
});

router.post('/api/v1/download-file', apiLimiter, async (req, res) => {
  const { url, format, option, quality } = req.body || {};
  const requested = (format || option || quality || 'best').trim().toLowerCase();

  if (!is_valid_url(url)) {
    return res.status(400).json({ error: "validation_error", message: "Invalid URL." });
  }

  const { platform_key, error } = detect_platform(url);
  if (error) {
    return res.status(400).json({ error: "detect_error", message: error });
  }

  const spec = get_platform(platform_key);
  let requestedFormat = requested;
  if (!spec.formats.includes(requestedFormat)) {
    requestedFormat = spec.formats.includes("best") ? "best" : spec.formats[0];
  }

  const isMp3 = requestedFormat === 'mp3';
  const downloadsDir = path.join(__dirname, '..', '..', 'downloads');

  try {
    const result = await download_file(url, downloadsDir, requestedFormat, isMp3);
    
    // We fetch metadata again for title (yt-dlp can return it in stdout but we used simple run)
    // To save time, we will just use a generic title or the filename
    const ext = isMp3 ? 'mp3' : 'mp4';
    
    res.json({
      success: true,
      platform: spec.key,
      platform_name: spec.name,
      title: result.filename,
      filename: result.filename,
      quality: requestedFormat,
      quality_selected: requestedFormat,
      option_requested: requestedFormat,
      downloader_used: 'yt-dlp',
      download_url: `/api/file/${result.filename}`,
      file_url: `/api/file/${result.filename}`,
      file_size: format_size(result.size),
    });
  } catch (err) {
    console.error('Download file error:', err);
    res.status(502).json({ error: "download_error", message: err.message || "Download failed." });
  }
});

router.get('/api/file/:filename', (req, res) => {
  const filename = path.basename(req.params.filename); // Path traversal prevention
  const downloadsDir = path.join(__dirname, '..', '..', 'downloads');
  const filePath = path.join(downloadsDir, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found or expired.');
  }

  res.download(filePath, filename, (err) => {
    if (err) {
      console.error('Error sending file:', err);
    }
  });
});

router.get('/api/v1/proxy-download', (req, res) => {
  const url = req.query.url;
  let filename = req.query.filename || 'media';

  if (!is_valid_url(url)) {
    return res.status(400).send('A valid absolute URL is required.');
  }

  if (url.includes('youtube.com/') || url.includes('youtu.be/')) {
    return res.status(400).send('YouTube files must be downloaded through the server download button.');
  }

  const isMp3 = filename.endsWith('.mp3');
  const safeName = encodeURIComponent(path.basename(filename));

  const client = url.startsWith('https') ? https : http;
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept': '*/*'
  };

  if (url.includes('cdninstagram.com') || url.includes('fbcdn.net')) {
    headers['Referer'] = 'https://www.instagram.com/';
    headers['Origin'] = 'https://www.instagram.com/';
  }

  client.get(url, { headers }, (upstream) => {
    if (upstream.statusCode >= 400) {
      return res.redirect(url);
    }

    res.setHeader('Content-Disposition', `attachment; filename*=utf-8''${safeName}`);
    res.setHeader('Content-Type', isMp3 ? 'audio/mpeg' : 'video/mp4');
    res.setHeader('Cache-Control', 'no-store');

    upstream.pipe(res);
  }).on('error', (err) => {
    console.error('Proxy error:', err);
    res.redirect(url);
  });
});

module.exports = router;
