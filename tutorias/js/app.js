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
            
            // Centralized Teacher Name
            if (allData.config && allData.config.docente) {
                document.getElementById('user-name').textContent = allData.config.docente;
                document.getElementById('report-teacher-name').textContent = allData.config.docente;
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
                <td style="padding:1rem; font-size:0.85rem;">Parcial ${t.parcial}</td>
                <td style="padding:1rem; font-size:0.85rem; font-weight:700;">${t.grupo}</td>
                <td style="padding:1rem; font-size:0.85rem;">${t.alumno} <small style="color:#94a3b8;">(${t.sexo})</small></td>
                <td style="padding:1rem; font-size:0.85rem;">${t.asignatura}</td>
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
                <td style="border:1px solid #000; padding:4px; text-align:center;">${t.grupal ? 'X' : ''}</td>
                <td style="border:1px solid #000; padding:4px; text-align:center;">${t.individual ? 'X' : ''}</td>
                <td style="border:1px solid #000; padding:4px;">${new Date(t.fecha).toLocaleDateString()}</td>
            </tr>
        `).join('') || '<tr><td colspan="7" style="text-align:center; padding:10px;">No hay datos para este parcial</td></tr>';
    }

    document.getElementById('report-parcial-filter').addEventListener('change', renderReporte);

    // --- AUTOMATION & GROUP SELECTION ---
    function setupGroupSelection() {
        const inputGrupo = document.getElementById('input-grupo');
        const inputSearchName = document.getElementById('input-search-name');
        const container = document.getElementById('students-checkbox-list');
        const btnSelectAll = document.getElementById('btn-select-all');
        const btnAddManual = document.getElementById('btn-add-manual');

        // Helper to render a student item
        const createStudentHTML = (a, isNew = false) => {
            let initialSexo = "H";
            if (a.sexo && (a.sexo.toUpperCase().startsWith('M') || a.sexo.toUpperCase().startsWith('F'))) initialSexo = "F";
            
            return `
                <div class="student-item ${isNew ? 'new-student' : ''}" style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; padding: 6px 10px; border-bottom: 1px solid #f1f5f9; background: ${isNew ? '#fffbeb' : 'transparent'};">
                    <label style="display: flex; align-items: center; gap: 0.8rem; font-size: 0.85rem; cursor: pointer; flex: 1; margin-bottom: 0;">
                        <input type="checkbox" name="selected_students" value="${a.nombre}" checked style="width: auto;">
                        <span style="font-weight: 500;">${a.nombre} <small style="color: #64748b;">${a.grupo ? '['+a.grupo+']' : '(Manual)'}</small></span>
                    </label>
                    <select class="student-sex-select" style="width: auto; padding: 2px 8px; font-size: 0.75rem; border-radius: 6px; background: #fff; border: 1px solid #cbd5e1;">
                        <option value="H" ${initialSexo === 'H' ? 'selected' : ''}>H</option>
                        <option value="F" ${initialSexo === 'F' ? 'selected' : ''}>M</option>
                    </select>
                </div>
            `;
        };

        // 1. Search by Group
        inputGrupo.addEventListener('input', () => {
            inputSearchName.value = ''; // Clear other search
            const val = inputGrupo.value.trim().toUpperCase();
            if (val.length >= 2) {
                const students = allData.alumnosFull.filter(a => a.grupo.toUpperCase() === val);
                
                if (students.length > 0) {
                    btnSelectAll.style.display = 'block';
                    container.innerHTML = students.map(a => createStudentHTML(a)).join('');
                    // Desmarcar todos inicialmente si se busca por grupo masivo
                    container.querySelectorAll('input[type="checkbox"]').forEach(c => c.checked = false);
                } else {
                    btnSelectAll.style.display = 'none';
                    container.innerHTML = '<p style="color: #94a3b8; font-size: 0.85rem; grid-column: 1/-1;">No se encontraron alumnos en este grupo.</p>';
                }
            } else {
                btnSelectAll.style.display = 'none';
                container.innerHTML = '<p style="color: #94a3b8; font-size: 0.85rem; grid-column: 1/-1;">Ingresa un grupo para ver la lista de alumnos...</p>';
            }
        });

        // 2. Global Search by Name
        inputSearchName.addEventListener('input', () => {
            inputGrupo.value = ''; // Clear group search
            const val = inputSearchName.value.trim().toLowerCase();
            if (val.length >= 3) {
                const results = allData.alumnosFull.filter(a => a.nombre.toLowerCase().includes(val));
                if (results.length > 0) {
                    btnSelectAll.style.display = 'none';
                    container.innerHTML = results.map(a => createStudentHTML(a)).join('');
                    // Al buscar por nombre específico, solemos querer seleccionarlos
                } else {
                    container.innerHTML = '<p style="color: #94a3b8; font-size: 0.85rem; grid-column: 1/-1;">No se encontraron coincidencias.</p>';
                }
            }
        });

        // 3. Manual Addition
        btnAddManual.addEventListener('click', () => {
            const manualName = prompt("Nombre completo del alumno:");
            if (!manualName || manualName.trim().length < 5) return;
            
            const manualSexo = prompt("Sexo (H/M):", "H").toUpperCase().startsWith('M') ? 'F' : 'H';
            
            const manualItem = {
                nombre: manualName.trim(),
                sexo: manualSexo,
                grupo: inputGrupo.value.trim() || ""
            };

            // Remover el placeholder si existe
            if (container.querySelector('p')) container.innerHTML = '';
            
            // Añadir al inicio del contenedor
            const div = document.createElement('div');
            div.innerHTML = createStudentHTML(manualItem, true);
            container.prepend(div.firstElementChild);
        });

        btnSelectAll.addEventListener('click', () => {
            const checks = container.querySelectorAll('input[type="checkbox"]');
            const allChecked = Array.from(checks).every(c => c.checked);
            checks.forEach(c => c.checked = !allChecked);
            btnSelectAll.textContent = allChecked ? 'Seleccionar todos' : 'Deseleccionar todos';
        });
    }

    // --- FORM SUBMISSION ---
    const form = document.getElementById('form-tutoria');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        
        // Obtener alumnos seleccionados y su sexo específico
        const studentItems = document.querySelectorAll('.student-item');
        const alumnosArray = [];
        
        studentItems.forEach(item => {
            const check = item.querySelector('input[name="selected_students"]');
            if (check && check.checked) {
                const sexSelect = item.querySelector('.student-sex-select');
                alumnosArray.push({
                    nombre: check.value,
                    sexo: sexSelect ? sexSelect.value : "H"
                });
            }
        });

        if (alumnosArray.length === 0) {
            alert("Por favor, selecciona al menos un estudiante.");
            return;
        }

        const payload = {
            parcial: formData.get('parcial'),
            grupo: formData.get('grupo').toUpperCase(),
            alumnos: alumnosArray,
            asignatura: formData.get('asignatura'),
            regular: formData.get('alumno_tipo') === 'regular',
            intra: formData.get('alumno_tipo') === 'intra',
            tema: formData.get('tema'),
            individual: formData.get('tutoria_tipo') === 'individual',
            grupal: formData.get('tutoria_tipo') === 'grupal'
        };

        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Guardando...';

        try {
            const result = await api.guardarTutoria(payload);
            if (result.status === 'success') {
                alert(`¡Éxito! Se registraron ${alumnosArray.length} tutorías.`);
                form.reset();
                document.getElementById('students-checkbox-list').innerHTML = '<p style="color: #94a3b8; font-size: 0.85rem; grid-column: 1/-1;">Ingresa un grupo para ver la lista de alumnos...</p>';
                document.getElementById('btn-select-all').style.display = 'none';
                
                // Volver al dashboard
                document.querySelector('[data-view="dashboard"]').click();
                loadInitialData(); 
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            alert("Error al guardar: " + error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i data-lucide="save"></i> Guardar Tutoría';
            lucide.createIcons();
        }
    });

    // Start
    loadInitialData();
});
