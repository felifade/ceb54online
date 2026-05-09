// Simulacros con IA — genera casos prácticos y preguntas conceptuales
// basadas en las 16 fuentes oficiales (RAG con MiniSearch).
//
// Reutiliza la API key + modelo configurados en el Consultor IA.

import MiniSearch from "https://esm.sh/minisearch@7.1.2";
import { loadCatalog, escapeHtml } from "./app.js";
import { storage } from "./storage.js";

const $  = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

// === Misma config que el chat (compartida) ===
const STORAGE_KEY    = "dir-consultor-key";
const STORAGE_MODEL  = "dir-consultor-model";

const RAG_TOP_K_PER_QUESTION = 6; // páginas a recuperar por pregunta solicitada

const STATE = {
  catalog: null,
  ms: null,
  recordsById: {},
  config: { topic: "all", count: 5, kind: "mixto", mode: "estudio" },
  questions: [],
  answers: [],   // [{i: idx_pregunta, choice: 0-3, correct: bool}]
  current: 0,
  startedAt: 0,
  abortController: null,
};

// === Carga del corpus ===
async function buildIndex() {
  const [cat, idx] = await Promise.all([
    loadCatalog(),
    fetch("data/search-index.json").then(r => r.json()),
  ]);
  STATE.catalog = cat;
  STATE.ms = new MiniSearch({
    fields: ["text", "title", "abbr"],
    storeFields: ["doc", "abbr", "title", "page", "category"],
    idField: "id",
    processTerm: t => {
      const n = t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return n.length < 2 ? null : n;
    },
    searchOptions: { boost: { title: 2, abbr: 4 }, prefix: true, fuzzy: 0.15, combineWith: "AND" },
  });
  const BATCH = 200;
  for (let i = 0; i < idx.records.length; i += BATCH) {
    STATE.ms.addAll(idx.records.slice(i, i + BATCH));
  }
  idx.records.forEach(r => { STATE.recordsById[r.id] = r.text; });
}

// === Build prompt ===
function buildSystemPrompt(config) {
  const kindRules = {
    mixto:    "Mezcla preguntas de CASO PRÁCTICO (60%) y CONCEPTUALES (40%).",
    casos:    "Solo CASOS PRÁCTICOS: situaciones realistas que enfrentaría un director y debe decidir.",
    conceptos:"Solo CONCEPTUALES: definiciones, principios, fundamentos jurídicos y pedagógicos.",
  };

  return `Eres un experto en evaluación para el examen de promoción a director del Centro de Estudios de Bachillerato (CEB, SEP).

Tu tarea: generar exactamente ${config.count} preguntas tipo examen real, basadas ESTRICTAMENTE en el CONTEXTO RECUPERADO de las 16 fuentes oficiales que se te proveen.

ABREVIATURAS DE LAS 16 FUENTES (úsalas tal cual en las citas):
CPEUM, LGE, LGRA, LGDNNA, LGAMVLV, MCCEMS-25, AC-21/08/25, PAEC, CT-1, CT-2, PCAE, PRUE, PSP, AC-04/07/23, DCT, LPMC-24

REGLAS:
1. ${kindRules[config.kind] || kindRules.mixto}
2. Cada pregunta tiene 4 opciones (A, B, C, D). Solo UNA correcta.
3. Las opciones deben ser plausibles (no "ridícula" vs "obvia"). Distractores realistas.
4. Casos prácticos: empieza con "Como director del plantel, …" o "Un docente le reporta …" o similar.
   Plantea decisión concreta (notificar, suspender, mediar, escalar, etc.).
5. Conceptuales: pregunta directa sobre el contenido de las fuentes.
6. La explicación de la respuesta correcta debe ser 1-2 frases y CITAR la fuente exacta.
7. Si el contexto no alcanza para hacer una buena pregunta, reduce el número total y avisa en "warning".

FORMATO DE SALIDA — DEVUELVE SOLO JSON VÁLIDO, SIN MARKDOWN NI EXPLICACIONES FUERA DEL JSON.
NO uses fences \`\`\`json. NO añadas texto antes ni después. NO uses comillas tipográficas (“ ”).
Las cadenas DEBEN escapar comillas internas con \\". Sin trailing commas. JSON puro.

{
  "questions": [
    {
      "kind": "caso" | "concepto",
      "stem": "Enunciado de la pregunta…",
      "options": ["A) …", "B) …", "C) …", "D) …"],
      "correct": 0,
      "explanation": "Por qué la opción X es correcta. Las demás fallan porque …",
      "source": { "abbr": "LGRA", "page": 45 }
    }
  ],
  "warning": null
}

correct es índice 0-3. NUNCA inventes una abreviatura distinta a las 16 listadas. NUNCA inventes una página que no esté en el contexto recuperado.`;
}

function buildUserPrompt(config, retrieved) {
  const ctx = retrieved.map(r =>
    `[${r.abbr} p.${r.page}] (${r.title})\n${r.text.slice(0, 1600)}`
  ).join("\n\n---\n\n");

  let topicDesc = "Cualquier tema del corpus.";
  if (config.topic !== "all") {
    if (config.topic.startsWith("doc:")) {
      const id = parseInt(config.topic.slice(4), 10);
      const doc = STATE.catalog.documents.find(d => d.id === id);
      topicDesc = `Solo del documento: ${doc.short || doc.title} (${doc.abbr})`;
    } else if (config.topic.startsWith("cat:")) {
      const cat = STATE.catalog.categories[config.topic.slice(4)];
      topicDesc = `Solo de la categoría: ${cat.name}`;
    }
  }

  return `TEMA: ${topicDesc}

CONTEXTO RECUPERADO (${retrieved.length} páginas relevantes):

${ctx}

================
Genera ${config.count} preguntas siguiendo el formato JSON especificado. Devuelve SOLO el JSON.`;
}

// === RAG: recoger N páginas relevantes para el tema ===
function getContext(config) {
  let pool = Object.entries(STATE.recordsById)
    .map(([id, text]) => ({ id, text }));

  // Filtrar por scope
  if (config.topic.startsWith("doc:")) {
    const docId = parseInt(config.topic.slice(4), 10);
    pool = pool.filter(p => p.id.startsWith(`${docId}-`));
  } else if (config.topic.startsWith("cat:")) {
    const cat = config.topic.slice(4);
    const docsInCat = STATE.catalog.documents.filter(d => d.category === cat).map(d => d.id);
    pool = pool.filter(p => docsInCat.includes(parseInt(p.id.split("-")[0], 10)));
  }

  // Tomar páginas aleatorias (para variedad entre simulacros)
  // Pero pesando un poco por longitud para no sacar índices
  const desired = Math.min(pool.length, RAG_TOP_K_PER_QUESTION * config.count);
  const shuffled = pool
    .filter(p => p.text.length > 400) // descartar páginas casi vacías (índices)
    .sort(() => Math.random() - 0.5)
    .slice(0, desired);

  // Mapear a formato con metadatos
  return shuffled.map(p => {
    const [docId, page] = p.id.split("-").map(Number);
    const doc = STATE.catalog.documents.find(d => d.id === docId);
    return {
      doc: docId,
      page,
      abbr: doc?.abbr || "",
      title: doc?.short || doc?.title || "",
      text: p.text,
    };
  });
}

// === Llamada a la API de Anthropic ===
async function callAnthropic({ system, userText, onDelta }) {
  const apiKey = localStorage.getItem(STORAGE_KEY);
  const model = localStorage.getItem(STORAGE_MODEL) || "claude-haiku-4-5-20251001";
  if (!apiKey) {
    throw new Error("Falta tu API key de Anthropic. Configúrala en el Consultor IA primero.");
  }

  const ctrl = new AbortController();
  STATE.abortController = ctrl;

  const body = {
    model,
    max_tokens: 8192,  // suficiente para 15 preguntas con casos prácticos largos
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: [{ type: "text", text: userText }] }],
    stream: true,
  };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify(body),
    signal: ctrl.signal,
  });

  if (!res.ok) {
    const t = await res.text().catch(() => res.statusText);
    let parsed; try { parsed = JSON.parse(t); } catch {}
    throw new Error(parsed?.error?.message || t || `HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "", acc = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop();
    for (const evt of events) {
      const dataLine = evt.split("\n").find(l => l.startsWith("data: "));
      if (!dataLine) continue;
      try {
        const json = JSON.parse(dataLine.slice(6));
        if (json.type === "content_block_delta" && json.delta?.type === "text_delta") {
          acc += json.delta.text;
          if (onDelta) onDelta(acc);
        }
      } catch {}
    }
  }
  STATE.abortController = null;
  return acc;
}

function extractJson(s) {
  // 1) Quitar fences de código markdown si los hay (```json ... ```)
  let cleaned = s.replace(/```(?:json)?\s*/gi, "").replace(/```\s*$/g, "").trim();

  // 2) Encontrar el primer { y luego cerrar de forma balanceada
  //    (respetando strings, escapes y nesting). Esto evita que un
  //    "}" dentro de un string termine el parseo prematuramente.
  const start = cleaned.indexOf("{");
  if (start === -1) throw new Error("Respuesta sin JSON");
  let depth = 0, inString = false, escape = false, end = -1;
  for (let i = start; i < cleaned.length; i++) {
    const c = cleaned[i];
    if (escape) { escape = false; continue; }
    if (c === "\\") { escape = true; continue; }
    if (c === '"')  { inString = !inString; continue; }
    if (inString) continue;
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end === -1) {
    // JSON truncado (probablemente max_tokens) — intentar cerrar a la fuerza
    // contando cuántos } faltan. Si Claude estaba a media pregunta, fallará igual.
    cleaned += "}".repeat(depth) + "]".repeat(0);
    end = cleaned.length - 1;
  }
  let candidate = cleaned.slice(start, end + 1);

  // 3) Reparaciones comunes
  candidate = candidate
    .replace(/,(\s*[\]}])/g, "$1")          // trailing commas
    .replace(/[“”]/g, '"')        // comillas curvas
    .replace(/[‘’]/g, "'");

  try {
    return JSON.parse(candidate);
  } catch (e) {
    // Mostrar primeras líneas del candidato para depurar
    const head = candidate.slice(0, 200);
    const tail = candidate.slice(-200);
    throw new Error(`${e.message}\n\nInicio del JSON:\n${head}…\n\nFinal:\n…${tail}`);
  }
}

// === Render: configurador inicial ===
function renderConfigurator() {
  const cats = Object.entries(STATE.catalog.categories).map(([key, c]) =>
    `<option value="cat:${key}">📁 ${c.name}</option>`
  ).join("");
  const docs = STATE.catalog.documents.map(d =>
    `<option value="doc:${d.id}">${d.abbr} — ${d.short || d.title}</option>`
  ).join("");

  $("#sim-shell").innerHTML = `
    <div class="sim-config">
      <h1 class="page-title">Simulacro de examen</h1>
      <p class="page-sub">Casos prácticos y preguntas conceptuales generadas con IA, basadas en las 16 fuentes oficiales.</p>

      <div class="sim-form">
        <label>
          <span>Tema</span>
          <select id="cfg-topic">
            <option value="all">🎯 Mixto — todas las fuentes</option>
            ${cats}
            ${docs}
          </select>
        </label>

        <label>
          <span>Número de preguntas</span>
          <select id="cfg-count">
            <option value="5">5 (rápido — 2-3 min)</option>
            <option value="10" selected>10 (estándar — 5 min)</option>
            <option value="15">15 (extendido — 8 min)</option>
          </select>
        </label>

        <label>
          <span>Tipo de pregunta</span>
          <select id="cfg-kind">
            <option value="mixto" selected>Mixto (60% casos + 40% conceptos)</option>
            <option value="casos">Solo casos prácticos</option>
            <option value="conceptos">Solo conceptos</option>
          </select>
        </label>

        <label>
          <span>Modo</span>
          <select id="cfg-mode">
            <option value="estudio" selected>Estudio — feedback inmediato</option>
            <option value="examen">Examen — feedback al final</option>
          </select>
        </label>

        <button class="btn btn-primary btn-lg" id="btn-start">Generar simulacro →</button>
        <p class="hint" style="text-align:center">Costo aprox: $0.01–0.03 USD por simulacro (depende del modelo).</p>
      </div>

      ${renderHistorySection()}
    </div>
  `;
  $("#btn-start").onclick = startSimulacro;
}

function renderHistorySection() {
  const hist = storage.getSimulacros();
  if (hist.length === 0) return "";
  return `
    <section class="sim-history">
      <h2>Tus simulacros anteriores</h2>
      <div class="sim-history-list">
        ${hist.slice(0, 8).map(s => `
          <div class="sim-history-item">
            <div class="sim-hi-score">${s.score}/${s.total}</div>
            <div class="sim-hi-meta">
              <strong>${escapeHtml(s.topicLabel || "Mixto")}</strong>
              <span>${new Date(s.date).toLocaleDateString("es-MX", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" })}</span>
            </div>
            <div class="sim-hi-pct" style="--p:${Math.round(100 * s.score / s.total)}%">${Math.round(100*s.score/s.total)}%</div>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

// === Iniciar simulacro: leer config + RAG + llamar IA + parsear ===
async function startSimulacro() {
  STATE.config = {
    topic: $("#cfg-topic").value,
    count: parseInt($("#cfg-count").value, 10),
    kind: $("#cfg-kind").value,
    mode: $("#cfg-mode").value,
  };

  // Etiqueta legible para histórico
  let topicLabel = "Mixto";
  if (STATE.config.topic.startsWith("doc:")) {
    const d = STATE.catalog.documents.find(x => x.id === parseInt(STATE.config.topic.slice(4)));
    topicLabel = d ? d.abbr : "—";
  } else if (STATE.config.topic.startsWith("cat:")) {
    topicLabel = STATE.catalog.categories[STATE.config.topic.slice(4)]?.short || "—";
  }
  STATE.config.topicLabel = topicLabel;

  $("#sim-shell").innerHTML = `
    <div class="sim-loading">
      <h2>Generando ${STATE.config.count} preguntas…</h2>
      <p class="muted" id="loading-status">Recuperando contexto del corpus…</p>
      <div class="spinner-big"><span class="spinner"></span></div>
      <button class="btn btn-sm" id="btn-cancel-gen">Cancelar</button>
    </div>
  `;
  $("#btn-cancel-gen").onclick = () => {
    STATE.abortController?.abort();
    renderConfigurator();
  };

  try {
    const retrieved = getContext(STATE.config);
    if (retrieved.length === 0) throw new Error("No hay suficiente contenido para este tema.");

    $("#loading-status").textContent = `Pidiendo a Claude que diseñe ${STATE.config.count} preguntas (esto toma 10-30 s)…`;

    const system = buildSystemPrompt(STATE.config);
    const userText = buildUserPrompt(STATE.config, retrieved);

    let lastAcc = "";
    const raw = await callAnthropic({
      system, userText,
      onDelta: (acc) => {
        lastAcc = acc;
        $("#loading-status").textContent = `Generando preguntas… (${acc.length} caracteres)`;
      },
    });

    let parsed;
    try { parsed = extractJson(raw); }
    catch (e) {
      console.error("Raw response:", raw);
      throw new Error(`No se pudo parsear la respuesta de la IA: ${e.message}`);
    }

    if (!parsed.questions?.length) throw new Error("La IA no generó preguntas válidas.");

    // Validar y normalizar
    STATE.questions = parsed.questions.map((q, i) => ({
      kind: q.kind || "concepto",
      stem: q.stem || "",
      options: q.options || [],
      correct: typeof q.correct === "number" ? q.correct : 0,
      explanation: q.explanation || "",
      source: q.source || null,
    })).filter(q => q.stem && q.options.length === 4);

    if (STATE.questions.length === 0) throw new Error("No se generaron preguntas válidas.");

    STATE.answers = [];
    STATE.current = 0;
    STATE.startedAt = Date.now();
    renderQuestion();

  } catch (err) {
    if (err.name === "AbortError") return;
    $("#sim-shell").innerHTML = `
      <div class="sim-error">
        <h2>Algo salió mal</h2>
        <p>${escapeHtml(err.message)}</p>
        <button class="btn" id="btn-retry">← Volver</button>
      </div>
    `;
    $("#btn-retry").onclick = renderConfigurator;
  }
}

// === Render de pregunta ===
function renderQuestion() {
  const q = STATE.questions[STATE.current];
  const total = STATE.questions.length;
  const num = STATE.current + 1;
  const kindLabel = q.kind === "caso" ? "📋 Caso práctico" : "📖 Concepto";
  const docInfo = q.source ? `[${q.source.abbr}]` : "";

  $("#sim-shell").innerHTML = `
    <div class="sim-quiz">
      <header class="sim-quiz-head">
        <div class="sim-progress">
          <div class="sim-progress-bar"><div class="sim-progress-fill" style="width:${(num/total)*100}%"></div></div>
          <span class="sim-progress-label">Pregunta ${num} de ${total}</span>
        </div>
        <button class="btn btn-sm" id="btn-quit">Salir</button>
      </header>

      <article class="sim-question">
        <span class="sim-kind">${kindLabel} ${docInfo ? `<span class="sim-source-hint">${docInfo}</span>` : ""}</span>
        <h2>${escapeHtml(q.stem)}</h2>
        <div class="sim-options">
          ${q.options.map((opt, i) => `
            <button class="sim-option" data-i="${i}">${escapeHtml(opt)}</button>
          `).join("")}
        </div>
        <div class="sim-feedback" id="sim-feedback" style="display:none"></div>
        <div class="sim-actions" id="sim-actions"></div>
      </article>
    </div>
  `;

  $("#btn-quit").onclick = () => {
    if (confirm("¿Salir del simulacro? Perderás el progreso actual.")) renderConfigurator();
  };

  $$(".sim-option").forEach(btn => {
    btn.onclick = () => answerQuestion(parseInt(btn.dataset.i, 10));
  });
}

function answerQuestion(choice) {
  const q = STATE.questions[STATE.current];
  const correct = choice === q.correct;
  STATE.answers.push({ i: STATE.current, choice, correct });

  // En modo examen: pasar a siguiente directo
  if (STATE.config.mode === "examen") {
    return goNextOrFinish();
  }

  // Modo estudio: mostrar feedback
  $$(".sim-option").forEach((b, i) => {
    b.disabled = true;
    if (i === q.correct) b.classList.add("correct");
    if (i === choice && !correct) b.classList.add("incorrect");
  });
  const fb = $("#sim-feedback");
  fb.style.display = "block";
  fb.className = "sim-feedback " + (correct ? "ok" : "fail");
  const sourceLink = q.source ? `<a href="lector.html?id=${docIdByAbbr(q.source.abbr)}&page=${q.source.page}" target="_blank">[${q.source.abbr} p.${q.source.page}] ↗</a>` : "";
  fb.innerHTML = `
    <strong>${correct ? "✓ Correcto" : "✗ Incorrecto"}</strong>
    <p>${escapeHtml(q.explanation)}</p>
    ${sourceLink ? `<p class="sim-source-link">${sourceLink}</p>` : ""}
  `;

  $("#sim-actions").innerHTML = `
    <button class="btn btn-primary" id="btn-next">${STATE.current + 1 === STATE.questions.length ? "Ver resultados →" : "Siguiente →"}</button>
  `;
  $("#btn-next").onclick = goNextOrFinish;
}

function docIdByAbbr(abbr) {
  return STATE.catalog.documents.find(d => d.abbr === abbr)?.id || 0;
}

function goNextOrFinish() {
  STATE.current++;
  if (STATE.current >= STATE.questions.length) {
    finishSimulacro();
  } else {
    renderQuestion();
  }
}

// === Resultados finales ===
function finishSimulacro() {
  const total = STATE.questions.length;
  const score = STATE.answers.filter(a => a.correct).length;
  const pct = Math.round((score / total) * 100);
  const elapsedSec = Math.round((Date.now() - STATE.startedAt) / 1000);

  // Guardar en histórico
  storage.addSimulacroResult({
    topic: STATE.config.topic,
    topicLabel: STATE.config.topicLabel,
    kind: STATE.config.kind,
    mode: STATE.config.mode,
    score, total,
    elapsedSec,
    questions: STATE.questions.map((q, i) => ({
      stem: q.stem,
      kind: q.kind,
      correct: q.correct,
      myChoice: STATE.answers[i]?.choice ?? null,
      source: q.source,
    })),
  });

  $("#sim-shell").innerHTML = `
    <div class="sim-results">
      <h1 class="page-title">Resultado del simulacro</h1>
      <div class="sim-score-card sim-pct-${pct >= 80 ? "good" : pct >= 60 ? "mid" : "low"}">
        <div class="sim-score-pct">${pct}%</div>
        <div class="sim-score-frac">${score} / ${total} correctas</div>
        <div class="sim-score-meta">${STATE.config.topicLabel} · ${formatTime(elapsedSec)}</div>
      </div>

      <h2 class="sim-results-h">Revisión por pregunta</h2>
      <div class="sim-review">
        ${STATE.questions.map((q, i) => {
          const a = STATE.answers[i];
          const ok = a?.correct;
          return `
            <article class="sim-review-item ${ok ? "ok" : "fail"}">
              <header>
                <span>${ok ? "✓" : "✗"} P${i+1} · ${q.kind === "caso" ? "Caso" : "Concepto"}</span>
                ${q.source ? `<a href="lector.html?id=${docIdByAbbr(q.source.abbr)}&page=${q.source.page}" target="_blank" class="cite">[${q.source.abbr} p.${q.source.page}]</a>` : ""}
              </header>
              <p class="sim-review-stem">${escapeHtml(q.stem)}</p>
              ${!ok ? `
                <div class="sim-review-detail">
                  <span class="bad">Tu respuesta: ${escapeHtml(q.options[a?.choice ?? -1] || "(sin responder)")}</span>
                  <span class="good">Correcta: ${escapeHtml(q.options[q.correct])}</span>
                  <p class="muted">${escapeHtml(q.explanation)}</p>
                </div>
              ` : ""}
            </article>
          `;
        }).join("")}
      </div>

      <div class="sim-results-actions">
        <button class="btn btn-primary" id="btn-new">Nuevo simulacro</button>
        ${STATE.answers.some(a => !a.correct) ? `<button class="btn" id="btn-retry-fails">↻ Repetir las que fallé</button>` : ""}
        <a class="btn" href="mis-notas.html">Ver Mi Estudio</a>
      </div>
    </div>
  `;

  $("#btn-new").onclick = renderConfigurator;
  if ($("#btn-retry-fails")) $("#btn-retry-fails").onclick = retryFails;
}

function retryFails() {
  // Solo dejar las preguntas falladas
  const failedIdx = STATE.answers.filter(a => !a.correct).map(a => a.i);
  STATE.questions = failedIdx.map(i => STATE.questions[i]);
  STATE.answers = [];
  STATE.current = 0;
  STATE.startedAt = Date.now();
  renderQuestion();
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
}

// === Bootstrap ===
async function init() {
  await storage.init();
  $("#sim-shell").innerHTML = `<p class="muted" style="text-align:center;padding:3rem"><span class="spinner"></span> Cargando corpus…</p>`;
  try {
    await buildIndex();
  } catch (e) {
    $("#sim-shell").innerHTML = `<p style="color:var(--danger);padding:2rem">${e.message}</p>`;
    return;
  }
  // Verificar que tenga API key
  if (!localStorage.getItem(STORAGE_KEY)) {
    $("#sim-shell").innerHTML = `
      <div class="sim-config" style="max-width:520px;margin:3rem auto;text-align:center">
        <h1 class="page-title">Falta tu API key</h1>
        <p>El simulacro usa la misma API key de Anthropic que el Consultor IA.</p>
        <p>Configúrala una sola vez y queda guardada para los dos.</p>
        <a class="btn btn-primary btn-lg" href="consultor.html" style="margin-top:1.5rem">Ir al Consultor IA →</a>
      </div>
    `;
    return;
  }
  renderConfigurator();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
