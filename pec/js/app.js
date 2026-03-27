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


    // DOM Elements
    const views = document.querySelectorAll('.view');
    const navItems = document.querySelectorAll('.nav-item');
    const loader = document.getElementById('loading');
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');

    // Estado local
    let currentView = 'dashboard';

    // =============================================
    // ESTADO GLOBAL DE USUARIO PEC
    // =============================================
    window.PEC_USER = {
        email: (sessionStorage.getItem('user_email') || '').toLowerCase().trim(),
        nombre: sessionStorage.getItem('user_name') || 'Docente PEC',
        role: sessionStorage.getItem('user_role') || 'Docente',
        isAdmin: false,
        gruposAsignados: [],
        parcialActivo: '2',
        avanceDocente: { total: 0, evaluados: 0, pendientes: 0, porcentaje: 0 }
    };
    window.PEC_USER.isAdmin = PEC_USER.role.toLowerCase() === 'admin';

    // Establecer nombre en topbar
    const userNameEl = document.getElementById('topbar-user-name');
    if (userNameEl && PEC_USER.nombre) userNameEl.textContent = PEC_USER.nombre;

    // =============================================
    function aplicarControlAcceso(data) {
        // Actualizar estado global
        PEC_USER.isAdmin = data.isAdmin || false;
        PEC_USER.gruposAsignados = data.gruposDelDocente || [];
        PEC_USER.parcialActivo = data.parcialActivo || '2';
        PEC_USER.avanceDocente = data.avanceDocente || { total: 0, evaluados: 0, pendientes: 0, porcentaje: 0 };

        const navGrupos = document.getElementById('nav-grupos');
        const tieneGrupos = PEC_USER.gruposAsignados.length > 0;

        if (tieneGrupos) {
            // Agregar badge con cantidad de grupos
            const spn = navGrupos.querySelector('span');
            if (spn && !navGrupos.querySelector('.nav-badge')) {
                const badge = document.createElement('span');
                badge.className = 'nav-badge';
                badge.textContent = PEC_USER.gruposAsignados.length;
                navGrupos.appendChild(badge);
            }
        } else if (!PEC_USER.isAdmin) {
            // Deshabilitar el botón de Grupos
            navGrupos.classList.remove('nav-item');
            navGrupos.classList.add('nav-item-disabled');
            navGrupos.removeAttribute('data-view');
            navGrupos.setAttribute('title', 'No tienes grupos asignados para el Parcial ' + PEC_USER.parcialActivo);
        }

        // Ocultar botón exportar para no-admin
        const btnExportar = document.getElementById('btn-exportar');
        if (btnExportar && !PEC_USER.isAdmin) {
            btnExportar.style.display = 'none';
        }
    }

    // =============================================
    // BANNER: Renderizar banner de guia en vista Grupos
    // =============================================
    function renderizarBannerGrupos() {
        const container = document.getElementById('banner-mis-grupos');
        if (!container) return;

        const tieneGrupos = PEC_USER.gruposAsignados.length > 0;
        const av = PEC_USER.avanceDocente;
        const parcial = PEC_USER.parcialActivo;

        if (tieneGrupos) {
            // Banner azul con info y guia
            const grupoTags = PEC_USER.gruposAsignados
                .map(g => `<span class="grupo-tag">${g}</span>`).join('');

            container.innerHTML = `
                <div class="banner-mis-grupos">
                    <div class="banner-top-row">
                        <div class="banner-left">
                            <div class="banner-eyebrow">✅ Acceso Habilitado — Parcial ${parcial}</div>
                            <h2 class="banner-title">📋 Tus grupos para capturar</h2>
                            <p class="banner-subtitle">
                                Hola <strong>${PEC_USER.nombre}</strong>, tienes <strong>${PEC_USER.gruposAsignados.length} grupo(s)</strong> asignado(s) en este parcial.
                            </p>
                        </div>
                        <div style="display: flex; gap: 0.75rem;">
                            <div class="banner-stats-box">
                                <span class="stat-num">${av.evaluados}</span>
                                <span class="stat-lbl">✅ Evaluados</span>
                            </div>
                            <div class="banner-stats-box">
                                <span class="stat-num">${av.pendientes}</span>
                                <span class="stat-lbl">⏳ Pendientes</span>
                            </div>
                        </div>
                    </div>

                    <div class="banner-grupos-row">
                        <span style="font-size: 0.75rem; font-weight: 700; opacity: 0.7; text-transform: uppercase; letter-spacing: 1px; align-self: center;">Grupos:</span>
                        ${grupoTags}
                    </div>

                    <div class="banner-progress-section">
                        <div class="banner-progress-label">
                            <span>📊 Avance de captura en tus grupos</span>
                            <span>${av.porcentaje}% — ${av.evaluados} de ${av.total} equipos</span>
                        </div>
                        <div class="banner-progress-bar">
                            <div class="banner-progress-fill" style="width: 0%" data-target="${av.porcentaje}"></div>
                        </div>
                    </div>

                    <div class="banner-guia">
                        <div class="guia-step">
                            <span class="guia-step-num">1</span>
                            <span>Selecciona un grupo</span>
                        </div>
                        <span class="guia-arrow">→</span>
                        <div class="guia-step">
                            <span class="guia-step-num">2</span>
                            <span>Elige el equipo</span>
                        </div>
                        <span class="guia-arrow">→</span>
                        <div class="guia-step">
                            <span class="guia-step-num">3</span>
                            <span>Presiona <em>Evaluar</em></span>
                        </div>
                        <span class="guia-arrow">→</span>
                        <div class="guia-step">
                            <span class="guia-step-num">4</span>
                            <span>Llena y envia el formulario</span>
                        </div>
                    </div>
                </div>
            `;

            // Animar la barra de progreso después de renderizar
            setTimeout(() => {
                const fill = container.querySelector('.banner-progress-fill');
                if (fill) fill.style.width = fill.dataset.target + '%';
            }, 150);

        } else if (!PEC_USER.isAdmin) {
            // Banner de sin acceso
            container.innerHTML = `
                <div class="banner-sin-acceso">
                    <div class="icono-lock">
                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                    </div>
                    <h3>🔐 Sin grupos asignados en Parcial ${parcial}</h3>
                    <p>No tienes captura de PEC en este parcial. Puedes consultar el Dashboard y el Directorio. Si crees que es un error, contacta al administrador.</p>
                </div>
            `;
        }
        // Si es admin, no mostramos nada especial (ve todo)
    }

    // Navegación
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const viewName = item.getAttribute('data-view');
            if (!viewName) return; // Ignorar items deshabilitados sin data-view
            
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
            if (!data || !data.equipos) throw new Error("Datos del dashboard incompletos");
            
            // Aplicar control de acceso con los datos recien cargados
            const cacheAcceso = api.cache;
            if (cacheAcceso) aplicarControlAcceso(cacheAcceso);
            // Stats
            document.getElementById('dash-grupos').textContent = data.totalGrupos || 0;
            document.getElementById('dash-equipos').textContent = data.totalEquipos || 0;
            document.getElementById('dash-evaluaciones').textContent = data.evaluaciones || 0;
            document.getElementById('dash-avance').textContent = `${data.avance || 0}%`;

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
                const parcialSel = document.getElementById('seg-parcial').value;
                const grupoSel = document.getElementById('seg-grupo').value;
                const extractNum = (g) => String(g).replace(/^[A-Za-z]+/, '');

                const progParcial = programacion.filter(p => String(p.parcial) === parcialSel);
                const getTurno = (grupo) => String(grupo).toUpperCase().startsWith('V') ? 'VESPERTINO' : 'MATUTINO';

                let dirFiltrado = directorio;
                if (progParcial.length > 0) {
                    dirFiltrado = directorio.filter(d => {
                        const turnoGrupo = getTurno(d.grupo);
                        return progParcial.some(p => {
                            const matchMateria = String(p.materia || '').trim() === String(d.materia || '').trim();
                            const matchTurno = !p.turno || p.turno === '' || p.turno === turnoGrupo || p.turno === 'AMBOS';
                            const pGrupoOpcional = p.grupoEspecial ? String(p.grupoEspecial).trim().toUpperCase() : '';
                            const dGrupoNum = extractNum(d.grupo);
                            const gruposPermitidos = pGrupoOpcional.split(',').map(s => s.trim());
                            const matchGrupo = !pGrupoOpcional || gruposPermitidos.includes(String(d.grupo).toUpperCase()) || gruposPermitidos.includes(dGrupoNum);
                            return matchMateria && matchTurno && matchGrupo;
                        });
                    });
                }
                
                if (grupoSel) dirFiltrado = dirFiltrado.filter(d => d.grupo === grupoSel);

                const evalsHechas = new Set();
                evaluaciones.forEach(ev => {
                    const gNum = extractNum(String(ev.grupoId));
                    const mat = String(ev.materia || '').trim();
                    const par = String(ev.parcial);
                    evalsHechas.add(`${gNum}|${mat}|${par}`);
                });

                let filas = '';
                let totalEval = 0, totalPend = 0;
                dirFiltrado.forEach(item => {
                    const gNum = extractNum(item.grupo);
                    const key = `${gNum}|${item.materia}|${parcialSel}`;
                    const yaEvaluo = evalsHechas.has(key);
                    const semestre = String(gNum).startsWith('2') ? '2do' : String(gNum).startsWith('4') ? '4to' : '-';
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

                const container = document.getElementById('seg-tabla-container');
                if (container) {
                    container.innerHTML = `
                        ${progParcial.length === 0 ? '<div style="background:#FEF3C7; border:1px solid #FDE68A; color:#92400E; padding:10px 14px; border-radius:8px; margin-bottom:1rem; font-size:0.85rem;">⚠️ No hay materias programadas para el Parcial ' + parcialSel + '. Ve a tu Google Sheets → pestaña <strong>"Programación"</strong> e ingresa datos.</div>' : ''}
                        <div style="display:flex; gap:1rem; margin-bottom:1rem;">
                            <span style="background:#D1FAE5; color:#059669; padding:4px 12px; border-radius:999px; font-weight:600; font-size:0.85rem;">✅ ${totalEval} Evaluados</span>
                            <span style="background:#FEF3C7; color:#D97706; padding:4px 12px; border-radius:999px; font-weight:600; font-size:0.85rem;">⏳ ${totalPend} Pendientes</span>
                        </div>
                        <table style="width:100%; border-collapse:collapse; font-size:0.9rem;">
                            <thead>
                                <tr style="background:#f8fafc; border-bottom:2px solid #e2e8f0;">
                                    <th style="padding:10px; text-align:center;">Sem.</th>
                                    <th style="padding:10px; text-align:left;">Grupo</th>
                                    <th style="padding:10px; text-align:left;">Materia</th>
                                    <th style="padding:10px; text-align:left;">Docente</th>
                                    <th style="padding:10px; text-align:center;">Estado</th>
                                </tr>
                            </thead>
                            <tbody>${filas || '<tr><td colspan="5" style="text-align:center; padding:20px; color:#94a3b8;">No hay datos para mostrar.</td></tr>'}</tbody>
                        </table>
                    `;
                }
            };

            const segParcial = document.getElementById('seg-parcial');
            const segGrupo = document.getElementById('seg-grupo');
            if (segParcial) segParcial.addEventListener('change', renderSeguimiento);
            if (segGrupo) segGrupo.addEventListener('change', renderSeguimiento);

            // === PANEL DE PONDERACIONES (Premium UI) ===
            const renderPonderaciones = () => {
                const pondParcialEl = document.getElementById('pond-parcial');
                if (!pondParcialEl) return;
                const parcialPond = normalizeParcial(pondParcialEl.value);
                
                // Filtro resiliente: normalizamos ambos lados de la comparación
                const progFiltrada = programacion.filter(p => normalizeParcial(p.parcial) === parcialPond);
                
                // Diagnóstico para consola
                console.log(`DEBUG - Ponderaciones Parcial ${parcialPond}: filtradas ${progFiltrada.length} de ${programacion.length}`);
                
                const container = document.getElementById('pond-container');
                if (!container) return;
                
                if (progFiltrada.length === 0) {
                    container.innerHTML = `
                        <div style="text-align:center; padding:3rem; color:#64748b; background:#f8fafc; border:2px dashed #e2e8f0; border-radius:16px;">
                            <div style="font-size:2rem; margin-bottom:1rem;">📋</div>
                            <p style="font-weight:600; margin:0;">No hay materias programadas para el Parcial ${parcialPond}</p>
                            <p style="font-size:0.85rem; margin-top:0.5rem;">Agrega la información en la pestaña "Programación" de tu Google Sheets (columna Parcial debe tener el número).</p>
                        </div>
                    `;
                    return;
                }

                const getTurno = (g) => String(g).toUpperCase().startsWith('V') ? 'VESPERTINO' : 'MATUTINO';
                const extractNum = (g) => String(g).replace(/^[A-Za-z]+/, '');
                const todosLosGrupos = [...new Set(directorio.map(d => d.grupo))].sort();
                const curriculumPorGrupo = {};

                todosLosGrupos.forEach(grupo => {
                    const turnoGrupo = getTurno(grupo);
                    const grupoNum = extractNum(grupo);
                    const semestre = grupoNum.startsWith('2') ? '2do' : grupoNum.startsWith('4') ? '4to' : '-';

                    // Encontrar qué materias aplican a este grupo (incluyendo excepciones en grupoEspecial)
                    const materiasAplicables = progFiltrada.filter(p => {
                        const matchTurno = !p.turno || p.turno === '' || p.turno === turnoGrupo || p.turno === 'AMBOS';
                        const matchSemestre = !p.semestre || p.semestre === '' || semestre.includes(String(p.semestre));
                        
                        const pGrupoEspecial = p.grupoEspecial ? String(p.grupoEspecial).trim().toUpperCase() : '';
                        const gruposHabilitados = pGrupoEspecial.split(',').map(s => s.trim());
                        
                        // Si hay grupo especial, DEBE estar en la lista. Si no hay, sigue regla general de turno/semestre.
                        const matchGrupo = !pGrupoEspecial || 
                                           gruposHabilitados.includes(String(grupo).toUpperCase()) || 
                                           gruposHabilitados.includes(grupoNum);

                        return matchTurno && matchSemestre && matchGrupo;
                    });

                    if (materiasAplicables.length === 0) return;

                    // Deduplicar por materia en caso de error en la hoja
                    const materiasUnicas = {};
                    materiasAplicables.forEach(m => {
                        if (!m.materia) return;
                        if (!materiasUnicas[m.materia]) {
                            materiasUnicas[m.materia] = { materia: m.materia, ponderacion: parseFloat(m.ponderacion) || 0 };
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
            renderPonderaciones();      renderPonderaciones();

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
        // Renderizar el banner según el usuario (siempre actualizado)
        renderizarBannerGrupos();

        if (selectGrupo.options.length <= 1) { // Solo opción default
            showLoader();
            const todosGrupos = await api.getGrupos();

            // FILTRAR GRUPOS: Si el docente tiene grupos asignados, solo mostrar los suyos
            let gruposAMostrar;
            if (PEC_USER.isAdmin || PEC_USER.gruposAsignados.length === 0) {
                // Admin ve todos; si no hay asignados tampoco filtramos (evita select vacío)
                gruposAMostrar = [...todosGrupos];
            } else {
                // Docente con grupos: solo sus grupos
                gruposAMostrar = todosGrupos.filter(g => PEC_USER.gruposAsignados.includes(g));
                // Actualizar label del select
                const lbl = document.getElementById('label-select-grupo');
                if (lbl) lbl.textContent = `Selecciona uno de tus ${gruposAMostrar.length} grupo(s):`;
            }

            // Ordenar y poblar el select
            const gruposOrdenados = [...gruposAMostrar].sort((a, b) =>
                String(a).localeCompare(String(b), undefined, {numeric: true})
            );

            gruposOrdenados.forEach(g => {
                const opt = document.createElement('option');
                opt.value = g;
                opt.textContent = `Grupo ${g}`;
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
        let equipos = await api.getEquiposPorGrupo(grupoId);
        
        // Ordenar equipos alfabéticamente por nombre
        equipos.sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)));
        
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
