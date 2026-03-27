// tutorias/js/api.js

const GOOGLE_SHEETS_API_URL = "https://script.google.com/macros/s/AKfycbzqrGedn9wFRIF6DDzBlmWwINti3gjF_PHhbM7H92DtAYG3Qz98FVFfBRm7lfzdAkbtyw/exec";

const api = {
    cache: null,

    async fetchAllData() {
        const response = await fetch(GOOGLE_SHEETS_API_URL);
        const data = await response.json();
        if (data.status === "error") throw new Error(data.message);
        this.cache = data;
        return data;
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
            config: db.config || { docente: "Felipe López Salazar" },
            alumnosFull: db.alumnosFull || []
        };
    },

    async guardarTutoria(datos) {
        datos.action = "saveTutoria";
        const response = await fetch(GOOGLE_SHEETS_API_URL, {
            method: 'POST',
            body: JSON.stringify(datos),
            headers: {
                "Content-Type": "text/plain;charset=utf-8",
            }
        });
        const result = await response.json();
        this.cache = null; // Limpiar caché para forzar recarga
        return result;
    }
};
