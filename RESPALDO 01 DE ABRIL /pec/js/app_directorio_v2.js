// pec/js/app_directorio_v2.js
// Versión modular y mejorada del Directorio Escolar PEC v2.3
// Inclusión de indicadores de Parcial (Azul=P1, Naranja=P2, Verde=P3)

window.initDirectorioV2 = async () => {
    // Inicializar íconos
    feather.replace();

    const loader = document.getElementById('loading');
    const showLoader = () => loader.classList.remove('hidden');
    const hideLoader = () => loader.classList.add('hidden');

    const viewTitle = document.getElementById('view-title');
    if (viewTitle) viewTitle.textContent = "Directorio Escolar Oficial (CEB 5/4)";

    const normalizeG = (g) => String(g || "").replace(/[^0-9]/g, '').trim();

    async function processDirectorio() {
        showLoader();
        try {
            const data = await api.fetchAllData();
            const directorio = data.directorio || [];
            
            if (directorio.length === 0) {
                renderEmpty();
                hideLoader();
                return;
            }

            const statsGrupo = calcularStats(data);
            const agrupados = agruparDirectorio(directorio);
            renderLayout(agrupados, statsGrupo);

        } catch (e) {
            console.error("Error en directorio:", e);
            const container = document.getElementById('view-directorio');
            if (container) {
                container.innerHTML = `<div class="panel" style="border-left:4px solid #ef4444;">
                    <h2 style="color:#ef4444;">⚠️ Error de Carga</h2>
                    <p>${e.message}</p>
                </div>`;
            }
        }
        hideLoader();
    }

    function calcularStats(data) {
        const stats = {};
        (data.equipos || []).forEach(eq => {
            const gKey = normalizeG(eq.grupo);
            if (!gKey) return;
            if (!stats[gKey]) stats[gKey] = new Set();
            (eq.integrantes || []).forEach(name => { if(name) stats[gKey].add(name.trim()); });
        });
        (data.sinEquipo || []).forEach(al => {
            const gKey = normalizeG(al.grupo);
            if (!gKey) return;
            if (!stats[gKey]) stats[gKey] = new Set();
            if(al.alumno) stats[gKey].add(al.alumno.trim());
        });
        const counts = {};
        for(const k in stats) counts[k] = stats[k].size;
        return counts;
    }

    function agruparDirectorio(lista) {
        const agrupar = {};
        lista.forEach(d => {
            const grupoStr = String(d.grupo || "S/G");
            const matchS = grupoStr.match(/\d/);
            const semestre = matchS ? `${matchS[0]}º Semestre` : "Otros";
            
            if (!agrupar[semestre]) agrupar[semestre] = {};
            if (!agrupar[semestre][grupoStr]) agrupar[semestre][grupoStr] = [];
            agrupar[semestre][grupoStr].push(d);
        });
        return agrupar;
    }

    function renderLayout(agrupados, statsGrupo) {
        const container = document.getElementById('view-directorio');
        if (!container) return;
        container.innerHTML = '';

        let html = `
            <div class="panel" style="margin-bottom: 2rem; border-left: 8px solid #0891b2; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); padding: 1rem 1.5rem;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <h2 style="display:flex; align-items:center; gap:10px; margin:0; color:#1e293b; font-size:1.3rem;">
                            <i data-feather="map" style="color:#0891b2; width:22px;"></i> 
                            Directorio de Materias y Docentes
                        </h2>
                    </div>
                </div>
            </div>
        `;

        const semestres = Object.keys(agrupados).sort();
        semestres.forEach(sem => {
            html += `
                <div class="semestre-section" style="margin-bottom: 2rem;">
                    <div style="display:flex; align-items:center; gap:12px; margin-bottom:1rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">
                        <span style="background:#0891b2; color:white; padding:2px 12px; border-radius:999px; font-weight:800; font-size:0.8rem;">${sem.toUpperCase()}</span>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem;">
                        ${renderGrupos(agrupados[sem], statsGrupo)}
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
        feather.replace();
    }

    function renderGrupos(grupos, statsGrupo) {
        let cards = '';
        const sortedKeys = Object.keys(grupos).sort((a,b)=>a.localeCompare(b, undefined, {numeric:true}));
        
        sortedKeys.forEach(gKey => {
            const materias = grupos[gKey];
            const gNorm = normalizeG(gKey);
            const numAlumnos = statsGrupo[gNorm] || 0;
            const isVespertino = gKey.toUpperCase().startsWith('V');
            const accent = isVespertino ? '#7c3aed' : '#0891b2';

            cards += `
                <div class="panel" style="padding: 0; border: none; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.05); background: #fff; border-top: 3px solid ${accent};">
                    <div style="background: ${accent}08; padding: 0.75rem 1rem; border-bottom: 1px solid #f1f5f9; display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <h3 style="margin:0; font-size:1rem; color:#1e293b; font-weight:800;">Grupo ${gKey}</h3>
                            <div style="font-size:0.75rem; color:#059669; font-weight:700; display:flex; align-items:center; gap:4px; margin-top:2px;">
                                <i data-feather="users" style="width:12px;"></i> ${numAlumnos} Estudiantes
                            </div>
                        </div>
                    </div>
                    <div style="padding: 0.75rem;">
                        <table style="width:100%; border-collapse:collapse; font-size:0.8rem;">
                            <tbody>
                                ${materias.map(m => {
                                    // Parsear parciales: "1, 2" o similar
                                    const pString = String(m.parcial || "").trim();
                                    const pList = pString.split(',').map(s => s.trim()).filter(s => s !== "");
                                    
                                    const getBadge = (p) => {
                                        let bg = "#e2e8f0"; let clr = "#64748b";
                                        if (p === "1") { bg = "#eff6ff"; clr = "#2563eb"; }
                                        if (p === "2") { bg = "#fff7ed"; clr = "#f97316"; }
                                        if (p === "3") { bg = "#f0fdf4"; clr = "#16a34a"; }
                                        return `<span style="background:${bg}; color:${clr}; padding:1px 6px; border-radius:4px; font-size:0.65rem; font-weight:900; border:1px solid ${clr}22;">P${p}</span>`;
                                    };

                                    return `
                                    <tr style="border-bottom: 1px solid #f8fafc;">
                                        <td style="padding:10px 4px; vertical-align:top;">
                                            <div style="font-weight:700; color:#334155; line-height:1.2; margin-bottom:4px;">${m.materia}</div>
                                            <div style="display:flex; gap:4px; flex-wrap:wrap;">
                                                ${pList.length > 0 ? pList.map(p => getBadge(p)).join('') : '<span style="color:#94a3b8; font-size:0.65rem; font-weight:600; font-style:italic;">No participa</span>'}
                                            </div>
                                        </td>
                                        <td style="padding:10px 4px; vertical-align:top;">
                                            <div style="font-weight:600; color:#475569;">${m.docente || 'Sin Asignar'}</div>
                                            <div style="font-size:0.65rem; color:#94a3b8; margin-top:2px;">${m.correo || ''}</div>
                                        </td>
                                    </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        });
        return cards;
    }

    function renderEmpty() {
        const container = document.getElementById('view-directorio');
        if (container) {
            container.innerHTML = `<div class="panel" style="text-align:center; padding:3rem; background:#f8fafc; border:2px dashed #e2e8f0; border-radius:16px;">📂 <h3>Directorio Vacío</h3></div>`;
        }
    }

    await processDirectorio();
};
