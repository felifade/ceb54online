// Repaso espaciado de flashcards (algoritmo SM-2 simplificado en storage.js)
// Cada sesión muestra todas las cards con due <= ahora.
// El usuario clica una calidad (0-3) → la card se reprograma.

import { loadCatalog, escapeHtml } from "./app.js";
import { storage } from "./storage.js";

const $ = sel => document.querySelector(sel);

let CATALOG = null;
let queue = [];      // Cola de cards pendientes en esta sesión
let current = null;  // Card actual mostrándose
let showingBack = false;
let stats = { reviewed: 0, byQuality: { 0: 0, 1: 0, 2: 0, 3: 0 } };

const QUALITY = [
  { q: 0, emoji: "😵", label: "Difícil",  color: "q-0" },
  { q: 1, emoji: "🙂", label: "Bien",     color: "q-1" },
  { q: 2, emoji: "😊", label: "Fácil",    color: "q-2" },
  { q: 3, emoji: "🎯", label: "Perfecto", color: "q-3" },
];

function previewNextInterval(card, quality) {
  // Misma lógica que storage.updateFlashcardReview, sin escribir
  if (quality === 0) return 1;
  const baseInterval = (card.reviews || 0) === 0 ? 1 : (card.interval || 1);
  return Math.max(1, Math.round(baseInterval * (card.ease || 2.5)));
}

function fmtDays(d) {
  if (d <= 1) return "1 día";
  if (d < 30) return `${d} días`;
  if (d < 365) return `${Math.round(d/30)} meses`;
  return `${(d/365).toFixed(1)} años`;
}

function getDocAbbr(docId) {
  const doc = CATALOG?.documents?.find(d => d.id === docId);
  return doc?.abbr || `Doc${docId}`;
}

function render() {
  const shell = $("#repaso-shell");

  if (!current && queue.length === 0) {
    // Pantalla inicial o final
    const total = storage.getFlashcards().length;
    const due = storage.getDueFlashcards().length;

    if (stats.reviewed > 0) {
      // Final de sesión
      shell.innerHTML = renderEnd();
      bindEnd();
      return;
    }

    if (total === 0) {
      shell.innerHTML = `
        <div class="repaso-empty">
          <div class="repaso-empty-emoji">📇</div>
          <h2>Aún no tienes flashcards</h2>
          <p>Subraya texto en el <a href="index.html">lector</a> y usa el botón <strong>→ FC</strong> para crear flashcards desde tus subrayados.</p>
        </div>`;
      return;
    }

    if (due === 0) {
      const next = storage.getFlashcards().reduce((m, c) => Math.min(m, c.due || Infinity), Infinity);
      const dt = isFinite(next) ? new Date(next) : null;
      shell.innerHTML = `
        <div class="repaso-empty">
          <div class="repaso-empty-emoji">✅</div>
          <h2>Todo al día</h2>
          <p>Tienes <strong>${total}</strong> flashcard${total !== 1 ? "s" : ""} en total. Ninguna está pendiente de repaso ahora.</p>
          ${dt ? `<p>Próximo repaso: <strong>${dt.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}</strong>.</p>` : ""}
          <p style="margin-top:1.5rem"><a href="index.html" class="dir-btn-primary" style="display:inline-block;text-decoration:none">← Volver al catálogo</a></p>
        </div>`;
      return;
    }

    // Iniciar sesión
    queue = [...storage.getDueFlashcards()].sort(() => Math.random() - 0.5);
    current = queue.shift();
    showingBack = false;
    render();
    return;
  }

  if (!current) return;

  const ab = getDocAbbr(current.doc);
  const totalSession = queue.length + 1; // current + restantes
  const reviewed = stats.reviewed;
  const totalAll = reviewed + totalSession;

  shell.innerHTML = `
    <div class="repaso-header">
      <h1>Repaso</h1>
      <div class="repaso-counter">${reviewed + 1} / ${totalAll} · ${queue.length} pendientes</div>
    </div>

    <div class="fc-card">
      <span class="fc-card-side-label">${showingBack ? "Respuesta" : "Pregunta"}</span>
      <span class="fc-card-source">${escapeHtml(ab)} p.${current.page || "?"}</span>
      <div class="fc-card-content ${showingBack ? "is-back" : ""}">
        ${escapeHtml(showingBack ? current.back : current.front)}
      </div>
    </div>

    ${showingBack
      ? `<div class="fc-actions">${QUALITY.map(q => {
          const days = q.q === 0 ? 1 : previewNextInterval(current, q.q);
          return `<button class="fc-btn-quality ${q.color}" data-q="${q.q}">
            <span class="fc-qty-emoji">${q.emoji}</span>
            <span class="fc-qty-label">${q.label}</span>
            <span class="fc-qty-days">+${fmtDays(days)}</span>
          </button>`;
        }).join("")}</div>`
      : `<button class="fc-show-back" id="show-back">Mostrar respuesta</button>`
    }

    <div style="text-align:center; margin-top:1.5rem; font-size:0.82rem; color:var(--muted);">
      <a href="mis-notas.html" style="color:inherit">← Mi Estudio</a>
    </div>
  `;

  if (!showingBack) {
    $("#show-back").onclick = () => { showingBack = true; render(); };
    document.addEventListener("keydown", spaceToReveal, { once: true });
  } else {
    document.querySelectorAll(".fc-btn-quality").forEach(btn => {
      btn.onclick = () => rate(parseInt(btn.dataset.q, 10));
    });
  }
}

function spaceToReveal(e) {
  if (e.code === "Space" && !showingBack) {
    e.preventDefault();
    showingBack = true;
    render();
  }
}

function rate(quality) {
  if (!current) return;
  storage.updateFlashcardReview(current.doc, current.id, quality);
  stats.reviewed++;
  stats.byQuality[quality]++;
  current = queue.shift() || null;
  showingBack = false;
  render();
}

function renderEnd() {
  const totalQ = stats.reviewed;
  const ok = stats.byQuality[1] + stats.byQuality[2] + stats.byQuality[3];
  const pct = totalQ > 0 ? Math.round(100 * ok / totalQ) : 0;
  return `
    <div class="repaso-empty">
      <div class="repaso-empty-emoji">🎉</div>
      <h2>Sesión terminada</h2>
      <p>Repasaste <strong>${totalQ}</strong> flashcard${totalQ !== 1 ? "s" : ""}.</p>
      <p style="margin-top:0.6rem">
        ${QUALITY.map(q => `<span style="display:inline-block;margin:0 .4rem;font-size:0.95rem">
          ${q.emoji} ${q.label}: <strong>${stats.byQuality[q.q]}</strong>
        </span>`).join("")}
      </p>
      <p style="margin-top:0.5rem;font-size:0.95rem">Acertaste el <strong>${pct}%</strong> sin marca de "Difícil".</p>
      <div style="margin-top:1.6rem; display:flex; gap:.6rem; justify-content:center; flex-wrap:wrap">
        <button class="dir-btn-primary" id="btn-again">Otra ronda</button>
        <a href="mis-notas.html" class="dir-btn-secondary" style="text-decoration:none">Mi Estudio</a>
      </div>
    </div>`;
}

function bindEnd() {
  $("#btn-again").onclick = () => {
    stats = { reviewed: 0, byQuality: { 0: 0, 1: 0, 2: 0, 3: 0 } };
    queue = [];
    current = null;
    render();
  };
}

async function init() {
  await storage.init();
  CATALOG = await loadCatalog();
  render();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
