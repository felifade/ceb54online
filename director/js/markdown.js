// Parser Markdown → HTML minimalista, sin dependencias.
// Soporta lo necesario para resúmenes de estudio:
//   # H1, ## H2, ### H3
//   **negrita**, *cursiva*, `código`
//   - lista no ordenada (también • y *)
//   1. lista ordenada
//   > cita
//   [texto](url)
//   ---  (regla horizontal)
//   párrafos separados por línea en blanco
//
// Escapa HTML primero para evitar inyección.

import { escapeHtml } from "./app.js";

export function renderMarkdown(src) {
  if (!src) return "";
  // Normalizar saltos de línea
  let s = src.replace(/\r\n/g, "\n");

  // Dividir en bloques separados por línea(s) en blanco
  const blocks = s.split(/\n{2,}/);
  const out = [];

  for (const raw of blocks) {
    const block = raw.replace(/^\n+|\n+$/g, "");
    if (!block.trim()) continue;

    // Regla horizontal
    if (/^\s*(?:---|\*\*\*|___)\s*$/.test(block)) {
      out.push("<hr>");
      continue;
    }

    // Encabezados
    const h1 = block.match(/^# (.+)$/);
    const h2 = block.match(/^## (.+)$/);
    const h3 = block.match(/^### (.+)$/);
    if (h1) { out.push(`<h1>${inline(h1[1])}</h1>`); continue; }
    if (h2) { out.push(`<h2>${inline(h2[1])}</h2>`); continue; }
    if (h3) { out.push(`<h3>${inline(h3[1])}</h3>`); continue; }

    // Cita (todo el bloque empieza con > en cada línea)
    if (block.split("\n").every(l => /^>\s*/.test(l))) {
      const cleaned = block.split("\n").map(l => l.replace(/^>\s*/, "")).join("\n");
      out.push(`<blockquote>${inlineMulti(cleaned)}</blockquote>`);
      continue;
    }

    // Lista no ordenada
    if (block.split("\n").every(l => /^\s*[-*•]\s+/.test(l))) {
      const items = block.split("\n").map(l => l.replace(/^\s*[-*•]\s+/, "").trim());
      out.push("<ul>" + items.map(i => `<li>${inline(i)}</li>`).join("") + "</ul>");
      continue;
    }

    // Lista ordenada
    if (block.split("\n").every(l => /^\s*\d+\.\s+/.test(l))) {
      const items = block.split("\n").map(l => l.replace(/^\s*\d+\.\s+/, "").trim());
      out.push("<ol>" + items.map(i => `<li>${inline(i)}</li>`).join("") + "</ol>");
      continue;
    }

    // Párrafo normal: <br> entre líneas individuales
    out.push("<p>" + inlineMulti(block) + "</p>");
  }
  return out.join("\n");
}

function inlineMulti(s) {
  // <br> al final de cada línea (no en la última)
  return s.split("\n").map(inline).join("<br>");
}

function inline(s) {
  let html = escapeHtml(s);
  // Código `…` (procesar primero para que ** dentro no afecte)
  html = html.replace(/`([^`\n]+)`/g, "<code>$1</code>");
  // Enlaces [texto](url) — solo http(s) y rutas relativas
  html = html.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (m, text, url) => {
    const safe = /^(https?:|\/|#|mailto:|lector\.html|leer\.html|consultor\.html|simulacro\.html|estudiar\.html|mis-notas\.html|index\.html|buscar\.html)/.test(url);
    if (!safe) return m;
    const ext = /^https?:/.test(url);
    return `<a href="${url}"${ext ? ' target="_blank" rel="noopener"' : ""}>${text}</a>`;
  });
  // Negritas **…**
  html = html.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  // Cursivas *…* (que no sean parte de **)
  html = html.replace(/(?<![*\w])\*([^*\n]+)\*(?![*\w])/g, "<em>$1</em>");
  return html;
}
