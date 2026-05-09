// Plan de estudio + sesiones rápidas guiadas por IA.
// El plan se genera UNA vez (Claude analiza tus días disponibles y arma
// un calendario por día con temas, lecturas y prácticas). Cada sesión se
// marca completada y se ve el avance.
// "Sesión rápida" genera UN bloque de 5/15/30 min sobre el tema actual.

import { loadCatalog, escapeHtml } from "./app.js";
import { storage } from "./storage.js";

const $  = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

const STORAGE_KEY    = "dir-consultor-key";
const STORAGE_MODEL  = "dir-consultor-model";

let CATALOG = null;
let DOCS_BY_ABBR = {};
let ABORT = null;

// === System prompt para diseñar plan ===
function planSystemPrompt() {
  return `Eres un asesor pedagógico experto en el examen de promoción a director del CEB (SEP).

Tu tarea: diseñar un PLAN DE ESTUDIO personalizado basado en el tiempo disponible del usuario y las 16 fuentes oficiales.

LAS 16 FUENTES (ya catalogadas — usa estas abreviaturas exactas):
- CPEUM (403 pp) · Constitución Política
- LGE (82 pp) · Ley General de Educación
- LGRA (79 pp) · Ley Gral. de Responsabilidades Administrativas
- LGDNNA (97 pp) · Ley Gral. Derechos NNA
- LGAMVLV (88 pp) · Ley Gral. Acceso Mujeres Vida Libre Violencias
- MCCEMS-25 (68 pp) · Modelo Educativo 2025 (MCCEMS)
- AC-21/08/25 (17 pp) · Acuerdo MCCEMS DOF
- PAEC (32 pp) · Programa Aula Escuela Comunidad
- CT-1 (97 pp) · Curso-Taller acceso al conocimiento
- CT-2 (86 pp) · Curso-Taller recursos sociocognitivos
- PCAE (32 pp) · Protocolo Convivencia Armónica
- PRUE (51 pp) · Protocolo Revisión Útiles
- PSP (56 pp) · Protocolos Seguridad Plantel
- AC-04/07/23 (16 pp) · Código de Conducta SEP
- DCT (11 pp) · Declaratoria Cero Tolerancia
- LPMC-24 (19 pp) · Lineamientos Mejora Continua

REGLAS:
1. Distribuye el contenido en N días según el tiempo total disponible.
2. PRIORIZA por importancia para examen real: leyes (LGE, LGRA, LGDNNA, LGAMVLV, CPEUM art. 3), MCCEMS y casos prácticos. Lo demás como complemento.
3. Cada sesión diaria debe ser realista para el tiempo declarado (no incluyas 80 pp si solo hay 30 min).
4. Las primeras sesiones: bases legales (CPEUM, LGE). Luego MCCEMS. Luego protocolos. Reserva los últimos 2-3 días para repaso integrador + simulacros.
5. Cada sesión tiene: tema, fuentes a leer (con páginas si pertinente), 2-3 puntos clave que debe dominar, 1 ejercicio práctico (caso o pregunta).

FORMATO DE SALIDA — DEVUELVE SOLO JSON VÁLIDO, SIN MARKDOWN ni texto adicional.
NO uses fences \`\`\`json. NO uses comillas tipográficas. Escapa comillas internas con \\". Sin trailing commas.

{
  "summary": "Resumen del plan en 1-2 frases",
  "sessions": [
    {
      "day": 1,
      "title": "Bases constitucionales del derecho a la educación",
      "minutes": 30,
      "readings": [
        { "abbr": "CPEUM", "from": 8, "to": 14, "note": "Artículo 3°" },
        { "abbr": "LGE",   "from": 1, "to": 10, "note": "Capítulo I" }
      ],
      "keyPoints": [
        "El derecho a la educación es obligatorio, gratuito y laico (art. 3 CPEUM)",
        "Distinción entre rectoría del Estado y autonomía universitaria",
        "Principios del SEN según LGE art. 5"
      ],
      "exercise": {
        "kind": "caso",
        "prompt": "Como director, un padre solicita inscripción para su hija en el plantel pero no presenta acta de nacimiento. ¿Cómo procedes con base en CPEUM art. 3 y LGE?"
      }
    }
  ]
}`;
}

function planUserPrompt(days, minutesPerDay) {
  return `Diseña un plan de estudio para ${days} días con aproximadamente ${minutesPerDay} minutos diarios.

Total: ${days * minutesPerDay} minutos disponibles.

Devuelve SOLO el JSON con todas las sesiones.`;
}

// === Sesión rápida ===
function quickSessionSystem() {
  return `Eres un tutor experto en el examen de promoción a director del CEB. Genera UNA sesión de estudio breve y enfocada.

ABREVIATURAS DE LAS 16 FUENTES (úsalas exactas en citas):
CPEUM, LGE, LGRA, LGDNNA, LGAMVLV, MCCEMS-25, AC-21/08/25, PAEC, CT-1, CT-2, PCAE, PRUE, PSP, AC-04/07/23, DCT, LPMC-24

FORMATO: JSON único.
{
  "title": "Título",
  "intro": "Presentación del tema en 1-2 frases",
  "keyPoints": [
    { "point": "punto clave 1", "source": {"abbr":"LGE","page":12} },
    { "point": "punto clave 2", "source": {"abbr":"LGRA","page":45} }
  ],
  "exercise": {
    "kind": "caso" | "concepto",
    "prompt": "Pregunta o caso para resolver",
    "answer": "Respuesta esperada con cita explícita [ABBR p.X]"
  }
}

Tono: directo, didáctico. Cita SIEMPRE la fuente con [ABBR p.X].`;
}

function quickSessionUser(topic, minutes) {
  return `Genera una sesión de estudio de ~${minutes} minutos sobre: ${topic}

Si el tema es general ("repaso", "lo más importante"), elige tú el subtema más útil que aún no haya sido cubierto recientemente. Devuelve SOLO el JSON.`;
}

// === Llamada Anthropic ===
async function callAnthropic(system, userText, onProgress) {
  const apiKey = localStorage.getItem(STORAGE_KEY);
  const model = localStorage.getItem(STORAGE_MODEL) || "claude-haiku-4-5-20251001";
  if (!apiKey) throw new Error("Falta tu API key. Ve al Consultor IA para configurarla.");

  ABORT = new AbortController();
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: [{ type: "text", text: userText }] }],
      stream: true,
    }),
    signal: ABORT.signal,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => res.statusText);
    let p; try { p = JSON.parse(t); } catch {}
    throw new Error(p?.error?.message || t || `HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "", acc = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const events = buf.split("\n\n");
    buf = events.pop();
    for (const evt of events) {
      const dl = evt.split("\n").find(l => l.startsWith("data: "));
      if (!dl) continue;
      try {
        const j = JSON.parse(dl.slice(6));
        if (j.type === "content_block_delta" && j.delta?.type === "text_delta") {
          acc += j.delta.text;
          if (onProgress) onProgress(acc.length);
        }
      } catch {}
    }
  }
  ABORT = null;
  return acc;
}

function extractJson(s) {
  // Quitar fences markdown
  let cleaned = s.replace(/```(?:json)?\s*/gi, "").replace(/```\s*$/g, "").trim();
  // Encontrar { inicial y cerrar balanceado respetando strings
  const start = cleaned.indexOf("{");
  if (start === -1) throw new Error("Sin JSON en la respuesta");
  let depth = 0, inString = false, escape = false, end = -1;
  for (let i = start; i < cleaned.length; i++) {
    const c = cleaned[i];
    if (escape) { escape = false; continue; }
    if (c === "\\") { escape = true; continue; }
    if (c === '"')  { inString = !inString; continue; }
    if (inString) continue;
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end === -1) {
    cleaned += "}".repeat(Math.max(0, depth));
    end = cleaned.length - 1;
  }
  let candidate = cleaned.slice(start, end + 1)
    .replace(/,(\s*[\]}])/g, "$1")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
  try {
    return JSON.parse(candidate);
  } catch (e) {
    throw new Error(`${e.message}\n\nInicio: ${candidate.slice(0,200)}…\nFinal: …${candidate.slice(-200)}`);
  }
}

// === Render principal ===
function renderEntry() {
  const plan = storage.getPlan();
  $("#estudiar-shell").innerHTML = `
    <h1 class="page-title">Mi plan de estudio</h1>
    <p class="page-sub">Plan personalizado por IA basado en tus días disponibles y las 16 fuentes oficiales.</p>

    ${plan ? renderPlan(plan) : ""}

    <div class="study-grid">
      <div class="study-card">
        <h2>${plan ? "🔄 Rehacer el plan" : "📅 Crear plan"}</h2>
        <p>Te pregunto cuántos días tienes y cuánto tiempo diario, y la IA arma un plan dirigido.</p>
        <button class="btn btn-primary" id="btn-new-plan">${plan ? "Rehacer plan" : "Crear plan"}</button>
      </div>

      <div class="study-card">
        <h2>⚡ Sesión rápida</h2>
        <p>5, 15 o 30 minutos sobre el tema que elijas — o que la IA elija por ti. Sin compromiso.</p>
        <button class="btn btn-primary" id="btn-quick">Empezar ahora</button>
      </div>
    </div>

    <div class="study-card" style="margin-top: 1rem">
      <h2>🎯 Lo más útil para el examen</h2>
      <p>Acceso directo a recursos por orden de prioridad típica:</p>
      <ul class="study-shortcuts">
        <li><a href="leer.html?id=2">📖 CPEUM — Artículo 3 y siguientes</a></li>
        <li><a href="leer.html?id=3">📖 LGE — Ley General de Educación</a></li>
        <li><a href="leer.html?id=1">📖 LGRA — Responsabilidades del servidor público</a></li>
        <li><a href="leer.html?id=14">📖 MCCEMS — Modelo Educativo 2025</a></li>
        <li><a href="simulacro.html">🎯 Simulacro mixto</a></li>
        <li><a href="consultor.html">🤖 Pregúntale al consultor IA</a></li>
      </ul>
    </div>
  `;
  $("#btn-new-plan").onclick = openPlanModal;
  $("#btn-quick").onclick = openQuickModal;
}

function renderPlan(plan) {
  const total = plan.sessions.length;
  const done = plan.sessions.filter(s => s.doneAt).length;
  const pct = Math.round((done / total) * 100);
  return `
    <section class="plan-overview">
      <header class="plan-overview-head">
        <div>
          <h2>${escapeHtml(plan.summary || "Plan activo")}</h2>
          <p class="muted">Creado el ${new Date(plan.createdAt).toLocaleDateString("es-MX", {day:"numeric",month:"long",year:"numeric"})} · ${total} sesiones · ${done} completadas</p>
        </div>
        <div class="plan-progress-circle" style="--p:${pct}">
          <span>${pct}%</span>
        </div>
      </header>

      <div class="plan-sessions">
        ${plan.sessions.map((s, i) => `
          <article class="plan-session ${s.doneAt ? 'done' : ''} ${!s.doneAt && i === done ? 'next' : ''}" data-id="${s.id}">
            <header class="plan-session-head">
              <span class="plan-day">Día ${s.day}</span>
              <h3>${escapeHtml(s.title)}</h3>
              <span class="plan-min">${s.minutes} min</span>
              <button class="plan-toggle">▾</button>
            </header>
            <div class="plan-session-body">
              <div class="plan-readings">
                <strong>📖 Lecturas:</strong>
                <ul>
                  ${(s.readings || []).map(r => `
                    <li>
                      <a href="leer.html?id=${docIdByAbbr(r.abbr)}${r.from ? `&page=${r.from}` : ''}">
                        <strong>[${r.abbr}]</strong>
                        ${r.from && r.to ? `pp. ${r.from}-${r.to}` : ''}
                        ${r.note ? `· ${escapeHtml(r.note)}` : ''}
                      </a>
                    </li>
                  `).join("")}
                </ul>
              </div>
              <div class="plan-keypoints">
                <strong>🎯 Puntos clave:</strong>
                <ul>${(s.keyPoints || []).map(p => `<li>${escapeHtml(p)}</li>`).join("")}</ul>
              </div>
              ${s.exercise ? `
                <div class="plan-exercise">
                  <strong>📝 Ejercicio (${s.exercise.kind === "caso" ? "caso" : "concepto"}):</strong>
                  <p>${escapeHtml(s.exercise.prompt)}</p>
                </div>
              ` : ""}
              <div class="plan-session-actions">
                ${s.doneAt
                  ? `<span class="plan-done-mark">✓ Completada el ${new Date(s.doneAt).toLocaleDateString("es-MX",{day:"numeric",month:"short"})}</span>`
                  : `<button class="btn btn-sm btn-primary" data-mark="${s.id}">Marcar como completada</button>`
                }
                <a class="btn btn-sm" href="simulacro.html">🎯 Simulacro relacionado</a>
              </div>
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function docIdByAbbr(abbr) {
  return DOCS_BY_ABBR[abbr]?.id || "";
}

// Toggle expand/collapse + marcar completada
function wirePlanInteractions() {
  $$(".plan-toggle").forEach(t => {
    t.onclick = (e) => {
      e.stopPropagation();
      const session = t.closest(".plan-session");
      session.classList.toggle("expanded");
      t.textContent = session.classList.contains("expanded") ? "▴" : "▾";
    };
  });
  $$(".plan-session-head").forEach(h => {
    h.onclick = () => h.querySelector(".plan-toggle")?.click();
  });
  $$("[data-mark]").forEach(b => {
    b.onclick = (e) => {
      e.stopPropagation();
      storage.markSessionDone(b.dataset.mark);
      renderEntry();
      wirePlanInteractions();
    };
  });
  // Auto-expandir la próxima sesión
  const nextSession = document.querySelector(".plan-session.next");
  if (nextSession) {
    nextSession.classList.add("expanded");
    nextSession.querySelector(".plan-toggle").textContent = "▴";
  }
}

// === Modal de creación de plan ===
function openPlanModal() {
  $("#modal-root").innerHTML = `
    <div class="modal-backdrop" id="bg">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h2>Crear plan de estudio</h2>
          <button class="close" id="x">×</button>
        </div>
        <div class="modal-body">
          <p>Te pregunto dos cosas y la IA arma el plan completo.</p>
          <label for="days">¿Cuántos días tienes hasta el examen?</label>
          <input type="number" id="days" min="3" max="60" value="14">

          <label for="mins">¿Cuántos minutos al día puedes estudiar?</label>
          <select id="mins">
            <option value="20">20 minutos (mínimo)</option>
            <option value="30" selected>30 minutos (estándar)</option>
            <option value="60">60 minutos</option>
            <option value="90">90 minutos (intensivo)</option>
          </select>
          <p class="hint">Al generar, se reemplaza tu plan actual (si tenías uno).</p>
        </div>
        <div class="modal-footer">
          <button class="btn" id="cancel">Cancelar</button>
          <button class="btn btn-primary" id="go">Generar plan →</button>
        </div>
      </div>
    </div>
  `;
  const close = () => { $("#modal-root").innerHTML = ""; };
  $("#x").onclick = close; $("#cancel").onclick = close; $("#bg").onclick = close;
  $("#go").onclick = async () => {
    const days = parseInt($("#days").value, 10) || 14;
    const mins = parseInt($("#mins").value, 10) || 30;
    close();
    await generatePlan(days, mins);
  };
}

async function generatePlan(days, minutesPerDay) {
  $("#estudiar-shell").innerHTML = `
    <div class="sim-loading">
      <h2>Diseñando tu plan…</h2>
      <p class="muted" id="status">Pidiendo a Claude que organice ${days} días × ${minutesPerDay} min…</p>
      <div class="spinner-big"><span class="spinner"></span></div>
      <button class="btn btn-sm" id="cx">Cancelar</button>
    </div>
  `;
  $("#cx").onclick = () => { ABORT?.abort(); renderEntry(); };
  try {
    const raw = await callAnthropic(
      planSystemPrompt(),
      planUserPrompt(days, minutesPerDay),
      (n) => { $("#status").textContent = `Generando plan… (${n} caracteres)`; }
    );
    const parsed = extractJson(raw);
    if (!parsed.sessions?.length) throw new Error("La IA no generó sesiones válidas");

    const plan = {
      createdAt: Date.now(),
      target: { days, minutesPerDay },
      summary: parsed.summary || "",
      sessions: parsed.sessions.map((s, i) => ({
        id: `s${i + 1}-${Date.now()}`,
        day: s.day || (i + 1),
        title: s.title || `Sesión ${i + 1}`,
        minutes: s.minutes || minutesPerDay,
        readings: s.readings || [],
        keyPoints: s.keyPoints || [],
        exercise: s.exercise || null,
        doneAt: null,
      })),
    };
    storage.setPlan(plan);
    renderEntry();
    wirePlanInteractions();
  } catch (e) {
    if (e.name === "AbortError") return;
    $("#estudiar-shell").innerHTML = `
      <div class="sim-error">
        <h2>Algo salió mal</h2>
        <p>${escapeHtml(e.message)}</p>
        <button class="btn" id="back">← Volver</button>
      </div>
    `;
    $("#back").onclick = renderEntry;
  }
}

// === Modal de sesión rápida ===
function openQuickModal() {
  $("#modal-root").innerHTML = `
    <div class="modal-backdrop" id="bg">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h2>Sesión rápida</h2>
          <button class="close" id="x">×</button>
        </div>
        <div class="modal-body">
          <label for="topic">¿Sobre qué quieres repasar?</label>
          <input type="text" id="topic" placeholder='Ej: "interés superior", "responsabilidades del director", "lo más importante"' autocomplete="off">
          <p class="hint">Si lo dejas en blanco o escribes "lo más importante", la IA elige.</p>

          <label for="mins">Duración</label>
          <select id="mins">
            <option value="5">☕ 5 min — píldora rápida</option>
            <option value="15" selected>📚 15 min — sesión estándar</option>
            <option value="30">🎯 30 min — profundización</option>
          </select>
        </div>
        <div class="modal-footer">
          <button class="btn" id="cancel">Cancelar</button>
          <button class="btn btn-primary" id="go">Generar →</button>
        </div>
      </div>
    </div>
  `;
  const close = () => { $("#modal-root").innerHTML = ""; };
  $("#x").onclick = close; $("#cancel").onclick = close; $("#bg").onclick = close;
  $("#go").onclick = async () => {
    const topic = $("#topic").value.trim() || "lo más importante para el examen";
    const mins = parseInt($("#mins").value, 10) || 15;
    close();
    await generateQuickSession(topic, mins);
  };
  setTimeout(() => $("#topic").focus(), 50);
}

async function generateQuickSession(topic, minutes) {
  $("#estudiar-shell").innerHTML = `
    <div class="sim-loading">
      <h2>Preparando sesión sobre "${escapeHtml(topic)}"…</h2>
      <p class="muted" id="status">Pidiendo a Claude…</p>
      <div class="spinner-big"><span class="spinner"></span></div>
      <button class="btn btn-sm" id="cx">Cancelar</button>
    </div>
  `;
  $("#cx").onclick = () => { ABORT?.abort(); renderEntry(); };
  try {
    const raw = await callAnthropic(
      quickSessionSystem(),
      quickSessionUser(topic, minutes),
      (n) => { $("#status").textContent = `Generando… (${n} caracteres)`; }
    );
    const s = extractJson(raw);
    renderQuickSession(s, topic, minutes);
  } catch (e) {
    if (e.name === "AbortError") return;
    $("#estudiar-shell").innerHTML = `
      <div class="sim-error">
        <h2>Algo salió mal</h2>
        <p>${escapeHtml(e.message)}</p>
        <button class="btn" id="back">← Volver</button>
      </div>
    `;
    $("#back").onclick = renderEntry;
  }
}

function renderQuickSession(s, topic, mins) {
  const linkSrc = (src) => src ? `<a class="cite" href="lector.html?id=${docIdByAbbr(src.abbr)}&page=${src.page}" target="_blank">[${src.abbr} p.${src.page}]</a>` : "";

  $("#estudiar-shell").innerHTML = `
    <div class="quick-session">
      <header>
        <a href="estudiar.html" class="back-link">← Plan de estudio</a>
        <span class="quick-meta">⚡ Sesión ${mins} min · "${escapeHtml(topic)}"</span>
      </header>
      <h1>${escapeHtml(s.title || "Sesión")}</h1>
      ${s.intro ? `<p class="quick-intro">${escapeHtml(s.intro)}</p>` : ""}

      <section class="quick-block">
        <h2>🎯 Puntos clave</h2>
        <ul>
          ${(s.keyPoints || []).map(kp => `
            <li>
              <span>${escapeHtml(kp.point || kp)}</span>
              ${linkSrc(kp.source)}
            </li>
          `).join("")}
        </ul>
      </section>

      ${s.exercise ? `
        <section class="quick-block">
          <h2>📝 Ejercicio: ${s.exercise.kind === "caso" ? "Caso práctico" : "Concepto"}</h2>
          <p class="quick-prompt">${escapeHtml(s.exercise.prompt)}</p>
          <details class="quick-answer">
            <summary>Ver respuesta sugerida</summary>
            <p>${escapeHtml(s.exercise.answer || "")}</p>
          </details>
        </section>
      ` : ""}

      <div class="quick-actions">
        <button class="btn btn-primary" id="btn-another">⚡ Otra sesión rápida</button>
        <a class="btn" href="simulacro.html">🎯 Simulacro de este tema</a>
        <a class="btn" href="estudiar.html">← Plan</a>
      </div>
    </div>
  `;
  $("#btn-another").onclick = openQuickModal;
}

// === Bootstrap ===
async function init() {
  await storage.init();
  CATALOG = await loadCatalog();
  CATALOG.documents.forEach(d => { DOCS_BY_ABBR[d.abbr] = d; });

  if (!localStorage.getItem(STORAGE_KEY)) {
    $("#estudiar-shell").innerHTML = `
      <div class="sim-config" style="max-width:520px;margin:3rem auto;text-align:center">
        <h1 class="page-title">Falta tu API key</h1>
        <p>El plan de estudio usa la misma API key del Consultor IA.</p>
        <a class="btn btn-primary btn-lg" href="consultor.html" style="margin-top:1.5rem">Configurar →</a>
      </div>
    `;
    return;
  }

  renderEntry();
  wirePlanInteractions();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
