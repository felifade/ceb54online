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

// ── Semanas escolares (igual que CONFIG_CALENDARIO en app_calendario.js) ──
// Vacaciones excluidas del conteo académico, misma lógica que generarCronogramaEfectivo()
const PREF_FECHA_INICIO = "2026-02-11";
const PREF_FECHA_FIN    = "2026-07-30";
const PREF_VACACIONES   = [
    { inicio: "2026-03-30", fin: "2026-04-10" }   // Receso escolar — Semana Santa
];

function _prefCronograma() {
    const semanas = [];
    const ini = new Date(PREF_FECHA_INICIO + 'T00:00:00');
    const fin = new Date(PREF_FECHA_FIN + 'T23:59:59');
    let curIni = new Date(ini);
    let curFin = new Date(ini);
    curFin.setDate(ini.getDate() + (7 - ini.getDay()) % 7);
    curFin.setHours(23, 59, 59, 999);
    let numAcad = 0;
    while (curIni <= fin) {
        const esVac = PREF_VACACIONES.some(v => {
            const vs = new Date(v.inicio + 'T00:00:00');
            const ve = new Date(v.fin   + 'T23:59:59');
            return (curIni <= ve && curFin >= vs);
        });
        if (!esVac) numAcad++;
        semanas.push({ num: esVac ? 0 : numAcad, start: new Date(curIni), end: new Date(curFin) });
        curIni = new Date(curFin); curIni.setDate(curFin.getDate() + 1); curIni.setHours(0,0,0,0);
        curFin = new Date(curIni); curFin.setDate(curIni.getDate() + 6); curFin.setHours(23,59,59,999);
    }
    return semanas;
}
const _PREF_SEMANAS = _prefCronograma();

function prefGetSemanaActual() {
    const hoy = new Date(); hoy.setHours(12, 0, 0, 0);
    const s = _PREF_SEMANAS.find(s => hoy >= s.start && hoy <= s.end);
    return s ? s.num : 0;
}

function prefGetSemanaDeDate(fechaStr) {
    const d = new Date(fechaStr + 'T12:00:00');
    const s = _PREF_SEMANAS.find(s => d >= s.start && d <= s.end);
    return s ? s.num : 0;
}

window.prefecturaAPI = prefecturaAPI;
window.prefGetSemanaActual = prefGetSemanaActual;
window.prefGetSemanaDeDate = prefGetSemanaDeDate;
