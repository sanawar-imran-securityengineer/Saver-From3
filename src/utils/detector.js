const { URL } = require('url');
const { PLATFORMS } = require('./platforms');

function normalize_url(raw_url) {
  let trimmed = (raw_url || "").trim();
  if (!trimmed) {
    return "";
  }
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    trimmed = "https://" + trimmed;
  }
  return trimmed;
}

function detect_platform(raw_url) {
  if (!raw_url || !raw_url.trim()) {
    return { platform_key: null, error: "URL cannot be empty." };
  }

  const url = normalize_url(raw_url);
  let hostname = "";
  try {
    const parsedUrl = new URL(url);
    hostname = (parsedUrl.hostname || "").toLowerCase();
  } catch (error) {
    return { platform_key: null, error: "Invalid URL format." };
  }

  if (!hostname) {
    return { platform_key: null, error: "Could not determine hostname from URL." };
  }

  for (const spec of PLATFORMS) {
    if (spec.regex.test(url)) {
      return { platform_key: spec.key, error: null };
    }
  }

  return { 
    platform_key: null, 
    error: "Unsupported video URL. Please provide a link from a supported platform." 
  };
}

module.exports = {
  normalize_url,
  detect_platform
};
