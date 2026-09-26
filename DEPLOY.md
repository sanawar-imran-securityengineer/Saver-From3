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

### Internet pe download block / fail (localhost pe theek tha)
Sabse common problem. Wajah:
- YouTube / Instagram / Facebook shared hosting IP ko bot samajh kar block kar dete hain
- Pehle high concurrency (64-128 parallel connections) IP ban trigger karti thi
- FFmpeg missing hone se merge fail

**Is version mein already laga diye gaye fixes:**
- Production mode mein concurrency 4 tak limited
- Realistic browser User-Agent + headers
- Progressive formats prefer (bina FFmpeg ke bhi kaam)
- Better proxy Referer / Origin headers

**Hostinger pe zaroori:**
1. Root folder mein `.env` banao:
```
ENVIRONMENT=production
DEBUG=false
CORS_ORIGINS=*
DOWNLOADS_DIR=/home/YOUR_USER/domains/YOURDOMAIN.com/downloads
```
2. `downloads` folder banao (permissions 755)
3. Python app Restart karo
4. `pip install -U yt-dlp`

### EACCES / Permission Denied
Binary pe `chmod +x`, ya downloads folder writable nahi.

### App Crash / Timeout
Shared hosting 30-60s limit. Large videos ke liye VPS behtar.

### FFmpeg nahi hai
Shared pe aksar nahi milta. Ab progressive single-file formats prefer hote hain. High quality merge ke liye VPS + `apt install ffmpeg`.

## Important Note for Shared Hosting
Shared hosting long yt-dlp processes ke liye ideal nahi. Agar phir bhi IP block / timeout aaye:
- Backend Railway / Render / VPS pe chalao
- Frontend Hostinger pe rakho
- Ya pure project Hostinger VPS pe deploy karo (`deploy/hostinger_instructions.md`)
