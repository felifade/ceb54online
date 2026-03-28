// tutorias/js/app.js

document.addEventListener('DOMContentLoaded', async () => {
    // Initial State
    let allData = { tutorias: [], grupos: [], config: { docente: "" }, alumnosFull: [] };
    const views = document.querySelectorAll('.view');
    const navLinks = document.querySelectorAll('.nav-link');
    const viewTitle = document.getElementById('view-title');
    const currentDateEl = document.getElementById('current-date');

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
            if (viewId === 'dashboard' || viewId === 'historial' || viewId === 'reporte') {
                renderAll();
            }
        });
    });

    // --- DATA LOADING & RENDERING ---
    async function loadInitialData() {
        try {
            allData = await api.getDashboardData();
            
            // --- FILTRADO POR DOCENTE (FRONTEND) ---
            const userEmail = sessionStorage.getItem('user_email');
            if (userEmail) {
                // Filtramos todas las tutorías para que solo se procesen las de este docente
                allData.tutorias = (allData.tutorias || []).filter(t => 
                    String(t.docenteEmail || "").toLowerCase().trim() === userEmail.toLowerCase().trim()
                );
                
                // Recalcular contadores locales del dashboard basándose en la lista filtrada
                allData.totalTutorias = allData.tutorias.length;
                allData.individual = allData.tutorias.filter(t => t.individual).length;
                allData.grupal = allData.tutorias.filter(t => t.grupal).length;
                allData.hombres = allData.tutorias.filter(t => t.sexo === 'H').length;
                allData.mujeres = allData.tutorias.filter(t => t.sexo === 'F').length;
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
        tbody.innerHTML = allData.tutorias.map(t => `
            <tr style="border-bottom: 1px solid #f8fafc;">
                <td style="padding:1rem; font-size:0.85rem;">${new Date(t.fecha).toLocaleDateString()}</td>
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
                <td style="padding:1rem; font-size:0.85rem;">${t.asignatura}</td>
                <td style="padding:1rem; font-size:1.1rem; text-align:center;" 
                    onclick="toggleAsistencia(event, '${t.fecha}', '${t.alumno.replace(/'/g, "\\'")}', '${t.asistencia}')"
                    title="Click para cambiar asistencia">
                    ${t.asistencia === 'NO' ? '❌' : '✅'}
                </td>
                <td style="padding:1rem; font-size:0.85rem;">${t.individual ? 'Individual' : 'Grupal'}</td>
                <td style="padding:1rem; font-size:0.85rem; color:#64748b; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${t.tema}</td>
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
            const result = await api.actualizarCampo(fecha, alumno, 5, nuevoSexo); // Columna 5 = Sexo
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
            const result = await api.actualizarCampo(fecha, alumno, 2, nuevoParcial); // Columna 2 = Parcial
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
        const filtered = allData.tutorias.filter(t => String(t.parcial) === String(pFilter));
        
        // Final Summary Logic (Counts per parcial)
        const stats = {
            p1: { h:0, m:0, g:0, i:0 },
            p2: { h:0, m:0, g:0, i:0 },
            p3: { h:0, m:0, g:0, i:0 }
        };

        allData.tutorias.forEach(t => {
            const key = `p${t.parcial}`;
            if (stats[key]) {
                if (t.sexo === 'H') stats[key].h++;
                if (t.sexo === 'F') stats[key].m++;
                if (t.grupal) stats[key].g++;
                if (t.individual) stats[key].i++;
            }
        });

        // Update Summary Tables in the Report View
        for (let i = 1; i <= 3; i++) {
            const s = stats[`p${i}`];
            document.getElementById(`rep-p${i}-h`).textContent = s.h;
            document.getElementById(`rep-p${i}-m`).textContent = s.m;
            document.getElementById(`rep-p${i}-t`).textContent = s.h + s.m;
            document.getElementById(`rep-g-p${i}`).textContent = s.g;
            document.getElementById(`rep-i-p${i}`).textContent = s.i;
        }

        // Render Data Rows for the filtered Parcial
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
                <td style="border:1px solid #000; padding:4px;">${new Date(t.fecha).toLocaleDateString()}</td>
            </tr>
        `).join('') || '<tr><td colspan="7" style="text-align:center; padding:10px;">No hay datos para este parcial</td></tr>';
    }

    document.getElementById('report-parcial-filter').addEventListener('change', renderReporte);

    // --- AUTOMATION & GROUP SELECTION ---
    let selectedStudentsState = []; // Almacena alumnos seleccionados PERSISTENTES

    function setupGroupSelection() {
        const inputGrupo = document.getElementById('input-grupo');
        const inputSearchName = document.getElementById('input-search-name');
        const container = document.getElementById('students-checkbox-list');
        const btnSelectAll = document.getElementById('btn-select-all');
        
        // Nuevos campos manuales
        const manualNameInput = document.getElementById('manual-name');
        const manualSexSelect = document.getElementById('manual-sex');
        const btnAddManualDirect = document.getElementById('btn-add-manual-direct');

        const renderTotalList = (searchResults = []) => {
            // Unir seleccionados existentes + nuevos resultados (evitando duplicados por nombre)
            const combined = [...selectedStudentsState];
            searchResults.forEach(res => {
                if (!combined.find(c => c.nombre === res.nombre)) {
                    combined.push({ ...res, isSelected: false });
                }
            });

            if (combined.length === 0) {
                container.innerHTML = '<p style="color: #94a3b8; font-size: 0.85rem; grid-column: 1/-1;">Los alumnos seleccionados o añadidos aparecerán aquí abajo...</p>';
                btnSelectAll.style.display = 'none';
                return;
            }

            btnSelectAll.style.display = 'block';
            container.innerHTML = combined.map(a => {
                // Determinar sexo inicial
                let initialSexo = a.sexo || "H";
                if (initialSexo.toUpperCase().startsWith('M') || initialSexo.toUpperCase().startsWith('F')) initialSexo = "F";
                
                return `
                    <div class="student-item" style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; padding: 6px 10px; border-bottom: 1px solid #f1f5f9; background: ${a.isSelected ? '#f0fdf4' : 'transparent'};">
                        <label style="display: flex; align-items: center; gap: 0.8rem; font-size: 0.85rem; cursor: pointer; flex: 1; margin-bottom: 0;">
                            <input type="checkbox" class="student-check" value="${a.nombre}" ${a.isSelected ? 'checked' : ''} style="width: auto;">
                            <span style="font-weight: 500;">${a.nombre} <small style="color: #64748b;">${a.grupo ? '['+a.grupo+']' : '(Nuevo)'}</small></span>
                        </label>
                        <select class="student-sex-select" style="width: auto; padding: 2px 8px; font-size: 0.75rem; border-radius: 6px; background: #fff; border: 1px solid #cbd5e1;">
                            <option value="H" ${initialSexo === 'H' ? 'selected' : ''}>H</option>
                            <option value="F" ${initialSexo === 'F' ? 'selected' : ''}>M</option>
                        </select>
                    </div>
                `;
            }).join('');

            // Re-vincular eventos a los checkboxes y selects
            container.querySelectorAll('.student-item').forEach((item, index) => {
                const check = item.querySelector('.student-check');
                const sexSelect = item.querySelector('.student-sex-select');
                
                check.addEventListener('change', () => {
                    const studentName = check.value;
                    const isChecked = check.checked;
                    
                    // Actualizar el estado persistente
                    const existingIdx = selectedStudentsState.findIndex(s => s.nombre === studentName);
                    if (isChecked) {
                        if (existingIdx === -1) {
                            // Si no estaba en persistentes (era un resultado de búsqueda), lo añadimos
                            const found = searchResults.find(r => r.nombre === studentName);
                            selectedStudentsState.push({ ...found, isSelected: true, sexo: sexSelect.value });
                        } else {
                            selectedStudentsState[existingIdx].isSelected = true;
                        }
                        item.style.background = '#f0fdf4';
                    } else {
                        // Si se deselecciona, lo marcamos como no seleccionado en el estado
                        if (existingIdx !== -1) {
                            selectedStudentsState[existingIdx].isSelected = false;
                        }
                        item.style.background = 'transparent';
                    }
                });

                sexSelect.addEventListener('change', () => {
                    const existingIdx = selectedStudentsState.findIndex(s => s.nombre === check.value);
                    if (existingIdx !== -1) {
                        selectedStudentsState[existingIdx].sexo = sexSelect.value;
                    }
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
                alert("Por favor escribe el nombre completo.");
                return;
            }
            
            const sex = manualSexSelect.value;
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
            
            // Limpiar campos y refrescar
            manualNameInput.value = '';
            renderTotalList();
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
            grupal: formData.get('tutoria_tipo') === 'grupal'
        };

        try {
            const btn = form.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.textContent = "Guardando...";
            
            const result = await api.guardarTutoria(payload);
            if (result.status === "success") {
                alert("Tutoría registrada con éxito.");
                form.reset();
                selectedStudentsState = []; // Limpiar lista
                document.getElementById('students-checkbox-list').innerHTML = '<p ...> Los alumnos seleccionados aparecerán aquí...</p>';
                loadInitialData(); // Recargar historial
            } else {
                alert("Error: " + result.message);
            }
        } catch (error) {
            alert("Error al conectar.");
        } finally {
            const btn = form.querySelector('button[type="submit"]');
            btn.disabled = false;
            btn.textContent = "Registrar Sesión";
        }
    });

    // --- INITIALIZATION ---
    loadInitialData();
});
