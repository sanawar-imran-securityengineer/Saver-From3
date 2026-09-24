# Hostinger Node.js Deployment Guide (Roman Urdu)

Yeh guide apko batayegi ke is Node.js Express based Video Downloader ko Hostinger shared hosting (ya kisi bhi Node.js supported platform) par kaise deploy karna hai.

## Step 1: Files aur Folders Tayyar Karna
1. Is repo ko ek ZIP file mein compress karein (ya apna GitHub repo Hostinger se connect karein).
2. Dhyan rakhein ke `node_modules`, `downloads/`, `bin/` aur `.env` files ZIP mein shamil na hon. Sirf source code aur `package.json` zaroori hain.

## Step 2: Hostinger hPanel Mein Node.js Setup
1. Hostinger **hPanel** mein login karein aur apni website ke **Manage** par click karein.
2. Sidebar se **Advanced** -> **Node.js App** (ya Node.js Selector) par jayein.
3. Ek nayi app create karein:
   - **Node.js Version**: `18.x` ya `20.x` select karein (is app ke liye Node 18+ zaroori hai).
   - **Application Mode**: `Production` set karein.
   - **Application Root**: Apni website ka root folder select karein (jaise `public_html/downloader`).
   - **Application URL**: Apni domain select karein.
   - **Application Startup File**: `server.js` likhein.
4. Agar Hostinger par PORT environment variable khud set na hota ho, to Environment variables section mein add karein: `PORT = 3000` (wese shared hosting par usually Passenger ya cPanel khud handle karta hai aur aapko PORT define karne ki zaroorat nahi padti, app automatically Hostinger ke internal port par bind ho jayegi).

## Step 3: Files Upload aur Install
1. **File Manager** ya **Git** ke zariye apni files server par upload karein application root directory mein.
2. Wapis **Node.js App** dashboard mein aakar **Run NPM Install** button par click karein.
3. **ZAROORI**: Jab aap `npm install` run karenge, to `package.json` ka `postinstall` script automatically chalega. Ye script GitHub se `yt-dlp` ka latest Linux binary download karega aur usko executable permissions dega (`chmod +x`). 
4. Verify karne ke liye File Manager mein check karein ke `bin/yt-dlp` file majood hai. Agar wahan EACCES ya permission ka error aaye, to terminal (SSH) se ya File Manager se file ki permissions `755` (Read, Write, Execute) kar dein.

## Step 4: App Start Karna
1. Sab kuch install hone ke baad, **Start App** par click karein.
2. Apni website open kar ke check karein ke UI show ho raha hai ya nahi.

## Step 5: SSL (HTTPS) aur Domain
1. Hamesha SSL (HTTPS) enable rakhein Hostinger ki settings se taake secure connection ho.
2. Express app khud HTTP se HTTPS par redirect karti hai. Canonical URLs (www vs non-www) ko bhi cPanel/hPanel ke redirects se set kiya ja sakta hai agar zaroorat mehsoos ho.

## Troubleshooting (Masle aur Hal)
1. **EACCES Error**: Agar `yt-dlp` chalne par Permission Denied ka error aata hai, to iska matlab binary executable nahi hai. SSH se login karke app root folder mein `chmod +x bin/yt-dlp` run karein.
2. **App Crash ho rahi hai**: Hostinger Node.js app logs (e.g. `stderr.log` ya `server.log`) ko check karein. Agar Hostinger memory limit cross kar deta hai, to VPS ya Render/Railway par host karne ka sochein.
3. **Downloads Fail / Timeout**: Shared hosting par aksar background processes ki execution limit 30 ya 60 seconds hoti hai. Agar large file yt-dlp ke through merge aur download ho rahi ho aur server us process ko kill kar de, to iska koi fix shared hosting par nahi hai siwaye limits badhane ki request karne ke. `yt-dlp` FFmpeg ke baghair merging nahi kar sakta. Agar Hostinger par FFmpeg available nahi hai, to app best single-file format degi (jaise video without sound ya alag audio) MP4 ke liye jo without merging ho. 
4. **Proxy Download Error**: Agar Hostinger remote proxy-stream block kare, to frontend par direct file link ka fallback option use karna padega.

## Important Note for Shared Hosting
Shared hosting Node.js apps ke liye lambay processes chalane ke liye nahi bani. Agar apko CPU/Memory timeouts aate hain kyunke yt-dlp (Khas tor par Instagram/Reddit/YouTube) resources consume karta hai, tab behtar hai backend ko Railway (railway.app) ya kisi VPS par chalayein aur usay apne Hostinger frontend se link kar dein.
