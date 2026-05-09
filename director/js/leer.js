// Lector "iBook" — texto extraído por página, con tipografía cuidada,
// modo claro/sepia/oscuro, ajustes de fuente, tabla de contenidos,
// subrayados con selección, notas por página y "continuar donde te quedaste".

import { loadCatalog, escapeHtml } from "./app.js";
import { storage } from "./storage.js";
import { bookmarkButton } from "./bookmark.js";

const $  = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

let CATALOG = null;
let DOC = null;
let DOC_PAGES = null; // { doc, pages: [{page, text}, ...] }

function getParams() {
  const u = new URL(location.href);
  return {
    id:   parseInt(u.searchParams.get("id")   || "0", 10),
    page: parseInt(u.searchParams.get("page") || "0", 10), // 0 = continuar / página 1
  };
}

// === Carga del documento ===
async function loadDoc(id) {
  const r = await fetch(`data/pages/${id}.json`);
  if (!r.ok) throw new Error(`No se pudo cargar el doc ${id}`);
  return r.json();
}

// === Render del párrafo ===
// Heurística suave para reconstruir párrafos a partir del texto -layout de pdftotext.
function paragraphsFromPage(text) {
  if (!text) return [];
  // Normaliza saltos: 2+ \n = nuevo párrafo, 1 \n dentro de párrafo = espacio
  const blocks = text
    .replace(/[ \t]+\n/g, "\n")          // limpiar trailing whitespace
    .split(/\n{2,}/)
    .map(b => b.trim())
    .filter(Boolean);

  return blocks.map(block => {
    // Si parece un encabezado: todas mayúsculas + corto, o "Artículo N." al inicio
    const lines = block.split("\n").map(l => l.trim()).filter(Boolean);
    const joined = lines.join(" ");
    // Listas: si las líneas empiezan con I./II./a)/-/•, mostrar como lista
    const looksLikeList = lines.length >= 2 &&
      lines.every(l => /^([IVXLCDM]+\.|[a-z]\)|[0-9]+\.|[•\-–])/.test(l));
    return {
      type: looksLikeList ? "list" : detectHeading(joined),
      text: joined,
      raw: block,
      lines,
    };
  });
}

function detectHeading(line) {
  // "Artículo X" / "ARTÍCULO X." / "CAPÍTULO N" / "TÍTULO N"
  if (/^(art[íi]culo|cap[íi]tulo|t[íi]tulo|secci[óo]n|fracci[óo]n)\s+[IVXLCDM0-9]+/i.test(line)) return "heading";
  // Línea corta TODA EN MAYÚSCULAS
  const letters = line.replace(/[^A-ZÁÉÍÓÚÑa-záéíóúñ ]/g, "");
  if (letters.length > 0 && letters.length < 90 && letters === letters.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(letters)) {
    return "heading";
  }
  return "p";
}

// === Render de una página ===
function renderPage(pageNumber) {
  const pageData = DOC_PAGES.pages.find(p => p.page === pageNumber);
  if (!pageData) {
    return `<div class="reader-page"><p class="muted">Página ${pageNumber} no encontrada.</p></div>`;
  }
  const paragraphs = paragraphsFromPage(pageData.text);
  // Render
  const html = paragraphs.map((p, i) => {
    const data = `data-page="${pageNumber}" data-para="${i}"`;
    if (p.type === "heading") {
      return `<h3 class="ibk-h" ${data}>${escapeHtml(p.text)}</h3>`;
    }
    if (p.type === "list") {
      return `<ul class="ibk-list" ${data}>${p.lines.map(l => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`;
    }
    return `<p class="ibk-p" ${data}>${escapeHtml(p.text)}</p>`;
  }).join("");

  // Notas existentes para esta página
  const note = storage.getNote(DOC.id, pageNumber);
  const noteHtml = `
    <div class="ibk-note-box" data-page="${pageNumber}">
      <details ${note ? "open" : ""}>
        <summary>📝 Mis notas (página ${pageNumber}) ${note ? "✓" : ""}</summary>
        <textarea
          class="ibk-note-input"
          data-page="${pageNumber}"
          placeholder="Anota aquí lo que quieras recordar de esta página…"
          rows="3">${escapeHtml(note)}</textarea>
      </details>
    </div>
  `;

  return `
    <article class="reader-page" id="page-${pageNumber}" data-page="${pageNumber}">
      <header class="ibk-page-head">
        <span class="ibk-page-num">Página ${pageNumber}</span>
        <div class="ibk-page-actions" id="ibk-bm-${pageNumber}"></div>
      </header>
      <div class="ibk-text">${html || `<p class="muted">(página vacía)</p>`}</div>
      ${noteHtml}
    </article>
  `;
}

// === Render del lector completo ===
function renderReader(startPage) {
  const main = $("#leer-main");
  // Render de TODAS las páginas seguidas (scroll continuo, como un libro)
  main.innerHTML = DOC_PAGES.pages.map(p => renderPage(p.page)).join("");

  // Insertar botones de marcador en cada página
  DOC_PAGES.pages.forEach(p => {
    const slot = $(`#ibk-bm-${p.page}`);
    if (slot) slot.appendChild(bookmarkButton({ doc: DOC.id, page: p.page, size: "sm" }));
  });

  // Wire up notas (auto-save al perder foco o con debounce)
  $$(".ibk-note-input").forEach(ta => {
    let t;
    ta.addEventListener("input", () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const page = parseInt(ta.dataset.page, 10);
        storage.setNote(DOC.id, page, ta.value);
        // Update label
        const summary = ta.closest("details").querySelector("summary");
        const has = ta.value.trim().length > 0;
        summary.innerHTML = `📝 Mis notas (página ${page}) ${has ? "✓" : ""}`;
      }, 600);
    });
  });

  // Apply highlights guardados
  applyHighlights();

  // Scroll inicial
  if (startPage > 1) {
    requestAnimationFrame(() => {
      const el = $(`#page-${startPage}`);
      if (el) el.scrollIntoView({ behavior: "instant", block: "start" });
    });
  }

  // Tracking de página actual con IntersectionObserver
  setupCurrentPageObserver();
}

// === Tabla de contenidos (TOC) ===
function renderTOC() {
  const toc = $("#toc-list");
  // TOC = lista de páginas con detección de encabezados destacados
  const items = DOC_PAGES.pages.map(p => {
    const paras = paragraphsFromPage(p.text);
    const heading = paras.find(x => x.type === "heading");
    return {
      page: p.page,
      label: heading ? heading.text.slice(0, 80) : `Página ${p.page}`,
      hasHeading: !!heading,
    };
  });
  toc.innerHTML = items.map(it => `
    <li>
      <a href="#page-${it.page}" data-page="${it.page}" class="toc-link${it.hasHeading ? " toc-h" : ""}">
        <span class="toc-page">${it.page}</span>
        <span class="toc-label">${escapeHtml(it.label)}</span>
      </a>
    </li>
  `).join("");
  // Click → scroll suave + actualizar URL
  toc.querySelectorAll(".toc-link").forEach(a => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const page = parseInt(a.dataset.page, 10);
      const el = $(`#page-${page}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      const u = new URL(location.href);
      u.searchParams.set("page", page);
      history.replaceState({}, "", u);
    });
  });
}

function setupCurrentPageObserver() {
  // Resaltar la página actual en el TOC + actualizar progreso al hacer scroll
  let currentPage = null;
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
        const p = parseInt(entry.target.dataset.page, 10);
        if (p !== currentPage) {
          currentPage = p;
          // Update TOC active
          $$(".toc-link").forEach(a => a.classList.toggle("active",
            parseInt(a.dataset.page, 10) === p));
          // Update URL (silencioso)
          const u = new URL(location.href);
          u.searchParams.set("page", p);
          history.replaceState({}, "", u);
          // Marcar progreso
          storage.setProgress(DOC.id, p);
          // Update title pill
          $("#current-page").textContent = `${p} / ${DOC.pages}`;
        }
      }
    });
  }, { threshold: [0.5] });
  $$(".reader-page").forEach(el => obs.observe(el));
}

// === Subrayados con selección de texto ===
function setupHighlightMenu() {
  const menu = document.createElement("div");
  menu.className = "ibk-sel-menu";
  menu.style.display = "none";
  menu.innerHTML = `
    <button data-color="yellow" title="Subrayar amarillo" style="background:#fff3a0">A</button>
    <button data-color="green"  title="Subrayar verde"   style="background:#c8e6c9">A</button>
    <button data-color="blue"   title="Subrayar azul"    style="background:#bbdefb">A</button>
    <button data-color="pink"   title="Subrayar rosa"    style="background:#f8bbd0">A</button>
  `;
  document.body.appendChild(menu);

  document.addEventListener("mouseup", () => {
    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) { menu.style.display = "none"; return; }
      const txt = sel.toString().trim();
      if (txt.length < 3) { menu.style.display = "none"; return; }
      // Verificar que la selección esté dentro de una página del lector
      const range = sel.getRangeAt(0);
      const pageEl = range.startContainer.parentElement?.closest(".reader-page");
      if (!pageEl) { menu.style.display = "none"; return; }
      const rect = range.getBoundingClientRect();
      menu.style.display = "flex";
      menu.style.left = `${Math.max(8, rect.left + rect.width / 2 - menu.offsetWidth / 2)}px`;
      menu.style.top = `${Math.max(8, rect.top - menu.offsetHeight - 8 + window.scrollY)}px`;
    }, 10);
  });

  menu.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const txt = sel.toString().trim();
    const range = sel.getRangeAt(0);
    const pageEl = range.startContainer.parentElement?.closest(".reader-page");
    if (!pageEl) return;
    const page = parseInt(pageEl.dataset.page, 10);
    storage.addHighlight(DOC.id, { page, text: txt, color: btn.dataset.color });
    sel.removeAllRanges();
    menu.style.display = "none";
    applyHighlights();
  });

  document.addEventListener("scroll", () => { menu.style.display = "none"; }, { passive: true });
}

function applyHighlights() {
  const all = storage.getHighlights(DOC.id);
  if (all.length === 0) return;
  // Para cada highlight, buscar su texto en la página y rodearlo
  // Estrategia simple: reemplazar la primera ocurrencia del text en innerHTML de la página
  const byPage = {};
  all.forEach(h => { (byPage[h.page] ||= []).push(h); });
  Object.entries(byPage).forEach(([page, hs]) => {
    const pageEl = $(`#page-${page} .ibk-text`);
    if (!pageEl) return;
    hs.forEach(h => {
      // Evitar re-aplicar
      if (pageEl.querySelector(`mark[data-hid="${h.id}"]`)) return;
      const safeText = h.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(safeText.replace(/\s+/g, "\\s+"), "u");
      walkAndWrap(pageEl, re, h);
    });
  });
}

function walkAndWrap(root, re, h) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const m = node.nodeValue.match(re);
    if (m) {
      const span = document.createElement("mark");
      span.className = `hl hl-${h.color || "yellow"}`;
      span.dataset.hid = h.id;
      span.title = "Doble clic para quitar";
      span.textContent = m[0];
      const after = node.splitText(m.index);
      after.nodeValue = after.nodeValue.slice(m[0].length);
      node.parentNode.insertBefore(span, after);
      span.addEventListener("dblclick", () => {
        if (confirm("¿Quitar este subrayado?")) {
          storage.removeHighlight(DOC.id, h.id);
          // Reemplazar el span por su texto plano
          const t = document.createTextNode(span.textContent);
          span.replaceWith(t);
        }
      });
      return;
    }
  }
}

// === Toolbar: tema, tamaño, navegación ===
function setupToolbar() {
  // Tema
  const theme = storage.getSetting("reader.theme", "light");
  applyTheme(theme);
  $("#btn-theme").onclick = () => {
    const cur = storage.getSetting("reader.theme", "light");
    const next = { light: "sepia", sepia: "dark", dark: "light" }[cur] || "light";
    storage.setSetting("reader.theme", next);
    applyTheme(next);
  };

  // Tamaño de fuente
  const fs = storage.getSetting("reader.fontSize", 18);
  applyFontSize(fs);
  $("#btn-font-up").onclick = () => {
    const cur = storage.getSetting("reader.fontSize", 18);
    const next = Math.min(28, cur + 2);
    storage.setSetting("reader.fontSize", next);
    applyFontSize(next);
  };
  $("#btn-font-down").onclick = () => {
    const cur = storage.getSetting("reader.fontSize", 18);
    const next = Math.max(13, cur - 2);
    storage.setSetting("reader.fontSize", next);
    applyFontSize(next);
  };

  // TOC toggle (mobile)
  $("#btn-toc-toggle").onclick = () => {
    $("#toc-aside").classList.toggle("open");
  };

  // Volver al PDF
  $("#btn-pdf").href = `lector.html?id=${DOC.id}`;
}

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  const labels = { light: "☀️", sepia: "🟡", dark: "🌙" };
  $("#btn-theme").textContent = labels[theme] || "☀️";
}

function applyFontSize(px) {
  document.documentElement.style.setProperty("--ibk-fs", `${px}px`);
  $("#font-pill").textContent = `${px}px`;
}

// === Bootstrap ===
async function init() {
  await storage.init();
  CATALOG = await loadCatalog();

  const params = getParams();
  DOC = CATALOG.documents.find(d => d.id === params.id);
  if (!DOC) {
    document.body.innerHTML = `
      <main class="dir-main"><h1 class="page-title">Documento no encontrado</h1>
      <p><a href="index.html">← Volver al catálogo</a></p></main>`;
    return;
  }

  document.title = `${DOC.abbr} · Lector iBook`;
  $("#doc-title").textContent = DOC.short || DOC.title;
  const cat = CATALOG.categories[DOC.category];
  $("#doc-abbr").textContent = DOC.abbr;
  $("#doc-abbr").style.color = cat.color;
  $("#doc-abbr").style.background = cat.tint;
  document.documentElement.style.setProperty("--cat-color", cat.color);

  // Página inicial: ?page= o último progreso o 1
  const progress = storage.getProgress(DOC.id);
  const startPage = params.page || progress?.lastPage || 1;
  $("#current-page").textContent = `${startPage} / ${DOC.pages}`;

  // Cargar texto del documento
  $("#leer-main").innerHTML = `<p class="muted" style="text-align:center;padding:3rem"><span class="spinner"></span> Cargando texto…</p>`;
  try {
    DOC_PAGES = await loadDoc(DOC.id);
  } catch (e) {
    $("#leer-main").innerHTML = `<p style="color:var(--danger);padding:2rem">${e.message}</p>`;
    return;
  }

  setupToolbar();
  renderTOC();
  renderReader(startPage);
  setupHighlightMenu();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
