const fs = require('fs');

const file = 'tics/notebook.html';
let html = fs.readFileSync(file, 'utf8');

// 1. Add stPageFlip library to head
html = html.replace('</head>', `
<script src="https://cdn.jsdelivr.net/npm/page-flip/dist/js/page-flip.browser.min.js"></script>
<style>
/* NOTEBOOK STYLES */
body { overflow: hidden; background: #000; display: flex; align-items: center; justify-content: center; height: 100vh; }
#book-wrapper { width: 100%; height: 100vh; display: flex; align-items: center; justify-content: center; }
#book { display: none; } /* hidden until init */
.page { background: var(--dark); border-right: 1px solid rgba(0,212,255,0.1); overflow: hidden; box-shadow: inset -10px 0 20px rgba(0,0,0,0.5); }
[data-theme="light"] .page { background: #f0f2ff; border-right: 1px solid rgba(0,85,204,0.1); box-shadow: inset -10px 0 20px rgba(0,0,0,0.1); }
.page.-left { border-right: none; border-left: 1px solid rgba(0,212,255,0.1); box-shadow: inset 10px 0 20px rgba(0,0,0,0.5); }
[data-theme="light"] .page.-left { border-left: 1px solid rgba(0,85,204,0.1); box-shadow: inset 10px 0 20px rgba(0,0,0,0.1); }

.page-content { width: 100%; height: 100%; padding: 2rem; overflow-y: auto; overflow-x: hidden; }
.page-content::-webkit-scrollbar { width: 4px; }
.page-content::-webkit-scrollbar-thumb { background: var(--cyan); border-radius: 2px; }

/* Adjust sections inside pages to fit and look like pages */
section { padding: 2rem 0 !important; min-height: auto !important; }
.hero-title { font-size: clamp(1.8rem, 4vw, 3rem) !important; }
.section-title { font-size: clamp(1.5rem, 3vw, 2.5rem) !important; }
.hp-title { font-size: 1.2rem !important; }
.hscroll-outer { height: auto !important; }
.hscroll-sticky { position: relative !important; height: auto !important; }
.hscroll-track { transform: none !important; display: flex; flex-direction: column; width: 100% !important; padding:0 !important; gap: 1rem !important; }
.hscroll-panel { width: 100% !important; max-width: none !important; padding: 1.5rem !important; }
nav { display: none !important; } /* Hide nav inside book or overlay it */
#canvas-bg { display: none !important; } /* Disable background canvas to save performance */

/* Controls */
.book-controls { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); z-index: 9999; display: flex; gap: 10px; }
.book-btn { background: var(--dark2); border: 1px solid var(--cyan); color: var(--cyan); padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; font-family: var(--font-code); font-size: 0.8rem; }
.book-btn:hover { background: var(--cyan); color: #000; }
</style>
</head>`);

// 2. Wrap sections into pages
// First, wrap the entire body content in #book-wrapper and #book (except script tags at the bottom)
// We will replace `<section` with `<div class="page"><div class="page-content"><section`
// And `</section>` with `</section></div></div>`

// The `#hero` is a section. Let's make sure we wrap correctly.
html = html.replace(/<section\b[^>]*>([\s\S]*?)<\/section>/g, (match) => {
    return `<div class="page"><div class="page-content">${match}</div></div>`;
});

// We need to group all these pages inside `<div id="book">`
// Let's find the first `<div class="page">` and the last `</div></div>` (which is before `<script>`)
const firstPageIdx = html.indexOf('<div class="page">');
const scriptsIdx = html.lastIndexOf('<script'); // the scripts at the end

if (firstPageIdx !== -1 && scriptsIdx !== -1) {
    const before = html.substring(0, firstPageIdx);
    const pages = html.substring(firstPageIdx, scriptsIdx);
    const after = html.substring(scriptsIdx);
    
    html = before + 
           `\n<div id="book-wrapper"><div id="book">\n` + 
           // Add a cover page
           `<div class="page"><div class="page-content" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;">
             <h1 style="font-family:var(--font-tech);color:var(--cyan);font-size:3rem;margin-bottom:1rem;">TIC</h1>
             <p style="font-family:var(--font-code);color:var(--gray2);letter-spacing:0.3em;">MANUAL DEL ALUMNO</p>
             <p style="font-family:var(--font-code);color:var(--purple2);margin-top:2rem;font-size:0.8rem;">Arrastra la esquina o usa los botones para abrir</p>
           </div></div>\n` +
           pages + 
           // Add a back cover
           `<div class="page"><div class="page-content" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;">
             <div class="qr-canvas-wrap" style="margin:0 auto 2rem;"><img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://ceb54.online/tics/&bgcolor=0d0d22&color=00d4ff&margin=1" width="150" height="150" style="border-radius:6px;"></div>
             <p style="font-family:var(--font-code);color:var(--cyan);letter-spacing:0.2em;">CEB 5/4</p>
           </div></div>\n` +
           `</div></div>\n` + 
           `<div class="book-controls">
              <button class="book-btn" id="btn-prev">◀ Anterior</button>
              <button class="book-btn" id="btn-next">Siguiente ▶</button>
            </div>\n` +
           after;
}

// 3. Add init script
html = html.replace('</body>', `
<script>
document.addEventListener('DOMContentLoaded', function() {
    const bookEl = document.getElementById('book');
    bookEl.style.display = 'block'; // show it
    
    // Disable any interfering scroll animations from original script
    window.removeEventListener('scroll', null);
    
    const pageFlip = new St.PageFlip(bookEl, {
        width: 500, // base width
        height: 700, // base height
        size: "stretch",
        minWidth: 300,
        maxWidth: 600,
        minHeight: 400,
        maxHeight: 800,
        maxShadowOpacity: 0.5,
        showCover: true,
        mobileScrollSupport: false,
        useMouseEvents: true
    });

    // load pages
    pageFlip.loadFromHTML(document.querySelectorAll('.page'));

    document.getElementById('btn-prev').addEventListener('click', () => {
        pageFlip.flipPrev();
    });
    document.getElementById('btn-next').addEventListener('click', () => {
        pageFlip.flipNext();
    });
});
</script>
</body>`);

fs.writeFileSync(file, html);
console.log('Notebook transformations applied.');
