// tutorias/js/api.js

const GOOGLE_SHEETS_API_URL = "https://script.google.com/macros/s/AKfycbxwWi6BuGmF-zBEWjX5Axkq3-LYQV8nuWCEKvMVTodhEuh5An1tezqHFGoMtlVsY6Fh4w/exec";

const api = {
    cache: null,

    async fetchAllData() {
        const userEmail = sessionStorage.getItem('user_email') || "";
        const url = `${GOOGLE_SHEETS_API_URL}?userEmail=${encodeURIComponent(userEmail)}`;
        
        const response = await fetch(url);
        const data = await response.json();
        if (data.status === "error") throw new Error(data.message);
        this.cache = data;
        return data;
    },

    async getDashboardData() {
        // ... (resto del código igual)
    },

    async guardarTutoria(datos) {
        datos.action = "saveTutoria";
        datos.docente_email = sessionStorage.getItem('user_email') || "";

        const response = await fetch(GOOGLE_SHEETS_API_URL, {
            method: 'POST',
            body: JSON.stringify(datos),
            headers: {
                "Content-Type": "text/plain;charset=utf-8",
            }
        });
        const result = await response.json();
        this.cache = null; 
        return result;
    }
};
