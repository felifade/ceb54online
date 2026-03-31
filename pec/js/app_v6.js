// pec/js/app.js

document.addEventListener("DOMContentLoaded", () => {
    // Inicializar íconos
    feather.replace();

    // Helper para normalizar el Parcial (convierte "Parcial 1" o "1" en solo "1")
    const normalizeParcial = (val) => {
        if (!val) return "";
        const match = String(val).match(/\d+/);
        return match ? match[0] : String(val).trim();
    };

    // === HELPER GLOBAL PARA COMAS EN DIRECTORIO ===
    function getPonderacionParaParcial(m, parcialElegido) {
        if (!m) return 0;
        const pStr = String(m.parcial || "");
        const pondStr = String(m.ponderacion || "");
        
        const parseNum = (v) => { const m = String(v).match(/\d+/); return m ? m[0] : String(v).trim(); };
        const pArr = pStr.split(',').map(s => parseNum(s));
        
        // Convertir de ej "0.7, 0.8, 0.3" a array numérico
        const pondArr = pondStr.split(',').map(s => parseFloat(s) || 0);
        
        const idx = pArr.indexOf(parseNum(parcialElegido));
        if (idx !== -1 && idx < pondArr.length) {
            return pondArr[idx];
        }
        // Fallback: si solo pusieron "0.7" para todos, usar ese valor único.
        return pondArr.length > 0 ? pondArr[0] : 0;
    }

    // Establecer nombre de usuario desde la sesión
    const userName = sessionStorage.getItem('user_name');
    if (userName) {
        const userNameEl = document.getElementById('topbar-user-name');
        if (userNameEl) userNameEl.textContent = userName;
    }

    // DOM Elements
    const views = document.querySelectorAll('.view');
    const navItems = document.querySelectorAll('.nav-item');
    const loader = document.getElementById('loading');
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');

    // Estado local
    let currentView = 'pecportal';

    // Navegación
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const viewName = item.getAttribute('data-view');
            if (!viewName) return; // Links con href real (ej. calificaciones.html) navegan normalmente
            e.preventDefault();
            
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            views.forEach(view => {
                view.classList.add('hidden');
                view.classList.remove('active');
            });
            
            const selectedView = document.getElementById(`view-${viewName}`);
            selectedView.classList.remove('hidden');
            selectedView.classList.add('active');
            
            document.getElementById('view-title').textContent = item.querySelector('span').textContent;
            currentView = viewName;

            // En móviles, cerrar menú tras click
            if(window.innerWidth <= 768) {
                sidebar.classList.remove('open');
            }

            // Cargar datos de la vista
            loadViewData(viewName);
        });
    });

    // Menú móvil
    menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });

    // Funciones Base
    const showLoader = () => loader.classList.remove('hidden');
    const hideLoader = () => loader.classList.add('hidden');

    // Lógica por Vista
    const loadViewData = async (view) => {
        if (view === 'dashboard') await initDashboard();
        if (view === 'grupos') await initGrupos();
        if (view === 'concentrado') await initConcentrado();
        if (view === 'directorio') await window.initDirectorioV2();
        if (view === 'rapida') await initVistaRapida();
        if (view === 'auditoria' && window.initAuditoriaView) await window.initAuditoriaView();
    };

    /* =======================================
       VISTA 1: DASHBOARD
       ======================================= */
    async function initDashboard() {
        showLoader();
        try {
            const data = await api.getDashboardData();
            window._log("DEBUG - Datos PEC Dashboard:", data);
            if (!data || !data.equipos) throw new Error("Datos del dashboard incompletos");
            
            // Stats
            document.getElementById('dash-grupos').textContent = data.totalGrupos || 0;
            document.getElementById('dash-equipos').textContent = data.totalEquipos || 0;
            document.getElementById('dash-evaluaciones').textContent = (data.evaluaciones || []).length;
            document.getElementById('dash-avance').textContent = `${data.avance || 0}%`;

            // 0. Agenda del Ciclo Dinámica
            const pActivoFecha = (data.config && data.config.parcialActivo) || "1";
            const parElegidoStr = normalizeParcial(pActivoFecha);
            const spanParcial = document.getElementById('dash-fecha-parcial');
            if (spanParcial) spanParcial.textContent = parElegidoStr;

            const fCaptura = document.getElementById('dash-fecha-captura');
            const fAclaracion = document.getElementById('dash-fecha-aclaracion');
            const fCierre = document.getElementById('dash-fecha-cierre');

            if (fCaptura) {
                // Prioridad: portal_fecha_captura > cal_px_fecha
                const fechaC = data.config.portal_fecha_captura || (data.fechas && data.fechas["p" + parElegidoStr]) || "Por definir";
                fCaptura.textContent = fechaC;
            }
            if (fAclaracion) fAclaracion.textContent = data.config.portal_fecha_aclaracion || "--";
            if (fCierre) fCierre.textContent = data.config.portal_fecha_cierre || "--";

            // Grupos Lista (Equipos por grupo)
            const listGrupos = document.getElementById('dash-lista-grupos');
            const equiposPorGrupo = {};
            data.equipos.forEach(eq => {
                const g = eq.grupo;
                if (!g) return;
                if (!equiposPorGrupo[g]) equiposPorGrupo[g] = 0;
                equiposPorGrupo[g]++;
            });
            
            listGrupos.innerHTML = (data.grupos || []).sort((a, b) => String(a).localeCompare(String(b), undefined, {numeric: true})).map(g => {
                const count = equiposPorGrupo[g] || 0;
                return `<div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:6px 12px; font-size:0.85rem; font-weight:500; color:#334155;">
                    <span style="color:#2563eb; font-weight:700; margin-right:4px;">${g}</span>
                    <span style="color:#64748b;">(${count} eq.)</span>
                </div>`;
            }).join('');

            // Avance Lista
            const totalEq = data.equipos.length || 1;
            const eqEvaluados = data.equipos.filter(e => e.estado === 'Evaluado').length;
            const dashAvance = document.getElementById('dash-avance-equipos');
            dashAvance.innerHTML = `
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-weight: 600;">
                    <span>${eqEvaluados} Evaluados</span>
                    <span>${data.equipos.length - eqEvaluados} Pendientes</span>
                </div>
                <div style="width: 100%; height: 12px; background: #E2E8F0; border-radius: 999px; overflow: hidden;">
                    <div style="height: 100%; width: ${(eqEvaluados/totalEq)*100}%; background: var(--clr-success);"></div>
                </div>
            `;

            // === EQUIPOS Y EVALUACIONES (De la primera carga) ===
            const directorio = data.directorio || [];
            const evaluaciones = data.evaluaciones || [];
            const programacion = data.programacion || [];
            const sinEquipo = data.sinEquipo || [];

            // === DIAGNÓSTICO ALUMNOS SIN EQUIPO ===
            const badgeSinEq = document.getElementById('badge-sin-equipo');
            const containerSinEq = document.getElementById('dash-sin-equipo');
            const panelDiag = document.getElementById('panel-diagnostico');
            
            if (badgeSinEq) badgeSinEq.textContent = `${sinEquipo.length} alumno(s)`;
            
            if (sinEquipo.length === 0) {
                if (containerSinEq) containerSinEq.innerHTML = '<p style="text-align: center; color: #10b981; font-weight: 500; margin: 0;">✅ Todos los alumnos de la lista tienen equipo asignado.</p>';
                if (panelDiag) {
                    panelDiag.style.borderLeftColor = '#10b981';
                    const h2 = panelDiag.querySelector('h2');
                    if (h2) {
                        h2.style.color = '#047857';
                        h2.textContent = '✅ Equipos Completos';
                    }
                }
                if (badgeSinEq) {
                    badgeSinEq.style.background = '#d1fae5';
                    badgeSinEq.style.color = '#047857';
                }
            } else {
                const sinEqPorGrupo = {};
                sinEquipo.forEach(a => {
                    if (!a.grupo) return;
                    if (!sinEqPorGrupo[a.grupo]) sinEqPorGrupo[a.grupo] = [];
                    sinEqPorGrupo[a.grupo].push(a.alumno || "Sin nombre");
                });
                
                let htmlSinEq = '<div style="display:flex; flex-direction:column; gap:8px;">';
                Object.keys(sinEqPorGrupo).sort().forEach(g => {
                    htmlSinEq += `
                        <div style="background:white; padding:8px 12px; border-radius:6px; border:1px solid #fee2e2;">
                            <strong style="color:#ef4444; display:block; margin-bottom:4px;">Grupo ${g} (${sinEqPorGrupo[g].length})</strong>
                            <div style="font-size:0.85rem; color:#475569; padding-left:8px; border-left:2px solid #fca5a5;">
                                ${sinEqPorGrupo[g].join(', ')}
                            </div>
                        </div>
                    `;
                });
                htmlSinEq += '</div>';
                if (containerSinEq) containerSinEq.innerHTML = htmlSinEq;
            }

            // === SEGUIMIENTO DOCENTE ===
            const segGrupoSelect = document.getElementById('seg-grupo');
            if (segGrupoSelect && segGrupoSelect.options.length <= 1) {
                const gruposDir = [...new Set(directorio.map(d => d.grupo))].sort();
                gruposDir.forEach(g => {
                    const opt = document.createElement('option');
                    opt.value = g;
                    opt.textContent = `Grupo ${g}`;
                    segGrupoSelect.appendChild(opt);
                });
            }

            const renderSeguimiento = () => {
                const segParcialEl = document.getElementById('seg-parcial');
                const segGrupoEl = document.getElementById('seg-grupo');
                if (!segParcialEl || !segGrupoEl) return;

                const parcialSel = normalizeParcial(segParcialEl.value);
                const grupoSel = String(segGrupoEl.value || '').trim();

                const cleanG = (g) => String(g).replace(/[^0-9]/g, '');
                
                let dirFiltrado = directorio.filter(d => {
                    const strParciales = String(d.parcial || "").trim();
                    const parcialesArray = strParciales.split(',').map(s => { const m = s.match(/\d+/); return m ? m[0] : s.trim(); });
                    const parseNum = (v) => { const m = String(v).match(/\d+/); return m ? m[0] : String(v).trim(); };
                    return parcialesArray.includes(parseNum(parcialSel));
                });
                
                if (grupoSel) dirFiltrado = dirFiltrado.filter(d => d.grupo === grupoSel);

                // 1. Agrupar Directorio por Docente
                const porDocente = {};
                dirFiltrado.forEach(d => {
                    const docNormal = String(d.docente || "SIN NOMBRE").trim().toUpperCase();
                    if (!porDocente[docNormal]) {
                        porDocente[docNormal] = { 
                            docente: d.docente || "SIN NOMBRE", 
                            docNormal: docNormal,
                            asignaciones: [], // {grupo, materia}
                            totalesPorEquipo: 0,
                            hechos: 0
                        };
                    }
                    porDocente[docNormal].asignaciones.push({ grupo: d.grupo, materia: d.materia });
                });

                // 2. Calcular Carga de Equipos y Evaluaciones por Docente
                Object.values(porDocente).forEach(docObj => {
                    docObj.asignaciones.forEach(asig => {
                        const teamsInG = (data.equipos || []).filter(eq => cleanG(eq.grupo) === cleanG(asig.grupo));
                        docObj.totalesPorEquipo += teamsInG.length;

                        // Contar cuántos de esos equipos ya tienen evaluación de este docente para esta materia
                        teamsInG.forEach(eq => {
                            const yaEvaluo = evaluaciones.some(ev => 
                                String(ev.docente).trim().toUpperCase() === docObj.docNormal &&
                                cleanG(ev.grupoId) === cleanG(asig.grupo) &&
                                String(ev.equipoId) === String(eq.id) &&
                                String(ev.materia).trim() === String(asig.materia).trim() &&
                                String(ev.parcial) === String(parcialSel)
                            );
                            if (yaEvaluo) docObj.hechos++;
                        });
                    });
                });

                // 3. Crear Filas de Tabla (Ordenados por faltantes)
                const listaDocentes = Object.values(porDocente).sort((a,b) => {
                    const faltanA = a.totalesPorEquipo - a.hechos;
                    const faltanB = b.totalesPorEquipo - b.hechos;
                    return faltanB - faltanA; // Más faltantes arriba
                });

                let totalTerminado = 0, totalEnProceso = 0;
                let filas = '';
                
                listaDocentes.forEach(item => {
                    const faltan = item.totalesPorEquipo - item.hechos;
                    const avancePct = item.totalesPorEquipo > 0 ? (item.hechos / item.totalesPorEquipo) * 100 : 0;
                    const yaTermino = (faltan === 0 && item.totalesPorEquipo > 0);

                    if (yaTermino) totalTerminado++; else totalEnProceso++;

                    const resumenCarga = item.asignaciones.map(a => `<span style="display:inline-block; background:#f1f5f9; padding:2px 6px; border-radius:4px; margin:2px; font-size:0.75rem;">${a.grupo} (${a.materia})</span>`).join(' ');

                    filas += `
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding:12px 10px;">
                                <div style="font-weight:700; color:#1e293b; font-size:0.95rem;">${item.docente}</div>
                                <div style="margin-top:4px;">${resumenCarga}</div>
                            </td>
                            <td style="padding:12px 10px; text-align:center;">
                                <div style="font-weight:800; color:#475569; font-size:1rem;">${item.hechos} / ${item.totalesPorEquipo}</div>
                                <div style="width:60px; height:4px; background:#f1f5f9; border-radius:999px; margin:4px auto; overflow:hidden;">
                                    <div style="height:100%; width:${avancePct}%; background:${yaTermino ? '#10b981' : '#3b82f6'}; transition: width 0.3s;"></div>
                                </div>
                            </td>
                            <td style="padding:12px 10px; text-align:center;">
                                <span style="font-size:1.1rem; font-weight:900; color:${faltan > 0 ? '#ef4444' : '#10b981'};">
                                    ${faltan > 0 ? faltan : '✓'}
                                </span>
                            </td>
                            <td style="padding:12px 10px; text-align:center;">
                                ${yaTermino 
                                    ? '<span style="background:#D1FAE5; color:#065f46; padding:4px 12px; border-radius:99px; font-weight:700; font-size:0.75rem; border:1px solid #10b98133;">COMPLETO</span>' 
                                    : '<span style="background:#FEF3C7; color:#92400e; padding:4px 12px; border-radius:999px; font-weight:700; font-size:0.75rem; border:1px solid #eab30833;">PENDIENTE</span>'}
                            </td>
                        </tr>
                    `;
                });

                const container = document.getElementById('seg-tabla-container');
                if (container) {
                    container.innerHTML = `
                        ${dirFiltrado.length === 0 ? '<div style="background:#FEF3C7; border:1px solid #FDE68A; color:#92400E; padding:10px 14px; border-radius:8px; margin-bottom:1rem; font-size:0.85rem;">⚠️ No hay docentes asignados para evaluar en el Parcial ' + parcialSel + '.</div>' : ''}
                        <div style="display:flex; gap:1rem; margin-bottom:1.5rem;">
                            <span style="background:#D1FAE5; color:#065f46; padding:6px 16px; border-radius:12px; font-weight:700; font-size:0.85rem; border:1px solid #10b98144;">🏆 ${totalTerminado} Concluidos</span>
                            <span style="background:#FEF3C7; color:#92400e; padding:6px 16px; border-radius:12px; font-weight:700; font-size:0.85rem; border:1px solid #eab30844;">⏳ ${totalEnProceso} En Proceso</span>
                        </div>
                        <table style="width:100%; border-collapse:collapse; font-size:0.9rem;">
                            <thead>
                                <tr style="background:#f8fafc; border-bottom:2px solid #e2e8f0; color:#64748b; font-size:0.75rem; text-transform:uppercase; letter-spacing:0.5px;">
                                    <th style="padding:12px 10px; text-align:left;">Docente / Carga Académica</th>
                                    <th style="padding:12px 10px; text-align:center;">Avance (Equipos)</th>
                                    <th style="padding:12px 10px; text-align:center;">Faltantes</th>
                                    <th style="padding:12px 10px; text-align:center;">Estado</th>
                                </tr>
                            </thead>
                            <tbody>${filas || '<tr><td colspan="4" style="text-align:center; padding:30px; color:#94a3b8; font-style:italic;">No hay docentes en este grupo/parcial.</td></tr>'}</tbody>
                        </table>
                    `;
                }
            };
            const segParcialEl = document.getElementById('seg-parcial');
            const segGrupoEl = document.getElementById('seg-grupo');

            if (segParcialEl) {
                const pActivo = (data.config && data.config.parcialActivo) || "1";
                segParcialEl.value = pActivo;
                segParcialEl.addEventListener('change', renderSeguimiento);
            }
            if (segGrupoEl) segGrupoEl.addEventListener('change', renderSeguimiento);

            renderSeguimiento();

            const pActivoGlobal = (data.config && data.config.parcialActivo) || "1";

            // === PANEL DE PONDERACIONES (Premium UI) ===
            const renderPonderaciones = () => {
                const pondParcialEl = document.getElementById('pond-parcial');
                if (!pondParcialEl) return;
                
                // Si nunca se ha tocado, poner el parcial activo
                if (!pondParcialEl.dataset.initialized) {
                    pondParcialEl.value = pActivoGlobal;
                    pondParcialEl.dataset.initialized = "true";
                }
                
                const parcialPond = normalizeParcial(pondParcialEl.value);
                
                const parseNum = (v) => { const m = String(v).match(/\d+/); return m ? m[0] : String(v).trim(); };
                
                // Extraer de directorio las filas que van en este parcial
                const progFiltrada = directorio.filter(d => {
                    const strParciales = String(d.parcial || "").trim();
                    const parcialesArray = strParciales.split(',').map(s => parseNum(s));
                    return parcialesArray.includes(parseNum(parcialPond));
                });
                
                // Diagnóstico para consola
                window._log(`DEBUG - Ponderaciones Parcial ${parcialPond}: ${progFiltrada.length} filas en Directorio`);
                
                const container = document.getElementById('pond-container');
                if (!container) return;
                
                if (progFiltrada.length === 0) {
                    container.innerHTML = `
                        <div style="text-align:center; padding:3rem; color:#64748b; background:#f8fafc; border:2px dashed #e2e8f0; border-radius:16px;">
                            <div style="font-size:2rem; margin-bottom:1rem;">📋</div>
                            <p style="font-weight:600; margin:0;">No hay materias a evaluar en el Parcial ${parcialPond}</p>
                            <p style="font-size:0.85rem; margin-top:0.5rem;">Agrega '2' en la Columna E del Directorio para habilitarlas.</p>
                        </div>
                    `;
                    return;
                }

                const getTurno = (g) => String(g).toUpperCase().startsWith('V') ? 'VESPERTINO' : 'MATUTINO';
                const extractNum = (g) => String(g).replace(/^[A-Za-z]+/, '');
                const todosLosGrupos = [...new Set(progFiltrada.map(d => d.grupo))].sort();
                const curriculumPorGrupo = {};

                todosLosGrupos.forEach(grupo => {
                    const turnoGrupo = getTurno(grupo).toUpperCase();
                    const grupoNum = extractNum(grupo);
                    const semestre = grupoNum.startsWith('2') ? '2do' : grupoNum.startsWith('4') ? '4to' : '-';

                    const materiasAplicables = progFiltrada.filter(d => d.grupo === grupo);
                    if (materiasAplicables.length === 0) return;

                    // Deduplicar por materia
                    const materiasUnicas = {};
                    materiasAplicables.forEach(m => {
                        if (!m.materia) return;
                        if (!materiasUnicas[m.materia]) {
                            materiasUnicas[m.materia] = { materia: m.materia, ponderacion: getPonderacionParaParcial(m, parcialPond) };
                        }
                    });

                    const listaMaterias = Object.values(materiasUnicas);
                    // El "fingerprint" agrupa grupos con la misma carga académica exactamente
                    const fingerprint = listaMaterias.map(m => `${m.materia}|${m.ponderacion}`).sort().join('||');

                    if (!curriculumPorGrupo[fingerprint]) {
                        curriculumPorGrupo[fingerprint] = {
                            grupos: [],
                            turno: turnoGrupo,
                            semestre: semestre,
                            materias: listaMaterias
                        };
                    }
                    curriculumPorGrupo[fingerprint].grupos.push(grupo);
                });

                let html = '<div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); gap:1.5rem;">';

                Object.values(curriculumPorGrupo).forEach(curr => {
                    const totalPuntos = curr.materias.reduce((acc, m) => acc + m.ponderacion, 0);
                    const isTotalCorrect = Math.abs(totalPuntos - 2) < 0.01;
                    const semColor = curr.semestre === '2do' ? '#2563eb' : curr.semestre === '4to' ? '#7c3aed' : '#475569';
                    const semBg = curr.semestre === '2do' ? '#eff6ff' : curr.semestre === '4to' ? '#f5f3ff' : '#f8fafc';
                    const progressWidth = Math.min((totalPuntos / 2) * 100, 100);

                    html += `
                        <div style="background:white; border:1px solid #e2e8f0; border-radius:16px; overflow:hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); transition:transform 0.2s hover; cursor:default;">
                            <div style="background: linear-gradient(135deg, ${semColor}, ${semColor}dd); padding: 1.25rem; color: white;">
                                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                                    <div>
                                        <div style="font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; opacity: 0.8;">
                                            ${curr.semestre} Semestre | ${curr.turno === 'VESPERTINO' ? '🌙 VESPERTINO' : '☀️ MATUTINO'}
                                        </div>
                                        <h3 style="margin: 4px 0 0; font-size: 1.1rem; color: white; display:flex; align-items:center; gap:8px;">
                                            Grupos: ${curr.grupos.map(g => `<span style="background:rgba(255,255,255,0.2); padding:2px 8px; border-radius:6px; font-size:0.9rem;">${g}</span>`).join('')}
                                        </h3>
                                    </div>
                                    <div style="text-align: right;">
                                        <div style="font-size: 1.75rem; font-weight: 900; line-height: 1;">${totalPuntos.toFixed(2)}</div>
                                        <div style="font-size: 0.7rem; opacity: 0.8; font-weight:600;">/ 2.00 PUNTOS</div>
                                    </div>
                                </div>
                                <div style="height: 6px; background: rgba(255,255,255,0.2); border-radius: 99px; margin-top: 1rem; overflow: hidden;">
                                    <div style="height: 100%; width: ${progressWidth}%; background: white; border-radius: 99px; transition: width 0.8s ease-out;"></div>
                                </div>
                                <div style="margin-top: 0.75rem; display: flex; align-items: center; gap: 6px; font-size: 0.75rem; font-weight: 600;">
                                    ${isTotalCorrect 
                                        ? '<span style="display:inline-flex; align-items:center; gap:4px; background:rgba(34,197,94,0.3); padding:2px 8px; border-radius:99px;">✓ Configuración Correcta</span>' 
                                        : `<span style="display:inline-flex; align-items:center; gap:4px; background:rgba(239,68,68,0.3); padding:2px 8px; border-radius:99px;">⚠ Error: Debe sumar 2.00</span>`}
                                </div>
                            </div>
                            <div style="padding: 1.25rem;">
                                ${curr.materias.map(m => {
                                    // Buscar docentes para esta materia en estos grupos
                                    const docentesMateria = directorio.filter(d => d.materia === m.materia && curr.grupos.includes(d.grupo));
                                    const listaDocentes = [...new Set(docentesMateria.map(d => d.docente))];
                                    
                                    return `
                                        <div style="padding: 0.75rem 0; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;">
                                            <div style="flex: 1; min-width: 0;">
                                                <div style="font-size: 0.9rem; font-weight: 700; color: #1e293b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${m.materia}">${m.materia}</div>
                                                <div style="font-size: 0.75rem; color: #64748b; margin-top: 2px;">
                                                    ${listaDocentes.length > 0 
                                                        ? `👤 ${listaDocentes.join(', ')}` 
                                                        : '<span style="color:#ef4444; font-style:italic;">⚠ No asignado en Directorio</span>'}
                                                </div>
                                            </div>
                                            <div style="background: ${semBg}; color: ${semColor}; padding: 4px 10px; border-radius: 8px; font-weight: 800; font-variant-numeric: tabular-nums; min-width: 55px; text-align: center; border: 1px solid ${semColor}22;">
                                                ${m.ponderacion.toFixed(2)}
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    `;
                });

                container.innerHTML = html + '</div>';
            };

            const pondSelect = document.getElementById('pond-parcial');
            if (pondSelect) pondSelect.addEventListener('change', renderPonderaciones);
            renderPonderaciones();

        } catch (e) {
            console.error("DEBUG - Error detallado:", e);
            const listGrupos = document.getElementById('dash-lista-grupos');
            if (listGrupos) {
                listGrupos.innerHTML = `
                    <div style="background:#fef2f2; border:1px solid #fee2e2; color:#b91c1c; padding:1.5rem; border-radius:12px; grid-column: 1 / -1; width:100%;">
                        <h3 style="margin-top:0;">⚠️ Error al cargar datos</h3>
                        <p style="font-size:0.9rem; margin-bottom:1rem;">No pudimos conectar con los datos de Google Sheets. Esto puede ocurrir por:</p>
                        <ul style="font-size:0.85rem; padding-left:1.5rem;">
                            <li>Problemas de conexión a internet.</li>
                            <li>La URL de la API en <code>pec/js/api.js</code> ha cambiado.</li>
                            <li>El script de Google Apps Script no ha sido actualizado o desplegado correctamente.</li>
                        </ul>
                        <p style="font-size:0.8rem; margin-top:1rem; opacity:0.8;">Detalle técnico: ${e.message}</p>
                    </div>
                `;
            } else {
                alert("Error cargando dashboard: " + e.message);
            }
        }
        hideLoader();
    }

    /* =======================================
       VISTA 2: GRUPOS y EQUIPOS
       ======================================= */
    const selectGrupo = document.getElementById('select-grupo');
    const containerEquipos = document.getElementById('equipos-container');

    async function initGrupos() {
        if (selectGrupo.options.length <= 1) { // Solo opción default
            showLoader();
            const data = await api.fetchAllData();
            const userEmail = sessionStorage.getItem('user_email') || "";
            const isAdmin = sessionStorage.getItem('user_role') === 'admin';
            
            let gruposValidos = data.grupos || [];
            
            // 1. FILTRADO ESTRICTO DE GRUPOS (Directorio + Programacion)
            if (!isAdmin && userEmail) {
                const normStr = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
                const pActivo = (data.config && data.config.parcialActivo) || "2";
                
                const dir = data.directorio || [];
                const misAsignaciones = dir.filter(d => String(d.correo).trim().toLowerCase() === String(userEmail).trim().toLowerCase());
                
                // Mapear los nombres de grupo como el directorio los llama
                const misGruposDir = misAsignaciones.filter(d => {
                    const strParciales = String(d.parcial || "").trim();
                    const parcialesArray = strParciales.split(',').map(s => { const m = s.match(/\d+/); return m ? m[0] : s.trim(); });
                    const parseNum = (v) => { const m = String(v).match(/\d+/); return m ? m[0] : String(v).trim(); };
                    return parcialesArray.includes(parseNum(pActivo));
                }).map(d => d.grupo);

                // Función ultra robusta para extraer solo los números del grupo ("Grupo M201" -> "201", "201" -> "201")
                const cleanGroup = (g) => String(g).replace(/[^0-9]/g, '');
                const misCleaned = misGruposDir.map(cleanGroup);

                // Intersectar con los grupos reales del sistema para no romper api.getEquiposPorGrupo()
                gruposValidos = (data.grupos || []).filter(g => misCleaned.includes(cleanGroup(g)));
                
                // Fallback por si en data.grupos no venía pero en Directorio sí
                if (gruposValidos.length === 0 && misGruposDir.length > 0) {
                    gruposValidos = [...new Set(misGruposDir)];
                }
            }

            // Ordenar grupos alfabéticamente
            const gruposOrdenados = [...new Set(gruposValidos)].sort((a, b) => String(a).localeCompare(String(b), undefined, {numeric: true}));
            
            gruposOrdenados.forEach(g => {
                const opt = document.createElement('option');
                opt.value = g; opt.textContent = `Grupo ${g}`;
                selectGrupo.appendChild(opt);
            });

            // Si no hay grupos válidos, mostrar un mensaje
            if (!isAdmin && gruposValidos.length === 0) {
                const opt = document.createElement('option');
                opt.value = ""; 
                opt.textContent = "❌ No evalúas en este Parcial.";
                // Remover la opción original si está vacía
                selectGrupo.innerHTML = '';
                selectGrupo.appendChild(opt);
                selectGrupo.disabled = true;
            }

            hideLoader();
        }
        // Limpiar equipos al recargar
        containerEquipos.innerHTML = '';
        containerEquipos.classList.add('hidden');
        selectGrupo.value = "";
    }

    selectGrupo.addEventListener('change', async (e) => {
        const grupoId = e.target.value;
        if(!grupoId) {
            containerEquipos.innerHTML = '';
            containerEquipos.classList.add('hidden');
            return;
        }

        showLoader();
        
        // Obtener equipos con una comparación relajada a prueba de balas (solo números)
        const allData = await api.fetchAllData();
        const cleanGroupStr = (g) => String(g).replace(/[^0-9]/g, '');
        const targetClean = cleanGroupStr(grupoId);
        
        let equipos = allData.equipos.filter(e => cleanGroupStr(e.grupo) === targetClean);
        
        // Ordenar equipos alfabéticamente por nombre
        equipos.sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)));
        
        containerEquipos.innerHTML = '';
        
        if (equipos.length === 0) {
            containerEquipos.innerHTML = '<p>No hay equipos registrados en este grupo.</p>';
        } else {
            // Obtener evaluaciones para mostrar detalles
            const todasEvals = await api.getConcentrado();
            const allData = await api.fetchAllData();
            
            // 2. LÓGICA DE BLOQUEO DE BOTÓN CAPTURA
            const userEmail = sessionStorage.getItem('user_email') || "";
            const isAdmin = sessionStorage.getItem('user_role') === 'admin';
            const pActivo = (allData.config && allData.config.parcialActivo) || "2";

            let puedeEvaluar = isAdmin;
            if (!isAdmin && userEmail) {
                const myRows = allData.directorio.filter(d => 
                    cleanGroupStr(d.grupo) === targetClean && String(d.correo).trim().toLowerCase() === String(userEmail).trim().toLowerCase()
                );
                
                // Si alguna de sus materias para este grupo incluye el parcial activo
                puedeEvaluar = myRows.some(d => {
                    const parseNum = (v) => { const m = String(v).match(/\d+/); return m ? m[0] : String(v).trim(); };
                    const strParciales = String(d.parcial || "").trim();
                    const parcialesArray = strParciales.split(',').map(s => parseNum(s));
                    return parcialesArray.includes(parseNum(pActivo));
                });
            }
            // ===================================
            // PROGRESO PERSONAL DEL DOCENTE (NUEVO)
            // ===================================
            if (!isAdmin && userEmail && puedeEvaluar) {
                const misEvalsAqui = todasEvals.filter(ev => 
                    (String(ev.docenteEmail || ev.docente_email || "").trim().toLowerCase() === String(userEmail).trim().toLowerCase()) &&
                    String(ev.parcial) === String(pActivo) &&
                    cleanGroupStr(ev.grupoId) === targetClean
                );
                
                const equiposYaCalificados = new Set(misEvalsAqui.map(ev => ev.equipoId));
                let evaluadosMios = 0;
                equipos.forEach(eq => { if (equiposYaCalificados.has(eq.id)) evaluadosMios++; });

                const totalMios = equipos.length;
                const pct = totalMios > 0 ? (evaluadosMios / totalMios) * 100 : 0;
                const yaTermine = evaluadosMios === totalMios && totalMios > 0;

                const htmlProgreso = `
                    <div style="background: white; border-radius: 12px; padding: 1.25rem; margin-bottom: 24px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; border-left: 4px solid ${yaTermine ? '#10b981' : '#3b82f6'}; grid-column: 1 / -1; width: 100%;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                            <h3 style="margin: 0; font-size: 1.05rem; color: #1e293b; display: flex; align-items: center; gap: 8px;">
                                <i data-feather="${yaTermine ? 'check-circle' : 'activity'}" style="color: ${yaTermine ? '#10b981' : '#3b82f6'}; width: 20px;"></i> 
                                Mi Avance de Evaluación en este Grupo
                            </h3>
                            <span style="font-weight: 700; font-size: 0.8rem; color: #64748b; background: #f1f5f9; padding: 4px 10px; border-radius: 99px;">
                                Parcial ${pActivo}
                            </span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 0.9rem; color: #475569; font-weight: 500;">
                            <span>Has evaluado <strong style="color: #1e293b;">${evaluadosMios}</strong> de <strong style="color: #1e293b;">${totalMios}</strong> equipos.</span>
                            <span style="color: ${yaTermine ? '#10b981' : '#3b82f6'}; font-weight: 800; font-variant-numeric: tabular-nums;">${pct.toFixed(0)}%</span>
                        </div>
                        <div style="width: 100%; height: 8px; background: #f1f5f9; border-radius: 99px; overflow: hidden;">
                            <div style="height: 100%; width: ${pct}%; background: ${yaTermine ? '#10b981' : '#3b82f6'}; transition: width 0.5s ease-out;"></div>
                        </div>
                    </div>
                `;
                containerEquipos.insertAdjacentHTML('beforeend', htmlProgreso);
            }

            equipos.forEach(eq => {
                const isEvaluado = eq.estado === 'Evaluado';
                
                // Determinar el aspecto del botón
                let btnHtml = '';
                if (puedeEvaluar) {
                    btnHtml = `<button class="btn btn-outline ${isEvaluado ? '' : 'btn-full'} btn-evaluar" data-id="${eq.id}" data-nombre="${eq.nombre}" data-enlace="${eq.urlDoc}" data-grupo="${eq.grupo}" data-integrantes="${eq.integrantes.join('|')}" style="flex:1;">
                                    <i data-feather="edit-2"></i> Evaluar Equipo
                               </button>`;
                } else {
                    btnHtml = `<button class="btn btn-outline ${isEvaluado ? '' : 'btn-full'} btn-disabled" disabled style="flex:1; background:#f1f5f9; color:#94a3b8; border-color:#e2e8f0; cursor:not-allowed;" title="No configures ponderación en Parcial ${pActivo}">
                                    <i data-feather="lock"></i> No evalúas
                               </button>`;
                }

                const html = `
                    <div class="equipo-card">
                        <div class="equipo-header">
                            <div>
                                <h3 class="equipo-title">${eq.nombre}</h3>
                                <span class="equipo-tema">${eq.tema || 'Proyecto Escolar'}</span>
                            </div>
                            <span class="badge ${isEvaluado ? 'evaluado' : 'pendiente'}">${eq.estado}</span>
                        </div>
                        <div class="equipo-body">
                            <span class="integrantes-title">Integrantes:</span>
                            <ul class="integrantes-list">
                                ${eq.integrantes.map(i => `<li>${i}</li>`).join('')}
                            </ul>
                            ${isEvaluado ? `<div id="detalle-${eq.id}" class="detalle-evals hidden" style="margin-top:1rem;"></div>` : ''}
                        </div>
                        <div class="equipo-footer" style="flex-wrap: wrap; gap: 8px;">
                            ${isEvaluado ? `<button class="btn btn-secondary btn-ver-detalle" data-equipo-id="${eq.id}" style="flex:1;"><i data-feather="eye"></i> Ver Detalle</button>` : ''}
                            ${btnHtml}
                        </div>
                    </div>
                `;
                containerEquipos.insertAdjacentHTML('beforeend', html);
            });
            feather.replace();

            // Asignar eventos a los botones de Evaluar
            document.querySelectorAll('.btn-evaluar').forEach(btn => {
                btn.addEventListener('click', () => abrirModalEvaluacion(btn.dataset));
            });
            
            // Asignar eventos a los botones de Ver Detalle
            document.querySelectorAll('.btn-ver-detalle').forEach(btn => {
                btn.addEventListener('click', () => {
                    const eqId = btn.dataset.equipoId;
                    const container = document.getElementById(`detalle-${eqId}`);
                    
                    // Toggle: si ya está visible, ocultarlo
                    if (!container.classList.contains('hidden')) {
                        container.classList.add('hidden');
                        btn.innerHTML = '<i data-feather="eye"></i> Ver Detalle';
                        feather.replace();
                        return;
                    }
                    
                    // Filtrar evaluaciones de este equipo
                    const evalsEquipo = todasEvals.filter(ev => ev.equipoId === eqId);
                    
                    if (evalsEquipo.length === 0) {
                        container.innerHTML = '<p style="color:#64748b; font-size:0.85rem;">No se encontraron registros detallados.</p>';
                    } else {
                        // Agrupar por materia para mostrar resumen limpio
                        const porMateria = {};
                        evalsEquipo.forEach(ev => {
                            const key = `${ev.materia}|P${ev.parcial}`;
                            if (!porMateria[key]) {
                                porMateria[key] = { materia: ev.materia, parcial: ev.parcial, docente: ev.docente, fecha: ev.fecha, puntajes: [] };
                            }
                            porMateria[key].puntajes.push({ alumno: ev.alumno || 'Equipo', puntaje: ev.puntaje });
                        });
                        
                        let tableHTML = `
                            <div style="background:#f0f9ff; border:1px solid #bae6fd; border-radius:8px; padding:12px; margin-top:8px;">
                                <strong style="color:#0369a1; font-size:0.85rem;">📊 Evaluaciones Registradas:</strong>
                                <table style="width:100%; border-collapse:collapse; margin-top:8px; font-size:0.8rem;">
                                    <thead>
                                        <tr style="border-bottom:1px solid #bae6fd;">
                                            <th style="padding:5px 6px; text-align:left; color:#0c4a6e;">Parcial</th>
                                            <th style="padding:5px 6px; text-align:left; color:#0c4a6e;">Materia</th>
                                            <th style="padding:5px 6px; text-align:left; color:#0c4a6e;">Docente</th>
                                            <th style="padding:5px 6px; text-align:center; color:#0c4a6e;">Prom.</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                        `;
                        Object.values(porMateria).forEach(item => {
                            const promedio = item.puntajes.length > 0 
                                ? (item.puntajes.reduce((s, p) => s + p.puntaje, 0) / item.puntajes.length).toFixed(1)
                                : '-';
                            tableHTML += `
                                <tr style="border-bottom:1px solid #e0f2fe;">
                                    <td style="padding:5px 6px; color:#334155;">P${item.parcial}</td>
                                    <td style="padding:5px 6px; color:#475569;">${item.materia}</td>
                                    <td style="padding:5px 6px; color:#64748b;">${item.docente}</td>
                                    <td style="padding:5px 6px; text-align:center; font-weight:700; color:#0369a1;">${promedio}</td>
                                </tr>
                            `;
                        });
                        tableHTML += '</tbody></table></div>';
                        container.innerHTML = tableHTML;
                    }
                    
                    container.classList.remove('hidden');
                    btn.innerHTML = '<i data-feather="eye-off"></i> Ocultar';
                    feather.replace();
                });
            });
        }
        
        containerEquipos.classList.remove('hidden');
        hideLoader();
    });

    /* =======================================
       MODAL DE EVALUACIÓN
       ======================================= */
    const modal = document.getElementById('modal-captura');
    const formEval = document.getElementById('form-evaluacion');
    const puntajeGenInput = document.getElementById('eval-puntaje');

    // Autollenar a los integrantes cuando se pone la calificación general
    puntajeGenInput.addEventListener('input', (e) => {
        const val = e.target.value;
        document.querySelectorAll('.eval-indiv-input').forEach(inp => {
            inp.value = val;
        });
    });

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            modal.classList.add('hidden');
            formEval.reset();
        });
    });

    async function abrirModalEvaluacion(data) {
        document.getElementById('modal-equipo-nombre').textContent = `Evaluar: ${data.nombre}`;
        document.getElementById('modal-equipo-link').href = data.enlace || '#';
        document.getElementById('eval-equipo-id').value = data.id;
        document.getElementById('eval-equipo-nombre').value = data.nombre;
        document.getElementById('eval-grupo-id').value = data.grupo;
        document.getElementById('eval-puntaje').value = '';
        
        // 1. CARGAR MATERIAS DINÁMICAS DESDE EL DIRECTORIO
        const selectMateria = document.getElementById('eval-materia');
        const selectParcial = document.getElementById('eval-parcial');
        
        async function cargarMateriasParaParcial() {
            selectMateria.innerHTML = '<option value="">-- Selecciona tu materia --</option>';
            document.getElementById('eval-docente').value = '';
            document.getElementById('eval-ponderacion-hint').innerHTML = '';
            
            try {
                const directorio = await api.getDirectorio();
                const parseNum = (v) => { const m = String(v).match(/\d+/); return m ? m[0] : String(v).trim(); };
                const parcialElegido = parseNum(selectParcial.value);
                
                const extractNum = (g) => g.replace(/^[A-Za-z]+/, '');
                const grupoNum = extractNum(data.grupo);
                
                // Intentar coincidencia exacta primero, luego por número
                let materiasGrupo = directorio.filter(item => item.grupo === data.grupo);
                if (materiasGrupo.length === 0) {
                    materiasGrupo = directorio.filter(item => extractNum(item.grupo) === grupoNum);
                }
                
                // Filtrar AHORA sí obligadamente por Parcial
                materiasGrupo = materiasGrupo.filter(item => {
                    const strParciales = String(item.parcial || "").trim();
                    const parcialesArray = strParciales.split(',').map(s => parseNum(s));
                    return parcialesArray.includes(parcialElegido);
                });
                
                // Deduplicar materias
                const seen = new Set();
                materiasGrupo = materiasGrupo.filter(m => {
                    if (seen.has(m.materia)) return false;
                    seen.add(m.materia);
                    return true;
                });
                
                if (materiasGrupo.length > 0) {
                    materiasGrupo.forEach(m => {
                        const opt = document.createElement('option');
                        opt.value = m.materia;
                        opt.textContent = m.materia;
                        opt.dataset.docente = m.docente; 
                        opt.dataset.ponderacion = getPonderacionParaParcial(m, parcialElegido); 
                        selectMateria.appendChild(opt);
                    });
                }
            } catch(e) {
                console.error("Error al cargar materias del directorio", e);
            }
        }

        // Cargar inmediatamente
        await cargarMateriasParaParcial();
        
        // Y recargar cada vez que el profe cambie el parcial en el select
        selectParcial.onchange = async () => {
            await cargarMateriasParaParcial();
        };

        // 2. AUTO-LLENAR DOCENTE Y MOSTRAR PONDERACIÓN AL CAMBIAR MATERIA
        selectMateria.onchange = (e) => {
            const selectedOpt = e.target.options[e.target.selectedIndex];
            const hintDiv = document.getElementById('eval-ponderacion-hint');
            
            if (selectedOpt && selectedOpt.dataset.docente) {
                document.getElementById('eval-docente').value = selectedOpt.dataset.docente.toUpperCase();
                
                const pond = parseFloat(selectedOpt.dataset.ponderacion);
                if (pond > 0) {
                    hintDiv.innerHTML = `
                        <div style="background:#EEF2FF; border:1px solid #C7D2FE; color:#4338CA; padding:10px 14px; border-radius:8px; font-size:0.85rem; margin-top:8px;">
                            📌 <strong>${selectedOpt.value}</strong> tiene una ponderación de <strong>${pond} punto(s)</strong> sobre los 2 puntos totales del PEC.
                            <br><span style="font-size:0.8rem; color:#6366f1;">Calificación sugerida: de 0 a ${pond}</span>
                        </div>
                    `;
                } else {
                    hintDiv.innerHTML = '';
                }
            } else {
                document.getElementById('eval-docente').value = '';
                hintDiv.innerHTML = '';
            }
        };

        // 3. RENDERIZAR INTEGRANTES (Mismo que antes)
        const indivContainer = document.getElementById('eval-evaluacion-individual');
        indivContainer.innerHTML = '';
        if (data.integrantes) {
            const arr = data.integrantes.split('|');
            arr.forEach(alum => {
                indivContainer.innerHTML += `
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
                        <span style="font-size:0.85rem; color:#1e293b; font-weight: 500;">${alum}</span>
                        <input type="number" class="input-control eval-indiv-input" data-alumno="${alum}" min="0" max="10" step="0.1" style="width:75px; padding:4px; text-align:center;">
                    </div>
                `;
            });
        }
        
        // Abrir modal al final de cargar todo
        modal.classList.remove('hidden');
        // Asegurar que el scroll del modal esté arriba al abrir
        modal.scrollTop = 0;
        
        // Recordar docente anterior si existe en localStorage
        const profGuardado = localStorage.getItem('pec-docente-n');
        if(profGuardado) document.getElementById('eval-docente').value = profGuardado;
    }

    formEval.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const individual = [];
        document.querySelectorAll('.eval-indiv-input').forEach(inp => {
            if (inp.value !== "") {
                individual.push({
                    alumno: inp.dataset.alumno,
                    puntaje: parseFloat(inp.value)
                });
            }
        });

        const payload = {
            equipoId: document.getElementById('eval-equipo-id').value,
            equipoNombre: document.getElementById('eval-equipo-nombre').value,
            grupoId: document.getElementById('eval-grupo-id').value,
            parcial: document.getElementById('eval-parcial').value,
            materia: document.getElementById('eval-materia').value,
            docente: document.getElementById('eval-docente').value,
            puntaje: parseFloat(document.getElementById('eval-puntaje').value), // Sirve como general fallback
            observaciones: document.getElementById('eval-obs').value,
            integrantes: individual
        };

        // Guardar nombre del profesor para su comodidad
        localStorage.setItem('pec-docente-n', payload.docente);

        modal.classList.add('hidden');
        showLoader();
        
        try {
            await api.guardarEvaluacion(payload);
            alert("Evaluación guardada exitosamente en Google Sheets.");
            formEval.reset();
            // Refrescar equipos si seguimos en la vista
            if(currentView === 'grupos') {
                selectGrupo.dispatchEvent(new Event('change'));
            }
        } catch (error) {
            console.error(error);
            alert("Ocurrió un error al enviar a Google Sheets.");
        }
        hideLoader();
    });

    /* =======================================
       VISTA 3: CONCENTRADO
       ======================================= */
    async function initConcentrado() {
        showLoader();
        try {
            const evals = await api.getConcentrado();
            const tbody = document.querySelector('#tabla-concentrado tbody');
            tbody.innerHTML = '';

            if(evals.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No hay evaluaciones registradas.</td></tr>';
            } else {
                evals.forEach(ev => {
                    const tr = `
                        <tr>
                            <td style="color:#64748b; font-size:0.85rem;">${ev.fecha}</td>
                            <td><span class="badge" style="background:#fef08a; color:#854d0e;">P${ev.parcial || '-'}</span></td>
                            <td><span class="badge" style="background:#e0f2fe; color:#0369a1;">${ev.grupoId}</span></td>
                            <td style="font-weight:600;">${ev.equipoNombre}</td>
                            <td>${ev.materia}</td>
                            <td>${ev.docente}</td>
                            <td style="font-weight:700; color:var(--clr-primary); font-size: 1.1rem;">${ev.puntaje.toFixed(1)}</td>
                        </tr>
                    `;
                    tbody.insertAdjacentHTML('beforeend', tr);
                });
            }
        } catch (error) {
            alert("Error al cargar concentrado");
        }
        hideLoader();
    }

    /* =======================================
       VISTA 4: DIRECTORIO
       ======================================= */
    async function initDirectorio() {
        showLoader();
        try {
            const directorio = await api.getDirectorio();
            const dirSegundos = document.getElementById('dir-segundos');
            const dirCuartos = document.getElementById('dir-cuartos');
            dirSegundos.innerHTML = '';
            dirCuartos.innerHTML = '';
            
            if (!directorio || directorio.length === 0) {
               dirSegundos.innerHTML = '<p style="color: #64748b;">Aún no hay horarios capturados en Google Sheets.</p>';
               dirCuartos.innerHTML = '<p style="color: #64748b;">Aún no hay horarios capturados en Google Sheets...</p>';
               hideLoader();
               return;
            }

            const gruposMap = {};
            directorio.forEach(row => {
               if (!gruposMap[row.grupo]) gruposMap[row.grupo] = [];
               gruposMap[row.grupo].push(row);
            });

            const gruposOrdenados = Object.keys(gruposMap).sort();
            
            gruposOrdenados.forEach(grupo => {
                const isSegundo = /2\d{2}/.test(grupo); // matches 201, 211, M205, V207, etc.
                const colorBorderTop = isSegundo ? 'var(--clr-primary)' : 'var(--clr-secondary)';
                const colorBg = isSegundo ? '#f0f9ff' : '#fef2f2';
                
                const html = `
                    <div class="equipo-card" style="margin-bottom: 20px; border-top: 4px solid ${colorBorderTop}; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
                        <div class="equipo-header" style="background:${colorBg}; padding: 12px 16px;">
                            <h3 class="equipo-title" style="margin:0; font-size:1.1rem; color: #1e293b;">Grupo ${grupo}</h3>
                        </div>
                        <div class="equipo-body" style="padding: 16px;">
                            <table style="width:100%; font-size: 0.85rem; border-collapse: collapse;">
                                <thead>
                                    <tr style="border-bottom: 2px solid #cbd5e1; text-align:left;">
                                        <th style="padding-bottom: 8px; color: #475569;">Asignatura</th>
                                        <th style="padding-bottom: 8px; color: #475569;">Docente Asignado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${gruposMap[grupo].map(asg => `
                                        <tr style="border-bottom: 1px solid #f1f5f9;">
                                            <td style="padding: 8px 0; padding-right: 12px; font-weight: 500; color: #334155;">${asg.materia}</td>
                                            <td style="padding: 8px 0; color: #64748b;">
                                                <div style="font-weight:500;">${asg.docente.toUpperCase()}</div>
                                                ${asg.correo ? `<div style="font-size:0.75rem; color:#94a3b8; font-family:monospace;">${asg.correo.toLowerCase()}</div>` : ''}
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
                
                if (isSegundo) {
                    dirSegundos.insertAdjacentHTML('beforeend', html);
                } else {
                    dirCuartos.insertAdjacentHTML('beforeend', html);
                }
            });
            
            if(dirSegundos.innerHTML === '') dirSegundos.innerHTML = '<p style="color: #64748b;">No hay registro de 2do Semestre.</p>';
            if(dirCuartos.innerHTML === '') dirCuartos.innerHTML = '<p style="color: #64748b;">No hay registro de 4to Semestre.</p>';

        } catch(e) {
            console.error("Error cargando directorio: ", e);
        }
        hideLoader();
    }

    /* Exportar/Generar Sábanas Excel */
    document.getElementById('btn-exportar').addEventListener('click', async () => {
        showLoader();
        const loadingText = document.querySelector('#loading p');
        const defaultMessage = loadingText.textContent;
        loadingText.textContent = "Generando Matrices en Excel en la Nube...";
        
        try {
            const res = await api.generarExcel();
            if(res.status === 'success') {
                alert("¡Éxito! Abre tu archivo de Google Sheets. Se acaban de crear/sobreescribir las pestañas de 'Sábana' por grupo con todos los datos desglosados.");
            } else {
                alert("Hubo un error al generar: " + res.message);
            }
        } catch (e) {
            console.error(e);
            alert("Error de conexión al intentar generar el archivo.");
        }
        
        loadingText.textContent = defaultMessage;
        hideLoader();
    });

    // --- VISTA: VISTA RÁPIDA (GLOBAL) ---
    async function initVistaRapida() {
        showLoader();
        try {
            const data = await api.getDashboardData();
            const container = document.getElementById('lista-rapida-container');
            const stats = document.getElementById('rapida-stats');
            
            if (!container) return;

            if (!data.equipos || data.equipos.length === 0) {
                container.innerHTML = '<p style="text-align:center; padding:2rem; color:#64748b;">No hay equipos registrados en el sistema.</p>';
                hideLoader();
                return;
            }

            // Stats Rápidos
            if (stats) {
                stats.innerHTML = `
                    <span style="color:#0369a1; background:#e0f2fe; padding:4px 12px; border-radius:999px;">${data.totalGrupos} Grupos</span>
                    <span style="color:#059669; background:#d1fae5; padding:4px 12px; border-radius:999px;">${data.totalEquipos} Equipos</span>
                    <span style="color:#6366f1; background:#eef2ff; padding:4px 12px; border-radius:999px;">Parcial ${data.config.parcialActivo || "1"}</span>
                `;
            }

            const pActivo = (data.config && data.config.parcialActivo) || "1";
            const cleanG = (g) => String(g).replace(/[^0-9]/g, '');
            const parseP = (v) => { const m = String(v).match(/\d+/); return m ? m[0] : String(v).trim(); };

            // Agrupar Equipos por Grupo
            const grouped = {};
            data.equipos.forEach(eq => {
                if (!eq.grupo) return;
                if (!grouped[eq.grupo]) grouped[eq.grupo] = [];
                grouped[eq.grupo].push(eq);
            });

            const sortedGroups = Object.keys(grouped).sort((a,b)=>String(a).localeCompare(String(b), undefined, {numeric:true}));
            
            container.innerHTML = sortedGroups.map(gName => {
                const eqs = grouped[gName].sort((a,b)=>String(a.nombre).localeCompare(String(b.nombre)));
                return `
                    <div class="grupo-section" style="border-bottom: 2px solid #f1f5f9; padding-bottom: 2rem; margin-bottom: 1rem;">
                        <div style="display:flex; align-items:center; gap:12px; margin-bottom:1.5rem; position:sticky; top:0; background:white; padding:10px 0; z-index:10; border-bottom: 1px solid #e2e8f0; box-shadow: 0 2px 4px -2px rgba(0,0,0,0.05);">
                            <span style="background:var(--clr-primary); color:white; width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:1.2rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">${gName[0]}</span>
                            <div>
                                <h3 style="margin:0; font-size:1.4rem; color:#1e293b; letter-spacing:-0.5px;">Grupo ${gName}</h3>
                                <span style="font-size:0.85rem; color:#64748b; font-weight:600; display:flex; align-items:center; gap:4px;">
                                    <i data-feather="users" style="width:14px;"></i> ${eqs.length} equipos conformados
                                </span>
                            </div>
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.5rem;">
                            ${eqs.map(eq => {
                                // 1. Calcular Estatus Estricto
                                const materiasAsignadas = (data.directorio || []).filter(d => {
                                    const parciales = String(d.parcial || "").split(',').map(s => parseP(s));
                                    return cleanG(d.grupo) === cleanG(gName) && parciales.includes(parseP(pActivo));
                                }).map(d => d.materia);
                                
                                const uniqueAsignadas = [...new Set(materiasAsignadas)];
                                const todasEvals = data.todasEvaluaciones || data.evaluaciones || [];
                                const evalsEqP = todasEvals.filter(ev => String(ev.equipoId) === String(eq.id) && String(ev.parcial) === String(pActivo));
                                const materiasEvaluadas = [...new Set(evalsEqP.map(ev => ev.materia))];
                                
                                const countAsign = uniqueAsignadas.length;
                                const countEval = materiasEvaluadas.filter(m => uniqueAsignadas.includes(m)).length;
                                
                                let stText = "PENDIENTE";
                                let stColor = "#92400e";
                                let stBg = "#fef3c7";
                                let borderColor = "#f59e0b";
                                
                                if (countEval > 0) {
                                    if (countEval < countAsign) {
                                        stText = "EN PROCESO";
                                        stColor = "#854d0e";
                                        stBg = "#fefce8";
                                        borderColor = "#eab308";
                                    } else {
                                        stText = "COMPLETO";
                                        stColor = "#065f46";
                                        stBg = "#d1fae5";
                                        borderColor = "#10b981";
                                    }
                                }

                                return `
                                <div style="background:white; border:1px solid #e2e8f0; border-radius:16px; padding:1.25rem; border-left: 5px solid ${borderColor}; transition: all 0.2s; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                                    <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:10px;">
                                        <h4 style="margin:0; font-size:1.05rem; color:#1e293b; font-weight:800; line-height:1.2;">${eq.nombre}</h4>
                                        <span style="white-space:nowrap; font-size:0.6rem; padding:3px 10px; border-radius:999px; background:${stBg}; color:${stColor}; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">
                                            ${stText} ${countAsign > 0 ? `(${countEval}/${countAsign})` : ''}
                                        </span>
                                    </div>
                                    <p style="font-size:0.8rem; color:#64748b; margin-top:0; font-style:italic; margin-bottom:12px; border-bottom:1px solid #f1f5f9; padding-bottom:8px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;" title="${eq.tema || 'Proyecto PEC'}">${eq.tema || 'Proyecto PEC'}</p>
                                    <div style="display:flex; flex-wrap:wrap; gap:6px;">
                                        ${eq.integrantes.map(i => `<span style="font-size:0.75rem; background:#f8fafc; color:#475569; padding:4px 10px; border-radius:6px; border:1px solid #e2e8f0; font-weight:500;">${i}</span>`).join('')}
                                    </div>

                                    ${uniqueAsignadas.length > 0 ? `
                                    <div style="margin-top:10px; padding:8px; background:#f8fafc; border-radius:8px; border:1px solid #f1f5f9;">
                                        <div style="font-size:0.58rem; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Evaluaciones P${pActivo}</div>
                                        <div style="display:flex; flex-direction:column; gap:2px;">
                                            ${uniqueAsignadas.map(mat => {
                                                const evMat = evalsEqP.filter(ev => ev.materia === mat);
                                                const evaluado = evMat.length > 0;
                                                const docente = evaluado ? evMat[0].docente : null;
                                                return evaluado
                                                    ? `<div style="display:flex; align-items:center; gap:4px; font-size:0.62rem;">
                                                          <span style="color:#10b981; flex-shrink:0;">✓</span>
                                                          <span style="font-weight:600; color:#1e293b;">${mat}</span>
                                                          <span style="color:#64748b; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">· ${docente}</span>
                                                       </div>`
                                                    : `<div style="display:flex; align-items:center; gap:4px; font-size:0.62rem; opacity:0.5;">
                                                          <span style="color:#f59e0b; flex-shrink:0;">○</span>
                                                          <span style="color:#64748b;">${mat}</span>
                                                       </div>`;
                                            }).join('')}
                                        </div>
                                    </div>` : ''}

                                    <div style="display:flex; gap:6px; margin-top:12px; padding-top:10px; border-top:1px dashed #e2e8f0;">
                                        ${['1', '2', '3'].map(p => {
                                            const evs = todasEvals.filter(ev => String(ev.equipoId) === String(eq.id) && String(ev.parcial) === p);
                                            if (evs.length === 0) {
                                                return `<div style="flex:1; text-align:center; padding:4px; background:#f8fafc; color:#cbd5e1; border-radius:8px; font-size:0.7rem; font-weight:700; border:1px solid #e2e8f0; opacity:0.6;">P${p} -</div>`;
                                            }
                                            
                                            const avg = (evs.reduce((acc, cur) => acc + cur.puntaje, 0) / evs.length).toFixed(1);
                                            const docs = [...new Set(evs.map(ev => ev.docente))].join(', ');
                                            const obsEscaped = evs.map(ev => (ev.observaciones || 'Sin observaciones')).join('\\n---\\n').replace(/'/g, "\\'").replace(/"/g, '&quot;');
                                            const titleText = `Evaluado por: ${docs}\nPromedio: ${avg}\nHaz clic para ver observaciones.`;

                                            return `
                                                <div onclick="window.verObservacionesPEC('${eq.nombre}', '${p}', '${obsEscaped}')" 
                                                     title="${titleText}" 
                                                     style="flex:1; text-align:center; padding:4px; background:#f0fdf4; color:#166534; border-radius:8px; font-size:0.7rem; font-weight:800; border:1px solid #bbf7d0; cursor:pointer; transition:all 0.2s;">
                                                    P${p}: ${avg}
                                                </div>`;
                                        }).join('')}
                                    </div>

                                    ${eq.urlDoc ? `
                                        <a href="${eq.urlDoc}" target="_blank" style="display:inline-flex; align-items:center; gap:6px; margin-top:12px; font-size:0.8rem; color:#2563eb; text-decoration:none; font-weight:700; background:#eff6ff; padding:6px 12px; border-radius:8px; border:1px solid #dbeafe; transition:all 0.2s;">
                                            <i data-feather="external-link" style="width:14px;"></i> Protocolo
                                        </a>` : ''}
                                </div>`;
                            }).join('')}
                        </div>
                    </div>
                `;
            }).join('');
            
            feather.replace();
        } catch (e) {
            console.error("Error en Vista Rápida:", e);
            const container = document.getElementById('lista-rapida-container');
            if (container) container.innerHTML = `<p style="color:#ef4444; text-align:center; padding:3rem; background:#fef2f2; border-radius:12px; border:1px solid #fee2e2;">⚠️ Ocurrió un error al cargar los datos: ${e.message}</p>`;
        }
        hideLoader();
    }

    // Función Global para ver observaciones desde Vista Rápida
    window.verObservacionesPEC = (equipo, parcial, obs) => {
        alert(`📝 Observaciones PEC - ${equipo}\nParcial ${parcial}\n\n${obs}`);
    };

    // Iniciar con la primera vista
    initDashboard();
});
