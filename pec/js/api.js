// pec/js/api.js

const USE_MOCK = false;
// La URL que te dará Google Apps Script cuando lo publiques
const GOOGLE_SHEETS_API_URL = "https://script.google.com/macros/s/AKfycbxwWi6BuGmF-zBEWjX5Axkq3-LYQV8nuWCEKvMVTodhEuh5An1tezqHFGoMtlVsY6Fh4w/exec";

const api = {
    // Almacén temporal de datos para no recargar en cada clic
    cache: null,

    async fetchAllData() {
        if (USE_MOCK) {
            return MOCK_DATA;
        }

        const userEmail = sessionStorage.getItem('user_email') || "";
        const url = `${GOOGLE_SHEETS_API_URL}?userEmail=${encodeURIComponent(userEmail)}`;

        // Pide la información real a Google Sheets
        const response = await fetch(url);
        const data = await response.json();
        if (data.status === "error") throw new Error(data.message);

        this.cache = data;
        return data;
    },

    async getDashboardData() {
        // ... (resto del código igual)
    },

    // ... (otros getters omitidos para brevedad en el diff, pero se mantienen arriba)

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
