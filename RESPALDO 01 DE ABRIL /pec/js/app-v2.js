// pec/js/app-v2.js
// VERSIÓN DE PRUEBA PARA PERSONALIZACIÓN POR DOCENTE

document.addEventListener("DOMContentLoaded", () => {
    // Inicializar íconos Feather (si están disponibles)
    if (window.feather) feather.replace();

    // Helper para normalizar el Parcial
    const normalizeParcial = (val) => {
        if (!val) return "";
        const match = String(val).match(/\d+/);
        return match ? match[0] : String(val).trim();
    };

    // --- CONFIGURACIÓN DE SESIÓN ---
    const userEmail = (sessionStorage.getItem('user_email') || "").toLowerCase().trim();
    const userName = sessionStorage.getItem('user_name') || "Docente PEC";
    const userRole = (sessionStorage.getItem('user_role') || "Docente").toLowerCase();
    const isAdmin = userRole === "admin" || userEmail === "admin@ceb54.online";

    const userNameEl = document.getElementById('topbar-user-name');
    if (userNameEl) userNameEl.textContent = userName;

    // --- DOM ELEMENTS ---
    const views = document.querySelectorAll('.view');
    const navItems = document.querySelectorAll('.nav-item');
    const loader = document.getElementById('loading');
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');

    const showLoader = () => loader.classList.remove('hidden');
    const hideLoader = () => loader.classList.add('hidden');

    // --- STATE ---
    let currentView = 'dashboard';
    let allData = null; // Guardará el dump completo de la API

    // --- NAVEGACIÓN ---
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const viewName = item.getAttribute('data-view');
            if (!viewName) return;
            e.preventDefault();
            switchView(viewName);
        });
    });

    function switchView(viewName) {
        navItems.forEach(nav => nav.classList.remove('active'));
        const activeNav = Array.from(navItems).find(n => n.getAttribute('data-view') === viewName);
        if (activeNav) activeNav.classList.add('active');

        views.forEach(view => {
            view.classList.add('hidden');
            view.classList.remove('active');
        });
        const selectedView = document.getElementById(`view-${viewName}`);
        if (selectedView) {
            selectedView.classList.remove('hidden');
            selectedView.classList.add('active');
        }
        
        const titleEl = document.getElementById('view-title');
        if (titleEl && activeNav) titleEl.textContent = activeNav.querySelector('span').textContent;
        
        currentView = viewName;
        if(window.innerWidth <= 768) sidebar.classList.remove('open');
        
        loadViewData(viewName);
    }

    menuToggle.addEventListener('click', () => sidebar.classList.toggle('open'));

    // --- LÓGICA DE CARGA ---
    async function loadViewData(view) {
        if (!allData) {
            showLoader();
            try {
                allData = await api.fetchAllData();
            } catch (err) {
                console.error("Error al cargar datos:", err);
                alert("Error de conexión con Google Sheets.");
                hideLoader();
                return;
            }
            hideLoader();
        }

        if (view === 'dashboard') initDashboard();
        if (view === 'grupos') initGrupos();
        if (view === 'concentrado') initConcentrado();
        if (view === 'directorio') initDirectorio();
    }

    // --- FILTRADO DE DOCENTE ---
    function getTeacherData() {
        if (!allData) return null;
        
        // Directorio filtrado por este maestro
        const teacherDirectorio = isAdmin ? allData.directorio : allData.directorio.filter(d => 
            String(d.correo || "").toLowerCase().trim() === userEmail
        );

        // Grupos asignados a este maestro
        const assignedGroups = [...new Set(teacherDirectorio.map(d => d.grupo))];

        // Equipos de esos grupos
        const teacherEquipos = allData.equipos.filter(e => assignedGroups.includes(e.grupo));

        // Evaluaciones de este maestro
        const teacherEvaluaciones = allData.evaluaciones.filter(ev => 
            isAdmin || (String(ev.docenteEmail || "").toLowerCase().trim() === userEmail)
        );

        return {
            directorio: teacherDirectorio,
            grupos: assignedGroups.sort(),
            equipos: teacherEquipos,
            evaluaciones: teacherEvaluaciones
        };
    }

    // --- VISTA 1: DASHBOARD ---
    function initDashboard() {
        const tData = getTeacherData();
        if (!tData) return;

        // Stats
        document.getElementById('dash-grupos').textContent = tData.grupos.length;
        document.getElementById('dash-equipos').textContent = tData.equipos.length;
        document.getElementById('dash-evaluaciones').textContent = tData.evaluaciones.length;
        
        // Avance (7 materias por equipo es la convención del API original)
        const totalEsperado = tData.equipos.length * (isAdmin ? 7 : tData.directorio.length);
        const avancePercent = totalEsperado === 0 ? 0 : Math.round((tData.evaluaciones.length / totalEsperado) * 100);
        document.getElementById('dash-avance').textContent = `${avancePercent}%`;

        // Grupos Tags
        const listGrupos = document.getElementById('dash-lista-grupos');
        listGrupos.innerHTML = tData.grupos.map(g => `
            <div style="background:#f0f7ff; color:#0369a1; border:1px solid #bae6fd; border-radius:6px; padding:4px 10px; font-size:0.8rem; font-weight:700;">
                Grupo ${g}
            </div>
        `).join('') || '<p style="color:#94a3b8; font-size:0.85rem;">No tienes grupos asignados.</p>';

        // Progreso Bar
        const dashAvanceInfo = document.getElementById('dash-avance-equipos');
        const countEval = tData.equipos.filter(e => e.estado === 'Evaluado').length;
        const totalEq = tData.equipos.length || 1;
        dashAvanceInfo.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size:0.9rem;">
                <span style="color:#059669; font-weight:600;">${countEval} Evaluados</span>
                <span style="color:#64748b;">${totalEq - countEval} Pendientes</span>
            </div>
            <div style="width:100%; height:8px; background:#e2e8f0; border-radius:99px; overflow:hidden;">
                <div style="width:${(countEval/totalEq)*100}%; height:100%; background:#10b981;"></div>
            </div>
        `;

        // Diagnóstico (Alumnos de MIS grupos sin equipo)
        const badgeSinEq = document.getElementById('badge-sin-equipo');
        const containerSinEq = document.getElementById('dash-sin-equipo');
        const mySinEquipo = allData.sinEquipo.filter(s => tData.grupos.includes(s.grupo));
        
        badgeSinEq.textContent = `${mySinEquipo.length} alumnos`;
        if (mySinEquipo.length === 0) {
            containerSinEq.innerHTML = '<p style="text-align:center; color:#10b981; font-weight:600; font-size:0.85rem; margin:0;">✨ Todos tus alumnos tienen equipo.</p>';
        } else {
            containerSinEq.innerHTML = mySinEquipo.map(s => `
                <div style="padding:4px 8px; border-bottom:1px solid #e2e8f0; font-size:0.8rem;">
                    <strong>[${s.grupo}]</strong> ${s.alumno}
                </div>
            `).join('');
        }

        // Ponderaciones (Filtro por docente)
        renderPonderaciones();
    }

    function renderPonderaciones() {
        const pVal = normalizeParcial(document.getElementById('pond-parcial').value);
        const container = document.getElementById('pond-container');
        const tData = getTeacherData();

        // Filtrar programación por el parcial seleccionado
        const progParcial = allData.programacion.filter(p => normalizeParcial(p.parcial) === pVal);
        
        // Filtrar programación para mostrar solo mis materias (o todas si soy admin)
        const myProg = isAdmin ? progParcial : progParcial.filter(p => 
            tData.directorio.some(d => d.materia === p.materia)
        );

        if (myProg.length === 0) {
            container.innerHTML = `<p style="text-align:center; padding:20px; color:#94a3b8;">No hay materias programadas para ti en el Parcial ${pVal}.</p>`;
            return;
        }

        container.innerHTML = `
            <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
                <thead>
                    <tr style="background:#f8fafc; border-bottom:2px solid #e2e8f0;">
                        <th style="padding:8px; text-align:left;">Materia</th>
                        <th style="padding:8px; text-align:left;">Turno</th>
                        <th style="padding:8px; text-align:center;">Ponderación</th>
                    </tr>
                </thead>
                <tbody>
                    ${myProg.map(p => `
                        <tr style="border-bottom:1px solid #f1f5f9;">
                            <td style="padding:8px; font-weight:600;">${p.materia}</td>
                            <td style="padding:8px; color:#64748b;">${p.turno || 'AMBOS'}</td>
                            <td style="padding:8px; text-align:center;"><span style="background:#eff6ff; color:#2563eb; padding:2px 8px; border-radius:4px; font-weight:800;">${p.ponderacion.toFixed(2)}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    document.getElementById('pond-parcial').addEventListener('change', renderPonderaciones);

    // --- VISTA 2: GRUPOS ---
    function initGrupos() {
        const tData = getTeacherData();
        const selectGrupo = document.getElementById('select-grupo');
        const navGrupos = document.getElementById('nav-grupos');
        const filterPanel = document.getElementById('grupos-filter-panel');
        const restrictionMsg = document.getElementById('restriction-msg');

        // Reset
        selectGrupo.innerHTML = '<option value="">-- Elige uno de tus grupos --</option>';
        document.getElementById('equipos-container').innerHTML = '';
        document.getElementById('equipos-container').classList.add('hidden');

        if (tData.grupos.length === 0 && !isAdmin) {
            // BLOQUEO DE ACCESO SI NO TIENE ASIGNACIÓN
            filterPanel.classList.add('hidden');
            restrictionMsg.classList.remove('hidden');
            if (navGrupos) navGrupos.style.opacity = "0.5";
            return;
        }

        filterPanel.classList.remove('hidden');
        restrictionMsg.classList.add('hidden');
        if (navGrupos) navGrupos.style.opacity = "1";

        const gruposAMostrar = isAdmin ? allData.grupos : tData.grupos;
        gruposAMostrar.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g;
            opt.textContent = `Grupo ${g}`;
            selectGrupo.appendChild(opt);
        });
    }

    document.getElementById('select-grupo').addEventListener('change', async (e) => {
        const grupoId = e.target.value;
        const container = document.getElementById('equipos-container');
        if (!grupoId) {
            container.classList.add('hidden');
            return;
        }

        showLoader();
        const equipos = allData.equipos.filter(eq => eq.grupo === grupoId);
        equipos.sort((a,b) => String(a.nombre).localeCompare(b.nombre));

        container.innerHTML = '';
        if (equipos.length === 0) {
            container.innerHTML = '<p style="grid-column:1/-1; text-align:center; padding:2rem;">No hay equipos registrados en este grupo.</p>';
        } else {
            equipos.forEach(eq => {
                const isEvaluado = eq.estado === 'Evaluado';
                const html = `
                    <div class="equipo-card">
                        <div class="equipo-header">
                            <div>
                                <h3 class="equipo-title">${eq.nombre}</h3>
                                <span class="equipo-tema" style="font-size:0.75rem;">${eq.tema || 'Proyecto Escolar'}</span>
                            </div>
                            <span class="badge ${isEvaluado ? 'evaluado' : 'pendiente'}">${eq.estado}</span>
                        </div>
                        <div class="equipo-body">
                            <span style="font-size:0.7rem; font-weight:700; color:#64748b; text-transform:uppercase;">Integrantes:</span>
                            <ul style="padding-left:15px; margin:5px 0; font-size:0.8rem; color:#475569;">
                                ${eq.integrantes.map(i => `<li>${i}</li>`).join('')}
                            </ul>
                        </div>
                        <div class="equipo-footer">
                            <button class="btn btn-primary btn-evaluar" data-id="${eq.id}" data-nombre="${eq.nombre}" data-enlace="${eq.urlDoc}" data-grupo="${eq.grupo}" data-integrantes="${eq.integrantes.join('|')}">
                                <i data-feather="edit-2"></i> Evaluar
                            </button>
                        </div>
                    </div>
                `;
                container.insertAdjacentHTML('beforeend', html);
            });
            if (window.feather) feather.replace();
            
            document.querySelectorAll('.btn-evaluar').forEach(btn => {
                btn.addEventListener('click', () => abrirModalEvaluacion(btn.dataset));
            });
        }
        container.classList.remove('hidden');
        hideLoader();
    });

    // --- MODAL DE EVALUACIÓN ---
    async function abrirModalEvaluacion(data) {
        const tData = getTeacherData();
        const modal = document.getElementById('modal-captura');
        const form = document.getElementById('form-evaluacion');
        
        document.getElementById('modal-equipo-nombre').textContent = `Evaluar: ${data.nombre}`;
        document.getElementById('modal-equipo-link').href = data.enlace || '#';
        document.getElementById('eval-equipo-id').value = data.id;
        document.getElementById('eval-equipo-nombre').value = data.nombre;
        document.getElementById('eval-grupo-id').value = data.grupo;
        document.getElementById('eval-docente').value = userName.toUpperCase();

        // Selector de materias filtrado por lo que el docente tiene en este grupo
        const selectMateria = document.getElementById('eval-materia');
        selectMateria.innerHTML = '<option value="">-- Elige una materia --</option>';

        const materiasDisponibles = tData.directorio.filter(d => 
            d.grupo === data.grupo || d.grupo === data.grupo.replace(/^[A-Za-z]+/, '')
        );

        if (materiasDisponibles.length === 0 && !isAdmin) {
             alert("Error: No tienes materias asignadas a este grupo en el Directorio.");
             return;
        }

        const materiasFinales = isAdmin ? allData.directorio.filter(d => d.grupo === data.grupo) : materiasDisponibles;

        materiasFinales.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.materia;
            opt.textContent = m.materia;
            selectMateria.appendChild(opt);
        });

        // Lógica de Ponderación
        selectMateria.onchange = (e) => {
            const mat = e.target.value;
            const par = document.getElementById('eval-parcial').value;
            
            const prog = allData.programacion.find(p => p.materia === mat && normalizeParcial(p.parcial) === normalizeParcial(par));
            const hint = document.getElementById('eval-ponderacion-hint');
            if (prog) {
                hint.innerHTML = `<div style="margin-top:5px; font-size:0.75rem; color:#2563eb; font-weight:600;">Ponderación: ${prog.ponderacion.toFixed(2)} punto(s)</div>`;
            } else {
                hint.innerHTML = '';
            }
        };

        // Renderizar individuales
        const indivContainer = document.getElementById('eval-evaluacion-individual');
        indivContainer.innerHTML = '';
        data.integrantes.split('|').forEach(alum => {
            indivContainer.innerHTML += `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 6px;">
                    <span style="font-size:0.8rem; color:#1e293b;">${alum}</span>
                    <input type="number" class="eval-indiv-input" data-alumno="${alum}" min="0" max="10" step="0.1" style="width:60px; padding:2px; text-align:center; border:1px solid #cbd5e1; border-radius:4px;">
                </div>
            `;
        });

        // Autollenado de puntaje general a todos
        document.getElementById('eval-puntaje').oninput = (e) => {
            document.querySelectorAll('.eval-indiv-input').forEach(inp => inp.value = e.target.value);
        };

        modal.classList.remove('hidden');
    }

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('modal-captura').classList.add('hidden');
            document.getElementById('form-evaluacion').reset();
        });
    });

    document.getElementById('form-evaluacion').addEventListener('submit', async (e) => {
        e.preventDefault();
        const individual = Array.from(document.querySelectorAll('.eval-indiv-input')).map(inp => ({
            alumno: inp.dataset.alumno,
            puntaje: parseFloat(inp.value) || 0
        }));

        const payload = {
            equipoId: document.getElementById('eval-equipo-id').value,
            equipoNombre: document.getElementById('eval-equipo-nombre').value,
            grupoId: document.getElementById('eval-grupo-id').value,
            parcial: document.getElementById('eval-parcial').value,
            materia: document.getElementById('eval-materia').value,
            docente: document.getElementById('eval-docente').value,
            puntaje: parseFloat(document.getElementById('eval-puntaje').value),
            observaciones: document.getElementById('eval-obs').value,
            integrantes: individual
        };

        document.getElementById('modal-captura').classList.add('hidden');
        showLoader();
        try {
            await api.guardarEvaluacion(payload);
            alert("Evaluación guardada con éxito.");
            allData = null; // Forzar recarga en el próximo cambio de vista
            switchView('dashboard');
        } catch (err) {
            alert("Error al guardar: " + err.message);
        }
        hideLoader();
    });

    // --- OTRAS VISTAS ---
    function initConcentrado() {
        const tData = getTeacherData();
        const tbody = document.getElementById('concentrado-tbody');
        tbody.innerHTML = tData.evaluaciones.map(ev => `
            <tr style="border-bottom:1px solid #f1f5f9; font-size:0.8rem;">
                <td style="padding:10px;">${new Date(ev.fecha).toLocaleDateString()}</td>
                <td style="padding:10px;">P${ev.parcial}</td>
                <td style="padding:10px;">${ev.grupoId}</td>
                <td style="padding:10px;">${ev.equipoNombre}</td>
                <td style="padding:10px;">${ev.materia}</td>
                <td style="padding:10px; color:#64748b;">${ev.docente}</td>
                <td style="padding:10px; font-weight:700; color:#2563eb;">${ev.puntaje.toFixed(1)}</td>
            </tr>
        `).join('') || '<tr><td colspan="7" style="text-align:center; padding:20px; color:#94a3b8;">No has realizado evaluaciones aún.</td></tr>';
    }

    function initDirectorio() {
        const tData = getTeacherData();
        const container = document.getElementById('dir-container');
        container.innerHTML = `
            <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
                <thead>
                    <tr style="background:#f8fafc; border-bottom:2px solid #e2e8f0;">
                        <th style="padding:10px; text-align:left;">Grupo</th>
                        <th style="padding:10px; text-align:left;">Materia</th>
                        <th style="padding:10px; text-align:left;">Docente</th>
                    </tr>
                </thead>
                <tbody>
                    ${tData.directorio.map(d => `
                        <tr style="border-bottom:1px solid #f1f5f9;">
                            <td style="padding:10px; font-weight:700;">${d.grupo}</td>
                            <td style="padding:10px;">${d.materia}</td>
                            <td style="padding:10px; color:#64748b;">${d.docente}</td>
                        </tr>
                    `).join('') || '<tr><td colspan="3" style="text-align:center; padding:20px;">No tienes materias asignadas en el Directorio actual.</td></tr>'}
                </tbody>
            </table>
        `;
    }

    // Inicio
    loadViewData('dashboard');
});
