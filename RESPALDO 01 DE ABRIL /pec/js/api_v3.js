// pec/js/api.js

window._log = location.hostname === 'localhost' ? console.log.bind(console) : () => {};

const USE_MOCK = false;
// La URL que te dará Google Apps Script cuando lo publiques
const GOOGLE_SHEETS_API_URL = "https://script.google.com/macros/s/AKfycbwqT7gO_vF_V20F0kFvQdIwQslBuLqc5_wVtiNU_lfsDN5l3kMp3AV1uN9423eG0TyLNw/exec";

const api = {
    // Almacén temporal de datos para no recargar en cada clic
    cache: null,

    async fetchAllData() {
        if (USE_MOCK) {
            return MOCK_DATA;
        }

        if (this.cache) return this.cache;

        const userEmail = sessionStorage.getItem('user_email') || "";
        const userRole = sessionStorage.getItem('user_role') || "";
        // Cache buster + Redirect follow (v3.3 compatible)
        const url = `${GOOGLE_SHEETS_API_URL}?userEmail=${encodeURIComponent(userEmail)}&userRole=${encodeURIComponent(userRole)}&_t=${Date.now()}`;

        // Pide la información real a Google Sheets
        const response = await fetch(url, {
            method: 'GET',
            redirect: 'follow'
        });

        window._log(`DEBUG - API Status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            const text = await response.text();
            console.error("DEBUG - Fallo de red:", text);
            throw new Error(`Error de red (${response.status}): Verifica la URL de la API.`);
        }

        const data = await response.json();
        window._log("DEBUG - Datos recibidos (Primeros 100 caracteres):", JSON.stringify(data).substring(0, 100));

        if (data.status === "error") throw new Error(data.message);

        this.cache = data;
        return data;
    },

    // Caché separada para datos globales (sin filtro por docente)
    _globalCache: null,

    // Fetch SIN userEmail: el GAS no aplica filtro de docente cuando userEmail=""
    // Usado exclusivamente por Dashboard y Vista Rápida para métricas globales
    async fetchAllDataGlobal() {
        if (USE_MOCK) return MOCK_DATA;
        if (this._globalCache) return this._globalCache;

        const url = `${GOOGLE_SHEETS_API_URL}?_t=${Date.now()}`;
        const response = await fetch(url, { method: 'GET', redirect: 'follow' });
        if (!response.ok) throw new Error(`Error de red (${response.status})`);
        const data = await response.json();
        if (data.status === "error") throw new Error(data.message);

        this._globalCache = data;
        return data;
    },

    async getDashboardData() {
        // Datos globales (sin filtro docente) para métricas de Dashboard y Vista Rápida
        const db = await this.fetchAllDataGlobal();

        const materiasPorEquipo = 7;
        const totalEsperado = (db.equipos || []).length * materiasPorEquipo;
        // db.evaluaciones aquí ya es global porque fetchAllDataGlobal no envía userEmail
        const evGlobal = db.evaluaciones || [];
        const avancePorcentaje = totalEsperado === 0 ? 0 : Math.round((evGlobal.length / totalEsperado) * 100);

        return {
            totalGrupos: db.grupos ? db.grupos.length : 0,
            totalEquipos: db.equipos ? db.equipos.length : 0,
            evaluaciones:       evGlobal,
            todasEvaluaciones:  evGlobal,
            grupos:       db.grupos       || [],
            equipos:      db.equipos      || [],
            avance:       avancePorcentaje,
            directorio:   db.directorio   || [],
            programacion: db.programacion || [],
            sinEquipo:    db.sinEquipo    || [],
            config:       db.config       || {}
        };
    },

    async getGrupos() {
        const db = await this.fetchAllData();
        return db.grupos;
    },

    async getEquiposPorGrupo(grupoId) {
        const db = await this.fetchAllData();
        return db.equipos.filter(e => e.grupo === grupoId);
    },

    async getDirectorio() {
        const db = await this.fetchAllData();
        return db.directorio || [];
    },

    async getConcentrado() {
        const db = await this.fetchAllData();
        return [...db.evaluaciones].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    },

    async guardarEvaluacion(datos) {
        if (USE_MOCK) {
            datos.fecha = new Date().toISOString().slice(0, 19).replace('T', ' ');
            MOCK_DATA.evaluaciones.unshift(datos);
            const eq = MOCK_DATA.equipos.find(e => e.id === datos.equipoId);
            if (eq) eq.estado = "Evaluado";
            return { status: 'success' };
        }

        // Registrar autoría
        datos.docente_email = sessionStorage.getItem('user_email') || "";

        // Enviar a Google Sheets
        const response = await fetch(GOOGLE_SHEETS_API_URL, {
            method: 'POST',
            body: JSON.stringify(datos),
            headers: {
                "Content-Type": "text/plain;charset=utf-8",
            }
        });

        const result = await response.json();

        // Limpiar ambas cachés para que la próxima lectura traiga datos frescos
        this.cache = null;
        this._globalCache = null;

        return result;
    },

    async generarExcel() {
        if (USE_MOCK) {
            await this.delay(1000);
            return { status: 'success' };
        }

        // Solicitar a Google Sheets que compile la Sábana
        const response = await fetch(GOOGLE_SHEETS_API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: "export" }),
            headers: {
                "Content-Type": "text/plain;charset=utf-8",
            }
        });

        return await response.json();
    },

    // ── MÓDULO DE EDICIÓN POSTERIOR ─────────────────────────────────────────

    async buscarParaEditar(filtros = {}) {
        const userEmail = sessionStorage.getItem('user_email') || "";
        const params = new URLSearchParams({
            action: "getEdicion",
            userEmail,
            _t: Date.now()
        });
        if (filtros.parcial)  params.set('parcial',  filtros.parcial);
        if (filtros.grupo)    params.set('grupo',     filtros.grupo);
        if (filtros.materia)  params.set('materia',   filtros.materia);

        const res = await fetch(`${GOOGLE_SHEETS_API_URL}?${params}`, { redirect: 'follow' });
        const data = await res.json();
        if (data.status === "error") throw new Error(data.message);
        return data;  // { evaluaciones, fechaCierre, edicionAbierta, isAdmin }
    },

    async editarEvaluacion(datos) {
        const userEmail = sessionStorage.getItem('user_email') || "";
        const payload = { action: "editarEvaluacion", userEmail, ...datos };
        const res = await fetch(GOOGLE_SHEETS_API_URL, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: { "Content-Type": "text/plain;charset=utf-8" }
        });
        this.cache = null;
        this._globalCache = null;  // invalidar también caché global
        return await res.json();
    },

    async getBitacora() {
        const userEmail = sessionStorage.getItem('user_email') || "";
        const url = `${GOOGLE_SHEETS_API_URL}?action=getBitacora&userEmail=${encodeURIComponent(userEmail)}&_t=${Date.now()}`;
        const res = await fetch(url, { redirect: 'follow' });
        const data = await res.json();
        if (data.status === "error") throw new Error(data.message);
        return data.bitacora || [];
    }
};

// Exponer al ámbito global para visibilidad en todo el PEC
window.api = api;
