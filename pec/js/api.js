// pec/js/api.js

const USE_MOCK = false;
// La URL que te dará Google Apps Script cuando lo publiques
const GOOGLE_SHEETS_API_URL = "https://script.google.com/macros/s/AKfycbx-Wrrn0Do39mtqGgnT-aUaxRM8pVQwkpF1BpcIM9_ssxX9a3iF5R84G4aC3zsGKhHj/exec";

const api = {
    // Almacén temporal de datos para no recargar en cada clic
    cache: null,

    async fetchAllData() {
        if (USE_MOCK) {
            return MOCK_DATA;
        }

        const userEmail = sessionStorage.getItem('user_email') || "";
        // Cache buster + Redirect follow (v3.3 compatible)
        const url = `${GOOGLE_SHEETS_API_URL}?userEmail=${encodeURIComponent(userEmail)}&_t=${Date.now()}`;

        // Pide la información real a Google Sheets
        const response = await fetch(url, {
            method: 'GET',
            redirect: 'follow'
        });

        console.log(`DEBUG - API Status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            const text = await response.text();
            console.error("DEBUG - Fallo de red:", text);
            throw new Error(`Error de red (${response.status}): Verifica la URL de la API.`);
        }

        const data = await response.json();
        console.log("DEBUG - Datos recibidos (Primeros 100 caracteres):", JSON.stringify(data).substring(0, 100));

        if (data.status === "error") throw new Error(data.message);

        this.cache = data;
        return data;
    },

    async getDashboardData() {
        const db = await this.fetchAllData();

        const materiasPorEquipo = 7;
        const totalEsperado = db.equipos.length * materiasPorEquipo;
        const avancePorcentaje = totalEsperado === 0 ? 0 : Math.round((db.evaluaciones.length / totalEsperado) * 100);

        return {
            totalGrupos: db.grupos.length,
            totalEquipos: db.equipos.length,
            evaluaciones: db.evaluaciones.length,
            grupos: db.grupos,
            equipos: db.equipos,
            avance: avancePorcentaje
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

        // Limpiamos la caché para que la próxima lectura obligue a traer los datos nuevos
        this.cache = null;

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
    }
};
