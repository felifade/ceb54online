// Helper compartido para llamadas no-streaming a Claude desde features
// secundarias del Consultor Director (resúmenes, flashcards).
// La sesión de chat principal sigue en chat.js con su propio streaming.

const API_KEY_LS = "dir-consultor-key";
const MODEL_LS = "dir-consultor-model";
const DEFAULT_MODEL = "claude-haiku-4-5";

export function getApiKey() {
  return localStorage.getItem(API_KEY_LS) || "";
}

export function getModel() {
  return localStorage.getItem(MODEL_LS) || DEFAULT_MODEL;
}

export function hasApiKey() {
  return !!getApiKey();
}

/**
 * Llamada simple no-streaming a Claude. Devuelve el texto del mensaje.
 *
 * @param {Object} opts
 * @param {string} opts.system — system prompt (se cachea con cache_control:ephemeral)
 * @param {string} opts.userText — el mensaje del usuario
 * @param {number} [opts.maxTokens=1024]
 * @param {string} [opts.model] — sobreescribe modelo del LS
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<{text: string, usage: object}>}
 */
export async function askClaude({ system, userText, maxTokens = 1024, model, signal }) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("Falta API key de Claude. Configúrala en el Consultor IA.");
  }

  const body = {
    model: model || getModel(),
    max_tokens: maxTokens,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userText }],
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
    signal,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    let parsed;
    try { parsed = JSON.parse(errText); } catch {}
    const msg = parsed?.error?.message || errText || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  const data = await res.json();
  const text = (data.content || [])
    .filter(b => b.type === "text")
    .map(b => b.text)
    .join("\n");
  return { text: text.trim(), usage: data.usage || {} };
}

/**
 * Extrae el primer JSON válido de un texto (para respuestas estructuradas).
 * Tolerante a markdown/explicación alrededor.
 */
export function extractJson(text) {
  if (!text) return null;
  // Si viene en bloque ```json ... ``` o ``` ... ```
  const fence = text.match(/```(?:json)?\s*([\s\S]+?)```/i);
  const candidate = fence ? fence[1] : text;
  // Buscar la primera llave/corchete y cerrarlo balanceado
  const start = candidate.search(/[{[]/);
  if (start === -1) return null;
  let depth = 0;
  let end = -1;
  let inStr = false;
  let escape = false;
  for (let i = start; i < candidate.length; i++) {
    const c = candidate[i];
    if (escape) { escape = false; continue; }
    if (c === "\\") { escape = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end === -1) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}
