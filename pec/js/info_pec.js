document.addEventListener('DOMContentLoaded', async () => {
    // 1. Detección Paciente (Esperar a que api.js esté listo)
    const waitForApi = async () => {
        let retries = 0;
        while (retries < 20) { // Reintentar durante 5 segundos (20 * 250ms)
            const pecApi = window.api || (typeof api !== 'undefined' ? api : null);
            if (pecApi) return pecApi;
            await new Promise(r => setTimeout(r, 250));
            retries++;
        }
        return null;
    };

    const pecApi = await waitForApi();
    
    if (!pecApi) {
        console.error("No se pudo conectar con la API de Tutorías tras 5 segundos.");
        const mainTitle = document.querySelector('h1');
        if (mainTitle) mainTitle.textContent = "Error de Conexión: Recarga la página";
        return;
    }

    try {
        const allData = await pecApi.getDashboardData();
        const config = allData.config || {};
        const grupos = allData.grupos || [];
        const programacion = allData.programacion || [];
        const directorio = allData.directorio || [];

        // 1. Poblado de Textos (Config dinámico) - 6 Proyectos
        const projectKeys = ['2m', '2v', '4m', '4v', '6'];
        projectKeys.forEach(key => {
            const nameEl = document.getElementById(`pec_${key}_nombre`);
            const objEl = document.getElementById(`pec_${key}_objetivo`);
            const urlEl = document.getElementById(`pec_${key}_url`);
            
            if (nameEl) nameEl.textContent = config[`pec_${key}_nombre`] || `Proyecto PEC ${key.toUpperCase()}`;
            if (objEl) objEl.textContent = config[`pec_${key}_objetivo`] || "Desarrollando habilidades para el bienestar comunitario y el crecimiento académico.";
            
            // Lógica para el botón de documento
            const docUrl = config[`pec_${key}_url`] || config[`pec_${key}_documento`];
            if (urlEl && docUrl) {
                urlEl.href = docUrl;
                urlEl.classList.remove('hidden');
            } else if (urlEl) {
                urlEl.classList.add('hidden');
            }
        });

        // 2. Lógica de Agrupación de Maestros (Detección Inteligente)
        const projectTeams = {
            '2m': new Set(), '2v': new Set(),
            '4m': new Set(), '4v': new Set(),
            '6': new Set()
        };

        // Función para descifrar Semestre y Turno de cualquier registro
        const categorize = (item) => {
            const grp = String(item.grupo || "").toUpperCase().trim();
            const sem = String(item.semestre || "").trim();
            const tur = String(item.turno || "").toLowerCase().trim();

            // Determinar Semestre (Prioridad: Número en el grupo > Campo semestre)
            let s = "";
            const matchS = grp.match(/\d/);
            if (matchS) s = matchS[0];
            else s = sem;

            // Determinar Turno (Prioridad: Letra en el grupo > Campo turno)
            let t = "";
            if (grp.startsWith('M')) t = "m";
            else if (grp.startsWith('V')) t = "v";
            else if (tur.includes('matutino') || tur === 'm') t = "m";
            else if (tur.includes('vespertino') || tur === 'v') t = "v";

            // Asignar al bucket correcto
            if (s === "2") return t === "m" ? "2m" : "2v";
            if (s === "4") return t === "m" ? "4m" : "4v";
            if (s === "6") return "6";
            return null;
        };

        // Procesar DIRECTORIO (Donde están todos los maestros)
        directorio.forEach(d => {
            const key = categorize(d);
            if (key && d.docente) projectTeams[key].add(d.docente);
        });

        // Procesar PROGRAMACIÓN (Para capturar asignaciones especiales)
        programacion.forEach(p => {
            const key = categorize(p);
            if (key && p.docente) projectTeams[key].add(p.docente);
        });

        // 3. Renderizar Listas de Docentes
        Object.keys(projectTeams).forEach(key => {
            const container = document.getElementById(`list_${key}`);
            const teacherNames = [...projectTeams[key]].sort();

            if (teacherNames.length === 0) {
                container.innerHTML = '<p style="font-size:0.75rem; color:#94a3b8;">Pendiente por asignar docentes.</p>';
                return;
            }

            container.innerHTML = teacherNames.map(name => {
                const initials = name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();
                return `
                    <div class="teacher-item">
                        <div class="avatar">${initials}</div>
                        <span>${name}</span>
                    </div>
                `;
            }).join('');
        });

        // 4. Inicializar Iconos
        lucide.createIcons();

    } catch (error) {
        console.error("Error al cargar Portal PEC:", error);
    }
});
