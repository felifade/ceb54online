// Botón de marcador ⭐ reutilizable.
// Crea un botón que toggle el marcador para (doc, page) y refleja el estado.

import { storage } from "./storage.js";

const ICON_OFF = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
const ICON_ON = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;

/**
 * @param {object} opts
 * @param {number} opts.doc      ID del documento
 * @param {number} opts.page     Página
 * @param {string} [opts.label]  Texto opcional ("Guardar", "")
 * @param {string} [opts.size]   "sm" | "md"
 * @returns {HTMLButtonElement}
 */
export function bookmarkButton({ doc, page, label = "", size = "md" }) {
  const btn = document.createElement("button");
  btn.className = "bookmark-btn" + (size === "sm" ? " sm" : "");
  btn.type = "button";
  btn.dataset.doc = doc;
  btn.dataset.page = page;
  btn.title = "Marcador";

  const update = () => {
    const on = storage.isBookmarked(doc, page);
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.title = on ? "Quitar marcador" : "Agregar marcador";
    btn.innerHTML = (on ? ICON_ON : ICON_OFF) + (label ? `<span>${label}</span>` : "");
  };
  update();

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    storage.toggleBookmark(doc, page);
    update();
    // Mini animación de feedback
    btn.classList.add("flash");
    setTimeout(() => btn.classList.remove("flash"), 350);
  });

  // Auto-actualizar si cambia el storage (otra pestaña/dispositivo)
  storage.on((event) => {
    if (event === "load" || event === "import" || event === "bookmark") update();
  });

  return btn;
}
