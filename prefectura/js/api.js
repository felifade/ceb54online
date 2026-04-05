// prefectura/js/api.js
// API EXCLUSIVA DEL MÓDULO PREFECTURA — no comparte estado con Tutorías ni PEC.

// Sustituir por la URL del GAS de Prefectura cuando esté desplegado.
// Por ahora apunta al mismo GAS general; el GAS distingue por action="prefectura_*"
// Mismo proyecto "PEC Sistemas" — el dispatcher de Portal Estudiantil CEB.gs
// enruta las acciones getPrefecturaBase, getIncidencias, saveIncidencia, marcarLaborSocial
const PREFECTURA_GAS_URL = "https://script.google.com/macros/s/AKfycbwqT7gO_vF_V20F0kFvQdIwQslBuLqc5_wVtiNU_lfsDN5l3kMp3AV1uN9423eG0TyLNw/exec";

const prefecturaAPI = {
    _cache: null,

    // ── Lectura general (grupos + alumnos desde hoja Directorio) ────────────
    async fetchBase() {
        if (this._cache) return this._cache;
        const url = `${PREFECTURA_GAS_URL}?action=getPrefecturaBase&_t=${Date.now()}`;
        const res = await fetch(url, { redirect: 'follow' });
        if (!res.ok) throw new Error(`Error de red (${res.status})`);
        const data = await res.json();
        if (data.status === 'error') throw new Error(data.message);
        this._cache = data;
        return data;
    },

    // ── Guardar incidencia (escribe en hoja Prefectura_Incidencias) ─────────
    async guardarIncidencia(datos) {
        datos.action = 'saveIncidencia';
        const res = await fetch(PREFECTURA_GAS_URL, {
            method: 'POST',
            body: JSON.stringify(datos),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
        const result = await res.json();
        this._cache = null;          // invalidar caché
        return result;
    },

    // ── Consultar incidencias con filtros ───────────────────────────────────
    async consultarIncidencias(filtros = {}) {
        const params = new URLSearchParams({ action: 'getIncidencias', _t: Date.now() });
        if (filtros.grupo) params.set('grupo', filtros.grupo);
        if (filtros.alumno) params.set('alumno', filtros.alumno);
        if (filtros.semana) params.set('semana', filtros.semana);
        if (filtros.tipo) params.set('tipo', filtros.tipo);
        const res = await fetch(`${PREFECTURA_GAS_URL}?${params}`, { redirect: 'follow' });
        if (!res.ok) throw new Error(`Error de red (${res.status})`);
        const data = await res.json();
        if (data.status === 'error') throw new Error(data.message);
        return data.incidencias || [];
    },

    // ── Marcar labor social realizada ───────────────────────────────────────
    async marcarLaborSocial(rowId, fecha) {
        const payload = {
            action: 'marcarLaborSocial',
            rowId,
            fecha_labor_social: fecha
        };
        const res = await fetch(PREFECTURA_GAS_URL, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
        const result = await res.json();
        this._cache = null;
        return result;
    }
};

// ── Semanas escolares (lógica independiente, compatible con app_calendario.js) ──
const PREF_FECHA_INICIO = "2026-02-11";  // misma base que CONFIG_CALENDARIO

function prefGetSemanaActual() {
    const inicio = new Date(PREF_FECHA_INICIO + 'T00:00:00');
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    if (hoy < inicio) return 0;
    const diff = Math.floor((hoy - inicio) / (7 * 24 * 60 * 60 * 1000));
    return diff + 1;
}

function prefGetSemanaDeDate(fechaStr) {
    const inicio = new Date(PREF_FECHA_INICIO + 'T00:00:00');
    const fecha = new Date(fechaStr + 'T00:00:00');
    if (fecha < inicio) return 0;
    const diff = Math.floor((fecha - inicio) / (7 * 24 * 60 * 60 * 1000));
    return diff + 1;
}

window.prefecturaAPI = prefecturaAPI;
window.prefGetSemanaActual = prefGetSemanaActual;
window.prefGetSemanaDeDate = prefGetSemanaDeDate;
