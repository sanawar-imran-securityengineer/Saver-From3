const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const apiRoutes = require('./src/routes/api');
const { PLATFORMS } = require('./src/utils/platforms');

const app = express();
const PORT = process.env.PORT || 3000;

// Security and optimization
app.use(helmet({
  contentSecurityPolicy: false, // Don't break frontend scripts
}));
app.use(cors());
app.use(compression());
app.use(express.json());

// Redirect HTTP to HTTPS & canonicalize www/non-www (if required, implemented loosely)
app.use((req, res, next) => {
  // Common Hostinger headers for HTTPS
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  // Skip this in local dev
  if (process.env.NODE_ENV === 'production' && !isSecure) {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
});

// Setup downloads directory and cleanup job
const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

// 30 minute cleanup
setInterval(() => {
  fs.readdir(downloadsDir, (err, files) => {
    if (err) return console.error('Cleanup read error:', err);
    const now = Date.now();
    files.forEach(file => {
      const filePath = path.join(downloadsDir, file);
      fs.stat(filePath, (err, stats) => {
        if (err) return;
        if (now - stats.mtimeMs > 30 * 60 * 1000) {
          fs.unlink(filePath, () => {});
        }
      });
    });
  });
}, 5 * 60 * 1000); // Check every 5 minutes

// API Routes
app.use('/', apiRoutes);

// SEO: Generate specific landing pages for platforms dynamically using index.html
// This allows the frontend to stay exactly the same, but we inject SEO tags server-side
app.get(['/:platform', '/:platform-video-downloader'], (req, res, next) => {
  const pKey = req.params.platform.replace('-video-downloader', '');
  const platform = PLATFORMS.find(p => p.key === pKey);
  
  if (platform) {
    try {
      const indexPath = path.join(__dirname, 'frontend', 'index.html');
      let html = fs.readFileSync(indexPath, 'utf8');
      
      // Inject SEO
      const title = `${platform.name} Video Downloader - Download ${platform.name} Videos Free`;
      const desc = `Free online ${platform.name} video downloader. Download ${platform.name} videos and audio quickly and securely in HD quality.`;
      
      html = html.replace(/<title>.*?<\/title>/i, `<title>${title}</title>`);
      html = html.replace(/<meta\s+name=["']description["'].*?>/i, `<meta name="description" content="${desc}">`);
      
      // FAQ and Heading injection (Simple H1 injection before the main container)
      const h1Tag = `<h1 style="text-align:center; padding: 20px;">${platform.name} Video Downloader</h1>`;
      html = html.replace(/<main.*?>/i, `$&${h1Tag}`);

      // Optionally inject an H1 or structured data here.
      const jsonLD = {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        "name": `${platform.name} Downloader`,
        "url": `https://${req.headers.host}/${req.params.platform}`,
        "applicationCategory": "MultimediaApplication",
        "operatingSystem": "All"
      };
      
      const scriptTag = `<script type="application/ld+json">${JSON.stringify(jsonLD)}</script></head>`;
      html = html.replace('</head>', scriptTag);
      
      return res.send(html);
    } catch (e) {
      console.error(e);
      // Fallback
    }
  }
  next();
});

// Serve static frontend
app.use(express.static(path.join(__dirname, 'frontend'), {
  maxAge: '1d'
}));

// Catch all for frontend routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
