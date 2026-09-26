(function (global) {
  function isYouTube(url) {
    return /(?:youtube\.com|youtu\.be|youtube-nocookie\.com)/i.test(url || "");
  }

  function isHttpMediaUrl(url) {
    return /^https?:\/\//i.test(url || "") && !/\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(url || "");
  }

  // Only YouTube MUST use server-side /download-file (signed CDN + bot checks).
  // All other platforms: prefer the real CDN URL so the server is only a
  // "resolver" — no long download, no 30–60s timeout, no big data through Hostinger.
  var SERVER_ONLY_PLATFORMS = ["youtube"];

  function errorText(data, fallback) {
    if (!data) return fallback;
    if (typeof data.detail === "string") return data.detail;
    if (Array.isArray(data.detail)) {
      return data.detail.map(function (item) { return item.msg || item; }).join(" ");
    }
    return data.message || data.error || fallback;
  }

  async function downloadToServer(sourceUrl, format) {
    const resp = await fetch("/api/v1/download-file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: sourceUrl, format: format || "best" }),
    });
    const data = await resp.json().catch(function () { return {}; });
    if (!resp.ok || data.success === false) {
      throw new Error(errorText(data, "Could not download this video."));
    }
    const fileUrl = data.file_url || data.download_url;
    if (!fileUrl) throw new Error("Download finished but no file was returned.");
    return fileUrl;
  }

  function triggerDirectDownload(cdnUrl, filename) {
    // Open the real CDN URL in a new tab / let the browser save it.
    // This bypasses server timeout, proxy bandwidth, and Hostinger limits.
    var link = document.createElement("a");
    link.href = cdnUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    if (filename) link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  global.saverfromAttachDownload = function (dlBtn, sourceUrl, format, filename, resolved) {
    if (!dlBtn) return;
    const label = dlBtn.textContent;
    const platform = (resolved && resolved.platform) || "";
    const rawHint = (resolved && (resolved.download_url || resolved.url || resolved.stream_url)) || "";

    // Decision order:
    // 1. YouTube (or explicit server_download_required) → server /download-file
    // 2. Valid CDN URL + not YouTube → DIRECT browser download (no proxy, no server stream)
    // 3. Fallback → proxy-download (last resort)
    const forceServer =
      !!(resolved && resolved.server_download_required) ||
      SERVER_ONLY_PLATFORMS.indexOf(platform) !== -1 ||
      isYouTube(sourceUrl);

    const canDirect =
      !forceServer &&
      isHttpMediaUrl(rawHint) &&
      (resolved && resolved.direct_download_ok !== false);

    if (canDirect) {
      // Direct CDN — server only resolved the URL; browser fetches the file.
      dlBtn.href = rawHint;
      dlBtn.setAttribute("target", "_blank");
      dlBtn.setAttribute("rel", "noopener noreferrer");
      dlBtn.setAttribute("download", filename || "video.mp4");
      dlBtn.onclick = function (event) {
        // Some CDNs ignore the download attribute cross-origin; force navigation.
        event.preventDefault();
        triggerDirectDownload(rawHint, filename || "video.mp4");
      };
      return;
    }

    if (!forceServer && isHttpMediaUrl(rawHint)) {
      // Soft fallback: still try proxy only if direct flag was false
      dlBtn.href =
        "/api/v1/proxy-download?url=" +
        encodeURIComponent(rawHint) +
        "&filename=" +
        encodeURIComponent(filename || "video.mp4");
      dlBtn.setAttribute("download", filename || "video.mp4");
      dlBtn.setAttribute("target", "_blank");
      dlBtn.onclick = null;
      return;
    }

    // Server-side download path (YouTube + when no usable CDN URL)
    dlBtn.removeAttribute("target");
    dlBtn.removeAttribute("download");
    dlBtn.href = "#download";
    dlBtn.onclick = async function (event) {
      event.preventDefault();
      if (dlBtn.dataset.busy === "1") return;
      dlBtn.dataset.busy = "1";
      dlBtn.textContent = "Preparing file\u2026";

      var slowPlatforms = ["instagram", "reddit", "threads", "facebook", "tiktok", "pinterest", "youtube"];
      var progressTimer = null;
      if (slowPlatforms.indexOf(platform) !== -1) {
        progressTimer = setTimeout(function () {
          if (dlBtn.dataset.busy === "1") {
            dlBtn.textContent = "Downloading & merging\u2026";
          }
        }, 5000);
      }

      try {
        const fileUrl = await downloadToServer(sourceUrl, format);
        const link = document.createElement("a");
        link.href = fileUrl;
        link.setAttribute("download", filename || "video.mp4");
        document.body.appendChild(link);
        link.click();
        link.remove();
      } catch (err) {
        // Last chance: if resolver gave a CDN URL, open it directly
        if (isHttpMediaUrl(rawHint) && !isYouTube(sourceUrl)) {
          triggerDirectDownload(rawHint, filename || "video.mp4");
        } else {
          const msg = err.message || "Download failed.";
          const box = document.getElementById("error-box") || document.getElementById("error-box-plat");
          const text = document.getElementById("error-msg") || document.getElementById("error-msg-plat");
          if (box && text) {
            text.textContent = msg;
            box.style.display = "flex";
          } else {
            alert(msg);
          }
        }
      } finally {
        if (progressTimer) clearTimeout(progressTimer);
        dlBtn.dataset.busy = "0";
        dlBtn.textContent = label;
      }
    };
  };
})(window);
