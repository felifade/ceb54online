// Subrayar texto del resumen renderizado directamente con el dedo / Apple Pencil.
// Modifica el Markdown subyacente del resumen (storage.setMyResume) en lugar de
// añadir highlights aparte — así la marca persiste y se exporta con el texto.
//
// Funciona como el menú de selección del lector iBook (selectionchange + touchend
// + pointerdown) para que iOS no colapse la selección al tocar el menú.

import { storage } from "./storage.js";

const MENU_HTML = `
  <button data-format="bold"      title="Negrita"   class="ibk-sel-fmt"><b>B</b></button>
  <button data-format="italic"    title="Cursiva"   class="ibk-sel-fmt"><i>I</i></button>
  <button data-format="underline" title="Subrayado" class="ibk-sel-fmt"><u>U</u></button>
  <span class="ibk-sel-sep"></span>
  <button data-color="yellow" title="Marcar amarillo" style="background:#fff3a0">A</button>
  <button data-color="green"  title="Marcar verde"   style="background:#c8e6c9">A</button>
  <button data-color="blue"   title="Marcar azul"    style="background:#bbdefb">A</button>
  <button data-color="pink"   title="Marcar rosa"    style="background:#f8bbd0">A</button>
  <button data-action="off" title="Quitar marca" class="ibk-sel-off">⌫</button>
`;

let _menu = null;

function ensureMenu() {
  if (_menu) return _menu;
  _menu = document.createElement("div");
  _menu.className = "ibk-sel-menu";
  _menu.style.display = "none";
  _menu.innerHTML = MENU_HTML;
  document.body.appendChild(_menu);
  return _menu;
}

/**
 * Activar el subrayado por selección dentro del banner del resumen.
 * @param {object} opts
 * @param {HTMLElement} opts.container  — el .my-summary-body que renderiza el resumen
 * @param {object} opts.doc             — entrada del catálogo {id, abbr, ...}
 * @param {function} opts.onChange      — callback para re-renderizar el banner
 */
export function setupSummaryMarker({ container, doc, onChange }) {
  const menu = ensureMenu();
  let lastCaptured = null;
  let selTimer = null;

  function captureSelection() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return null;
    const txt = sel.toString().trim();
    if (txt.length < 2) return null;
    const range = sel.getRangeAt(0);
    // Verificar que la selección esté dentro del container
    if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) return null;
    return { text: txt, rect: range.getBoundingClientRect() };
  }

  function showMenuFor(captured) {
    if (!captured) { menu.style.display = "none"; return; }
    lastCaptured = captured;
    menu.style.display = "flex";
    const mw = menu.offsetWidth || 200;
    const mh = menu.offsetHeight || 40;
    const r = captured.rect;
    let left = r.left + r.width / 2 - mw / 2;
    left = Math.max(8, Math.min(window.innerWidth - mw - 8, left));
    let top;
    if (r.top > mh + 16) {
      top = r.top - mh - 8 + window.scrollY;
    } else {
      top = r.bottom + 8 + window.scrollY;
    }
    menu.style.left = `${left}px`;
    menu.style.top  = `${top}px`;
  }

  // selectionchange: la única forma confiable de detectar selección con dedo en iOS
  const onSelChange = () => {
    clearTimeout(selTimer);
    selTimer = setTimeout(() => showMenuFor(captureSelection()), 250);
  };
  document.addEventListener("selectionchange", onSelChange);

  // Mouse y touch como respaldo
  const onMouseUp = () => setTimeout(() => showMenuFor(captureSelection()), 10);
  const onTouchEnd = () => setTimeout(() => showMenuFor(captureSelection()), 50);
  document.addEventListener("mouseup", onMouseUp);
  document.addEventListener("touchend", onTouchEnd, { passive: true });

  // pointerdown en menú: evita que iOS colapse la selección al tocar
  const onMenuPointerDown = (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const captured = lastCaptured || captureSelection();
    if (!captured) return;

    const md = storage.getMyResume(doc.id);
    let newMd = null;

    if (btn.dataset.action === "off") {
      newMd = removeMarkAroundSelection(md, captured.text);
      if (!newMd) {
        flashMessage(menu, "Sin marca");
        return;
      }
    } else if (btn.dataset.format) {
      // Toggle de formato (negrita, cursiva, subrayado)
      newMd = toggleFormat(md, captured.text, btn.dataset.format);
      if (!newMd) {
        flashMessage(menu, "No se ubicó");
        return;
      }
    } else {
      const color = btn.dataset.color || "yellow";
      newMd = applyMarkToSelection(md, captured.text, color);
      if (!newMd) {
        flashMessage(menu, "No se ubicó");
        return;
      }
    }

    storage.setMyResume(doc.id, newMd);
    window.getSelection()?.removeAllRanges();
    lastCaptured = null;
    menu.style.display = "none";
    if (onChange) onChange();
  };
  menu.addEventListener("pointerdown", onMenuPointerDown);

  // Ocultar al hacer scroll
  let lastScroll = window.scrollY;
  const onScroll = () => {
    if (Math.abs(window.scrollY - lastScroll) > 30) {
      menu.style.display = "none";
      lastScroll = window.scrollY;
    }
  };
  document.addEventListener("scroll", onScroll, { passive: true });

  // Devolver función de teardown (cuando el banner se re-renderiza, los listeners
  // del documento siguen vivos pero ya no apuntan al container viejo — no problema
  // porque captureSelection valida el container actual)
  return () => {
    document.removeEventListener("selectionchange", onSelChange);
    document.removeEventListener("mouseup", onMouseUp);
    document.removeEventListener("touchend", onTouchEnd);
    document.removeEventListener("scroll", onScroll);
  };
}

// === Lógica de mapping selección → markdown ===

const MARK_COLORS = ["yellow", "green", "blue", "pink"];

/**
 * Aplica una marca de color al texto seleccionado, modificando el markdown.
 * Estrategia:
 *  1. Match exacto en el markdown (caso simple: selección sin formato)
 *  2. Match tolerante en una versión "limpia" del markdown (sin **, *, ==, etc.)
 *  3. Si la selección ya está marcada con OTRO color, cambia el color
 *  4. Devuelve null si no se pudo ubicar el texto
 */
export function applyMarkToSelection(markdown, selectionText, color) {
  if (!selectionText || !markdown) return null;
  const wrap = (s) => color === "yellow" ? `==${s}==` : `=={${color}}${s}==`;

  // Caso especial: la selección ya está envuelta en una marca → cambiar color
  const reExisting = new RegExp(
    `==(?:\\{(?:yellow|green|blue|pink)\\})?(${escapeRegex(selectionText)})==`,
    ""
  );
  const m = markdown.match(reExisting);
  if (m && m.index !== undefined) {
    return markdown.slice(0, m.index) + wrap(m[1]) + markdown.slice(m.index + m[0].length);
  }

  // Match exacto (selección de texto que aparece literal en el markdown)
  const exactIdx = markdown.indexOf(selectionText);
  if (exactIdx !== -1) {
    return markdown.slice(0, exactIdx) + wrap(selectionText) + markdown.slice(exactIdx + selectionText.length);
  }

  // Match tolerante: limpiar markdown y buscar
  const result = findInCleanMarkdown(markdown, selectionText);
  if (!result) return null;
  const { startPos, endPos } = result;
  return markdown.slice(0, startPos) + wrap(markdown.slice(startPos, endPos)) + markdown.slice(endPos);
}

/**
 * Aplica o quita un formato (bold/italic/underline) a la selección.
 * Si la selección ya está envuelta en ese formato → desenvuelve (toggle off).
 * Si no → envuelve.
 *
 * Wrappers:
 *   bold      → **texto**
 *   italic    → *texto*
 *   underline → __texto__   (custom; HTML <u>)
 */
export function toggleFormat(markdown, selectionText, format) {
  if (!selectionText || !markdown) return null;
  const W = {
    bold:      { open: "**", close: "**" },
    italic:    { open: "*",  close: "*"  },
    underline: { open: "__", close: "__" },
  }[format];
  if (!W) return null;

  const wrap = (s) => W.open + s + W.close;

  // 1) Match exacto + verificar si ya está envuelto inmediatamente alrededor
  const idx = markdown.indexOf(selectionText);
  if (idx !== -1) {
    const before = markdown.slice(Math.max(0, idx - W.open.length), idx);
    const after  = markdown.slice(idx + selectionText.length, idx + selectionText.length + W.close.length);
    if (before === W.open && after === W.close) {
      // Toggle OFF: quitar los marcadores que rodean
      return markdown.slice(0, idx - W.open.length)
        + selectionText
        + markdown.slice(idx + selectionText.length + W.close.length);
    }
    // Wrappear normal
    return markdown.slice(0, idx) + wrap(selectionText) + markdown.slice(idx + selectionText.length);
  }

  // 2) ¿La selección incluye ya los marcadores? (ej. "**texto**" seleccionado)
  const wrapped = wrap(selectionText);
  const wIdx = markdown.indexOf(wrapped);
  if (wIdx !== -1) {
    return markdown.slice(0, wIdx) + selectionText + markdown.slice(wIdx + wrapped.length);
  }

  // 3) Match tolerante (selección a través de formateadores)
  const result = findInCleanMarkdown(markdown, selectionText);
  if (!result) return null;
  const { startPos, endPos } = result;

  // Verificar si en el markdown original ya está envuelto
  const before = markdown.slice(Math.max(0, startPos - W.open.length), startPos);
  const after  = markdown.slice(endPos, endPos + W.close.length);
  if (before === W.open && after === W.close) {
    return markdown.slice(0, startPos - W.open.length)
      + markdown.slice(startPos, endPos)
      + markdown.slice(endPos + W.close.length);
  }

  return markdown.slice(0, startPos) + wrap(markdown.slice(startPos, endPos)) + markdown.slice(endPos);
}

/**
 * Quita la marca que contiene la selección (o la primera marca cuyo contenido
 * coincida total/parcialmente con la selección).
 * Devuelve null si no había marca que quitar.
 */
export function removeMarkAroundSelection(markdown, selectionText) {
  if (!markdown) return null;
  const sel = normalizeWs(selectionText);
  const reMark = /==(?:\{(?:yellow|green|blue|pink)\})?([^=\n]+?)==/g;

  let modified = false;
  const result = markdown.replace(reMark, (full, content) => {
    const c = normalizeWs(content);
    if (c === sel || c.includes(sel) || sel.includes(c)) {
      modified = true;
      return content;
    }
    return full;
  });
  return modified ? result : null;
}

// === Helpers ===

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeWs(s) {
  return (s || "").trim().replace(/\s+/g, " ");
}

/**
 * Busca `target` en una versión "limpia" del markdown (sin marcadores) y
 * devuelve las posiciones {startPos, endPos} en el markdown ORIGINAL.
 * El matching ignora espacios múltiples y marcadores Markdown comunes.
 */
function findInCleanMarkdown(markdown, target) {
  const sel = normalizeWs(target);
  if (!sel) return null;

  // Recorremos el markdown char por char saltando marcadores y normalizando whitespace,
  // manteniendo positions[i] = posición en markdown original del i-ésimo char "limpio".
  const cleanChars = [];
  const positions = [];
  let i = 0;
  let lastWasSpace = false;

  while (i < markdown.length) {
    const c = markdown[i];

    // ** (negritas)
    if (c === "*" && markdown[i + 1] === "*") { i += 2; continue; }

    // __ (subrayado custom)
    if (c === "_" && markdown[i + 1] === "_") { i += 2; continue; }

    // ==(?:{color})? subrayador
    if (c === "=" && markdown[i + 1] === "=") {
      i += 2;
      if (markdown[i] === "{") {
        const end = markdown.indexOf("}", i);
        if (end !== -1) i = end + 1;
      }
      continue;
    }

    // ` código
    if (c === "`") { i++; continue; }

    // * cursiva (sólo si no forma parte de **)
    if (c === "*" && markdown[i - 1] !== "*" && markdown[i + 1] !== "*") { i++; continue; }

    // Whitespace: colapsar en un solo espacio
    if (/\s/.test(c)) {
      if (!lastWasSpace) {
        cleanChars.push(" ");
        positions.push(i);
        lastWasSpace = true;
      }
      i++;
      continue;
    }

    cleanChars.push(c);
    positions.push(i);
    lastWasSpace = false;
    i++;
  }

  const clean = cleanChars.join("");
  // Búsqueda case-insensitive, pero conservando la ubicación exacta
  const idx = clean.toLowerCase().indexOf(sel.toLowerCase());
  if (idx === -1) return null;

  const startPos = positions[idx];
  const endPos = positions[idx + sel.length - 1] + 1;

  // Sanity: ambos índices deben caer dentro
  if (startPos == null || endPos == null) return null;
  return { startPos, endPos };
}

// Mostrar mensaje breve sobre el menú
function flashMessage(menu, msg) {
  const original = menu.innerHTML;
  menu.innerHTML = `<span style="font-size:0.75rem;color:var(--ink-3);padding:0 0.5rem">${msg}</span>`;
  setTimeout(() => { menu.innerHTML = original; menu.style.display = "none"; }, 900);
}
