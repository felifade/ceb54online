/**
 * MÓDULO: SEMANAS CD — CEB 5/4
 * ─────────────────────────────────────────────────────────────────
 * Responsabilidad ÚNICA: gestionar qué semanas son visibles
 * para alumnos en los portales de Cultura Digital II y III.
 *
 * CÓMO DESPLEGARLO (solo una vez):
 *   1. Crear nuevo proyecto en script.google.com
 *   2. Pegar este archivo completo
 *   3. Desplegar > Nueva implementación > Aplicación web
 *      - Ejecutar como: Yo
 *      - Acceso: Cualquiera (anónimo)
 *   4. Copiar la URL del deployment
 *   5. En cultura-digital/index.html y cultura-digital-iii/index.html
 *      reemplazar _CD_GAS con la nueva URL
 *
 * INDEPENDIENTE: no usa SpreadsheetApp, no toca PEC, no tiene
 * lógica de equipos ni evaluaciones. Solo PropertiesService.
 * ─────────────────────────────────────────────────────────────────
 */

// Valores por defecto si nunca se ha guardado nada
const CD_DEFAULTS = {
  cd2: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  cd3: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
};

// Materias válidas (previene escrituras arbitrarias)
const CD_MATERIAS_VALIDAS = Object.keys(CD_DEFAULTS);

// ── Helpers ──────────────────────────────────────────────────────

function _json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function _ok(extra) {
  return _json({ status: 'success', ...extra });
}

function _err(msg) {
  return _json({ status: 'error', message: msg });
}

function _getActivas(mat) {
  const props = PropertiesService.getScriptProperties();
  const raw   = props.getProperty('semanas_' + mat);
  return raw ? JSON.parse(raw) : CD_DEFAULTS[mat];
}

function _setActivas(mat, activas) {
  PropertiesService.getScriptProperties()
    .setProperty('semanas_' + mat, JSON.stringify(activas));
}

// ── Router GET ───────────────────────────────────────────────────

function doGet(e) {
  try {
    const action = (e.parameter.action || '').trim();
    const mat    = (e.parameter.mat    || '').toLowerCase().trim();

    switch (action) {

      case 'getSemanasActivas': {
        if (!CD_MATERIAS_VALIDAS.includes(mat)) return _err('Materia no reconocida: ' + mat);
        return _ok({ mat, activas: _getActivas(mat) });
      }

      case 'getAllSemanas': {
        // Devuelve el estado de todas las materias de una vez
        const todas = {};
        CD_MATERIAS_VALIDAS.forEach(m => { todas[m] = _getActivas(m); });
        return _ok({ semanas: todas });
      }

      case 'ping':
        return _ok({ mensaje: 'API Semanas CD operativa', version: '1.0' });

      default:
        return _err('Acción no reconocida: ' + action);
    }

  } catch (err) {
    return _err('Error interno: ' + err.toString());
  }
}

// ── Router POST ──────────────────────────────────────────────────

function doPost(e) {
  try {
    const body   = JSON.parse(e.postData.contents);
    const action = (body.action || '').trim();
    const mat    = (body.mat    || '').toLowerCase().trim();

    switch (action) {

      case 'setSemanasActivas': {
        if (!CD_MATERIAS_VALIDAS.includes(mat)) return _err('Materia no reconocida: ' + mat);
        if (!Array.isArray(body.activas))        return _err('activas debe ser un array.');

        const activas = body.activas
          .map(Number)
          .filter(n => Number.isInteger(n) && n >= 1 && n <= 20)
          .sort((a, b) => a - b);

        _setActivas(mat, activas);
        return _ok({ mat, activas });
      }

      default:
        return _err('Acción no reconocida: ' + action);
    }

  } catch (err) {
    return _err('Error interno: ' + err.toString());
  }
}
