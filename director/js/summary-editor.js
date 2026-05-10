// Editor de resúmenes personales por documento.
// Modal a pantalla completa con toolbar de Markdown + preview en vivo.
// Se importa desde leer.html, lector.html y mis-notas.html.

import { storage } from "./storage.js";
import { renderMarkdown } from "./markdown.js";
import { escapeHtml } from "./app.js";

const $ = sel => document.querySelector(sel);

/**
 * Abre el editor de resumen para un documento.
 * @param {object} opts
 * @param {object} opts.doc       Entrada del catálogo {id, abbr, short, title, ...}
 * @param {function} [opts.onClose] Callback al cerrar (con o sin guardar).
 */
export function openSummaryEditor({ doc, onClose }) {
  const root = ensureRoot();
  const initialText = storage.getMyResume(doc.id);
  let currentText = initialText;
  let saveTimer = null;
  const persist = (immediate = false) => {
    clearTimeout(saveTimer);
    if (immediate) { storage.setMyResume(doc.id, currentText); return; }
    saveTimer = setTimeout(() => storage.setMyResume(doc.id, currentText), 700);
  };

  root.innerHTML = `
    <div class="modal-backdrop summary-editor-bg" id="se-bg">
      <div class="summary-editor" onclick="event.stopPropagation()">
        <header class="summary-editor-head">
          <div class="summary-editor-doc">
            <span class="se-abbr">${escapeHtml(doc.abbr)}</span>
            <h2>Mi resumen · ${escapeHtml(doc.short || doc.title)}</h2>
          </div>
          <div class="summary-editor-actions">
            <span class="se-status" id="se-status"></span>
            <button class="icon-btn" id="se-close" title="Cerrar (autosave)">×</button>
          </div>
        </header>

        <div class="summary-editor-toolbar">
          <button data-md="bold"      title="Negrita"><b>B</b></button>
          <button data-md="italic"    title="Cursiva"><i>I</i></button>
          <button data-md="underline" title="Subrayado"><u>U</u></button>
          <button data-md="h2"        title="Encabezado">H</button>
          <button data-md="ul"     title="Lista">• Lista</button>
          <button data-md="ol"     title="Lista numerada">1. Lista</button>
          <button data-md="quote"  title="Cita">❝</button>
          <button data-md="code"   title="Código">&lt;/&gt;</button>
          <button data-md="link"   title="Enlace">🔗</button>
          <span class="se-tb-sep"></span>
          <button data-md="mark-yellow" class="se-mark se-mark-yellow" title="Marcar amarillo">A</button>
          <button data-md="mark-green"  class="se-mark se-mark-green"  title="Marcar verde">A</button>
          <button data-md="mark-blue"   class="se-mark se-mark-blue"   title="Marcar azul">A</button>
          <button data-md="mark-pink"   class="se-mark se-mark-pink"   title="Marcar rosa">A</button>
          <button data-md="mark-off"    class="se-mark-off"            title="Quitar marca de la selección">⌫</button>
          <span class="se-spacer"></span>
          <button id="se-toggle-preview" title="Alternar vista" class="se-toggle">Editor / Preview</button>
        </div>

        <div class="summary-editor-pane" id="se-pane">
          <textarea
            id="se-textarea"
            class="summary-textarea"
            placeholder="Escribe tu resumen aquí. Soporta Markdown:&#10;# Encabezado&#10;**negrita**, *cursiva*, \`código\`&#10;- listas&#10;> citas&#10;[texto](leer.html?id=2&page=8)"
            spellcheck="true">${escapeHtml(initialText)}</textarea>
          <div class="summary-preview" id="se-preview"></div>
        </div>

        <footer class="summary-editor-foot">
          <span class="se-tip">💡 Markdown soportado · Autoguardado · ${initialText ? "Tu resumen ya está sincronizado con Drive si lo conectaste" : "Cuando lo guardes, se sincroniza con Drive si lo conectaste"}</span>
          <button class="btn btn-sm" id="se-clear">Borrar resumen</button>
        </footer>
      </div>
    </div>
  `;

  const ta = $("#se-textarea");
  const preview = $("#se-preview");
  const status = $("#se-status");
  const updatePreview = () => { preview.innerHTML = renderMarkdown(ta.value); };
  updatePreview();

  ta.addEventListener("input", () => {
    currentText = ta.value;
    updatePreview();
    status.textContent = "Guardando…";
    status.className = "se-status saving";
    persist();
    setTimeout(() => {
      status.textContent = "✓ Guardado";
      status.className = "se-status saved";
      setTimeout(() => { if (status.classList.contains("saved")) status.textContent = ""; }, 1500);
    }, 750);
  });

  // Toolbar handlers
  document.querySelectorAll(".summary-editor-toolbar [data-md]").forEach(btn => {
    btn.onclick = () => {
      applyMarkdownAction(ta, btn.dataset.md);
      currentText = ta.value;
      updatePreview();
      persist();
    };
  });

  // Toggle preview en mobile (split → solo editor o solo preview)
  let showing = "split";
  $("#se-toggle-preview").onclick = () => {
    const pane = $("#se-pane");
    showing = showing === "split" ? "preview" : showing === "preview" ? "editor" : "split";
    pane.dataset.view = showing;
  };

  $("#se-clear").onclick = () => {
    if (!confirm("¿Borrar este resumen? No se puede deshacer (en este dispositivo).")) return;
    ta.value = "";
    currentText = "";
    updatePreview();
    persist(true);
  };

  const close = () => {
    persist(true); // forzar guardado al cerrar
    root.innerHTML = "";
    if (onClose) onClose(currentText);
  };
  $("#se-close").onclick = close;
  $("#se-bg").onclick = close;
  document.addEventListener("keydown", function escClose(e) {
    if (e.key === "Escape") {
      document.removeEventListener("keydown", escClose);
      close();
    }
  });

  setTimeout(() => ta.focus(), 100);
}

function ensureRoot() {
  let root = document.getElementById("modal-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "modal-root";
    document.body.appendChild(root);
  }
  return root;
}

// === Inserciones de Markdown según botón ===
function applyMarkdownAction(ta, action) {
  const start = ta.selectionStart;
  const end   = ta.selectionEnd;
  const sel   = ta.value.slice(start, end);
  const before= ta.value.slice(0, start);
  const after = ta.value.slice(end);

  let prefix = "", suffix = "", placeholder = sel || "texto";
  let blockMode = false;

  switch (action) {
    case "bold":      prefix = "**"; suffix = "**"; placeholder = sel || "negrita"; break;
    case "italic":    prefix = "*";  suffix = "*";  placeholder = sel || "cursiva"; break;
    case "underline": prefix = "__"; suffix = "__"; placeholder = sel || "subrayado"; break;
    case "code":      prefix = "`";  suffix = "`";  placeholder = sel || "código"; break;
    case "h2":     prefix = "## ";    blockMode = true; placeholder = sel || "Encabezado"; break;
    case "quote":  prefix = "> ";     blockMode = true; placeholder = sel || "Cita"; break;
    case "ul":     prefix = "- ";     blockMode = true; placeholder = sel || "Elemento"; break;
    case "ol":     prefix = "1. ";    blockMode = true; placeholder = sel || "Elemento"; break;
    case "link": {
      const url = prompt("URL del enlace:", "https://");
      if (!url) return;
      ta.value = before + `[${sel || "texto"}](${url})` + after;
      ta.focus();
      const newPos = before.length + 1 + (sel || "texto").length;
      ta.setSelectionRange(start + 1, newPos);
      return;
    }
    // Marcas de color (subrayador) — sintaxis: ==texto== o =={color}texto==
    case "mark-yellow": prefix = "==";         suffix = "=="; placeholder = sel || "texto"; break;
    case "mark-green":  prefix = "=={green}";  suffix = "=="; placeholder = sel || "texto"; break;
    case "mark-blue":   prefix = "=={blue}";   suffix = "=="; placeholder = sel || "texto"; break;
    case "mark-pink":   prefix = "=={pink}";   suffix = "=="; placeholder = sel || "texto"; break;
    // Quitar marcas: limpia los ==…== dentro de la selección
    case "mark-off": {
      if (!sel) return; // necesita selección
      const cleaned = sel.replace(/==(?:\{(?:yellow|green|blue|pink)\})?([^=\n]+?)==/g, "$1");
      if (cleaned === sel) return; // no había marcas que quitar
      ta.value = before + cleaned + after;
      ta.focus();
      ta.setSelectionRange(start, start + cleaned.length);
      return;
    }
  }

  if (blockMode) {
    // Encontrar inicio de la línea actual
    const lineStart = before.lastIndexOf("\n") + 1;
    const lineHead = ta.value.slice(0, lineStart);
    const lineRest = ta.value.slice(lineStart, end);
    ta.value = lineHead + prefix + (lineRest || placeholder) + after;
    const ps = lineHead.length + prefix.length;
    ta.focus();
    ta.setSelectionRange(ps, ps + (lineRest || placeholder).length);
  } else {
    const inserted = prefix + placeholder + suffix;
    ta.value = before + inserted + after;
    ta.focus();
    const cursorStart = before.length + prefix.length;
    ta.setSelectionRange(cursorStart, cursorStart + placeholder.length);
  }
}
