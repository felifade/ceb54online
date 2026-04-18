// tutorias/js/api.js

const GOOGLE_SHEETS_API_URL = "https://script.google.com/macros/s/AKfycbz4q9VlhAvvVJ1XYOwqNTJ9eMkVRm3HgoyFJNpEQaPJsDdK1JcfhbTX1CRfDg38x79fsA/exec";

const api = {
    cache: null,

    async fetchAllData() {
        try {
            if (this.cache) return this.cache;

            const userEmail = sessionStorage.getItem('user_email') || "";
            // Añadimos cache buster para evitar problemas con proxies o caché del navegador
            const url = `${GOOGLE_SHEETS_API_URL}?userEmail=${encodeURIComponent(userEmail)}&_t=${Date.now()}`;

            const response = await fetch(url, {
                method: 'GET',
                redirect: 'follow'
            });

            if (!response.ok) throw new Error("Respuesta de red no válida");

            const data = await response.json();
            if (data.status === "error") throw new Error(data.message);

            this.cache = data;
            return data;
        } catch (error) {
            console.error("Fetch error:", error);
            throw error;
        }
    },

    async getDashboardData() {
        const db = await this.fetchAllData();
        const tutorias = db.tutorias || [];

        return {
            totalTutorias: tutorias.length,
            grupal: tutorias.filter(t => t.grupal).length,
            individual: tutorias.filter(t => t.individual).length,
            hombres: tutorias.filter(t => t.sexo === 'H').length,
            mujeres: tutorias.filter(t => t.sexo === 'F').length,
            grupos: db.grupos || [],
            tutorias: tutorias,
            feedbackHistory: db.feedbackHistory || [],
            isAdmin: db.isAdmin || false,
            groupsDelDocente: db.gruposDelDocente || [],
            config: db.config || { docente: "Felipe López Salazar" },
            alumnosFull: db.alumnosFull || [],
            directorio: db.directorio || [],
            programacion: db.programacion || []
        };
    },

    async guardarTutoria(datos) {
        datos.action = "saveTutoria";
        datos.docente_email = sessionStorage.getItem('user_email') || "";

        console.log('[DEBUG] asistencia:', datos.asistencia);
        console.log('[DEBUG] fecha_tutoria:', datos.fecha_tutoria);
        console.log('[DEBUG] fecha:', datos.fecha);

        const response = await fetch(GOOGLE_SHEETS_API_URL, {
            method: 'POST',
            mode: 'cors',
            body: JSON.stringify(datos),
            headers: {
                "Content-Type": "text/plain;charset=utf-8",
            },
            redirect: 'follow'
        });
        const result = await response.json();
        this.cache = null;
        return result;
    },

    async eliminarTutoria(fecha, alumno) {
        const payload = {
            action: "deleteTutoria",
            fecha: fecha,
            alumno: alumno,
            docente_email: sessionStorage.getItem('user_email') || ""
        };

        const response = await fetch(GOOGLE_SHEETS_API_URL, {
            method: 'POST',
            mode: 'cors',
            body: JSON.stringify(payload),
            headers: {
                "Content-Type": "text/plain;charset=utf-8",
            },
            redirect: 'follow'
        });
        const result = await response.json();
        this.cache = null;
        return result;
    },

    async actualizarCampo(fecha, alumno, columna, valor) {
        const payload = {
            action: "updateTutoriaField",
            fecha: fecha,
            alumno: alumno,
            column: columna,
            value: valor,
            docente_email: sessionStorage.getItem('user_email') || ""
        };

        const response = await fetch(GOOGLE_SHEETS_API_URL, {
            method: 'POST',
            mode: 'cors',
            body: JSON.stringify(payload),
            headers: {
                "Content-Type": "text/plain;charset=utf-8",
            },
            redirect: 'follow'
        });
        const result = await response.json();
        this.cache = null;
        return result;
    }
};

// Exportar al ámbito global para visibilidad entre carpetas
window.api = api;
