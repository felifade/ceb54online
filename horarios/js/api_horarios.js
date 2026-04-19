// ============================================================
// api_horarios.js — Cliente API del módulo de Horarios CEB 5/4
// ============================================================

const HORARIOS_API_URL = "https://script.google.com/macros/s/AKfycbyQUyTVSi3-IxFpHR_ySzjaW5AxmXEiI29bVve4IixeKyOwtohWO-kreg8ycl0jFphw/exec";

// Cache en sessionStorage — 15 minutos de vigencia
const _HOR_CACHE_KEY = 'hor_web_v1';
const _HOR_CACHE_TTL = 15 * 60 * 1000;

const horariosAPI = {

  /** Obtiene los datos de HORARIOS_WEB (con caché). */
  async getHorariosWeb(forceRefresh) {
    if (!forceRefresh) {
      try {
        const raw = sessionStorage.getItem(_HOR_CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Date.now() - parsed.ts < _HOR_CACHE_TTL) return parsed.data;
        }
      } catch (_) {}
    }

    const url  = `${HORARIOS_API_URL}?action=getHorariosWeb&_t=${Date.now()}`;
    const res  = await fetch(url, { method: 'GET', redirect: 'follow' });
    const json = await res.json();

    if (json.status === 'error') throw new Error(json.message);

    try {
      sessionStorage.setItem(_HOR_CACHE_KEY, JSON.stringify({
        data: json.data,
        ts:   Date.now()
      }));
    } catch (_) {}

    return json.data;
  },

  /** Dispara la regeneración de HORARIOS_WEB. */
  async regenerar(adminKey) {
    const url = `${HORARIOS_API_URL}?action=regenerar&adminKey=${encodeURIComponent(adminKey)}&_t=${Date.now()}`;
    const res = await fetch(url, { method: 'GET', redirect: 'follow' });
    return res.json();
  },

  /** Limpia la caché local. */
  clearCache() {
    try { sessionStorage.removeItem(_HOR_CACHE_KEY); } catch (_) {}
  },

  // ── MÉTODOS DE CAPTURA ──────────────────────────────────────

  /** Lista UACs del catálogo CATALOGO_UAC. Retorna [] si la hoja no existe. */
  async getCatalogoUAC() {
    const url  = `${HORARIOS_API_URL}?action=getCatalogoUAC&_t=${Date.now()}`;
    const res  = await fetch(url, { method: 'GET', redirect: 'follow' });
    const json = await res.json();
    if (json.status === 'error') throw new Error(json.message);
    return json.data || [];
  },

  /** Lista docentes de DOCENTES_RAW. */
  async getDocentes() {
    const url = `${HORARIOS_API_URL}?action=getDocentes&_t=${Date.now()}`;
    const res = await fetch(url, { method: 'GET', redirect: 'follow' });
    const json = await res.json();
    if (json.status === 'error') throw new Error(json.message);
    return json.data || [];
  },

  /** Guarda o actualiza un docente en DOCENTES_RAW. */
  async saveDocente(adminKey, docente) {
    return this._post_({ action: 'saveDocente', adminKey, docente });
  },

  /** Guarda filas de carga horaria en HORARIOS_RAW. */
  async saveCargaHoraria(adminKey, filas) {
    return this._post_({ action: 'saveCargaHoraria', adminKey, filas });
  },

  /** Guarda filas de extraescolares en EXTRAESCOLARES_RAW. */
  async saveExtraescolares(adminKey, filas) {
    return this._post_({ action: 'saveExtraescolares', adminKey, filas });
  },

  // ── MÉTODOS DE EDICIÓN ──────────────────────────────────────

  /**
   * Devuelve la carga horaria y extraescolares de un docente/ciclo concreto.
   * Usado para poblar el formulario en modo edición.
   */
  async getDocenteData(clave, ciclo) {
    const url = `${HORARIOS_API_URL}?action=getDocenteData&clave=${encodeURIComponent(clave)}&ciclo=${encodeURIComponent(ciclo)}&_t=${Date.now()}`;
    const res  = await fetch(url, { method: 'GET', redirect: 'follow' });
    const json = await res.json();
    if (json.status === 'error') throw new Error(json.message);
    return json.data || { carga: [], extra: [] };
  },

  /**
   * Reemplaza (borra + reinserta) la carga horaria de un docente/ciclo.
   * Solo afecta las filas que coincidan con esa clave y ese ciclo.
   */
  async replaceCargaHoraria(adminKey, clave, ciclo, filas) {
    return this._post_({ action: 'replaceCargaHoraria', adminKey, clave, ciclo, filas });
  },

  /**
   * Reemplaza (borra + reinserta) los extraescolares de un docente/ciclo.
   */
  async replaceExtraescolares(adminKey, clave, ciclo, filas) {
    return this._post_({ action: 'replaceExtraescolares', adminKey, clave, ciclo, filas });
  },

  /** Helper interno para POST. */
  async _post_(body) {
    const res  = await fetch(HORARIOS_API_URL, {
      method:  'POST',
      redirect: 'follow',
      body:    JSON.stringify(body)
    });
    const json = await res.json();
    if (json.status === 'error') throw new Error(json.message);
    return json;
  }
};
