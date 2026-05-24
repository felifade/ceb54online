const fs = require('fs');
const https = require('https');

const FONT_URL = "https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;900&family=Rajdhani:wght@300;400;500;600;700&family=JetBrains+Mono:wght@300;400;700&display=swap";
const QR_URL = "https://ceb54.online/tics/";
const QR_DARK_URL = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=1&data=${encodeURIComponent(QR_URL)}&bgcolor=0d0d22&color=00d4ff`;
const QR_LIGHT_URL = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=1&data=${encodeURIComponent(QR_URL)}&bgcolor=ffffff&color=0055cc`;

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";

function fetch(url, isBinary = false, headers = {}) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return resolve(fetch(res.headers.location, isBinary, headers));
            }
            if (res.statusCode !== 200) {
                return reject(new Error(`Failed to fetch ${url} (status: ${res.statusCode})`));
            }
            const chunks = [];
            res.on('data', d => chunks.push(d));
            res.on('end', () => {
                const buffer = Buffer.concat(chunks);
                resolve(isBinary ? buffer : buffer.toString('utf8'));
            });
        }).on('error', reject);
    });
}

async function run() {
    try {
        console.log("Fetching Google Fonts CSS...");
        let css = await fetch(FONT_URL, false, { 'User-Agent': USER_AGENT });
        
        console.log("Extracting and downloading font files...");
        const urlRegex = /url\((https:\/\/[^)]+)\)/g;
        let match;
        const fontDownloads = [];
        
        while ((match = urlRegex.exec(css)) !== null) {
            const fontUrl = match[1];
            fontDownloads.push((async () => {
                console.log("Downloading", fontUrl);
                const buffer = await fetch(fontUrl, true, { 'User-Agent': USER_AGENT });
                const b64 = buffer.toString('base64');
                return { url: fontUrl, base64: `data:font/woff2;charset=utf-8;base64,${b64}` };
            })());
        }
        
        const downloadedFonts = await Promise.all(fontDownloads);
        
        for (const font of downloadedFonts) {
            css = css.replace(font.url, font.base64);
        }
        
        console.log("Downloading QR Codes...");
        const qrDarkBuffer = await fetch(QR_DARK_URL, true);
        const qrDarkB64 = `data:image/png;base64,${qrDarkBuffer.toString('base64')}`;
        
        const qrLightBuffer = await fetch(QR_LIGHT_URL, true);
        const qrLightB64 = `data:image/png;base64,${qrLightBuffer.toString('base64')}`;
        
        console.log("Processing HTML...");
        let html = fs.readFileSync('tics/index.html', 'utf8');
        
        // Remove preconnects
        html = html.replace(/<link rel="preconnect"[^>]*>\n?/g, '');
        // Replace stylesheet link with inline styles
        html = html.replace(/<link href="https:\/\/fonts\.googleapis\.com\/css2[^>]*rel="stylesheet">/, `<style id="offline-fonts">\n${css}\n</style>`);
        
        // Replace QR Images in HTML
        html = html.replace(/src="https:\/\/api\.qrserver\.com[^"]*"/g, `src="${qrDarkB64}"`);
        
        // Replace QR Variables in JS
        html = html.replace(/const QR_DARK=QR_BASE[^;]+;/, `const QR_DARK='${qrDarkB64}';`);
        html = html.replace(/const QR_LIGHT=QR_BASE[^;]+;/, `const QR_LIGHT='${qrLightB64}';`);
        // Remove QR_BASE definition since we don't need it
        html = html.replace(/const QR_BASE=.*?\n/, '');
        
        fs.writeFileSync('tics/index-offline.html', html);
        console.log("Successfully created tics/index-offline.html !");
    } catch (e) {
        console.error("Error during offline build:", e);
    }
}

run();
