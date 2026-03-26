// pec/js/app.js

document.addEventListener("DOMContentLoaded", () => {
    // Inicializar íconos
    feather.replace();

    // DOM Elements
    const views = document.querySelectorAll('.view');
    const navItems = document.querySelectorAll('.nav-item');
    const loader = document.getElementById('loading');
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');

    // Estado local
    let currentView = 'dashboard';

    // Navegación
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const viewName = item.getAttribute('data-view');
            
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
        if (view === 'directorio') await initDirectorio();
    };

    /* =======================================
       VISTA 1: DASHBOARD
       ======================================= */
    async function initDashboard() {
        showLoader();
        try {
            const data = await api.getDashboardData();
            
            // Stats
            document.getElementById('dash-grupos').textContent = data.totalGrupos;
            document.getElementById('dash-equipos').textContent = data.totalEquipos;
            document.getElementById('dash-evaluaciones').textContent = data.evaluaciones;
            document.getElementById('dash-avance').textContent = `${data.avance}%`;

            // Grupos Lista (Equipos por grupo)
            const listGrupos = document.getElementById('dash-lista-grupos');
            const equiposPorGrupo = {};
            data.equipos.forEach(eq => {
                const g = eq.grupo;
                if (!equiposPorGrupo[g]) equiposPorGrupo[g] = 0;
                equiposPorGrupo[g]++;
            });
            
            listGrupos.innerHTML = data.grupos.map(g => {
                const count = equiposPorGrupo[g] || 0;
                return `<div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:6px 12px; font-size:0.85rem; font-weight:500; color:#334155;">
                    <span style="color:#2563eb; font-weight:700; margin-right:4px;">${g}</span>
                    <span style="color:#64748b;">(${count} eq.)</span>
                </div>`;
            }).join('');

            // Avance Lista
            const eqEvaluados = data.equipos.filter(e => e.estado === 'Evaluado').length;
            const dashAvance = document.getElementById('dash-avance-equipos');
            dashAvance.innerHTML = `
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-weight: 600;">
                    <span>${eqEvaluados} Evaluados</span>
                    <span>${data.equipos.length - eqEvaluados} Pendientes</span>
                </div>
                <div style="width: 100%; height: 12px; background: #E2E8F0; border-radius: 999px; overflow: hidden;">
                    <div style="height: 100%; width: ${(eqEvaluados/data.equipos.length)*100}%; background: var(--clr-success);"></div>
                </div>
            `;

            // === OBTENER TODOS LOS DATOS ===
            const allData = await api.fetchAllData();
            const directorio = allData.directorio || [];
            const evaluaciones = allData.evaluaciones || [];
            const programacion = allData.programacion || [];
            const sinEquipo = allData.sinEquipo || [];

            // === DIAGNÓSTICO ALUMNOS SIN EQUIPO ===
            const badgeSinEq = document.getElementById('badge-sin-equipo');
            const containerSinEq = document.getElementById('dash-sin-equipo');
            const panelDiag = document.getElementById('panel-diagnostico');
            
            badgeSinEq.textContent = `${sinEquipo.length} alumno(s)`;
            
            if (sinEquipo.length === 0) {
                containerSinEq.innerHTML = '<p style="text-align: center; color: #10b981; font-weight: 500; margin: 0;">✅ Todos los alumnos de la lista tienen equipo asignado.</p>';
                panelDiag.style.borderLeftColor = '#10b981';
                badgeSinEq.style.background = '#d1fae5';
                badgeSinEq.style.color = '#047857';
                panelDiag.querySelector('h2').style.color = '#047857';
                panelDiag.querySelector('h2').textContent = '✅ Equipos Completos';
            } else {
                // Agrupar por grupo para mejor lectura
                const sinEqPorGrupo = {};
                sinEquipo.forEach(a => {
                    if (!sinEqPorGrupo[a.grupo]) sinEqPorGrupo[a.grupo] = [];
                    sinEqPorGrupo[a.grupo].push(a.alumno);
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
                containerSinEq.innerHTML = htmlSinEq;
            }

            // === SEGUIMIENTO DOCENTE ===
            
            // Llenar selector de grupos del seguimiento
            const segGrupoSelect = document.getElementById('seg-grupo');
            if (segGrupoSelect.options.length <= 1) {
                const gruposDir = [...new Set(directorio.map(d => d.grupo))].sort();
                gruposDir.forEach(g => {
                    const opt = document.createElement('option');
                    opt.value = g;
                    opt.textContent = `Grupo ${g}`;
                    segGrupoSelect.appendChild(opt);
                });
            }

            // Función para renderizar la tabla de seguimiento
            const renderSeguimiento = () => {
                const parcialSel = document.getElementById('seg-parcial').value;
                const grupoSel = document.getElementById('seg-grupo').value;
                const extractNum = (g) => g.replace(/^[A-Za-z]+/, '');

                // Obtener programación para este parcial
                const progParcial = programacion.filter(p => p.parcial === parcialSel);

                // Función para detectar turno de un grupo del Directorio
                const getTurno = (grupo) => {
                    if (grupo.toUpperCase().startsWith('V')) return 'VESPERTINO';
                    return 'MATUTINO'; // M o sin prefijo = matutino
                };

                // Filtrar directorio: solo materias programadas para este parcial Y turno correcto
                let dirFiltrado = directorio;
                if (progParcial.length > 0) {
                    dirFiltrado = directorio.filter(d => {
                        const turnoGrupo = getTurno(d.grupo);
                        // Buscar si esta materia está programada para el turno de este grupo
                        return progParcial.some(p => {
                            const matchMateria = p.materia === d.materia;
                            const matchTurno = !p.turno || p.turno === '' || p.turno === turnoGrupo || p.turno === 'AMBOS';
                            
                            const pGrupoOpcional = p.grupoEspecial ? String(p.grupoEspecial).trim().toUpperCase() : '';
                            const dGrupoNum = extractNum(d.grupo);
                            const gruposPermitidos = pGrupoOpcional.split(',').map(s => s.trim());
                            const matchGrupo = !pGrupoOpcional || 
                                               gruposPermitidos.includes(d.grupo.toUpperCase()) || 
                                               gruposPermitidos.includes(dGrupoNum);
                            
                            return matchMateria && matchTurno && matchGrupo;
                        });
                    });
                }
                
                // Filtrar por grupo si se seleccionó uno
                if (grupoSel) {
                    dirFiltrado = dirFiltrado.filter(d => d.grupo === grupoSel);
                }

                // Crear set de evaluaciones hechas: "grupoNum|materia|parcial"
                const evalsHechas = new Set();
                evaluaciones.forEach(ev => {
                    const gNum = extractNum(String(ev.grupoId));
                    const mat = String(ev.materia || '').trim();
                    const par = String(ev.parcial);
                    evalsHechas.add(`${gNum}|${mat}|${par}`);
                });

                // Construir filas
                let filas = '';
                let totalEval = 0, totalPend = 0;
                dirFiltrado.forEach(item => {
                    const gNum = extractNum(item.grupo);
                    const key = `${gNum}|${item.materia}|${parcialSel}`;
                    const yaEvaluo = evalsHechas.has(key);
                    // Detectar semestre: si el número empieza con 2 -> 2do, con 4 -> 4to
                    const semestre = gNum.startsWith('2') ? '2do' : gNum.startsWith('4') ? '4to' : '-';
                    
                    if (yaEvaluo) totalEval++; else totalPend++;

                    filas += `
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding:8px 10px; text-align:center;">
                                <span style="background:${semestre === '2do' ? '#DBEAFE' : '#E0E7FF'}; color:${semestre === '2do' ? '#1D4ED8' : '#4338CA'}; padding:2px 8px; border-radius:999px; font-weight:600; font-size:0.75rem;">${semestre}</span>
                            </td>
                            <td style="padding:8px 10px; font-weight:600; color:#334155;">${item.grupo}</td>
                            <td style="padding:8px 10px; color:#475569; max-width:220px;">${item.materia}</td>
                            <td style="padding:8px 10px; color:#64748b; font-weight:500;">${item.docente}</td>
                            <td style="padding:8px 10px; text-align:center;">
                                ${yaEvaluo 
                                    ? '<span style="background:#D1FAE5; color:#059669; padding:3px 10px; border-radius:999px; font-weight:600; font-size:0.8rem;">✅ Evaluado</span>' 
                                    : '<span style="background:#FEF3C7; color:#D97706; padding:3px 10px; border-radius:999px; font-weight:600; font-size:0.8rem;">⏳ Pendiente</span>'}
                            </td>
                        </tr>
                    `;
                });

                const hasProgramacion = progParcial.length > 0;
                const container = document.getElementById('seg-tabla-container');
                container.innerHTML = `
                    ${!hasProgramacion ? '<div style="background:#FEF3C7; border:1px solid #FDE68A; color:#92400E; padding:10px 14px; border-radius:8px; margin-bottom:1rem; font-size:0.85rem;">⚠️ No hay materias programadas para el Parcial ' + parcialSel + '. Ve a tu Google Sheets → pestaña <strong>"Programación"</strong> y agrega filas con: <strong>Parcial</strong> | <strong>Semestre</strong> | <strong>Turno</strong> (Matutino/Vespertino/Ambos) | <strong>Materia</strong> | <strong>Docente</strong>.</div>' : ''}
                    <div style="display:flex; gap:1rem; margin-bottom:1rem;">
                        <span style="background:#D1FAE5; color:#059669; padding:4px 12px; border-radius:999px; font-weight:600; font-size:0.85rem;">✅ ${totalEval} Evaluados</span>
                        <span style="background:#FEF3C7; color:#D97706; padding:4px 12px; border-radius:999px; font-weight:600; font-size:0.85rem;">⏳ ${totalPend} Pendientes</span>
                    </div>
                    <table style="width:100%; border-collapse:collapse; font-size:0.9rem;">
                        <thead>
                            <tr style="background:#f8fafc; border-bottom:2px solid #e2e8f0;">
                                <th style="padding:10px; text-align:center; font-size:0.75rem; text-transform:uppercase; color:#64748b;">Sem.</th>
                                <th style="padding:10px; text-align:left; font-size:0.75rem; text-transform:uppercase; color:#64748b;">Grupo</th>
                                <th style="padding:10px; text-align:left; font-size:0.75rem; text-transform:uppercase; color:#64748b;">Materia</th>
                                <th style="padding:10px; text-align:left; font-size:0.75rem; text-transform:uppercase; color:#64748b;">Docente</th>
                                <th style="padding:10px; text-align:center; font-size:0.75rem; text-transform:uppercase; color:#64748b;">Estado</th>
                            </tr>
                        </thead>
                        <tbody>${filas}</tbody>
                    </table>
                `;
            };

            // Eventos de los filtros
            document.getElementById('seg-parcial').addEventListener('change', renderSeguimiento);
            document.getElementById('seg-grupo').addEventListener('change', renderSeguimiento);
            
            // Render inicial
            renderSeguimiento();

            // === PANEL DE PONDERACIONES ===
            const renderPonderaciones = () => {
                const parcialPond = document.getElementById('pond-parcial').value;
                const progFiltrada = programacion.filter(p => p.parcial === parcialPond);
                const container = document.getElementById('pond-container');

                if (progFiltrada.length === 0) {
                    container.innerHTML = '<p style="color:#94a3b8; font-style:italic;">No hay ponderaciones registradas para este parcial.</p>';
                    return;
                }

                // Helper para turno
                const getTurno = (g) => g.toUpperCase().startsWith('V') ? 'VESPERTINO' : 'MATUTINO';
                const extractNum = (g) => g.replace(/^[A-Za-z]+/, '');

                // Obtener lista completa de grupos desde el directorio
                const todosLosGrupos = [...new Set(directorio.map(d => d.grupo))].sort();

                // Agrupar los grupos por "Curriculum" (exacta combinación de materias y ponderaciones)
                const curriculumPorGrupo = {};

                todosLosGrupos.forEach(grupo => {
                    const turnoGrupo = getTurno(grupo);
                    const grupoNum = extractNum(grupo);
                    const semestre = grupoNum.startsWith('2') ? '2do' : grupoNum.startsWith('4') ? '4to' : '-';

                    // Encontrar qué materias en la programación aplican Específicamente a este grupo
                    const materiasAplicables = progFiltrada.filter(p => {
                        const matchTurno = !p.turno || p.turno === '' || p.turno === turnoGrupo || p.turno === 'AMBOS';
                        // Asumiendo que semestre en programacion dice "2" o "4"
                        const matchSemestre = !p.semestre || p.semestre === '' || semestre.includes(p.semestre);

                        const pGrupoOpcional = p.grupoEspecial ? String(p.grupoEspecial).trim().toUpperCase() : '';
                        const gruposPermitidos = pGrupoOpcional.split(',').map(s => s.trim());
                        const matchGrupo = !pGrupoOpcional || 
                                           gruposPermitidos.includes(grupo.toUpperCase()) || 
                                           gruposPermitidos.includes(grupoNum);

                        return matchTurno && matchSemestre && matchGrupo;
                    });

                    // Si no tiene materias aplicables, lo omitimos del dashboard
                    if (materiasAplicables.length === 0) return;

                    // Deduplicar materias para armar el fingerprint (evitar dobles si hay un error en Sheets)
                    const materiasUnicas = {};
                    materiasAplicables.forEach(m => {
                        if (!materiasUnicas[m.materia]) {
                            materiasUnicas[m.materia] = { materia: m.materia, ponderacion: m.ponderacion };
                        }
                    });

                    const listaMaterias = Object.values(materiasUnicas);
                    // Crear un "identificador único" de esta combinación de materias
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

                let html = '<div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap:1.5rem;">';

                Object.values(curriculumPorGrupo).forEach(curriculum => {
                    const total = curriculum.materias.reduce((s, p) => s + (p.ponderacion || 0), 0);
                    const porcentaje = Math.min((total / 2) * 100, 100);
                    const isComplete = Math.abs(total - 2) < 0.01;
                    const semColor = curriculum.semestre === '2do' ? '#3B82F6' : curriculum.semestre === '4to' ? '#8B5CF6' : '#6B7280';
                    const gruposLabel = curriculum.grupos.join(', ');

                    html += `
                        <div style="background:white; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
                            <div style="background:linear-gradient(135deg, ${semColor}, ${semColor}dd); padding:14px 18px; color:white;">
                                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                                    <div>
                                        <span style="font-size:0.75rem; text-transform:uppercase; opacity:0.85; letter-spacing:1px; display:flex; align-items:center; gap:6px;">
                                            ${curriculum.semestre} Sem. | ${curriculum.turno === 'VESPERTINO' ? '🌙 Vesp.' : '☀️ Mat.'}
                                        </span>
                                        <h3 style="margin:4px 0 0; font-size:1rem; color:white; line-height:1.3;">Grupos: ${gruposLabel}</h3>
                                    </div>
                                    <div style="text-align:right;">
                                        <span style="font-size:1.8rem; font-weight:800;">${total.toFixed(2)}</span>
                                        <span style="font-size:0.8rem; opacity:0.8;">/ 2.00</span>
                                    </div>
                                </div>
                                <div style="background:rgba(255,255,255,0.25); height:6px; border-radius:99px; margin-top:10px; overflow:hidden;">
                                    <div style="height:100%; width:${porcentaje}%; background:white; border-radius:99px; transition:width 0.5s;"></div>
                                </div>
                                ${!isComplete ? '<span style="font-size:0.7rem; color:#FDE68A; margin-top:4px; display:block;">⚠️ No suma 2 puntos exactos</span>' : '<span style="font-size:0.7rem; color:#A7F3D0; margin-top:4px; display:block;">✅ Suma Correcta</span>'}
                            </div>
                            <div style="padding:12px 18px;">
                    `;

                    curriculum.materias.forEach(mat => {
                        // Buscar en el directorio general qué docentes dan esta materia a ESTOS grupos específicos
                        const direct = directorio.filter(d => 
                            d.materia === mat.materia && curriculum.grupos.includes(d.grupo)
                        );
                        
                        // Agrupar docentes -> grupos
                        const docentesMap = {};
                        direct.forEach(d => {
                            if (!docentesMap[d.docente]) docentesMap[d.docente] = [];
                            docentesMap[d.docente].push(d.grupo);
                        });

                        const docentesHTML = Object.entries(docentesMap).map(([docente, gruposDelDocente]) => 
                            `<div style="font-size:0.75rem; color:#64748b; padding:2px 0;">
                                👤 <strong>${docente}</strong> <span style="color:#94a3b8;">(${gruposDelDocente.join(', ')})</span>
                            </div>`
                        ).join('');
                        
                        html += `
                            <div style="padding:10px 0; border-bottom:1px solid #f1f5f9;">
                                <div style="display:flex; align-items:center; gap:10px;">
                                    <div style="flex:1; min-width:0;">
                                        <div style="font-size:0.85rem; font-weight:600; color:#1e293b;" title="${mat.materia}">${mat.materia}</div>
                                    </div>
                                    <div style="width:80px; text-align:right;">
                                        <span style="font-size:1rem; font-weight:700; color:${semColor};">${mat.ponderacion > 0 ? mat.ponderacion.toFixed(2) : '-'}</span>
                                    </div>
                                </div>
                                <div style="margin-top:4px; padding-left:4px;">
                                    ${docentesHTML || '<i style="font-size:0.75rem; color:#94a3b8;">No asignado en directorio</i>'}
                                </div>
                            </div>
                        `;
                    });

                    html += '</div></div>';
                });

                if (Object.keys(curriculumPorGrupo).length === 0) {
                     html = '<p style="color:#94a3b8; font-style:italic;">No hay grupos con materias programadas para este parcial.</p>';
                } else {
                     html += '</div>';
                }
                
                container.innerHTML = html;
            };

            document.getElementById('pond-parcial').addEventListener('change', renderPonderaciones);
            renderPonderaciones();

        } catch(e) {
            console.error(e);
            alert("Error cargando dashboard");
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
            const grupos = await api.getGrupos();
            grupos.forEach(g => {
                const opt = document.createElement('option');
                opt.value = g; opt.textContent = `Grupo ${g}`;
                selectGrupo.appendChild(opt);
            });
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
        const equipos = await api.getEquiposPorGrupo(grupoId);
        containerEquipos.innerHTML = '';
        
        if (equipos.length === 0) {
            containerEquipos.innerHTML = '<p>No hay equipos registrados en este grupo.</p>';
        } else {
            // Obtener evaluaciones para mostrar detalles
            const todasEvals = await api.getConcentrado();
            
            equipos.forEach(eq => {
                const isEvaluado = eq.estado === 'Evaluado';
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
                        <div class="equipo-footer" style="flex-wrap: wrap;">
                            ${isEvaluado ? `<button class="btn btn-secondary btn-ver-detalle" data-equipo-id="${eq.id}" style="flex:1;"><i data-feather="eye"></i> Ver Detalle</button>` : ''}
                            <button class="btn btn-outline ${isEvaluado ? '' : 'btn-full'} btn-evaluar" data-id="${eq.id}" data-nombre="${eq.nombre}" data-enlace="${eq.urlDoc}" data-grupo="${eq.grupo}" data-integrantes="${eq.integrantes.join('|')}" style="flex:1;">
                                <i data-feather="edit-2"></i> Evaluar
                            </button>
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
        selectMateria.innerHTML = '<option value="">-- Selecciona tu materia --</option>';
        try {
            const directorio = await api.getDirectorio();
            
            // Extraer solo la parte numérica del grupo para comparación flexible
            // "401" -> "401", "M401" -> "401", "V207" -> "207"
            const extractNum = (g) => g.replace(/^[A-Za-z]+/, '');
            const grupoNum = extractNum(data.grupo);
            
            // Intentar coincidencia exacta primero, luego por número
            let materiasGrupo = directorio.filter(item => item.grupo === data.grupo);
            if (materiasGrupo.length === 0) {
                materiasGrupo = directorio.filter(item => extractNum(item.grupo) === grupoNum);
            }
            
            // Deduplicar materias (evita repetidos si coinciden M401 y V401)
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
                    opt.dataset.docente = m.docente; // Guardamos el docente en el dataset
                    selectMateria.appendChild(opt);
                });
            } else {
                // Fallback si no hay nada en el directorio para ese grupo
                const defaultMaterias = ["Metodología de la Investigación", "Cultura Digital", "Inglés", "Cs. Naturales"];
                defaultMaterias.forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m;
                    opt.textContent = m;
                    selectMateria.appendChild(opt);
                });
            }
        } catch(e) {
            console.error("Error al cargar materias del directorio", e);
        }

        // 2. AUTO-LLENAR DOCENTE Y MOSTRAR PONDERACIÓN AL CAMBIAR MATERIA
        const allData = await api.fetchAllData();
        const programacion = allData.programacion || [];
        const parcialSel = document.getElementById('eval-parcial').value;

        selectMateria.onchange = (e) => {
            const selectedOpt = e.target.options[e.target.selectedIndex];
            if (selectedOpt && selectedOpt.dataset.docente) {
                document.getElementById('eval-docente').value = selectedOpt.dataset.docente.toUpperCase();
            }
            
            // Buscar ponderación en Programación (Priorizar si aplica solo a este grupo)
            const materiaSeleccionada = e.target.value;
            const parcialActual = document.getElementById('eval-parcial').value;
            const grupoActual = document.getElementById('eval-grupo-id').value;
            const grupoNum = grupoActual.replace(/^[A-Za-z]+/, '');
            
            // 1. Intentar buscar una regla estricta para este grupo específico
            let progMatch = programacion.find(p => {
                if (p.materia !== materiaSeleccionada || p.parcial !== parcialActual || !p.grupoEspecial) return false;
                const gruposPermitidos = String(p.grupoEspecial).toUpperCase().split(',').map(s => s.trim());
                return gruposPermitidos.includes(grupoActual.toUpperCase()) || gruposPermitidos.includes(grupoNum);
            });
            
            // 2. Si no hay regla estricta, buscar regla general (sin grupo especial)
            if (!progMatch) {
                progMatch = programacion.find(p => 
                    p.materia === materiaSeleccionada && 
                    p.parcial === parcialActual && 
                    (!p.grupoEspecial || String(p.grupoEspecial).trim() === '')
                );
            }
            
            const hintDiv = document.getElementById('eval-ponderacion-hint');
            if (progMatch && progMatch.ponderacion > 0) {
                hintDiv.innerHTML = `
                    <div style="background:#EEF2FF; border:1px solid #C7D2FE; color:#4338CA; padding:10px 14px; border-radius:8px; font-size:0.85rem; margin-top:8px;">
                        📌 <strong>${progMatch.materia}</strong> tiene una ponderación de <strong>${progMatch.ponderacion} punto(s)</strong> sobre los 2 puntos totales del PEC.
                        <br><span style="font-size:0.8rem; color:#6366f1;">Calificación sugerida: de 0 a ${progMatch.ponderacion}</span>
                    </div>
                `;
            } else {
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

    // Iniciar con la primera vista
    initDashboard();
});
