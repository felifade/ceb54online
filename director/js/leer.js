// Lector "iBook" — texto extraído por página, con tipografía cuidada,
// modo claro/sepia/oscuro, ajustes de fuente, tabla de contenidos,
// subrayados con selección, notas por página y "continuar donde te quedaste".

import { loadCatalog, escapeHtml } from "./app.js";
import { storage } from "./storage.js";
import { bookmarkButton } from "./bookmark.js";
import { askClaude, hasApiKey, extractJson } from "./ai.js";

const $  = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

let CATALOG = null;
let DOC = null;
let DOC_PAGES = null; // { doc, pages: [{page, text}, ...] }
let _currentPage = 1;

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
          _currentPage = p;
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
    <span class="ibk-sel-sep"></span>
    <button data-action="flashcard" class="ibk-sel-fc" title="Crear flashcard a partir de la selección">→ FC</button>
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

  menu.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const txt = sel.toString().trim();
    const range = sel.getRangeAt(0);
    const pageEl = range.startContainer.parentElement?.closest(".reader-page");
    if (!pageEl) return;
    const page = parseInt(pageEl.dataset.page, 10);

    if (btn.dataset.action === "flashcard") {
      // Crear flashcard a partir de la selección (sin subrayar)
      sel.removeAllRanges();
      menu.style.display = "none";
      await createFlashcardFromText(txt, page, null);
      return;
    }

    // Subrayar normal
    storage.addHighlight(DOC.id, { page, text: txt, color: btn.dataset.color });
    sel.removeAllRanges();
    menu.style.display = "none";
    applyHighlights();
  });

  document.addEventListener("scroll", () => { menu.style.display = "none"; }, { passive: true });
}

// === RESUMEN IA por página ===
let _summaryBusy = false;

async function generateSummary(page) {
  if (_summaryBusy) return;
  if (!hasApiKey()) {
    alert("Falta tu API key. Ve a Consultor IA y configúrala primero.");
    return;
  }
  const cached = storage.getSummary(DOC.id, page);
  if (cached) {
    showSummaryPanel(page, cached.text, cached.generatedAt);
    return;
  }
  const pageData = DOC_PAGES.pages.find(p => p.page === page);
  if (!pageData || !pageData.text || pageData.text.trim().length < 50) {
    alert("Esta página no tiene texto suficiente para resumir.");
    return;
  }

  _summaryBusy = true;
  showSummaryPanel(page, "", null, /*loading=*/true);

  const system = `Eres "Consultor Director", asistente jurídico-pedagógico especializado en el examen de promoción a director de bachillerato (SEP). Tu tarea: producir resúmenes claros, breves y útiles para estudiar.

Formato obligatorio:
- 4 a 6 viñetas con guion (-)
- Máximo 100 palabras totales
- Cada viñeta: una idea concreta. Conserva términos técnicos.
- Resalta artículos/numerales/obligaciones clave con **negrita**.
- Si hay obligaciones, jerarquías o sanciones, hazlas explícitas.
- Sin introducción ni cierre. Sin "En resumen…". Solo viñetas.`;

  const userText = `Resume esta página de **${DOC.abbr}** — ${DOC.short || DOC.title}, página ${page}.

---
${pageData.text.trim()}
---`;

  try {
    const { text } = await askClaude({ system, userText, maxTokens: 400 });
    storage.saveSummary(DOC.id, page, text);
    showSummaryPanel(page, text, Date.now());
  } catch (e) {
    showSummaryPanel(page, `⚠️ Error: ${escapeHtml(e.message)}`, null);
  } finally {
    _summaryBusy = false;
  }
}

function showSummaryPanel(page, text, ts, loading = false) {
  const pageEl = document.getElementById(`page-${page}`);
  if (!pageEl) return;
  let panel = pageEl.querySelector(`.ibk-summary-panel`);
  if (!panel) {
    panel = document.createElement("div");
    panel.className = "ibk-summary-panel";
    // Insertar después del header (antes del .ibk-text)
    const headEl = pageEl.querySelector(".ibk-page-head");
    if (headEl) headEl.after(panel);
    else pageEl.prepend(panel);
  }
  if (loading) {
    panel.innerHTML = `
      <div class="ibk-sum-head">🪄 Resumen IA — página ${page}</div>
      <div class="ibk-sum-loading"><span class="spinner"></span> Generando resumen…</div>
    `;
    return;
  }
  const tsLine = ts
    ? `<span class="ibk-sum-ts">${new Date(ts).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}</span>`
    : "";
  panel.innerHTML = `
    <div class="ibk-sum-head">
      🪄 Resumen IA — página ${page}
      ${tsLine}
      <button class="ibk-sum-action" data-act="regen" title="Regenerar">↻</button>
      <button class="ibk-sum-action" data-act="close" title="Cerrar">×</button>
    </div>
    <div class="ibk-sum-body">${markdownLite(text)}</div>
  `;
  panel.querySelector('[data-act="regen"]')?.addEventListener("click", () => {
    storage.removeSummary(DOC.id, page);
    generateSummary(page);
  });
  panel.querySelector('[data-act="close"]')?.addEventListener("click", () => {
    panel.remove();
  });
}

// Renderiza **negrita** y - viñetas como HTML mínimo seguro.
function markdownLite(s) {
  if (!s) return "";
  const escaped = escapeHtml(s);
  // Convertir líneas que empiezan con - en lista
  const lines = escaped.split(/\r?\n/);
  const out = [];
  let inList = false;
  for (const line of lines) {
    const m = line.match(/^[\s]*[-•]\s+(.+)$/);
    if (m) {
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`<li>${boldify(m[1])}</li>`);
    } else {
      if (inList) { out.push("</ul>"); inList = false; }
      if (line.trim()) out.push(`<p>${boldify(line)}</p>`);
    }
  }
  if (inList) out.push("</ul>");
  return out.join("");
}
function boldify(s) {
  return s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

// === Flashcard desde selección ===
async function createFlashcardFromText(text, page, sourceHighlightId) {
  if (!hasApiKey()) {
    alert("Falta tu API key. Ve a Consultor IA y configúrala primero.");
    return;
  }
  // Modal de loading
  const modal = openFlashcardModal({ loading: true });

  const system = `Generas flashcards estilo Anki para estudiar el examen de promoción a director (SEP, bachillerato general).

Reglas:
- 1 flashcard por entrada.
- "front": pregunta clara y específica que sirva para evaluar memoria activa. Máx 18 palabras. SIN respuesta dentro.
- "back": respuesta breve y precisa. Máx 35 palabras. Conserva términos técnicos. Si aplica cita el artículo/numeral.
- Devuelve EXACTAMENTE un objeto JSON: {"front": "...", "back": "..."}.
- Sin markdown, sin texto fuera del JSON, sin comentarios.`;

  const userText = `Genera 1 flashcard a partir de este texto subrayado del documento ${DOC.abbr} (${DOC.short || DOC.title}), página ${page}.

Texto:
"""
${text}
"""

Devuelve solo el JSON.`;

  try {
    const { text: raw } = await askClaude({ system, userText, maxTokens: 400 });
    const parsed = extractJson(raw);
    if (!parsed || !parsed.front || !parsed.back) {
      throw new Error("No pude generar la flashcard. Intenta con un texto más claro.");
    }
    openFlashcardModal({
      front: parsed.front,
      back: parsed.back,
      page,
      sourceText: text,
      sourceHighlightId,
      modal,
    });
  } catch (e) {
    modal.querySelector(".fc-modal-body").innerHTML = `<p style="color:var(--danger)">⚠️ ${escapeHtml(e.message)}</p>`;
  }
}

function openFlashcardModal(opts) {
  let modal = document.querySelector(".fc-modal-overlay");
  if (modal) modal.remove();
  modal = document.createElement("div");
  modal.className = "fc-modal-overlay";
  modal.innerHTML = `
    <div class="fc-modal">
      <div class="fc-modal-head">
        <span>📇 Nueva flashcard</span>
        <button class="fc-modal-close" aria-label="Cerrar">×</button>
      </div>
      <div class="fc-modal-body">
        ${opts.loading
          ? `<div class="ibk-sum-loading"><span class="spinner"></span> Generando con IA…</div>`
          : flashcardForm(opts)
        }
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector(".fc-modal-close").onclick = () => modal.remove();
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });

  if (!opts.loading) bindFlashcardForm(modal, opts);
  return modal;
}

function flashcardForm(opts) {
  return `
    <label class="fc-field">
      <span>Pregunta (front)</span>
      <textarea class="fc-front" rows="2">${escapeHtml(opts.front || "")}</textarea>
    </label>
    <label class="fc-field">
      <span>Respuesta (back)</span>
      <textarea class="fc-back" rows="3">${escapeHtml(opts.back || "")}</textarea>
    </label>
    <details class="fc-source">
      <summary>Fuente: ${DOC.abbr} p.${opts.page} — texto original</summary>
      <p class="fc-src-text">${escapeHtml(opts.sourceText || "")}</p>
    </details>
    <div class="fc-modal-actions">
      <button class="dir-btn-secondary" data-act="cancel">Cancelar</button>
      <button class="dir-btn-primary" data-act="save">Guardar flashcard</button>
    </div>
  `;
}

function bindFlashcardForm(modal, opts) {
  modal.querySelector('[data-act="cancel"]').onclick = () => modal.remove();
  modal.querySelector('[data-act="save"]').onclick = () => {
    const front = modal.querySelector(".fc-front").value.trim();
    const back  = modal.querySelector(".fc-back").value.trim();
    if (!front || !back) {
      alert("Completa pregunta y respuesta.");
      return;
    }
    storage.addFlashcard(DOC.id, {
      page: opts.page,
      front,
      back,
      sourceText: opts.sourceText,
      sourceHighlightId: opts.sourceHighlightId || null,
    });
    modal.remove();
    showToast("📇 Flashcard guardada — repásala en Mi Estudio → Repaso");
  };
}

function showToast(msg) {
  const t = document.createElement("div");
  t.className = "ibk-toast";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add("show"), 10);
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 3500);
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

  // Resumen IA de la página actual
  $("#btn-summary").onclick = () => {
    const page = _currentPage || parseInt($("#current-page").textContent.split("/")[0], 10) || 1;
    // Si ya hay panel abierto en esta página, hacer scroll a él
    const existing = document.querySelector(`#page-${page} .ibk-summary-panel`);
    if (existing) { existing.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    generateSummary(page);
  };

  // Renderizar resúmenes ya guardados al cargar una página visible (lazy)
  setTimeout(() => {
    document.querySelectorAll(".reader-page").forEach(pageEl => {
      const p = parseInt(pageEl.dataset.page, 10);
      const cached = storage.getSummary(DOC.id, p);
      if (cached) showSummaryPanel(p, cached.text, cached.generatedAt);
    });
  }, 100);
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
