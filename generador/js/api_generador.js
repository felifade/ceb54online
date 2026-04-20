/* ════════════════════════════════════════════════════════════════
   api_generador.js — Cliente API del Generador de Horarios Online
   CEB 5/4 — v1.0.0
   ════════════════════════════════════════════════════════════════
   ▶ Pega aquí la URL del despliegue del GAS (generador.gs):
   ════════════════════════════════════════════════════════════════ */

const GEN_API_URL = 'https://script.google.com/macros/s/AKfycbxkSJkIqZsa1zlZDPSBET-ACLfDYrE3hwbm2KqszFiUe-qHUTRMGfMlh_I4LKKMyGc/exec';  // ← Pega aquí la URL del GAS desplegado

// ── CACHE ────────────────────────────────────────────────────────
const _GEN_CACHE_ = {
  config: null,
  docentes: null,
  grupos: null,
  materias: null,
  aulas: null,
  cargaKey: null,   // 'ciclo'
  carga: null,
  horariosKey: null,  // 'ciclo|version'
  horarios: null,
  hiKey: null,          // 'ciclo|periodo'
  hi: null,
  estructuraKey: null,  // 'ciclo|periodo'
  estructura: null,
  estadoEstKey: null,   // 'ciclo|periodo'
  estadoEst: null
};

function genClearCache() {
  Object.keys(_GEN_CACHE_).forEach(function (k) { _GEN_CACHE_[k] = null; });
}

// ── HELPERS INTERNOS ─────────────────────────────────────────────
async function _genGet_(action, params) {
  if (!GEN_API_URL) throw new Error('GEN_API_URL no configurada. Abre js/api_generador.js y pega la URL del GAS.');
  var qs = Object.keys(params || {}).map(function (k) {
    return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
  }).join('&');
  var url = GEN_API_URL + '?action=' + action + (qs ? '&' + qs : '') + '&_t=' + Date.now();
  var res = await fetch(url, { method: 'GET', redirect: 'follow' });
  var json = await res.json();
  if (json.status === 'error') throw new Error(json.message);
  return json.data !== undefined ? json.data : json;
}

async function _genPost_(body) {
  if (!GEN_API_URL) throw new Error('GEN_API_URL no configurada. Abre js/api_generador.js y pega la URL del GAS.');
  var res = await fetch(GEN_API_URL, {
    method: 'POST',
    redirect: 'follow',
    body: JSON.stringify(body)
  });
  var json = await res.json();
  if (json.status === 'error') throw new Error(json.message);
  return json;
}

// ── API PÚBLICA ───────────────────────────────────────────────────
const genAPI = {

  // ── DIAGNÓSTICO ───────────────────────────────────────────────
  async ping() {
    return _genGet_('ping');
  },

  // ── CONFIGURACIÓN ─────────────────────────────────────────────
  async getConfig(force) {
    if (!force && _GEN_CACHE_.config) return _GEN_CACHE_.config;
    _GEN_CACHE_.config = await _genGet_('getConfig');
    return _GEN_CACHE_.config;
  },

  async saveConfig(adminKey, cfg) {
    _GEN_CACHE_.config = null;
    return _genPost_({ action: 'saveConfig', adminKey, config: cfg });
  },

  // ── CATÁLOGOS ─────────────────────────────────────────────────
  async getDocentes(force) {
    if (!force && _GEN_CACHE_.docentes) return _GEN_CACHE_.docentes;
    _GEN_CACHE_.docentes = await _genGet_('getDocentes');
    return _GEN_CACHE_.docentes;
  },

  async saveDocente(adminKey, record) {
    _GEN_CACHE_.docentes = null;
    return _genPost_({ action: 'saveDocente', adminKey, record });
  },

  async deleteDocente(adminKey, id) {
    _GEN_CACHE_.docentes = null;
    return _genPost_({ action: 'deleteDocente', adminKey, id });
  },

  async getGrupos(force) {
    if (!force && _GEN_CACHE_.grupos) return _GEN_CACHE_.grupos;
    _GEN_CACHE_.grupos = await _genGet_('getGrupos');
    return _GEN_CACHE_.grupos;
  },

  async saveGrupo(adminKey, record) {
    _GEN_CACHE_.grupos = null;
    return _genPost_({ action: 'saveGrupo', adminKey, record });
  },

  async deleteGrupo(adminKey, id) {
    _GEN_CACHE_.grupos = null;
    return _genPost_({ action: 'deleteGrupo', adminKey, id });
  },

  async getMaterias(force) {
    if (!force && _GEN_CACHE_.materias) return _GEN_CACHE_.materias;
    _GEN_CACHE_.materias = await _genGet_('getMaterias');
    return _GEN_CACHE_.materias;
  },

  async saveMateria(adminKey, record) {
    _GEN_CACHE_.materias = null;
    return _genPost_({ action: 'saveMateria', adminKey, record });
  },

  async deleteMateria(adminKey, id) {
    _GEN_CACHE_.materias = null;
    return _genPost_({ action: 'deleteMateria', adminKey, id });
  },

  async getAulas(force) {
    if (!force && _GEN_CACHE_.aulas) return _GEN_CACHE_.aulas;
    _GEN_CACHE_.aulas = await _genGet_('getAulas');
    return _GEN_CACHE_.aulas;
  },

  async saveAula(adminKey, record) {
    _GEN_CACHE_.aulas = null;
    return _genPost_({ action: 'saveAula', adminKey, record });
  },

  async deleteAula(adminKey, id) {
    _GEN_CACHE_.aulas = null;
    return _genPost_({ action: 'deleteAula', adminKey, id });
  },

  // ── CARGA HORARIA ─────────────────────────────────────────────
  async getCarga(ciclo, force) {
    var key = ciclo || '';
    if (!force && _GEN_CACHE_.cargaKey === key && _GEN_CACHE_.carga) return _GEN_CACHE_.carga;
    _GEN_CACHE_.cargaKey = key;
    _GEN_CACHE_.carga = await _genGet_('getCarga', { ciclo: ciclo || '' });
    return _GEN_CACHE_.carga;
  },

  async saveCargaFila(adminKey, record) {
    _GEN_CACHE_.carga = null;
    return _genPost_({ action: 'saveCargaFila', adminKey, record });
  },

  async deleteCargaFila(adminKey, id) {
    _GEN_CACHE_.carga = null;
    return _genPost_({ action: 'deleteCargaFila', adminKey, id });
  },

  async replaceCargaGrupo(adminKey, ciclo, grupo_id, filas) {
    _GEN_CACHE_.carga = null;
    return _genPost_({ action: 'replaceCargaGrupo', adminKey, ciclo, grupo_id, filas });
  },

  // ── DISPONIBILIDAD ────────────────────────────────────────────
  async getDisponibilidad(ciclo, docente_id) {
    return _genGet_('getDisponibilidad', { ciclo: ciclo || '', docente_id: docente_id || '' });
  },

  async saveDisponibilidad(adminKey, ciclo, docente_id, filas) {
    return _genPost_({ action: 'saveDisponibilidad', adminKey, ciclo, docente_id, filas });
  },

  // ── HORARIOS ─────────────────────────────────────────────────
  async getHorarios(ciclo, version, force) {
    var key = (ciclo || '') + '|' + (version || '');
    if (!force && _GEN_CACHE_.horariosKey === key && _GEN_CACHE_.horarios) return _GEN_CACHE_.horarios;
    _GEN_CACHE_.horariosKey = key;
    _GEN_CACHE_.horarios = await _genGet_('getHorarios', { ciclo: ciclo || '', version: version || '' });
    return _GEN_CACHE_.horarios;
  },

  async saveHorarioFila(adminKey, record) {
    _GEN_CACHE_.horarios = null;
    return _genPost_({ action: 'saveHorarioFila', adminKey, record });
  },

  async deleteHorarioFila(adminKey, id) {
    _GEN_CACHE_.horarios = null;
    return _genPost_({ action: 'deleteHorarioFila', adminKey, id });
  },

  async replaceHorarioGrupo(adminKey, ciclo, version, grupo_id, filas) {
    _GEN_CACHE_.horarios = null;
    return _genPost_({ action: 'replaceHorarioGrupo', adminKey, ciclo, version, grupo_id, filas });
  },

  // ── RESTRICCIONES ─────────────────────────────────────────────
  async getRestricciones(ciclo) {
    return _genGet_('getRestricciones', { ciclo: ciclo || '' });
  },

  async saveRestriccion(adminKey, record) {
    return _genPost_({ action: 'saveRestriccion', adminKey, record });
  },

  async deleteRestriccion(adminKey, id) {
    return _genPost_({ action: 'deleteRestriccion', adminKey, id });
  },

  // ── VERSIONES ─────────────────────────────────────────────────
  async getVersiones(ciclo) {
    return _genGet_('getVersiones', { ciclo: ciclo || '' });
  },

  async saveVersion(adminKey, record) {
    return _genPost_({ action: 'saveVersion', adminKey, record });
  },

  // ── ANÁLISIS ──────────────────────────────────────────────────
  async getConflictos(ciclo, version) {
    return _genGet_('getConflictos', { ciclo: ciclo || '', version: version || '' });
  },

  async getOcupacionEspacios(ciclo, version) {
    return _genGet_('getOcupacionEspacios', { ciclo: ciclo || '', version: version || '' });
  },

  async getResumen(ciclo, version) {
    return _genGet_('getResumen', { ciclo: ciclo || '', version: version || '' });
  },

  // ── HORARIOS INICIALES ────────────────────────────────────────
  async getHorariosIniciales(ciclo, force) {
    var periodo = (typeof _genApp !== 'undefined' ? _genApp.periodo : '') || '';
    var key = (ciclo || '') + '|' + periodo;
    if (!force && _GEN_CACHE_.hiKey === key && _GEN_CACHE_.hi) return _GEN_CACHE_.hi;
    _GEN_CACHE_.hiKey = key;
    _GEN_CACHE_.hi = await _genGet_('getHorariosIniciales', { ciclo: ciclo || '', periodo: periodo });
    return _GEN_CACHE_.hi;
  },

  async saveHoraInicial(adminKey, record) {
    _GEN_CACHE_.hi = null;
    return _genPost_({ action: 'saveHoraInicial', adminKey, record });
  },

  async deleteHoraInicial(adminKey, id) {
    _GEN_CACHE_.hi = null;
    return _genPost_({ action: 'deleteHoraInicial', adminKey, id });
  },

  async replaceHorariosInicialesDocente(adminKey, ciclo, docente_id, filas) {
    var periodo = (typeof _genApp !== 'undefined' ? _genApp.periodo : '') || '';
    _GEN_CACHE_.hi = null;
    return _genPost_({ action: 'replaceHorariosInicialesDocente', adminKey, ciclo, periodo, docente_id, filas });
  },

  async horariosInicialesAEstructura(adminKey, ciclo) {
    var periodo = (typeof _genApp !== 'undefined' ? _genApp.periodo : '') || '';
    _GEN_CACHE_.hi = null;
    _GEN_CACHE_.estructura = null;
    return _genPost_({ action: 'horariosInicialesAEstructura', adminKey, ciclo, periodo });
  },

  // ── ESTRUCTURA EDUCATIVA ──────────────────────────────────────
  async getEstructura(ciclo, force) {
    var periodo = (typeof _genApp !== 'undefined' ? _genApp.periodo : '') || '';
    var key = (ciclo || '') + '|' + periodo;
    if (!force && _GEN_CACHE_.estructuraKey === key && _GEN_CACHE_.estructura) return _GEN_CACHE_.estructura;
    _GEN_CACHE_.estructuraKey = key;
    _GEN_CACHE_.estructura = await _genGet_('getEstructura', { ciclo: ciclo || '', periodo: periodo });
    return _GEN_CACHE_.estructura;
  },

  async saveEstructuraFila(adminKey, record) {
    _GEN_CACHE_.estructura = null;
    return _genPost_({ action: 'saveEstructuraFila', adminKey, record });
  },

  async deleteEstructuraFila(adminKey, id) {
    _GEN_CACHE_.estructura = null;
    return _genPost_({ action: 'deleteEstructuraFila', adminKey, id });
  },

  async replaceEstructura(adminKey, ciclo, filas) {
    var periodo = (typeof _genApp !== 'undefined' ? _genApp.periodo : '') || '';
    _GEN_CACHE_.estructura = null;
    return _genPost_({ action: 'replaceEstructura', adminKey, ciclo, periodo, filas });
  },

  async getEstadoEstructura(ciclo, force) {
    var periodo = (typeof _genApp !== 'undefined' ? _genApp.periodo : '') || '';
    var key = (ciclo || '') + '|' + periodo;
    if (!force && _GEN_CACHE_.estadoEstKey === key && _GEN_CACHE_.estadoEst) return _GEN_CACHE_.estadoEst;
    _GEN_CACHE_.estadoEstKey = key;
    _GEN_CACHE_.estadoEst = await _genGet_('getEstadoEstructura', { ciclo: ciclo || '', periodo: periodo });
    return _GEN_CACHE_.estadoEst;
  },

  async saveEstadoEstructura(adminKey, ciclo, estado) {
    var periodo = (typeof _genApp !== 'undefined' ? _genApp.periodo : '') || '';
    _GEN_CACHE_.estadoEst = null;
    return _genPost_({ action: 'saveEstadoEstructura', adminKey, ciclo, estado, periodo });
  },

  async validarEstructura(ciclo) {
    var periodo = (typeof _genApp !== 'undefined' ? _genApp.periodo : '') || '';
    return _genGet_('validarEstructura', { ciclo: ciclo || '', periodo: periodo });
  },

  async estructuraACarga(adminKey, ciclo, hints) {
    var periodo = (typeof _genApp !== 'undefined' ? _genApp.periodo : '') || '';
    _GEN_CACHE_.carga = null;
    var payload = { action: 'estructuraACarga', adminKey, ciclo, periodo };
    if (hints) {
      // matchHints: { "UAC nombre": "materia_id" }
      // docenteHints: { "Nombre docente": "docente_id" }
      // grupoHints: { "Etiqueta grupo": "grupo_id" }
      if (hints.matchHints)   payload.matchHints   = hints.matchHints;
      if (hints.docenteHints) payload.docenteHints = hints.docenteHints;
      if (hints.grupoHints)   payload.grupoHints   = hints.grupoHints;
    }
    return _genPost_(payload);
  }
};
