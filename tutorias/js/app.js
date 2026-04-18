// tutorias/js/app.js

document.addEventListener('DOMContentLoaded', async () => {
    // Initial State
    let allData = { tutorias: [], grupos: [], config: { docente: "" }, alumnosFull: [] };
    const views = document.querySelectorAll('.view');
    const navLinks = document.querySelectorAll('.nav-link');
    const viewTitle = document.getElementById('view-title');
    const currentDateEl = document.getElementById('current-date');

    // Establecer fecha de hoy como valor por defecto en el campo fecha_tutoria
    const inputFechaTutoria = document.getElementById('input-fecha-tutoria');
    if (inputFechaTutoria) {
        const hoy = new Date();
        const yyyy = hoy.getFullYear();
        const mm = String(hoy.getMonth() + 1).padStart(2, '0');
        const dd = String(hoy.getDate()).padStart(2, '0');
        inputFechaTutoria.value = `${yyyy}-${mm}-${dd}`;
    }

    // Set Current Date
    const now = new Date();
    currentDateEl.textContent = now.toLocaleDateString('es-MX', {
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });

    // --- NAVIGATION ---
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const viewId = link.getAttribute('data-view');
            if (!viewId) return; // Exit for external links (Volver)
            
            e.preventDefault();
            
            // Switch Active Link
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            // Switch View
            views.forEach(v => v.classList.add('hidden'));
            const targetView = document.getElementById(`view-${viewId}`);
            if (targetView) targetView.classList.remove('hidden');
            
            // Update Title
            viewTitle.textContent = link.querySelector('span').textContent;
            
            // Refresh Data if needed
            if (viewId === 'dashboard' || viewId === 'historial' || viewId === 'reporte' || viewId === 'encuesta') {
                renderAll();
            }
        });
    });

    // --- ENCUESTA (SURVEY) RENDER LOGIC ---
    function normalizeName(str) {
        if (!str) return "";
        return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    }

    function renderEncuesta() {
        const history = allData.feedbackHistory || [];
        const userEmail = sessionStorage.getItem('user_email');
        const userName = sessionStorage.getItem('user_name');
        const isAdmin = allData.isAdmin === true;

        const mainView = document.getElementById('view-encuesta');
        if (mainView.classList.contains('hidden')) return;

        // 1. Mostrar modo local si no hay sesión
        if (!userEmail && !userName) {
            document.getElementById('encuesta-local-banner').style.display = 'block';
            document.getElementById('encuesta-test-selector').style.display = 'block';
            
            // Llenar selector de prueba si está vacío
            const select = document.getElementById('encuesta-debug-select');
            if (select.options.length <= 1) {
                const names = [...new Set(history.map(h => h.docente))].filter(Boolean).sort();
                select.innerHTML = '<option value="">-- Elige un nombre para probar reporte --</option>' +
                    names.map(n => `<option value="${n}">${n}</option>`).join('');
                select.onchange = (e) => {
                    const filtered = history.filter(h => h.docente === e.target.value);
                    renderEncuestaAnalysis(filtered, e.target.value);
                };
            }
        }

        // 2. Panel Admin y Ranking
        if (isAdmin) {
            const adminDashboard = document.getElementById('encuesta-admin-dashboard');
            const adminPanel = document.getElementById('encuesta-admin-panel');
            if (adminDashboard) adminDashboard.style.display = 'block';
            if (adminPanel) adminPanel.style.display = 'block';

            // --- CÁLCULO DE KPIs GLOBALES ---
            const gTotals = { c1:0, c2:0, c3:0, c4:0, all:0 };
            history.forEach(r => {
                gTotals.c1 += parseFloat(r.claridad || 0); gTotals.c2 += parseFloat(r.respeto || 0);
                gTotals.c3 += parseFloat(r.dominio || 0); gTotals.c4 += parseFloat(r.org || 0);
            });
            const hCount = history.length || 1;
            const kpis = {
                c1: (gTotals.c1 / hCount).toFixed(1), c2: (gTotals.c2 / hCount).toFixed(1),
                c3: (gTotals.c3 / hCount).toFixed(1), c4: (gTotals.c4 / hCount).toFixed(1)
            };
            const globalAvg = ((parseFloat(kpis.c1) + parseFloat(kpis.c2) + parseFloat(kpis.c3) + parseFloat(kpis.c4)) / 4).toFixed(1);
            
            document.getElementById('encuesta-kpi-global').textContent = globalAvg;
            document.getElementById('encuesta-kpi-c1').textContent = kpis.c1;
            document.getElementById('encuesta-kpi-c2').textContent = kpis.c2;
            document.getElementById('encuesta-kpi-c3').textContent = kpis.c3;
            document.getElementById('encuesta-kpi-c4').textContent = kpis.c4;

            // --- GENERAR RANKING DOCENTE ---
            const grouped = {};
            history.forEach(r => {
                const name = r.docente || "Desconocido";
                if (!grouped[name]) grouped[name] = { count:0, c1:0, c2:0, c3:0, c4:0, items: [] };
                grouped[name].count++;
                grouped[name].c1 += parseFloat(r.claridad || 0);
                grouped[name].c2 += parseFloat(r.respeto || 0);
                grouped[name].c3 += parseFloat(r.dominio || 0);
                grouped[name].c4 += parseFloat(r.org || 0);
                grouped[name].items.push(r);
            });

            const ranking = Object.keys(grouped).map(name => {
                const g = grouped[name];
                const avgs = {
                    c1: (g.c1 / g.count).toFixed(1), c2: (g.c2 / g.count).toFixed(1),
                    c3: (g.c3 / g.count).toFixed(1), c4: (g.c4 / g.count).toFixed(1)
                };
                const total = ((parseFloat(avgs.c1) + parseFloat(avgs.c2) + parseFloat(avgs.c3) + parseFloat(avgs.c4)) / 4).toFixed(1);
                return { name, total, avgs, count: g.count };
            }).sort((a, b) => b.total - a.total);

            const tbody = document.getElementById('encuesta-admin-tbody');
            tbody.innerHTML = ranking.map((r, i) => `
                <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:12px; font-weight:800; color:#64748b;">#${i+1}</td>
                    <td style="padding:12px; font-weight:700; color:#1e293b;">${r.name} <div style="font-size:0.65rem; color:#94a3b8; font-weight:400;">${r.count} evaluaciones</div></td>
                    <td style="padding:12px; text-align:center;"><span style="background:${r.total >= 4 ? '#f0fdf4' : '#fff7ed'}; color:${r.total >= 4 ? '#166534' : '#9a3412'}; padding:4px 8px; border-radius:8px; font-weight:800; font-size:1rem;">${r.total}</span></td>
                    <td style="padding:12px; font-size:0.75rem; color:#64748b;">${r.avgs.c1} | ${r.avgs.c2} | ${r.avgs.c3} | ${r.avgs.c4}</td>
                    <td style="padding:12px;"><span style="font-size:0.7rem; padding:2px 6px; border-radius:4px; background:#f1f5f9; color:#475569; font-weight:700;">${r.total >= 4.5 ? 'EXCELENTE' : (r.total >= 3.5 ? 'SATISFACTORIO' : 'MEJORABLE')}</span></td>
                </tr>
            `).join('');

            // --- POBLAR SELECTOR ESPEJO ---
            const mirrorSelect = document.getElementById('encuesta-admin-mirror-select');
            if (mirrorSelect && mirrorSelect.options.length <= 1) {
                const names = Object.keys(grouped).sort();
                names.forEach(n => {
                    const opt = document.createElement('option');
                    opt.value = n;
                    opt.textContent = `Ver Dashboard de: ${n}`;
                    mirrorSelect.appendChild(opt);
                });
                mirrorSelect.addEventListener('change', (e) => {
                    const val = e.target.value;
                    if (val === 'global') {
                        renderEncuestaAnalysis(history, "Resumen Global Institucional");
                    } else {
                        const filtered = grouped[val].items;
                        renderEncuestaAnalysis(filtered, val);
                    }
                });
            }
        }

        // 3. Renderizado automático si hay sesión (Docente Regular)
        const loggedEncuestaName = userName || userEmail;
        if (loggedEncuestaName) {
            // Filtro preciso: busca los nombres exactos del docente en el Directorio
            // usando su email como llave, luego cruza con feedbackHistory por nombre exacto.
            // Evita falsos positivos por apellidos compartidos (matchCount parcial anterior).
            const myNamesFromDir = (allData.directorio || [])
                .filter(d => normalizeName(d.correo) === normalizeName(userEmail))
                .map(d => normalizeName(d.docente));

            let myFeedback;
            if (myNamesFromDir.length > 0) {
                // Coincidencia exacta con los nombres del Directorio (mismo origen que feedbackHistory)
                myFeedback = history.filter(h => myNamesFromDir.includes(normalizeName(h.docente)));
            } else {
                // Fallback para directivos u otros no en Directorio: nombre exacto de sesión
                myFeedback = history.filter(h => normalizeName(h.docente) === normalizeName(userName));
            }

            if (myFeedback.length > 0) {
                renderEncuestaAnalysis(myFeedback, userName || myFeedback[0].docente);
            } else if (isAdmin) {
                // El admin por defecto ve el Resumen Global si no tiene evaluaciones directas
                renderEncuestaAnalysis(history, "Resumen Global Institucional");
            } else {
                document.getElementById('encuesta-teacher-name').textContent = "Sin evaluaciones aún";
                document.getElementById('encuesta-comment-list').innerHTML = '<p style="text-align:center; color:#94a3b8; padding:20px;">Aún no tienes evaluaciones registradas este semestre.</p>';
            }
        }
    }

    function renderEncuestaAnalysis(lista, nombre) {
        document.getElementById('encuesta-teacher-name').textContent = `Reporte de ${nombre}`;
        
        const totals = { c1: 0, c2: 0, c3: 0, c4: 0 };
        lista.forEach(r => {
            totals.c1 += parseFloat(r.claridad || 0);
            totals.c2 += parseFloat(r.respeto || 0);
            totals.c3 += parseFloat(r.dominio || 0);
            totals.c4 += parseFloat(r.org || 0);
        });

        const count = lista.length || 1;
        const avgs = {
            c1: (totals.c1 / count).toFixed(1),
            c2: (totals.c2 / count).toFixed(1),
            c3: (totals.c3 / count).toFixed(1),
            c4: (totals.c4 / count).toFixed(1)
        };

        const globalAvg = ((parseFloat(avgs.c1) + parseFloat(avgs.c2) + parseFloat(avgs.c3) + parseFloat(avgs.c4)) / 4).toFixed(1);
        document.getElementById('encuesta-global-avg').textContent = globalAvg;

        ['c1', 'c2', 'c3', 'c4'].forEach(id => {
            const v = avgs[id];
            document.getElementById(`encuesta-val-${id}`).textContent = v;
            document.getElementById(`encuesta-bar-${id}`).style.width = `${(v / 5) * 100}%`;
            
            const stars = document.getElementById(`encuesta-stars-${id}`);
            const full = Math.round(v);
            stars.innerHTML = Array(5).fill(0).map((_, i) => 
                `<i data-lucide="star" style="width:14px; fill:${i < full ? '#f59e0b' : 'none'}; color:${i < full ? '#f59e0b' : '#cbd5e1'};"></i>`
            ).join('');
        });

        const comms = document.getElementById('encuesta-comment-list');
        comms.innerHTML = lista.map(r => {
            const txt = r.comentarios || "";
            return txt.trim() ? `<div class="comment-item">&ldquo;${txt}&rdquo; <div style="font-size:0.7rem; color:#94a3b8; margin-top:4px;">&mdash; Grupo ${r.grupo || "?"}</div></div>` : '';
        }).join('') || '<p style="text-align:center; color:#94a3b8;">Sin comentarios.</p>';

        lucide.createIcons();
    }

    // --- DATA LOADING & RENDERING ---
    async function loadInitialData() {
        try {
            allData = await api.getDashboardData();
            
            // --- FILTRADO POR DOCENTE (FRONTEND) ---
            const userEmail = sessionStorage.getItem('user_email');
            const userRole = sessionStorage.getItem('user_role');
            const isAdmin = userRole === 'admin' || allData.isAdmin === true;

            if (userEmail && !isAdmin) {
                // Filtramos todas las tutorías para que solo se procesen las de este docente
                allData.tutorias = (allData.tutorias || []).filter(t => 
                    String(t.docenteEmail || "").toLowerCase().trim() === userEmail.toLowerCase().trim()
                );
            }

            // --- CRUCE DE DATOS: Asignar Nombres Reales a los Correos de los Docentes ---
            const directorio = allData.directorio || [];
            allData.tutorias.forEach(t => {
                const docFound = directorio.find(d => 
                    normalizeName(d.correo) === normalizeName(t.docenteEmail)
                );
                t.docente = docFound ? docFound.docente : t.docenteEmail || "Desconocido";
            });

            // Recalcular contadores (ahora pueden ser globales o personales según el rol)
            allData.totalTutorias = allData.tutorias.length;
            allData.individual = allData.tutorias.filter(t => t.individual).length;
            allData.grupal = allData.tutorias.filter(t => t.grupal).length;
            allData.hombres = allData.tutorias.filter(t => t.sexo === 'H').length;
            allData.mujeres = allData.tutorias.filter(t => t.sexo === 'F').length;

            if (isAdmin) {
                const adminControls = document.getElementById('admin-controls-historial');
                if (adminControls) adminControls.style.display = 'flex';
                document.querySelectorAll('.admin-only-col').forEach(el => el.style.display = 'table-cell');

                // Poblar selector de maestros para Historial y Reporte
                const teachers = [...new Set(allData.tutorias.map(t => t.docente))].filter(Boolean).sort();
                
                // Selector Historial
                const teacherSelect = document.getElementById('admin-teacher-select');
                if (teacherSelect && teacherSelect.options.length <= 1) {
                    teachers.forEach(t => {
                        const opt = document.createElement('option');
                        opt.value = t;
                        opt.textContent = t;
                        teacherSelect.appendChild(opt);
                    });
                    teacherSelect.addEventListener('change', renderHistorial);
                }

                // Selector Reporte
                const reportTeacherSelect = document.getElementById('report-teacher-select');
                if (reportTeacherSelect && reportTeacherSelect.options.length === 0) {
                    const adminReportFilter = document.getElementById('admin-report-filter');
                    if (adminReportFilter) adminReportFilter.style.display = 'flex';
                    
                    reportTeacherSelect.innerHTML = '<option value="all">-- Reporte Global Institucional --</option>';
                    teachers.forEach(t => {
                        const opt = document.createElement('option');
                        opt.value = t;
                        opt.textContent = t;
                        reportTeacherSelect.appendChild(opt);
                    });
                    reportTeacherSelect.addEventListener('change', renderReporte);
                }
            }

            // Centralized Teacher Name (Session Priority)
            const displayName = sessionStorage.getItem('user_name') || (allData.config && allData.config.docente);
            if (displayName) {
                document.getElementById('user-name').textContent = displayName;
                document.getElementById('report-teacher-name').textContent = displayName.toUpperCase();
                
                // Initials avatar
                const initials = displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                const initialsEl = document.getElementById('user-initials');
                if (initialsEl) initialsEl.textContent = initials;
            }
            
            populateSubjects();
            renderAll();
            setupGroupSelection();
        } catch (error) {
            console.error("Error cargando datos:", error);
            alert("Error al conectar con la base de datos.");
        }
    }

    function populateSubjects() {
        const select = document.getElementById('select-asignatura');
        if (!select) return;

        // Materias únicas de Directorio y Programación (Protegido contra nulos)
        const directorio = allData.directorio || [];
        const programacion = allData.programacion || [];
        
        const allSubjects = [
            ...directorio.map(d => d.materia),
            ...programacion.map(p => p.materia)
        ];
        const uniqueSubjects = [...new Set(allSubjects)].filter(s => s).sort();

        select.innerHTML = '<option value="">-- Elige una materia --</option>' + 
            uniqueSubjects.map(s => `<option value="${s}">${s}</option>`).join('') +
            '<option value="OTRA">-- OTRA (Escribir en Tema/Asunto) --</option>';
    }

    function renderAll() {
        renderDashboard();
        renderHistorial();
        renderReporte();
        renderEncuesta();
    }

    // 1. Dashboard Render
    function renderDashboard() {
        document.getElementById('stat-total').textContent = allData.totalTutorias;
        document.getElementById('stat-individual').textContent = allData.individual;
        document.getElementById('stat-grupal').textContent = allData.grupal;
        document.getElementById('stat-hombres').textContent = allData.hombres;
        document.getElementById('stat-mujeres').textContent = allData.mujeres;

        const list = document.getElementById('recent-activity-list');
        const recent = [...allData.tutorias].reverse().slice(0, 5);
        
        if (recent.length > 0) {
            list.innerHTML = recent.map(t => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:#f8fafc; border-radius:10px; border:1px solid #f1f5f9;">
                    <div>
                        <div style="font-weight:700; font-size:0.9rem;">${t.alumno}</div>
                        <div style="font-size:0.75rem; color:#64748b;">${t.grupo} • ${t.asignatura} • Parcial ${t.parcial}</div>
                    </div>
                    <span style="font-size:0.7rem; font-weight:700; padding:4px 10px; border-radius:20px; background:${t.individual ? '#e0f2fe' : '#fdf2f8'}; color:${t.individual ? '#0369a1' : '#db2777'};">
                        ${t.individual ? 'Individual' : 'Grupal'}
                    </span>
                </div>
            `).join('');
        }
    }

    // 2. Historial Render
    function renderHistorial() {
        const tbody = document.getElementById('historial-tbody');
        const userRole = sessionStorage.getItem('user_role');
        const isAdmin = userRole === 'admin' || allData.isAdmin === true;
        const teacherFilter = document.getElementById('admin-teacher-select')?.value || 'all';

        let filtered = allData.tutorias;
        if (isAdmin && teacherFilter !== 'all') {
            filtered = filtered.filter(t => t.docente === teacherFilter);
        }

        tbody.innerHTML = filtered.map(t => `
            <tr style="border-bottom: 1px solid #f8fafc;">
                <td style="padding:1rem; font-size:0.85rem;">${formatDateLocale(t.fecha)}</td>
                <td style="padding:1rem; font-size:0.85rem;">
                    <span onclick="toggleTutoriaParcial(event, '${t.fecha}', '${t.alumno.replace(/'/g, "\\'")}', ${t.parcial})"
                          title="Click para cambiar parcial"
                          style="cursor:pointer; font-weight:700; color:#3b82f6; background:#eff6ff; padding:2px 8px; border-radius:4px; border:1px solid #dbeafe;">
                        Parcial ${t.parcial}
                    </span>
                </td>
                <td style="padding:1rem; font-size:0.85rem; font-weight:700;">${t.grupo}</td>
                <td style="padding:1rem; font-size:0.85rem;">
                    ${t.alumno} 
                    <span onclick="toggleTutoriaSexo(event, '${t.fecha}', '${t.alumno.replace(/'/g, "\\'")}', '${t.sexo}')" 
                          title="Click para cambiar sexo"
                          style="cursor:pointer; font-size:0.7rem; font-weight:700; padding:2px 6px; border-radius:4px; margin-left:4px; background:${t.sexo === 'H' ? '#dcfce7' : '#fce7f3'}; color:${t.sexo === 'H' ? '#166534' : '#9d174d'}; border: 1px solid ${t.sexo === 'H' ? '#bbf7d0' : '#fbcfe8'};">
                        ${t.sexo}
                    </span>
                </td>
                <td class="admin-only-col" style="padding:1rem; font-size:0.8rem; font-weight:600; color:#475569; display:${isAdmin ? 'table-cell' : 'none'};">${t.docente || "-"}</td>
                <td style="padding:1rem; font-size:0.85rem;">${t.asignatura}</td>
                <td style="padding:1rem; font-size:1.1rem; text-align:center;" 
                    onclick="toggleAsistencia(event, '${t.fecha}', '${t.alumno.replace(/'/g, "\\'")}', '${t.asistencia}')"
                    title="Click para cambiar asistencia">
                    ${t.asistencia === 'NO' ? '❌' : '✅'}
                </td>
                <td style="padding:1rem; font-size:0.85rem;">${t.individual ? 'Individual' : 'Grupal'}</td>
                <td style="padding:1rem; font-size:0.85rem; color:#64748b; min-width: 250px; word-wrap: break-word;">${t.tema}</td>
                <td style="padding:1rem; font-size:0.85rem;">
                    <button class="btn-delete" onclick="handleDeleteTutoria('${t.fecha}', '${t.alumno.replace(/'/g, "\\'")}')" style="background:none; border:none; color:#ef4444; cursor:pointer; padding:4px;">
                        <i data-lucide="trash-2" style="width:16px; height:16px;"></i>
                    </button>
                </td>
            </tr>
        `).join('');
        lucide.createIcons();
    }

    window.handleDeleteTutoria = async (fecha, alumno) => {
        if (!confirm(`¿Estás seguro de que deseas eliminar el registro de tutoría de ${alumno}?`)) return;
        
        try {
            const result = await api.eliminarTutoria(fecha, alumno);
            if (result.status === 'success') {
                alert("Registro eliminado con éxito.");
                loadInitialData(); // Recargar todo
            } else {
                alert("Error al eliminar: " + result.message);
            }
        } catch (error) {
            alert("Error de conexión: " + error.message);
        }
    };

    window.toggleTutoriaSexo = async (event, fecha, alumno, sexoActual) => {
        const nuevoSexo = sexoActual === 'H' ? 'F' : 'H';
        
        // Efecto visual inmediato de "cargando"
        const badge = event.currentTarget;
        const originalContent = badge.innerHTML;
        badge.innerHTML = "...";
        badge.style.opacity = "0.5";
        badge.style.pointerEvents = "none";
        
        try {
            const result = await api.actualizarCampo(fecha, alumno, 'sexo', nuevoSexo); // Columna Sexo
            if (result.status === 'success') {
                await loadInitialData(); 
            } else {
                alert("Error al actualizar: " + result.message);
                badge.innerHTML = originalContent;
                badge.style.opacity = "1";
                badge.style.pointerEvents = "auto";
            }
        } catch (error) {
            alert("Error de conexión: " + error.message);
            badge.innerHTML = originalContent;
            badge.style.opacity = "1";
            badge.style.pointerEvents = "auto";
        }
    };

    window.toggleTutoriaParcial = async (event, fecha, alumno, parcialActual) => {
        const nuevoParcial = parcialActual >= 3 ? 1 : parcialActual + 1;
        
        const badge = event.currentTarget;
        const originalContent = badge.innerHTML;
        badge.innerHTML = "...";
        badge.style.opacity = "0.5";
        badge.style.pointerEvents = "none";
        
        try {
            const result = await api.actualizarCampo(fecha, alumno, 'parcial', nuevoParcial); // Columna Parcial
            if (result.status === 'success') {
                await loadInitialData(); 
            } else {
                alert("Error al actualizar: " + result.message);
                badge.innerHTML = originalContent;
                badge.style.opacity = "1";
                badge.style.pointerEvents = "auto";
            }
        } catch (error) {
            alert("Error de conexión: " + error.message);
            badge.innerHTML = originalContent;
            badge.style.opacity = "1";
            badge.style.pointerEvents = "auto";
        }
    };

    window.toggleAsistencia = async (event, fecha, alumno, asistenciaActual) => {
        const nuevoValor = asistenciaActual === 'NO' ? 'SÍ' : 'NO';
        
        const cell = event.currentTarget;
        const originalContent = cell.innerHTML;
        cell.innerHTML = "...";
        cell.style.opacity = "0.5";
        cell.style.pointerEvents = "none";
        
        try {
            const result = await api.actualizarCampo(fecha, alumno, 'asistencia', nuevoValor);
            if (result.status === 'success') {
                await loadInitialData(); 
            } else {
                alert("Error al actualizar: " + result.message);
                cell.innerHTML = originalContent;
                cell.style.opacity = "1";
                cell.style.pointerEvents = "auto";
            }
        } catch (error) {
            alert("Error de conexión: " + error.message);
            cell.innerHTML = originalContent;
            cell.style.opacity = "1";
            cell.style.pointerEvents = "auto";
        }
    };

    // 3. Reporte Render (Automated Totals)
    function renderReporte() {
        const pFilter = document.getElementById('report-parcial-filter').value;
        const userRole = sessionStorage.getItem('user_role');
        const isAdmin = userRole === 'admin' || allData.isAdmin === true;
        const reportTeacherFilter = document.getElementById('report-teacher-select')?.value || 'all';

        // 1. Filtrar los datos base (primero por docente si aplica)
        let baseData = allData.tutorias;
        if (isAdmin && reportTeacherFilter !== 'all') {
            baseData = baseData.filter(t => t.docente === reportTeacherFilter);
            document.getElementById('report-teacher-name').textContent = reportTeacherFilter.toUpperCase();
        } else if (isAdmin) {
            document.getElementById('report-teacher-name').textContent = "RESUMEN GLOBAL INSTITUCIONAL";
        } else {
            const displayName = sessionStorage.getItem('user_name') || (allData.config && allData.config.docente);
            document.getElementById('report-teacher-name').textContent = displayName ? displayName.toUpperCase() : "---";
        }

        // 2. Filtrar por el parcial seleccionado para la tabla de abajo
        const filtered = baseData.filter(t => String(t.parcial) === String(pFilter));
        
        // 3. Lógica de Totales (Basada en baseData para llenar la tabla resumen de arriba)
        const stats = {
            p1: { h:0, m:0, g:0, i:0 },
            p2: { h:0, m:0, g:0, i:0 },
            p3: { h:0, m:0, g:0, i:0 }
        };

        baseData.forEach(t => {
            const key = `p${t.parcial}`;
            if (stats[key]) {
                if (t.sexo === 'H') stats[key].h++;
                if (t.sexo === 'F') stats[key].m++;
                if (t.grupal) stats[key].g++;
                if (t.individual) stats[key].i++;
            }
        });

        // 4. Actualizar Tablas de Resumen
        for (let i = 1; i <= 3; i++) {
            const s = stats[`p${i}`];
            document.getElementById(`rep-p${i}-h`).textContent = s.h;
            document.getElementById(`rep-p${i}-m`).textContent = s.m;
            document.getElementById(`rep-p${i}-t`).textContent = s.h + s.m;
            document.getElementById(`rep-g-p${i}`).textContent = s.g;
            document.getElementById(`rep-i-p${i}`).textContent = s.i;
        }

        // 5. Renderizar Filas de Datos (Parcial seleccionado)
        const repTbody = document.getElementById('report-tbody');
        repTbody.innerHTML = filtered.map(t => `
            <tr>
                <td style="border:1px solid #000; padding:4px;">${t.grupo}</td>
                <td style="border:1px solid #000; padding:4px;">${t.alumno}</td>
                <td style="border:1px solid #000; padding:4px; text-align:center;">${t.sexo}</td>
                <td style="border:1px solid #000; padding:4px;">${t.asignatura}</td>
                <td style="border:1px solid #000; padding:4px; text-align:center; font-size:1.1rem;">${t.asistencia === 'NO' ? '❌' : '✅'}</td>
                <td style="border:1px solid #000; padding:4px; text-align:center;">${t.grupal ? 'X' : ''}</td>
                <td style="border:1px solid #000; padding:4px; text-align:center;">${t.individual ? 'X' : ''}</td>
                <td style="border:1px solid #000; padding:4px;">${formatDateLocale(t.fecha)}</td>
            </tr>
        `).join('') || '<tr><td colspan="8" style="text-align:center; padding:10px;">No hay datos para este parcial</td></tr>';
    }

    document.getElementById('report-parcial-filter').addEventListener('change', renderReporte);

    // --- AUTOMATION & GROUP SELECTION ---
    let selectedStudentsState = [];

    function updateCountBadge() {
        const count = selectedStudentsState.filter(s => s.isSelected).length;
        const badge = document.getElementById('selected-count-badge');
        if (!badge) return;
        badge.textContent = count;
        badge.style.display = count > 0 ? 'inline-flex' : 'none';
    }

    function setupGroupSelection() {
        const inputGrupo = document.getElementById('input-grupo');
        const inputSearchName = document.getElementById('input-search-name');
        const container = document.getElementById('students-checkbox-list');
        const btnSelectAll = document.getElementById('btn-select-all');

        const manualNameInput = document.getElementById('manual-name');
        const manualSexSelect = document.getElementById('manual-sex');
        const btnManualSex = document.getElementById('btn-manual-sex');
        const btnAddManualDirect = document.getElementById('btn-add-manual-direct');

        // Toggle del botón de sexo en entrada manual
        btnManualSex.addEventListener('click', () => {
            const newSexo = btnManualSex.dataset.sexo === 'H' ? 'F' : 'H';
            btnManualSex.dataset.sexo = newSexo;
            btnManualSex.textContent = newSexo === 'H' ? 'H' : 'M';
            btnManualSex.className = `sexo-toggle-btn sexo-${newSexo}`;
            manualSexSelect.value = newSexo;
        });

        const renderTotalList = (searchResults = []) => {
            const combined = [...selectedStudentsState];
            searchResults.forEach(res => {
                if (!combined.find(c => c.nombre === res.nombre)) {
                    combined.push({ ...res, isSelected: false });
                }
            });

            if (combined.length === 0) {
                container.innerHTML = `<div class="students-empty"><i data-lucide="user-search" style="width:36px;height:36px;color:#cbd5e1;"></i><p>Ingresa el número de grupo o busca por nombre</p></div>`;
                if (typeof lucide !== 'undefined') lucide.createIcons();
                btnSelectAll.style.display = 'none';
                updateCountBadge();
                return;
            }

            btnSelectAll.style.display = 'inline';
            container.innerHTML = combined.map(a => {
                let initialSexo = a.sexo || "H";
                if (initialSexo.toUpperCase().startsWith('M') || initialSexo.toUpperCase().startsWith('F')) initialSexo = "F";
                else initialSexo = "H";

                // Avatar con iniciales y color basado en género
                const initials = a.nombre.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
                const avatarStyle = initialSexo === 'F'
                    ? 'background:#fce7f3; color:#be185d;'
                    : 'background:#dbeafe; color:#1d4ed8;';
                const sexoLabel = initialSexo === 'H' ? 'H' : 'M';

                return `
                    <div class="student-item ${a.isSelected ? 'selected' : ''}">
                        <input type="checkbox" class="student-check" value="${a.nombre}" ${a.isSelected ? 'checked' : ''}>
                        <div class="student-avatar" style="${avatarStyle}">${initials}</div>
                        <div class="student-info">
                            <span class="student-name">${a.nombre}</span>
                            <span class="student-group-badge ${a.grupo ? '' : 'manual'}">${a.grupo || 'Manual'}</span>
                        </div>
                        <button type="button" class="sexo-badge sexo-${initialSexo}" data-sexo="${initialSexo}" title="Clic para cambiar género">${sexoLabel}</button>
                    </div>
                `;
            }).join('');

            container.querySelectorAll('.student-item').forEach((item) => {
                const check = item.querySelector('.student-check');
                const sexoBadge = item.querySelector('.sexo-badge');
                const avatar = item.querySelector('.student-avatar');

                check.addEventListener('change', () => {
                    const studentName = check.value;
                    const isChecked = check.checked;
                    const existingIdx = selectedStudentsState.findIndex(s => s.nombre === studentName);
                    if (isChecked) {
                        if (existingIdx === -1) {
                            const found = searchResults.find(r => r.nombre === studentName);
                            selectedStudentsState.push({ ...found, isSelected: true, sexo: sexoBadge.dataset.sexo });
                        } else {
                            selectedStudentsState[existingIdx].isSelected = true;
                        }
                        item.classList.add('selected');
                    } else {
                        if (existingIdx !== -1) selectedStudentsState[existingIdx].isSelected = false;
                        item.classList.remove('selected');
                    }
                    updateCountBadge();
                });

                sexoBadge.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const newSexo = sexoBadge.dataset.sexo === 'H' ? 'F' : 'H';
                    sexoBadge.dataset.sexo = newSexo;
                    sexoBadge.textContent = newSexo === 'H' ? 'H' : 'M';
                    sexoBadge.className = `sexo-badge sexo-${newSexo}`;
                    // Actualizar color del avatar
                    if (avatar) {
                        avatar.style.background = newSexo === 'F' ? '#fce7f3' : '#dbeafe';
                        avatar.style.color = newSexo === 'F' ? '#be185d' : '#1d4ed8';
                    }
                    const existingIdx = selectedStudentsState.findIndex(s => s.nombre === check.value);
                    if (existingIdx !== -1) selectedStudentsState[existingIdx].sexo = newSexo;
                });
            });
        };

        // 1. Filtro por Grupo (Sin borrar seleccionados)
        inputGrupo.addEventListener('input', () => {
            const val = inputGrupo.value.trim().toUpperCase();
            if (val.length >= 2) {
                const results = allData.alumnosFull.filter(a => a.grupo.toUpperCase() === val);
                renderTotalList(results);
            } else {
                renderTotalList([]);
            }
        });

        // 2. Buscador Global (Sin borrar seleccionados)
        inputSearchName.addEventListener('input', () => {
            const val = inputSearchName.value.trim().toLowerCase();
            if (val.length >= 3) {
                const results = allData.alumnosFull.filter(a => a.nombre.toLowerCase().includes(val));
                renderTotalList(results);
            } else {
                renderTotalList([]);
            }
        });

        // 3. Agregado Manual Directo
        btnAddManualDirect.addEventListener('click', () => {
            const name = manualNameInput.value.trim();
            if (name.length < 5) {
                alert("Por favor escribe el nombre completo del alumno.");
                return;
            }
            
            const sex = btnManualSex.dataset.sexo;
            const newStudent = {
                nombre: name,
                sexo: sex,
                grupo: inputGrupo.value.trim().toUpperCase() || "",
                isSelected: true
            };

            // Añadir al estado persistente
            if (!selectedStudentsState.find(s => s.nombre === name)) {
                selectedStudentsState.unshift(newStudent);
            }
            
            manualNameInput.value = '';
            renderTotalList();
            updateCountBadge();
        });

        btnSelectAll.addEventListener('click', () => {
            const checks = container.querySelectorAll('.student-check');
            const allChecked = Array.from(checks).every(c => c.checked);
            checks.forEach(c => {
                c.checked = !allChecked;
                c.dispatchEvent(new Event('change'));
            });
            btnSelectAll.textContent = allChecked ? 'Seleccionar todos' : 'Deseleccionar todos';
        });
    }

    // --- FORM SUBMISSION ---
    const form = document.getElementById('form-tutoria');
    function formatDateLocale(dateStr) {
        if (!dateStr) return "-";
        // Si recibimos YYYY-MM-DD, evitamos que JS lo trate como UTC
        if (typeof dateStr === 'string' && dateStr.includes('-') && !dateStr.includes(':')) {
            const [y, m, d] = dateStr.split('-');
            return `${d}/${m}/${y}`;
        }
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleDateString();
        } catch (e) { return dateStr; }
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Recoger solo los marcados como seleccionados en el estado
        const finalSelection = selectedStudentsState.filter(s => s.isSelected);

        if (finalSelection.length === 0) {
            alert("Por favor, selecciona o añade al menos un estudiante.");
            return;
        }

        const formData = new FormData(form);
        const payload = {
            parcial: formData.get('parcial'),
            grupo: formData.get('grupo').toUpperCase(),
            alumnos: finalSelection.map(s => ({ nombre: s.nombre, sexo: s.sexo })),
            asistencia: document.getElementById('check-asistencia').checked ? "SÍ" : "NO",
            asignatura: formData.get('asignatura'),
            regular: formData.get('alumno_tipo') === 'regular',
            intra: formData.get('alumno_tipo') === 'intra',
            tema: formData.get('tema'),
            individual: formData.get('tutoria_tipo') === 'individual',
            grupal: formData.get('tutoria_tipo') === 'grupal',
            fecha: formData.get('fecha_tutoria') || "",
            fecha_tutoria: formData.get('fecha_tutoria') || ""
        };

        try {
            const btn = form.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.textContent = "Guardando...";
            
            const result = await api.guardarTutoria(payload);
            if (result.status === "success") {
                alert("Tutoría registrada con éxito.");
                form.reset();
                // Re-establecer fecha de hoy para el siguiente registro
                const inputFecha = document.getElementById('input-fecha-tutoria');
                if (inputFecha) {
                    const hoy = new Date();
                    const yyyy = hoy.getFullYear();
                    const mm = String(hoy.getMonth() + 1).padStart(2, '0');
                    const dd = String(hoy.getDate()).padStart(2, '0');
                    inputFecha.value = `${yyyy}-${mm}-${dd}`;
                }
                selectedStudentsState = [];
                document.getElementById('students-checkbox-list').innerHTML = `<div class="students-empty"><i data-lucide="user-search" style="width:36px;height:36px;color:#cbd5e1;"></i><p>Ingresa el número de grupo o busca por nombre</p></div>`;
                if (typeof lucide !== 'undefined') lucide.createIcons();
                updateCountBadge();
                loadInitialData(); // Recargar historial
            } else {
                alert("Error: " + result.message);
            }
        } catch (error) {
            alert("Error al conectar.");
        } finally {
            const btn = form.querySelector('button[type="submit"]');
            btn.disabled = false;
            btn.innerHTML = '<i data-lucide="save" style="width:16px;height:16px;"></i> Guardar Tutoría';
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    });

    // --- SIDEBAR TOGGLE (MÓVIL) ---
    const btnSidebarToggle = document.getElementById('btn-sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    btnSidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        sidebarOverlay.classList.toggle('active');
    });
    sidebarOverlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        sidebarOverlay.classList.remove('active');
    });
    // Cerrar sidebar al navegar en móvil
    document.querySelectorAll('.nav-link[data-view]').forEach(link => {
        link.addEventListener('click', () => {
            sidebar.classList.remove('open');
            sidebarOverlay.classList.remove('active');
        });
    });

    // --- INITIALIZATION ---
    loadInitialData();
});
