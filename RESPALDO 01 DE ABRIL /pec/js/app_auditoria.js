// pec/js/app_auditoria.js
// Modularized for integration into the main PEC Dashboard

window.initAuditoriaView = async () => {
    // Inicializar íconos
    feather.replace();

    const loader = document.getElementById('loading');
    const showLoader = () => loader.classList.remove('hidden');
    const hideLoader = () => loader.classList.add('hidden');

    // Cambiar el título de la vista (esto lo suele manejar app_v6, pero lo reforzamos)
    const viewTitle = document.getElementById('view-title');
    if (viewTitle) viewTitle.textContent = "Auditoría de Asignaciones (Líderes de Academia)";

    async function processAuditoria() {
        showLoader();
        try {
            const data = await api.fetchAllData();
            window._log("DEBUG - Datos para Auditoría:", data);
            
            const directorio = data.directorio || [];
            
            // 1. PROCESAMIENTO: Identificar faltantes
            const faltantes = directorio.filter(d => {
                const tieneParcial = String(d.parcial || "").trim() !== "";
                const tienePonderacion = String(d.ponderacion || "").trim() !== "";
                return !tieneParcial || !tienePonderacion;
            });

            const asignados = directorio.filter(d => {
                const tieneParcial = String(d.parcial || "").trim() !== "";
                const tienePonderacion = String(d.ponderacion || "").trim() !== "";
                return tieneParcial && tienePonderacion;
            });

            // 2. ESTADÍSTICAS GLOBALES
            renderStats(directorio.length, asignados.length, faltantes.length);

            // 3. AGRUPACIÓN POR SEMESTRE Y TURNO
            const agrupados = agruparPorSemestreYTurno(faltantes);
            
            // 4. RENDERIZADO DE CARDS
            renderCards(agrupados);

        } catch (e) {
            console.error("Error en auditoría:", e);
            const container = document.getElementById('view-auditoria');
            if (container) {
                container.innerHTML = `<div class="panel" style="border-left:4px solid #ef4444; margin-top:1rem;">
                    <h2 style="color:#ef4444;">⚠️ Error de Conexión</h2>
                    <p>No se pudieron obtener los datos de Google Sheets. Verifica la API.</p>
                    <p style="font-size:0.8rem; margin-top:10px; opacity:0.7;">Detalle: ${e.message}</p>
                </div>`;
            }
        }
        hideLoader();
    }

    function renderStats(total, ok, fail) {
        // Buscamos la stats-grid específicamente dentro de view-auditoria
        const container = document.getElementById('view-auditoria');
        if (!container) return;
        
        let statsGrid = container.querySelector('.stats-grid');
        if (!statsGrid) {
            statsGrid = document.createElement('div');
            statsGrid.className = 'stats-grid';
            container.prepend(statsGrid);
        }

        const pct = total > 0 ? Math.round((ok/total)*100) : 0;

        statsGrid.innerHTML = `
            <div class="stat-card">
                <div class="stat-icon"><i data-feather="list"></i></div>
                <div class="stat-details">
                    <span class="stat-title">Total Materias</span>
                    <h3 class="stat-value" style="color:#1e293b;">${total}</h3>
                </div>
            </div>
            <div class="stat-card" style="border-left: 4px solid #10b981;">
                <div class="stat-icon" style="color:#10b981;"><i data-feather="check-circle"></i></div>
                <div class="stat-details">
                    <span class="stat-title">Ya Asignadas</span>
                    <h3 class="stat-value" style="color:#059669;">${ok}</h3>
                </div>
            </div>
            <div class="stat-card" style="border-left: 4px solid #ef4444;">
                <div class="stat-icon" style="color:#ef4444;"><i data-feather="alert-circle"></i></div>
                <div class="stat-details">
                    <span class="stat-title">Pendientes (Huecos)</span>
                    <h3 class="stat-value" style="color:#dc2626;">${fail}</h3>
                </div>
            </div>
            <div class="stat-card highlight" style="background: linear-gradient(135deg, #2563eb, #1d4ed8);">
                <div class="stat-icon" style="color:white; opacity:0.8;"><i data-feather="pie-chart"></i></div>
                <div class="stat-details">
                    <span class="stat-title" style="color:rgba(255,255,255,0.8);">Avance Global</span>
                    <h3 class="stat-value" style="color:white;">${pct}%</h3>
                </div>
            </div>
        `;
        feather.replace();
    }

    function agruparPorSemestreYTurno(lista) {
        const agrupar = {};
        lista.forEach(m => {
            const grupoStr = String(m.grupo || "S/G");
            const matchS = grupoStr.match(/\d/);
            const semestre = matchS ? `${matchS[0]}º Semestre` : "Otros";
            const turno = grupoStr.toUpperCase().startsWith('V') ? "Vespertino" : "Matutino";
            
            const key = `${semestre} - ${turno}`;
            if (!agrupar[key]) agrupar[key] = [];
            agrupar[key].push(m);
        });
        return agrupar;
    }

    function renderCards(agrupados) {
        const container = document.getElementById('view-auditoria');
        if (!container) return;

        // Limpiar contenido previo pero mantener la stats-grid
        const statsGrid = container.querySelector('.stats-grid');
        container.innerHTML = '';
        if (statsGrid) container.appendChild(statsGrid);

        let html = `
            <div class="panel" style="margin-bottom: 2rem; border-left: 8px solid #2563eb; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); margin-top:2rem;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <h2 style="display:flex; align-items:center; gap:10px; margin:0; color:#1e293b;">
                            <i data-feather="shield" style="color:#2563eb;"></i> 
                            Planilla de Auditoría: Materias sin Configurar
                        </h2>
                        <p style="color:#64748b; font-size:0.95rem; margin-top:5px;">Esta vista agiliza el trabajo de los Líderes de Academia para detectar vacíos en Parcial y Ponderación.</p>
                    </div>
                    <button onclick="window.initAuditoriaView()" class="btn btn-outline" style="border-radius:12px; padding:10px 20px;">
                        <i data-feather="refresh-cw" style="width:16px;"></i> Recargar Datos
                    </button>
                </div>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); gap: 1.5rem;">
        `;

        const keys = Object.keys(agrupados).sort();
        
        if (keys.length === 0) {
            html += `
                <div class="panel" style="grid-column: 1 / -1; text-align: center; padding: 5rem; background: #ecfdf5; border: 2px dashed #10b981; border-radius: 24px;">
                    <div style="font-size: 4rem; margin-bottom: 1.5rem;">✨</div>
                    <h2 style="color:#064e3b; font-size: 2rem;">¡Excelente Trabajo!</h2>
                    <p style="color:#065f46; font-size:1.2rem; max-width:600px; margin: 0 auto;">Todas las materias del Directorio tienen asignado su docente, parcial y ponderación correspondientes.</p>
                </div>
            `;
        }

        keys.forEach(key => {
            const materias = agrupados[key];
            const isVespertino = key.includes("Vespertino");
            const bgGradient = isVespertino 
                ? "linear-gradient(135deg, #7c3aed, #6d28d9)" 
                : "linear-gradient(135deg, #f59e0b, #d97706)";

            html += `
                <div class="panel" style="padding: 0; border: none; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); display: flex; flex-direction: column; background: #fff;">
                    <div style="background: ${bgGradient}; padding: 1.5rem; color: white;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <div>
                                <h3 style="margin:0; font-size:1.25rem; font-weight:800; letter-spacing:-0.5px;">${key}</h3>
                                <div style="font-size:0.85rem; opacity:0.9; margin-top:4px; display:flex; align-items:center; gap:6px; font-weight:500;">
                                    <i data-feather="${isVespertino ? 'moon' : 'sun'}" style="width:14px;"></i> Turno ${isVespertino ? 'Vespertino' : 'Matutino'}
                                </div>
                            </div>
                            <div style="background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 99px; font-size: 0.8rem; font-weight: 800; backdrop-filter: blur(4px);">
                                ${materias.length} FALTANTES
                            </div>
                        </div>
                    </div>
                    <div style="padding: 1.25rem; background: #f8fafc; flex-grow: 1;">
                        <div style="display:flex; flex-direction:column; gap:12px; max-height:500px; overflow-y:auto; padding-right:8px;">
                            ${materias.map(m => `
                                <div style="background:white; border:1px solid #e2e8f0; border-radius:16px; padding:16px; transition: transform 0.2s; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
                                        <div style="flex:1;">
                                            <div style="font-weight:800; color:#1e293b; font-size:1rem; line-height:1.2;">${m.materia}</div>
                                            <div style="display:inline-block; font-size:0.75rem; background:#eff6ff; color:#2563eb; font-weight:800; margin-top:6px; padding:2px 8px; border-radius:6px;">GRUPO ${m.grupo}</div>
                                        </div>
                                        <div style="width:32px; height:32px; background:#fff1f2; border-radius:10px; display:flex; align-items:center; justify-content:center;">
                                            <i data-feather="alert-circle" style="color:#e11d48; width:18px;"></i>
                                        </div>
                                    </div>
                                    <div style="background:#f1f5f9; padding:10px; border-radius:12px; display:flex; align-items:center; gap:10px; margin-bottom:12px;">
                                        <div style="width:28px; height:28px; background:white; border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                                            <i data-feather="user" style="width:14px; color:#64748b;"></i>
                                        </div>
                                        <div style="font-size:0.85rem; color:#475569; font-weight:600;">
                                            ${m.docente || '<span style="color:#e11d48;">Docente no registrado</span>'}
                                        </div>
                                    </div>
                                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                                        <div style="background:${m.parcial ? '#ecfdf5' : '#fff1f2'}; padding:8px; border-radius:10px; border: 1px solid ${m.parcial ? '#10b98122' : '#e11d4822'}; text-align:center;">
                                            <div style="font-size:0.6rem; text-transform:uppercase; color:${m.parcial ? '#059669' : '#e11d48'}; font-weight:800; letter-spacing:0.5px;">Estatus Parcial</div>
                                            <div style="font-size:0.75rem; font-weight:800; color:${m.parcial ? '#047857' : '#be123c'}; margin-top:2px;">
                                                ${m.parcial ? 'CONFIGURADO' : 'PENDIENTE'}
                                            </div>
                                        </div>
                                        <div style="background:${m.ponderacion ? '#ecfdf5' : '#fff1f2'}; padding:8px; border-radius:10px; border: 1px solid ${m.ponderacion ? '#10b98122' : '#e11d4822'}; text-align:center;">
                                            <div style="font-size:0.6rem; text-transform:uppercase; color:${m.ponderacion ? '#059669' : '#e11d48'}; font-weight:800; letter-spacing:0.5px;">Ponderación</div>
                                            <div style="font-size:0.75rem; font-weight:800; color:${m.ponderacion ? '#047857' : '#be123c'}; margin-top:2px;">
                                                ${m.ponderacion ? 'CONFIGURADO' : 'PENDIENTE'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
        });

        html += `</div>`;
        container.innerHTML += html;
        feather.replace();
    }

    // Ejecutar el procesamiento inicial
    await processAuditoria();
};
