// Sistema de almacenamiento del Consultor Director
// =================================================
// Una sola estructura JSON con TODOS los datos personales del usuario:
//   - bookmarks: páginas favoritas
//   - notes: notas personales por documento+página
//   - highlights: subrayados en el lector iBook
//   - progress: progreso de lectura por documento
//   - simulacros: histórico de intentos
//   - plan: plan de estudio actual
//
// Backend swappable: LocalBackend (localStorage) por default,
// DriveBackend cuando el usuario conecta su Google Drive.
// Si Drive está activo, los cambios locales se sincronizan con debounce.

const SCHEMA_VERSION = 2;
const STORAGE_KEY = "dir-mi-estudio";

// === Estructura por defecto ===
function emptyData() {
  return {
    schema: SCHEMA_VERSION,
    updated: Date.now(),
    bookmarks: {},   // {"docId-page": {doc, page, addedAt, note?}}
    notes: {},       // {"docId-page": {doc, page, text, updatedAt}}
    highlights: {},  // {docId: [{page, paraIdx, start, end, text, color, addedAt}]}
    progress: {},    // {docId: {lastPage, lastReadAt, completedPages: [...]}}
    simulacros: [],  // [{id, date, topic, score, total, questions: [...]}]
    plan: null,      // {createdAt, target, days, sessions: [...]}
    summaries: {},   // {docId: {page: {text, generatedAt}}}
    flashcards: {},  // {docId: [{id, page, front, back, sourceText, sourceHighlightId?, createdAt, interval, ease, due, reviews}]}
    settings: {
      reader: { fontSize: 18, theme: "light", lineHeight: 1.6 },
    },
  };
}

// === Backend: localStorage ===
class LocalBackend {
  constructor() { this.name = "local"; }
  async load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return emptyData();
      const data = JSON.parse(raw);
      return migrate(data);
    } catch (e) {
      console.warn("[storage] load fallback:", e);
      return emptyData();
    }
  }
  async save(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error("[storage] save error:", e);
    }
  }
}

// === Backend: Google Drive (placeholder hasta tener Client ID) ===
// Se implementa en drive-sync.js. Storage solo necesita load() y save().
class DriveBackend {
  constructor(driveSync) {
    this.name = "drive";
    this.drive = driveSync;
    // Mantenemos también una copia en localStorage como caché offline
    this.local = new LocalBackend();
  }
  async load() {
    // Leer Drive y local, quedarnos con el más reciente
    const [remote, local] = await Promise.all([
      this.drive.loadData().catch(e => { console.warn("[storage] drive load fail:", e); return null; }),
      this.local.load(),
    ]);
    if (!remote) return local;
    if ((remote.updated || 0) >= (local.updated || 0)) {
      // Drive es más reciente — actualizar caché local
      await this.local.save(remote);
      return remote;
    }
    // Local es más reciente — subir a Drive
    this.drive.saveData(local).catch(()=>{});
    return local;
  }
  async save(data) {
    // Guardar siempre primero en local (sync) y luego en Drive (async)
    await this.local.save(data);
    this.drive.saveData(data).catch(e => console.warn("[storage] drive save fail:", e));
  }
}

// === Migraciones de esquema ===
function migrate(data) {
  if (!data || typeof data !== "object") return emptyData();
  if (!data.schema || data.schema < 1) {
    // Migración inicial — completar campos que falten
    const fresh = emptyData();
    return { ...fresh, ...data, schema: SCHEMA_VERSION };
  }
  // v1 → v2: agregar summaries y flashcards si no existen
  if (data.schema < 2) {
    if (!data.summaries) data.summaries = {};
    if (!data.flashcards) data.flashcards = {};
    data.schema = 2;
  }
  return data;
}

// === API pública del Storage ===
class Storage {
  constructor() {
    this.backend = new LocalBackend();
    this.data = null;
    this.listeners = new Set();
    this.saveTimer = null;
    this._loadPromise = null;
  }

  async init() {
    if (this._loadPromise) return this._loadPromise;
    this._loadPromise = this._loadInternal();
    return this._loadPromise;
  }

  async _loadInternal() {
    this.data = await this.backend.load();
    this._emit("load");
    return this.data;
  }

  // Cambia el backend (p.ej. al conectar Drive)
  async setBackend(backend) {
    this.backend = backend;
    this._loadPromise = null;
    await this.init();
  }

  // Persistir con debounce — varias llamadas seguidas → un solo save
  _scheduleSave(immediate = false) {
    this.data.updated = Date.now();
    if (this.saveTimer) clearTimeout(this.saveTimer);
    if (immediate) {
      this.backend.save(this.data);
      return;
    }
    this.saveTimer = setTimeout(() => {
      this.backend.save(this.data);
      this.saveTimer = null;
    }, 800);
  }

  // === Eventos para que la UI se entere de cambios ===
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  _emit(event, payload) {
    for (const fn of this.listeners) {
      try { fn(event, payload); } catch (e) { console.error(e); }
    }
  }

  // === BOOKMARKS ===
  bookmarkKey(doc, page) { return `${doc}-${page}`; }

  isBookmarked(doc, page) {
    return !!this.data?.bookmarks[this.bookmarkKey(doc, page)];
  }

  toggleBookmark(doc, page, note = "") {
    const key = this.bookmarkKey(doc, page);
    if (this.data.bookmarks[key]) {
      delete this.data.bookmarks[key];
      this._emit("bookmark", { action: "remove", doc, page });
    } else {
      this.data.bookmarks[key] = { doc, page, addedAt: Date.now(), note };
      this._emit("bookmark", { action: "add", doc, page });
    }
    this._scheduleSave();
    return this.isBookmarked(doc, page);
  }

  setBookmarkNote(doc, page, note) {
    const key = this.bookmarkKey(doc, page);
    if (!this.data.bookmarks[key]) {
      this.data.bookmarks[key] = { doc, page, addedAt: Date.now(), note };
    } else {
      this.data.bookmarks[key].note = note;
    }
    this._emit("bookmark", { action: "update", doc, page });
    this._scheduleSave();
  }

  getBookmarks() {
    return Object.values(this.data?.bookmarks || {});
  }

  // === NOTAS ===
  noteKey(doc, page) { return `${doc}-${page}`; }

  getNote(doc, page) {
    return this.data?.notes[this.noteKey(doc, page)]?.text || "";
  }

  setNote(doc, page, text) {
    const key = this.noteKey(doc, page);
    if (!text || !text.trim()) {
      delete this.data.notes[key];
    } else {
      this.data.notes[key] = { doc, page, text: text.trim(), updatedAt: Date.now() };
    }
    this._emit("note", { doc, page });
    this._scheduleSave();
  }

  getAllNotes() {
    return Object.values(this.data?.notes || {});
  }

  // === HIGHLIGHTS (subrayados del lector iBook) ===
  addHighlight(doc, h) {
    if (!this.data.highlights[doc]) this.data.highlights[doc] = [];
    this.data.highlights[doc].push({ ...h, addedAt: Date.now(), id: cryptoRandomId() });
    this._emit("highlight", { doc });
    this._scheduleSave();
  }

  removeHighlight(doc, id) {
    if (!this.data.highlights[doc]) return;
    this.data.highlights[doc] = this.data.highlights[doc].filter(h => h.id !== id);
    this._emit("highlight", { doc });
    this._scheduleSave();
  }

  getHighlights(doc) {
    return this.data?.highlights[doc] || [];
  }

  // === PROGRESO DE LECTURA ===
  setProgress(doc, page) {
    if (!this.data.progress[doc]) {
      this.data.progress[doc] = { lastPage: page, lastReadAt: Date.now(), completedPages: [] };
    } else {
      this.data.progress[doc].lastPage = page;
      this.data.progress[doc].lastReadAt = Date.now();
      if (!this.data.progress[doc].completedPages.includes(page)) {
        this.data.progress[doc].completedPages.push(page);
      }
    }
    this._emit("progress", { doc, page });
    this._scheduleSave();
  }

  getProgress(doc) {
    return this.data?.progress[doc] || null;
  }

  getAllProgress() {
    return this.data?.progress || {};
  }

  // === SIMULACROS ===
  addSimulacroResult(result) {
    this.data.simulacros.unshift({
      id: cryptoRandomId(),
      date: Date.now(),
      ...result,
    });
    // Limitar a 50 intentos (para no llenar Drive)
    this.data.simulacros = this.data.simulacros.slice(0, 50);
    this._emit("simulacro");
    this._scheduleSave();
  }

  getSimulacros() {
    return this.data?.simulacros || [];
  }

  // === PLAN DE ESTUDIO ===
  setPlan(plan) {
    this.data.plan = plan;
    this._emit("plan");
    this._scheduleSave();
  }

  getPlan() { return this.data?.plan || null; }

  markSessionDone(sessionId) {
    if (!this.data.plan) return;
    const s = this.data.plan.sessions.find(x => x.id === sessionId);
    if (s) {
      s.doneAt = Date.now();
      this._emit("plan");
      this._scheduleSave();
    }
  }

  // === RESÚMENES IA (caché por página) ===
  saveSummary(doc, page, text) {
    if (!this.data.summaries) this.data.summaries = {};
    if (!this.data.summaries[doc]) this.data.summaries[doc] = {};
    this.data.summaries[doc][page] = { text, generatedAt: Date.now() };
    this._emit("summary", { doc, page });
    this._scheduleSave();
  }

  getSummary(doc, page) {
    return this.data?.summaries?.[doc]?.[page] || null;
  }

  removeSummary(doc, page) {
    if (this.data?.summaries?.[doc]?.[page]) {
      delete this.data.summaries[doc][page];
      this._emit("summary", { doc, page });
      this._scheduleSave();
    }
  }

  // === FLASHCARDS (con repaso espaciado SM-2 simplificado) ===
  addFlashcard(doc, card) {
    if (!this.data.flashcards) this.data.flashcards = {};
    if (!this.data.flashcards[doc]) this.data.flashcards[doc] = [];
    const fc = {
      id: cryptoRandomId(),
      doc,
      page: card.page || 0,
      front: (card.front || "").trim(),
      back: (card.back || "").trim(),
      sourceText: (card.sourceText || "").trim(),
      sourceHighlightId: card.sourceHighlightId || null,
      createdAt: Date.now(),
      // Repaso espaciado
      interval: 1,                                // días hasta próximo repaso
      ease: 2.5,                                  // factor de facilidad (SM-2)
      due: Date.now() + 24 * 3600 * 1000,         // primera vez: mañana
      reviews: 0,
      lastReviewAt: null,
    };
    this.data.flashcards[doc].push(fc);
    this._emit("flashcard", { doc, action: "add" });
    this._scheduleSave();
    return fc;
  }

  getFlashcards(doc) {
    if (!this.data.flashcards) return [];
    if (doc != null) return this.data.flashcards[doc] || [];
    return Object.entries(this.data.flashcards)
      .flatMap(([d, cards]) => cards.map(c => ({ ...c, doc: parseInt(d, 10) })));
  }

  // Tarjetas con due <= ahora (listas para repasar)
  getDueFlashcards() {
    const now = Date.now();
    return this.getFlashcards().filter(c => (c.due || 0) <= now);
  }

  updateFlashcardReview(doc, id, quality) {
    // quality: 0=Difícil, 1=Bien, 2=Fácil, 3=Perfecto
    if (!this.data.flashcards?.[doc]) return;
    const card = this.data.flashcards[doc].find(c => c.id === id);
    if (!card) return;
    if (quality === 0) {
      card.interval = 1;
      card.ease = Math.max(1.3, (card.ease || 2.5) - 0.2);
    } else {
      const baseInterval = card.reviews === 0 ? 1 : (card.interval || 1);
      card.interval = Math.max(1, Math.round(baseInterval * (card.ease || 2.5)));
      if (quality >= 2) card.ease = (card.ease || 2.5) + 0.15;
    }
    card.due = Date.now() + card.interval * 24 * 3600 * 1000;
    card.reviews = (card.reviews || 0) + 1;
    card.lastReviewAt = Date.now();
    this._emit("flashcard", { doc, action: "review", id });
    this._scheduleSave();
    return card;
  }

  removeFlashcard(doc, id) {
    if (!this.data.flashcards?.[doc]) return;
    this.data.flashcards[doc] = this.data.flashcards[doc].filter(c => c.id !== id);
    this._emit("flashcard", { doc, action: "remove", id });
    this._scheduleSave();
  }

  updateFlashcard(doc, id, patch) {
    if (!this.data.flashcards?.[doc]) return;
    const card = this.data.flashcards[doc].find(c => c.id === id);
    if (!card) return;
    Object.assign(card, patch);
    this._emit("flashcard", { doc, action: "update", id });
    this._scheduleSave();
    return card;
  }

  // === SETTINGS ===
  getSetting(path, fallback) {
    const parts = path.split(".");
    let cur = this.data?.settings;
    for (const p of parts) {
      if (!cur) return fallback;
      cur = cur[p];
    }
    return cur ?? fallback;
  }

  setSetting(path, value) {
    if (!this.data.settings) this.data.settings = {};
    const parts = path.split(".");
    let cur = this.data.settings;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!cur[parts[i]]) cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
    this._emit("settings", { path, value });
    this._scheduleSave();
  }

  // === EXPORT / IMPORT manual ===
  exportJson() {
    return JSON.stringify(this.data, null, 2);
  }

  async importJson(jsonStr) {
    const parsed = migrate(JSON.parse(jsonStr));
    this.data = parsed;
    this._scheduleSave(true);
    this._emit("import");
  }

  async clear() {
    this.data = emptyData();
    this._scheduleSave(true);
    this._emit("clear");
  }
}

function cryptoRandomId() {
  return crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
}

// Singleton — todas las páginas usan la misma instancia
const storage = new Storage();

export { storage, Storage, LocalBackend, DriveBackend, emptyData, SCHEMA_VERSION };
