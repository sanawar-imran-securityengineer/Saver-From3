const DEFAULT_OPTION_LABELS = {
  "360p": "360p SD",
  "480p": "480p",
  "720p": "720p HD",
  "1080p": "1080p Full HD",
  "1440p": "1440p QHD",
  "2160p": "2160p 4K",
  "4k": "4K UHD",
  "mp3": "Audio MP3",
  "best": "Best available",
};

const PLATFORMS_DATA = [
  {
    key: "youtube",
    name: "YouTube",
    icon: "/static/icons/youtube.svg",
    accent_color: "#FF0000",
    page: "youtube.html",
    host_patterns: [
      "^(?:https?://)?(?:[a-zA-Z0-9_\\-]+\\.)?(?:youtube\\.com|youtu\\.be|youtube-nocookie\\.com)"
    ],
    sample_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    formats: ["360p", "720p", "1080p", "1440p", "2160p", "mp3"],
    needs_ffmpeg: true,
  },
  {
    key: "tiktok",
    name: "TikTok",
    icon: "/static/icons/tiktok.svg",
    accent_color: "#010101",
    page: "tiktok.html",
    host_patterns: [
      "^(?:https?://)?(?:[a-zA-Z0-9_\\-]+\\.)?(?:tiktok\\.com|douyin\\.com)"
    ],
    sample_url: "https://www.tiktok.com/@tiktok/video/7106594312292453675",
    formats: ["best", "mp3"],
    options: [["best", "No Watermark MP4"], ["mp3", "Audio MP3"]],
  },
  {
    key: "instagram",
    name: "Instagram",
    icon: "/static/icons/instagram.svg",
    accent_color: "#E1306C",
    page: "instagram.html",
    host_patterns: [
      "^(?:https?://)?(?:[a-zA-Z0-9_\\-]+\\.)?(?:instagram\\.com|instagr\\.am)"
    ],
    sample_url: "https://www.instagram.com/reel/CtjoC2BNsB2/",
    formats: ["720p", "1080p", "mp3"],
  },
  {
    key: "facebook",
    name: "Facebook",
    icon: "/static/icons/facebook.svg",
    accent_color: "#1877F2",
    page: "facebook.html",
    host_patterns: [
      "^(?:https?://)?(?:[a-zA-Z0-9_\\-]+\\.)?(?:facebook\\.com|fb\\.watch|fb\\.com|fb\\.me)"
    ],
    sample_url: "https://www.facebook.com/watch/?v=10153231379946729",
    formats: ["360p", "720p", "1080p"],
  },
  {
    key: "twitter",
    name: "Twitter / X",
    icon: "/static/icons/twitter.svg",
    accent_color: "#1DA1F2",
    page: "twitter.html",
    host_patterns: [
      "^(?:https?://)?(?:[a-zA-Z0-9_\\-]+\\.)?(?:twitter\\.com|x\\.com|t\\.co)"
    ],
    sample_url: "https://twitter.com/i/status/1234567890123456789",
    formats: ["720p", "1080p", "mp3"],
  },
  {
    key: "pinterest",
    name: "Pinterest",
    icon: "/static/icons/pinterest.svg",
    accent_color: "#E60023",
    page: "pinterest.html",
    host_patterns: [
      "^(?:https?://)?(?:[a-zA-Z0-9_\\-]+\\.)?(?:pinterest\\.[a-z.]+|pin\\.it)"
    ],
    sample_url: "https://www.pinterest.com/pin/1234567890/",
    formats: ["best", "1080p", "mp3"],
    options: [["best", "Best available"], ["1080p", "1080p Full HD"], ["mp3", "Audio MP3"]],
  },
  {
    key: "reddit",
    name: "Reddit",
    icon: "/static/icons/reddit.svg",
    accent_color: "#FF4500",
    page: "reddit.html",
    host_patterns: [
      "^(?:https?://)?(?:[a-zA-Z0-9_\\-]+\\.)?(?:reddit\\.com|redd\\.it|v\\.redd\\.it)"
    ],
    sample_url: "https://www.reddit.com/r/aww/comments/xxxxxx/",
    formats: ["720p", "1080p", "mp3"],
    needs_ffmpeg: true,
  },
  {
    key: "snapchat",
    name: "Snapchat",
    icon: "/static/icons/snapchat.svg",
    accent_color: "#FFFC00",
    page: "snapchat.html",
    host_patterns: [
      "^(?:https?://)?(?:[a-zA-Z0-9_\\-]+\\.)?(?:snapchat\\.com)"
    ],
    sample_url: "https://www.snapchat.com/spotlight/xxxxxxxx",
    formats: ["720p", "1080p"],
  },
  {
    key: "threads",
    name: "Threads",
    icon: "/static/icons/threads.svg",
    accent_color: "#000000",
    page: "threads.html",
    host_patterns: [
      "^(?:https?://)?(?:[a-zA-Z0-9_\\-]+\\.)?(?:threads\\.net|threads\\.com)"
    ],
    sample_url: "https://www.threads.net/@zuck/post/xxxxxxxx",
    formats: ["720p", "1080p", "mp3"],
  },
  {
    key: "twitch",
    name: "Twitch",
    icon: "/static/icons/twitch.svg",
    accent_color: "#9146FF",
    page: "twitch.html",
    host_patterns: [
      "^(?:https?://)?(?:[a-zA-Z0-9_\\-]+\\.)?(?:twitch\\.tv|clips\\.twitch\\.tv)"
    ],
    sample_url: "https://www.twitch.tv/videos/1234567890",
    formats: ["720p", "1080p", "mp3"],
  },
];

class PlatformSpec {
  constructor(data) {
    this.key = data.key;
    this.name = data.name;
    this.icon = data.icon;
    this.accent_color = data.accent_color;
    this.page = data.page;
    this.host_patterns = data.host_patterns || [];
    this.sample_url = data.sample_url || "";
    this.formats = data.formats || [];
    this.options = data.options || null;
    this.needs_ffmpeg = data.needs_ffmpeg || false;
    
    const regexString = this.host_patterns.join('|');
    this.regex = new RegExp(regexString, 'i');
  }

  get option_pairs() {
    if (this.options) {
      return this.options;
    }
    return this.formats.map(fmt => [fmt, DEFAULT_OPTION_LABELS[fmt] || fmt]);
  }
}

const PLATFORMS = PLATFORMS_DATA.map(data => new PlatformSpec(data));
const PLATFORMS_BY_KEY = {};
PLATFORMS.forEach(spec => {
  PLATFORMS_BY_KEY[spec.key] = spec;
});

function get_platform(key) {
  const platform = PLATFORMS_BY_KEY[key];
  if (!platform) {
    throw new Error(`Unknown platform: ${key}`);
  }
  return platform;
}

module.exports = {
  PLATFORMS,
  PLATFORMS_BY_KEY,
  get_platform,
};
