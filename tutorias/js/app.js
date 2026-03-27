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

        // Materias únicas de Directorio y Programación
        const allSubjects = [
            ...allData.directorio.map(d => d.materia),
            ...allData.programacion.map(p => p.materia)
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
            </tr>
        `).join('');
    }

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
        const container = document.getElementById('students-checkbox-list');
        const btnSelectAll = document.getElementById('btn-select-all');

        inputGrupo.addEventListener('input', () => {
            const val = inputGrupo.value.trim().toUpperCase();
            if (val.length >= 2) {
                const students = allData.alumnosFull.filter(a => a.grupo.toUpperCase() === val);
                
                if (students.length > 0) {
                    btnSelectAll.style.display = 'block';
                    container.innerHTML = students.map(a => `
                        <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; padding: 4px; border-radius: 4px; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'">
                            <input type="checkbox" name="selected_students" value="${a.nombre}" data-sexo="${a.sexo}" style="width: auto;">
                            <span>${a.nombre}</span>
                        </label>
                    `).join('');
                } else {
                    btnSelectAll.style.display = 'none';
                    container.innerHTML = '<p style="color: #94a3b8; font-size: 0.85rem; grid-column: 1/-1;">No se encontraron alumnos en este grupo.</p>';
                }
            } else {
                btnSelectAll.style.display = 'none';
                container.innerHTML = '<p style="color: #94a3b8; font-size: 0.85rem; grid-column: 1/-1;">Ingresa un grupo para ver la lista de alumnos...</p>';
            }
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
        
        // Obtener alumnos seleccionados
        const selectedChecks = document.querySelectorAll('input[name="selected_students"]:checked');
        if (selectedChecks.length === 0) {
            alert("Por favor, selecciona al menos un estudiante.");
            return;
        }

        const alumnosArray = Array.from(selectedChecks).map(c => ({
            nombre: c.value,
            sexo: c.dataset.sexo || "H"
        }));

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
