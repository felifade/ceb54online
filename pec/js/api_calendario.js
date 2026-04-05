// pec/js/api_calendario.js

const API_CALENDARIO_URL = "https://script.google.com/macros/s/AKfycbwqT7gO_vF_V20F0kFvQdIwQslBuLqc5_wVtiNU_lfsDN5l3kMp3AV1uN9423eG0TyLNw/exec";

const apiCalendario = {
    cacheData: null,

    async fetchDatosCalendario() {
        if (this.cacheData) return this.cacheData;

        try {
            const url = `${API_CALENDARIO_URL}?action=getCalendario&_t=${Date.now()}`;
            const response = await fetch(url, {
                method: 'GET',
                redirect: 'follow'
            });

            if (!response.ok) {
                console.warn("api_calendario: Error de red", response.status);
                return null;
            }

            const data = await response.json();

            if (data.status === "error") {
                console.warn("api_calendario: Error lógico en GAS", data.message);
                return null;
            }

            this.cacheData = {
                cumpleanos: data.cumpleanos || [],
                eventos: data.eventos || []
            };
            return this.cacheData;
        } catch (e) {
            console.warn("api_calendario: Fallo al cargar datos. Usando fallback.", e);
            return null;
        }
    }
};

window.apiCalendario = apiCalendario;
