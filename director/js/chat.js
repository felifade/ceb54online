// Consultor IA — chat con Claude (Anthropic API directa desde el navegador).
// Hace RAG sobre las 16 fuentes oficiales usando MiniSearch en cliente.
// Soporta streaming, multimodal (imágenes), citas clickeables y persistencia local.

import MiniSearch from "https://esm.sh/minisearch@7.1.2";
import { loadCatalog, escapeHtml } from "./app.js";

const $ = sel => document.querySelector(sel);

// === Configuración ===
const STORAGE_KEY    = "dir-consultor-key";
const STORAGE_MODEL  = "dir-consultor-model";
const STORAGE_HIST   = "dir-consultor-history";

const MODELS = {
  "claude-haiku-4-5-20251001":   { name: "Haiku 4.5", desc: "Rápido y económico (~$0.005/consulta)" },
  "claude-sonnet-4-6":           { name: "Sonnet 4.6", desc: "Más razonado, ~6× más caro" },
};
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

// Cuántas páginas recuperar para el contexto RAG
const RAG_TOP_K = 10;

// Mensaje de sistema con instrucciones y abreviaturas
const SYSTEM_PROMPT = `Eres "Consultor Director", asistente jurídico-pedagógico especializado en el examen de promoción a director del CEB 5/4 (Centro de Estudios de Bachillerato, SEP). Tu propósito es ayudar al usuario a estudiar y, una vez en funciones, asesorarlo en la toma de decisiones directiva con base en las 16 fuentes oficiales que tiene catalogadas.

LAS 16 FUENTES (abreviatura · documento):
• CPEUM — Constitución Política de los Estados Unidos Mexicanos
• LGE — Ley General de Educación
• LGRA — Ley General de Responsabilidades Administrativas
• LGDNNA — Ley General de los Derechos de Niñas, Niños y Adolescentes
• LGAMVLV — Ley General de Acceso de las Mujeres a una Vida Libre de Violencias
• MCCEMS-25 — Modelo Educativo 2025 (Marco Curricular Común EMS)
• AC-21/08/25 — Acuerdo SEP por el que se establece el MCCEMS (DOF)
• PAEC — Programa Aula, Escuela y Comunidad (MCCEMS)
• CT-1 — Curso-Taller 1: Práctica docente colaborativa, áreas de acceso al conocimiento
• CT-2 — Curso-Taller 2: Práctica docente colaborativa, recursos sociocognitivos
• PCAE — Protocolo para la Convivencia Armónica del Estudiantado (planteles federales EMS)
• PRUE — Protocolo para la Protección y Cuidado del Estudiantado en la Revisión de Útiles
• PSP — Protocolos de Seguridad para los Planteles Federales de EMS
• AC-04/07/23 — Acuerdo: Código de Conducta de la SEP
• DCT — Declaratoria Cero Tolerancia
• LPMC-24 — Lineamientos para la Planeación de la Mejora Continua 2024

REGLAS DE RESPUESTA:
1. Responde SIEMPRE en español, tono profesional, directo y claro.
2. CITA las fuentes con formato exacto: \`[ABBR p.PÁGINA]\` — ejemplo: [LGRA p.45], [CPEUM p.12]. Sin paréntesis ni comillas. Una cita por afirmación.
3. Sólo afirma lo que esté en el CONTEXTO RECUPERADO. Si la información no está, di "No encuentro esto en las fuentes catalogadas" y sugiere reformular.
4. NO inventes artículos, páginas, ni abreviaturas distintas a las 16 anteriores.
5. Para preguntas tipo simulador (4 opciones A/B/C/D): identifica la opción correcta, explica brevemente por qué cada una es correcta o incorrecta, y cita la fuente que lo respalda.
6. Si te muestran una captura/imagen del simulador, lee la pregunta y todas las opciones antes de responder.
7. Sé conciso. Listas y negritas cuando ayuden a estudiar. Evita rodeos.
8. Cuando proceda, termina con una "Implicación práctica para el director" en una frase.`;

// === Estado global ===
const state = {
  apiKey: localStorage.getItem(STORAGE_KEY) || "",
  model: localStorage.getItem(STORAGE_MODEL) || DEFAULT_MODEL,
  messages: [],   // {role: "user"|"assistant", content: string|array, timestamp}
  attachments: [], // [{mediaType, base64, name}]
  catalog: null,
  ms: null,
  recordsById: {},
  abbrToDoc: {},  // {ABBR: catalogEntry}
  abortController: null,
  isStreaming: false,
};

// === Carga del catálogo + índice (igual que search.js) ===
async function buildIndex() {
  const [cat, idx] = await Promise.all([
    loadCatalog(),
    fetch("data/search-index.json").then(r => r.json()),
  ]);
  state.catalog = cat;
  cat.documents.forEach(d => { state.abbrToDoc[d.abbr] = d; });

  state.ms = new MiniSearch({
    fields: ["text", "title", "abbr"],
    storeFields: ["doc", "abbr", "title", "page", "category"],
    idField: "id",
    processTerm: (t) => {
      const n = t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return (n.length < 2) ? null : n;
    },
    searchOptions: { boost: { title: 2, abbr: 4 }, prefix: true, fuzzy: 0.15, combineWith: "AND" },
  });
  const BATCH = 200;
  for (let i = 0; i < idx.records.length; i += BATCH) {
    state.ms.addAll(idx.records.slice(i, i + BATCH));
  }
  idx.records.forEach(r => { state.recordsById[r.id] = r.text; });
}

// === RAG: buscar páginas relevantes para la query ===
function retrieveContext(query, k = RAG_TOP_K) {
  // Si el query es muy corto, expandir con últimos mensajes para tener contexto
  let q = query.trim();
  if (q.length < 8 && state.messages.length > 0) {
    const recent = state.messages.slice(-2).map(m => textOf(m.content)).join(" ");
    q = (recent + " " + q).slice(-200);
  }
  let hits = [];
  try { hits = state.ms.search(q); } catch { hits = []; }
  // Si no hay hits, intentar con cada palabra por separado (OR)
  if (hits.length === 0) {
    try { hits = state.ms.search(q, { combineWith: "OR" }); } catch {}
  }
  return hits.slice(0, k).map(h => ({
    abbr: h.abbr,
    doc: h.doc,
    title: h.title,
    page: h.page,
    category: h.category,
    text: state.recordsById[h.id] || "",
    score: h.score,
  }));
}

function textOf(content) {
  if (typeof content === "string") return content;
  return content.filter(b => b.type === "text").map(b => b.text).join(" ");
}

// === Construir mensaje a enviar a Claude ===
function buildAnthropicMessages(userText, attachments, retrieved) {
  // Contexto del RAG como bloque de texto al INICIO del último mensaje del usuario
  const contextBlock = retrieved.length === 0 ? "" :
    "CONTEXTO RECUPERADO (fragmentos de las 16 fuentes oficiales más relevantes a tu pregunta):\n\n" +
    retrieved.map((r, i) =>
      `[${r.abbr} p.${r.page}] (${r.title})\n${r.text.slice(0, 1800)}`
    ).join("\n\n---\n\n") +
    "\n\n=========================\n\n";

  // Construir el array de messages para la API:
  //   - todos los mensajes previos tal cual (sin contexto inyectado para no inflar el costo)
  //   - el último mensaje user con contextBlock + texto + adjuntos
  const out = state.messages.slice(0, -1).map(m => ({
    role: m.role,
    content: m.content,
  }));

  // Último mensaje (el que estamos enviando)
  const lastContent = [];
  // Adjuntos primero (Claude funciona mejor con imagen antes del texto)
  attachments.forEach(a => {
    lastContent.push({
      type: "image",
      source: { type: "base64", media_type: a.mediaType, data: a.base64 }
    });
  });
  lastContent.push({
    type: "text",
    text: contextBlock + "PREGUNTA DEL USUARIO:\n" + userText,
  });
  out.push({ role: "user", content: lastContent });

  return out;
}

// === Llamada a la API de Anthropic con streaming ===
async function callAnthropic(messages, onDelta, onMeta) {
  const ctrl = new AbortController();
  state.abortController = ctrl;

  const body = {
    model: state.model,
    max_tokens: 2048,
    system: [
      { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }
    ],
    messages,
    stream: true,
  };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": state.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify(body),
    signal: ctrl.signal,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    let parsed;
    try { parsed = JSON.parse(errText); } catch {}
    const msg = parsed?.error?.message || errText || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let usageMeta = {};

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
          onDelta(json.delta.text);
        } else if (json.type === "message_start" && json.message?.usage) {
          usageMeta = { ...usageMeta, ...json.message.usage };
        } else if (json.type === "message_delta" && json.usage) {
          usageMeta = { ...usageMeta, ...json.usage };
        }
      } catch {}
    }
  }
  state.abortController = null;
  if (onMeta) onMeta(usageMeta);
}

// === Render de mensajes ===
function avatarText(role) { return role === "user" ? "Tú" : "DR"; }

function renderMessage(msg, container) {
  const wrap = document.createElement("div");
  wrap.className = `msg msg-${msg.role}`;
  wrap.dataset.idx = msg.idx ?? state.messages.indexOf(msg);

  const avatar = document.createElement("div");
  avatar.className = "msg-avatar";
  avatar.textContent = avatarText(msg.role);

  const body = document.createElement("div");
  body.className = "msg-body";
  body.innerHTML = renderContent(msg.content);

  if (msg.role === "assistant" && !msg.streaming) {
    const actions = document.createElement("div");
    actions.className = "msg-actions";
    actions.innerHTML = `
      <button data-action="copy" title="Copiar">📋 Copiar</button>
      <button data-action="regen" title="Regenerar">↻ Regenerar</button>
    `;
    actions.querySelector('[data-action="copy"]').onclick = (e) => copyMessage(msg, e.target);
    actions.querySelector('[data-action="regen"]').onclick = () => regenerateLast();
    body.appendChild(actions);
  }

  wrap.appendChild(avatar);
  wrap.appendChild(body);
  container.appendChild(wrap);
  return wrap;
}

function renderContent(content) {
  if (typeof content === "string") {
    return formatText(content);
  }
  // Array de blocks (text + image)
  return content.map(b => {
    if (b.type === "text") {
      // El contexto del RAG está en el primer bloque del último user msg.
      // Para mostrar al usuario solo su pregunta, recortamos el bloque "CONTEXTO RECUPERADO ...".
      let text = b.text;
      const cut = text.indexOf("PREGUNTA DEL USUARIO:\n");
      if (cut !== -1) text = text.slice(cut + "PREGUNTA DEL USUARIO:\n".length);
      return formatText(text);
    }
    if (b.type === "image") {
      const src = `data:${b.source.media_type};base64,${b.source.data}`;
      return `<img class="msg-image" src="${src}" alt="captura" onclick="window.open(this.src)">`;
    }
    return "";
  }).join("");
}

// Formato simple de markdown → HTML + linkear citas [ABBR p.PÁGINA]
function formatText(s) {
  if (!s) return "";
  let html = escapeHtml(s);
  // Citas: [ABBR p.PÁGINA]
  html = html.replace(/\[([A-Z][A-Z0-9\-/]{1,14})\s+p\.(\d+)\]/g, (m, abbr, page) => {
    const doc = state.abbrToDoc[abbr];
    if (!doc) return m;
    const cat = doc.category || "legal";
    return `<a class="cite" data-cat="${cat}" href="lector.html?id=${doc.id}&page=${page}" target="_blank" rel="noopener">${m}</a>`;
  });
  // **negritas**
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // *cursivas*
  html = html.replace(/(?<!\w)\*([^*\n]+)\*(?!\w)/g, "<em>$1</em>");
  // `código`
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  // Listas: líneas que empiezan con "- " o "1. "
  const lines = html.split("\n");
  const out = [];
  let inUl = false, inOl = false;
  for (const ln of lines) {
    const ulm = ln.match(/^\s*[-•]\s+(.+)/);
    const olm = ln.match(/^\s*(\d+)\.\s+(.+)/);
    if (ulm) {
      if (!inUl) { out.push("<ul>"); inUl = true; }
      if (inOl) { out.push("</ol>"); inOl = false; }
      out.push(`<li>${ulm[1]}</li>`);
    } else if (olm) {
      if (!inOl) { out.push("<ol>"); inOl = true; }
      if (inUl) { out.push("</ul>"); inUl = false; }
      out.push(`<li>${olm[2]}</li>`);
    } else {
      if (inUl) { out.push("</ul>"); inUl = false; }
      if (inOl) { out.push("</ol>"); inOl = false; }
      if (ln.trim()) out.push(`<p>${ln}</p>`);
    }
  }
  if (inUl) out.push("</ul>");
  if (inOl) out.push("</ol>");
  return out.join("");
}

function copyMessage(msg, btn) {
  const text = textOf(msg.content);
  navigator.clipboard.writeText(text).then(() => {
    btn.classList.add("copied");
    btn.textContent = "✓ Copiado";
    setTimeout(() => {
      btn.classList.remove("copied");
      btn.textContent = "📋 Copiar";
    }, 1500);
  });
}

// === UI: render del historial completo ===
function renderHistory() {
  const stream = $("#chat-stream");
  if (state.messages.length === 0) {
    stream.innerHTML = `
      <div class="chat-empty">
        <h3>¿En qué te apoyo, director?</h3>
        <p>Pregunta sobre cualquiera de las 16 fuentes oficiales. Pega capturas del simulador para que las analice y cite la fuente.</p>
        <div class="chat-suggestions">
          <button class="chat-suggestion" data-q="¿Cuáles son los principios rectores del servicio público según la LGRA?"><strong>📌 LGRA</strong>Principios rectores del servicio público</button>
          <button class="chat-suggestion" data-q="Explica el interés superior de la niñez según la LGDNNA y la CPEUM"><strong>📌 NNA</strong>Interés superior de la niñez</button>
          <button class="chat-suggestion" data-q="¿Qué establece el MCCEMS sobre los recursos sociocognitivos?"><strong>📌 MCCEMS</strong>Recursos sociocognitivos</button>
          <button class="chat-suggestion" data-q="Pasos del Protocolo para la Revisión de Útiles Escolares"><strong>📌 Protocolo</strong>Revisión de útiles escolares</button>
        </div>
      </div>`;
    stream.querySelectorAll(".chat-suggestion").forEach(btn => {
      btn.onclick = () => {
        $("#chat-input").value = btn.dataset.q;
        $("#chat-input").focus();
        autoresize($("#chat-input"));
      };
    });
    return;
  }
  stream.innerHTML = "";
  state.messages.forEach(m => renderMessage(m, stream));
  scrollToBottom();
}

function scrollToBottom() {
  const stream = $("#chat-stream");
  stream.scrollTop = stream.scrollHeight;
}

// === Persistencia ===
function saveHistory() {
  try {
    // No guardar más de últimos 50 mensajes para no llenar localStorage
    const trimmed = state.messages.slice(-50);
    localStorage.setItem(STORAGE_HIST, JSON.stringify(trimmed));
  } catch (e) {
    console.warn("No se pudo guardar historial:", e);
  }
}
function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_HIST);
    if (!raw) return;
    state.messages = JSON.parse(raw) || [];
  } catch {}
}

// === Modal de configuración ===
function openConfigModal() {
  const root = $("#modal-root");
  root.innerHTML = `
    <div class="modal-backdrop" id="modal-bg">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h2>Configurar consultor</h2>
          <button class="close" id="modal-close">×</button>
        </div>
        <div class="modal-body">
          <p>Tu API key de Anthropic se guarda <strong>solo en tu navegador</strong> (localStorage). Nunca sale de tu dispositivo salvo para llamar a api.anthropic.com.</p>
          <label for="api-key">API key de Anthropic</label>
          <input type="password" id="api-key" placeholder="sk-ant-…" value="${escapeHtml(state.apiKey)}" autocomplete="off">
          <p class="hint">¿No tienes una? <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">Crear en console.anthropic.com →</a></p>

          <label for="model">Modelo</label>
          <select id="model">
            ${Object.entries(MODELS).map(([id, info]) => `
              <option value="${id}" ${id === state.model ? "selected" : ""}>${info.name} — ${info.desc}</option>
            `).join("")}
          </select>
          <p class="hint">Puedes cambiar el modelo en cualquier momento. Haiku 4.5 cubre bien la mayoría de consultas.</p>
        </div>
        <div class="modal-footer">
          <button class="btn" id="modal-cancel">Cancelar</button>
          <button class="btn btn-primary" id="modal-save">Guardar</button>
        </div>
      </div>
    </div>
  `;
  const close = () => { root.innerHTML = ""; };
  $("#modal-close").onclick = close;
  $("#modal-cancel").onclick = close;
  $("#modal-bg").onclick = close;
  $("#modal-save").onclick = () => {
    const key = $("#api-key").value.trim();
    const model = $("#model").value;
    if (key) {
      state.apiKey = key;
      localStorage.setItem(STORAGE_KEY, key);
    }
    state.model = model;
    localStorage.setItem(STORAGE_MODEL, model);
    updateModelPill();
    close();
  };
  setTimeout(() => $("#api-key").focus(), 50);
}

function updateModelPill() {
  const el = $("#model-pill");
  if (el) el.textContent = MODELS[state.model]?.name || state.model;
}

// === Composer (input + adjuntos + envío) ===
function autoresize(ta) {
  ta.style.height = "auto";
  ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
}

function renderAttachments() {
  const wrap = $("#attachments");
  wrap.innerHTML = state.attachments.map((a, i) => `
    <div class="chat-attachment">
      <img src="data:${a.mediaType};base64,${a.base64}" alt="adjunto">
      <button class="remove" data-i="${i}" aria-label="Quitar">×</button>
    </div>
  `).join("");
  wrap.querySelectorAll(".remove").forEach(b => {
    b.onclick = () => {
      state.attachments.splice(parseInt(b.dataset.i, 10), 1);
      renderAttachments();
    };
  });
}

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const result = r.result; // "data:image/png;base64,XXXX"
      const m = result.match(/^data:([^;]+);base64,(.+)$/);
      if (m) resolve({ mediaType: m[1], base64: m[2], name: file.name });
      else reject(new Error("Archivo no soportado"));
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

async function handleFiles(fileList) {
  for (const f of fileList) {
    if (!f.type.startsWith("image/")) continue;
    if (f.size > 5 * 1024 * 1024) {
      showError(`La imagen "${f.name}" pesa más de 5 MB. Compáctala antes de subirla.`);
      continue;
    }
    try {
      const att = await fileToBase64(f);
      state.attachments.push(att);
    } catch (e) {
      showError(`No se pudo leer "${f.name}": ${e.message}`);
    }
  }
  renderAttachments();
}

function showError(msg) {
  const banner = $("#error-banner");
  banner.innerHTML = `<strong>Error:</strong> ${escapeHtml(msg)}`;
  banner.style.display = "block";
  setTimeout(() => { banner.style.display = "none"; }, 6000);
}

// === Enviar mensaje ===
async function sendMessage() {
  if (state.isStreaming) {
    state.abortController?.abort();
    return;
  }
  const ta = $("#chat-input");
  const text = ta.value.trim();
  if (!text && state.attachments.length === 0) return;
  if (!state.apiKey) {
    showError("Falta tu API key. Abre la configuración (⚙️) para agregarla.");
    openConfigModal();
    return;
  }

  // Construir mensaje del usuario
  const userContent = [];
  state.attachments.forEach(a => {
    userContent.push({ type: "image", source: { type: "base64", media_type: a.mediaType, data: a.base64 } });
  });
  // Texto puro del usuario (lo guardamos sin contexto RAG inyectado para mostrar limpio)
  userContent.push({ type: "text", text });

  const userMsg = { role: "user", content: userContent, timestamp: Date.now() };
  state.messages.push(userMsg);

  // Limpiar input + attachments
  ta.value = "";
  autoresize(ta);
  state.attachments = [];
  renderAttachments();

  renderHistory();
  saveHistory();

  // Hacer RAG con el texto de la última pregunta
  const retrieved = retrieveContext(text);

  // Construir mensajes para la API (inyecta contexto RAG en el último user msg)
  const apiMessages = buildAnthropicMessagesFromState(text, retrieved);

  // Mensaje del asistente (vacío, se llenará en streaming)
  const asstMsg = { role: "assistant", content: "", timestamp: Date.now(), streaming: true, retrieved };
  state.messages.push(asstMsg);
  const stream = $("#chat-stream");
  // Quitar empty si lo hay
  const empty = stream.querySelector(".chat-empty");
  if (empty) empty.remove();
  // Renderizar mensaje del usuario
  renderMessage(userMsg, stream);
  // Renderizar burbuja del asistente con "thinking"
  const asstWrap = renderMessage(asstMsg, stream);
  const asstBody = asstWrap.querySelector(".msg-body");
  asstBody.innerHTML = `<div class="thinking"><span class="dot"></span><span class="dot"></span><span class="dot"></span> Consultando las fuentes…</div>`;
  scrollToBottom();

  // Estado de streaming
  state.isStreaming = true;
  toggleSendBtn(true);

  let acc = "";
  let firstDelta = true;
  try {
    await callAnthropic(apiMessages,
      (delta) => {
        if (firstDelta) {
          asstBody.innerHTML = "";
          firstDelta = false;
        }
        acc += delta;
        asstBody.innerHTML = formatText(acc) + '<span class="cursor"></span>';
        // Scroll suave al fondo solo si el usuario está cerca del fondo
        const stream = $("#chat-stream");
        const nearBottom = stream.scrollHeight - stream.scrollTop - stream.clientHeight < 120;
        if (nearBottom) scrollToBottom();
      },
      (meta) => {
        // Mostrar tokens consumidos brevemente
        if (meta && (meta.input_tokens || meta.output_tokens)) {
          const cached = meta.cache_read_input_tokens || 0;
          const inT = meta.input_tokens || 0;
          const outT = meta.output_tokens || 0;
          $("#token-meta").textContent = `↓${inT}${cached ? `(${cached} cache)` : ""} · ↑${outT}`;
        }
      }
    );
    asstMsg.content = acc;
    asstMsg.streaming = false;
    // Re-render del último mensaje para añadir botones de acciones
    asstWrap.remove();
    renderMessage(asstMsg, stream);
    saveHistory();
  } catch (err) {
    if (err.name === "AbortError") {
      asstMsg.content = acc + "\n\n*[detenido]*";
      asstMsg.streaming = false;
      asstBody.innerHTML = formatText(asstMsg.content);
    } else {
      console.error(err);
      asstMsg.content = `**Error al consultar a Claude:** ${err.message}`;
      asstMsg.role = "error";
      asstMsg.streaming = false;
      asstBody.innerHTML = formatText(asstMsg.content);
      asstWrap.classList.remove("msg-assistant");
      asstWrap.classList.add("msg-error");
      asstWrap.querySelector(".msg-avatar").textContent = "!";
    }
    saveHistory();
  } finally {
    state.isStreaming = false;
    toggleSendBtn(false);
    state.abortController = null;
  }
}

function buildAnthropicMessagesFromState(lastUserText, retrieved) {
  // El último mensaje (user que acabamos de empujar) le inyectamos contexto RAG
  const all = state.messages.slice(0, -1).map(m => ({ role: m.role, content: m.content }));

  const lastMsg = state.messages[state.messages.length - 1];
  const newContent = [];
  // Imágenes del último mensaje primero
  for (const b of lastMsg.content) {
    if (b.type === "image") newContent.push(b);
  }
  // Construir bloque de contexto + texto
  const contextBlock = retrieved.length === 0 ? "" :
    "CONTEXTO RECUPERADO (fragmentos relevantes de las 16 fuentes oficiales):\n\n" +
    retrieved.map(r =>
      `[${r.abbr} p.${r.page}] (${r.title})\n${r.text.slice(0, 1800)}`
    ).join("\n\n---\n\n") +
    "\n\n=========================\n\n";
  newContent.push({
    type: "text",
    text: contextBlock + "PREGUNTA DEL USUARIO:\n" + lastUserText,
  });
  all.push({ role: "user", content: newContent });
  return all;
}

function toggleSendBtn(streaming) {
  const btn = $("#chat-send");
  if (streaming) {
    btn.classList.add("stop");
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`;
    btn.disabled = false;
    btn.title = "Detener";
  } else {
    btn.classList.remove("stop");
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l14 0"/><path d="M13 6l6 6-6 6"/></svg>`;
    btn.title = "Enviar (Ctrl/Cmd+↵)";
  }
}

function regenerateLast() {
  if (state.messages.length < 2) return;
  // Quita el último mensaje del asistente
  const last = state.messages[state.messages.length - 1];
  if (last.role !== "assistant") return;
  state.messages.pop();
  // Quita el último user para volverlo a enviar
  const lastUser = state.messages.pop();
  if (!lastUser || lastUser.role !== "user") return;
  // Rellenar input con el texto y attachments
  const userText = lastUser.content.find(b => b.type === "text")?.text || "";
  $("#chat-input").value = userText;
  state.attachments = lastUser.content.filter(b => b.type === "image").map(img => ({
    mediaType: img.source.media_type,
    base64: img.source.data,
    name: "regen",
  }));
  renderAttachments();
  renderHistory();
  saveHistory();
  sendMessage();
}

function clearChat() {
  if (state.messages.length === 0) return;
  if (!confirm("¿Borrar la conversación actual? Esta acción no se puede deshacer.")) return;
  state.messages = [];
  state.attachments = [];
  saveHistory();
  renderAttachments();
  renderHistory();
  $("#token-meta").textContent = "";
}

// === Bootstrap ===
async function init() {
  loadHistory();
  updateModelPill();

  // Cargar índice (para RAG)
  $("#chat-stream").innerHTML = `<div class="chat-empty"><p><span class="spinner"></span> Cargando índice de las 16 fuentes…</p></div>`;
  try {
    await buildIndex();
  } catch (e) {
    showError(`No se pudo cargar el índice: ${e.message}`);
  }
  renderHistory();

  // Si no hay API key, abrir el modal
  if (!state.apiKey) {
    setTimeout(openConfigModal, 300);
  }

  // Wiring de UI
  const ta = $("#chat-input");
  ta.addEventListener("input", () => autoresize(ta));
  ta.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  });
  ta.addEventListener("paste", async (e) => {
    const items = e.clipboardData?.items || [];
    const files = [];
    for (const it of items) {
      if (it.kind === "file" && it.type.startsWith("image/")) {
        const f = it.getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length) { e.preventDefault(); await handleFiles(files); }
  });

  $("#chat-send").onclick = sendMessage;
  $("#btn-config").onclick = openConfigModal;
  $("#btn-clear").onclick = clearChat;
  $("#btn-attach").onclick = () => $("#file-input").click();
  $("#file-input").addEventListener("change", e => handleFiles(e.target.files));

  // Drop zone
  document.addEventListener("dragover", e => e.preventDefault());
  document.addEventListener("drop", async e => {
    e.preventDefault();
    if (e.dataTransfer?.files?.length) await handleFiles(e.dataTransfer.files);
  });

  toggleSendBtn(false);
  ta.focus();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
