/**
 * MÓDULO: CONFIGURACIÓN CENTRAL — CEB 5/4
 * ─────────────────────────────────────────────────────────────────
 * Lee la hoja MASTER_CEB54 y expone la configuración del sistema.
 * Todos los demás módulos llaman a _initConfig() al inicio.
 *
 * CÓMO USARLO:
 *   Este archivo se copia en CADA proyecto GAS de módulo.
 *   No se despliega solo — es una librería interna.
 *
 * HOJA MASTER REQUERIDA:
 *   Spreadsheet: MASTER_CEB54
 *   Hoja: CONFIG  (columnas: Clave | Valor)
 *   Hoja: CICLOS  (columnas: Ciclo | URL | Estado | FechaCierre)
 * ─────────────────────────────────────────────────────────────────
 */

// ── ID del Spreadsheet MASTER (cambiar por el ID real al crear) ──
const MASTER_ID = 'REEMPLAZAR_CON_ID_DE_MASTER_CEB54';

// ── Cache de configuración en memoria (dura por ejecución) ───────
let _CONFIG = null;

/**
 * Carga la configuración desde MASTER una sola vez por ejecución.
 * Llama a esta función al inicio de cada función pública.
 */
function _initConfig() {
  if (_CONFIG) return _CONFIG; // ya cargado en esta ejecución

  const master = SpreadsheetApp.openById(MASTER_ID);

  // ── Leer hoja CONFIG ──
  const cfgSheet = master.getSheetByName('CONFIG');
  const cfgRows  = cfgSheet.getDataRange().getValues();
  const cfg = {};
  cfgRows.forEach(([k, v]) => { if (k) cfg[k] = v; });

  // ── Resolver Spreadsheet activo (sandbox o producción) ──
  const modo = String(cfg['MODO'] || 'PRODUCCION').trim().toUpperCase();
  const url  = modo === 'PRUEBAS'
    ? cfg['URL_SANDBOX']
    : cfg['URL_CICLO_ACTIVO'];

  _CONFIG = {
    cicloActivo:  cfg['CICLO_ACTIVO']  || '',
    modo,
    version:      cfg['VERSION_SISTEMA'] || '1.0',
    mantenimiento: cfg['MANTENIMIENTO'] === true || cfg['MANTENIMIENTO'] === 'true',
    ss: SpreadsheetApp.openByUrl(url),
  };

  return _CONFIG;
}

/**
 * Obtiene una hoja del Spreadsheet activo (ciclo activo o sandbox).
 * Busca por nombre ignorando acentos y mayúsculas.
 */
function _getHoja(nombre) {
  const cfg    = _initConfig();
  const target = _normalizar(nombre);
  const sheets = cfg.ss.getSheets();
  const hoja   = sheets.find(s => _normalizar(s.getName()) === target);
  if (!hoja) throw new Error('Hoja no encontrada: ' + nombre);
  return hoja;
}

/**
 * Normaliza texto para comparaciones: quita acentos, minúsculas, trim.
 */
function _normalizar(val) {
  return String(val || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Helper de respuesta JSON.
 */
function _json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function _ok(extra)  { return _json({ status: 'success', ...extra }); }
function _err(msg)   { return _json({ status: 'error', message: msg }); }

/**
 * Verifica mantenimiento. Llamar al inicio de doGet/doPost.
 * Retorna null si OK, o la respuesta de error si está en mantenimiento.
 */
function _checkMantenimiento() {
  const cfg = _initConfig();
  if (cfg.mantenimiento) return _err('Sistema en mantenimiento. Intenta más tarde.');
  return null;
}

// ── Endpoint de info pública (para monitoreo) ─────────────────────
function doGet_Config(e) {
  if (e.parameter.action === 'ping') {
    const cfg = _initConfig();
    return _ok({
      ciclo:   cfg.cicloActivo,
      modo:    cfg.modo,
      version: cfg.version,
    });
  }
  return _err('Acción no reconocida.');
}
