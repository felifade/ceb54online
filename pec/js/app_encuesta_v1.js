/**
 * app_encuesta_v1.js
 * Lógica para la Evaluación Docente por Estudiantes
 * v1.1 - Soporte para Evaluaciones Directivas
 */

(function() {
    let allData = null;
    let selectedStudent = null;
    let selectedTeacher = null;
    let ratings = { c1:0, c2:0, c3:0, c4:0 };

    const steps = {
        login: document.getElementById('step-login'),
        choice: document.getElementById('step-choice'),
        teachers: document.getElementById('step-teachers'),
        survey: document.getElementById('step-survey'),
        success: document.getElementById('step-success')
    };

    const loader = document.getElementById('student-loader');

    // --- INICIALIZACIÓN ---
    async function init() {
        try {
            allData = await api.fetchAllData();
            populateGroups();
        } catch (e) {
            alert("Error al conectar con el servidor: " + e.message);
        }
    }

    function populateGroups() {
        const select = document.getElementById('student-group');
        const grupos = [...new Set(allData.alumnosFull.map(a => a.grupo))].sort();
        
        grupos.forEach(g => {
            if(!g) return;
            const opt = document.createElement('option');
            opt.value = g;
            opt.textContent = `Grupo ${g}`;
            select.appendChild(opt);
        });

        select.onchange = (e) => {
            const grupo = e.target.value;
            populateNames(grupo);
        };
    }

    function populateNames(grupo) {
        const select = document.getElementById('student-name');
        select.innerHTML = '<option value="">-- Selecciona tu nombre --</option>';
        
        if(!grupo) {
            select.disabled = true;
            return;
        }

        const alumnos = allData.alumnosFull
            .filter(a => a.grupo === grupo)
            .sort((a,b) => a.nombre.localeCompare(b.nombre));

        alumnos.forEach(a => {
            const opt = document.createElement('option');
            opt.value = a.nombre;
            opt.textContent = a.nombre;
            select.appendChild(opt);
        });

        select.disabled = false;
        select.onchange = () => {
            const hasValue = !!select.value;
            document.getElementById('btn-start').disabled = !hasValue;
            document.getElementById('pin-container').style.display = hasValue ? 'block' : 'none';
        };
    }

    // --- NAVEGACIÓN ---
    document.getElementById('btn-start').onclick = () => {
        const name = document.getElementById('student-name').value;
        const group = document.getElementById('student-group').value;
        const enteredPin = document.getElementById('student-pin').value.trim();
        
        const alumnoData = allData.alumnosFull.find(a => a.nombre === name && a.grupo === group);
        if (!alumnoData) return;

        const pinCorrecto = String(alumnoData.pin || "").trim();
        if (enteredPin !== pinCorrecto) {
            alert("⚠️ El PIN ingresado es incorrecto.");
            return;
        }

        selectedStudent = { nombre: name, grupo: group };
        showStep('choice');
    };

    document.getElementById('btn-back-to-login').onclick = () => showStep('login');

    // Controlador Global para botones de elección
    window.surveyController = {
        choosePath: (path) => {
            if (path === 'profesores') {
                showStep('teachers');
                loadTeachers(selectedStudent.grupo);
            } else {
                showStep('teachers'); // Reutilizamos la vista de lista pero cargamos directivos
                loadDirectors();
            }
        }
    };

    function showStep(s) {
        Object.values(steps).forEach(el => {
            if(el) {
                el.style.display = 'none';
                el.classList.remove('active');
            }
        });
        if(steps[s]) {
            steps[s].style.display = 'block';
            steps[s].classList.add('active');
        }
        
        // Actualizar dots
        document.querySelectorAll('.step-dot').forEach(d => d.classList.remove('active'));
        if(s === 'login') document.getElementById('dot-1').classList.add('active');
        if(s === 'choice' || s === 'teachers') document.getElementById('dot-2').classList.add('active');
        if(s === 'survey' || s === 'success') document.getElementById('dot-3').classList.add('active');
        
        window.scrollTo(0,0);
        feather.replace();
    }

    // --- CARGA DE MAESTROS ---
    function loadTeachers(grupo) {
        const container = document.getElementById('teacher-list');
        const title = document.querySelector('#step-teachers h2');
        title.textContent = "Profesores asignados";
        container.innerHTML = '';
        
        const clean = (g) => String(g).replace(/[^0-9]/g, '');
        const targetClean = clean(grupo);
        const pActivo = String(allData.config.parcialActivo || "2");

        const misMaestros = allData.directorio.filter(d => clean(d.grupo) === targetClean);
        
        // Deduplicar
        const docentesUnicos = {};
        misMaestros.forEach(m => {
            if(!docentesUnicos[m.docente]) docentesUnicos[m.docente] = m;
        });

        renderList(Object.values(docentesUnicos), container, pActivo);
    }

    // --- CARGA DE DIRECTIVOS ---
    function loadDirectors() {
        const container = document.getElementById('teacher-list');
        const title = document.querySelector('#step-teachers h2');
        title.textContent = "Cuerpo Directivo";
        container.innerHTML = '';

        const directivos = [
            { docente: "DIRECTOR DEL PLANTEL", materia: "DIRECCIÓN GENERAL", isDirector: true },
            { docente: "SUBDIRECTOR ACADÉMICO", materia: "SUBDIRECCIÓN", isDirector: true },
            { docente: "SUBDIRECTOR ADMINISTRATIVO", materia: "SUBDIRECCIÓN", isDirector: true }
        ];

        const pActivo = String(allData.config.parcialActivo || "2");
        renderList(directivos, container, pActivo);
    }

    function renderList(items, container, pActivo) {
        const historial = allData.feedbackHistory || [];

        items.forEach(m => {
            const yaEvaluado = historial.some(h => 
                h.parcial === pActivo && 
                h.alumno === selectedStudent.nombre && 
                h.docente === m.docente
            );

            const btn = document.createElement('div');
            btn.className = 'teacher-btn';
            if (yaEvaluado) {
                btn.style.opacity = '0.6';
                btn.style.cursor = 'not-allowed';
                btn.style.background = '#f1f5f9';
            }

            btn.innerHTML = `
                <i data-feather="${m.isDirector ? 'briefcase' : 'user'}" style="color: ${yaEvaluado ? '#10b981' : 'var(--clr-student)'}"></i>
                <div style="flex:1;">
                    <div style="font-weight:700; color:#1e293b;">${m.docente}</div>
                    <div style="font-size:0.8rem; color:#64748b;">${m.materia}</div>
                </div>
                ${yaEvaluado ? '<span style="font-size:0.7rem; font-weight:700; color:#059669; background:#d1fae5; padding:2px 8px; border-radius:99px;">EVALUADO</span>' : '<i data-feather="chevron-right" style="width:16px; opacity:0.3;"></i>'}
            `;
            
            if (!yaEvaluado) btn.onclick = () => openSurvey(m);
            container.appendChild(btn);
        });
        feather.replace();
    }

    // --- FORMULARIO DE ENCUESTA ---
    const criterios = [
        { id: 'c1', texto: '¿El profesor explica con claridad los temas?' },
        { id: 'c2', texto: '¿Trata a los alumnos con respeto y amabilidad?' },
        { id: 'c3', texto: '¿Demuestra dominio y conocimiento de su materia?' },
        { id: 'c4', texto: '¿Es organizado y cumple con los horarios de clase?' }
    ];

    function openSurvey(m) {
        selectedTeacher = m;
        document.getElementById('eval-teacher-name').textContent = m.docente;
        document.getElementById('eval-subject-name').textContent = m.materia;
        
        const container = document.getElementById('encuesta-form');
        container.innerHTML = '';
        ratings = { c1:0, c2:0, c3:0, c4:0 };

        criterios.forEach(crit => {
            const div = document.createElement('div');
            div.style.marginBottom = '1.5rem';
            div.innerHTML = `
                <label style="display:block; font-weight:600; font-size:0.95rem; color:#334155; margin-bottom:0.5rem;">${crit.texto}</label>
                <div class="star-rating" data-crit="${crit.id}">
                    ${[1,2,3,4,5].map(n => `<i data-feather="star" class="star" data-val="${n}"></i>`).join('')}
                </div>
            `;
            container.appendChild(div);
        });

        feather.replace();
        initStarEvents();
        showStep('survey');
    }

    function initStarEvents() {
        document.querySelectorAll('.star').forEach(star => {
            star.onclick = (e) => {
                const val = parseInt(e.target.closest('.star').dataset.val);
                const critId = e.target.closest('.star-rating').dataset.crit;
                ratings[critId] = val;
                
                const parent = e.target.closest('.star-rating');
                parent.querySelectorAll('.star').forEach(s => {
                    const sVal = parseInt(s.dataset.val);
                    if(sVal <= val) s.classList.add('active');
                    else s.classList.remove('active');
                });
            };
        });
    }

    document.getElementById('btn-back-to-list').onclick = () => {
        // Si es directivo, volver a la lista de directivos, si no a la de maestros
        if (selectedTeacher && selectedTeacher.isDirector) loadDirectors();
        else loadTeachers(selectedStudent.grupo);
        showStep('teachers');
    };

    document.getElementById('btn-submit-eval').onclick = async () => {
        if(Object.values(ratings).some(v => v === 0)) {
            alert("Por favor califica todos los puntos con estrellas.");
            return;
        }

        loader.style.display = 'block';
        steps.survey.style.opacity = '0.5';
        steps.survey.style.pointerEvents = 'none';

        const payload = {
            action: 'eval-docente',
            parcial: allData.config.parcialActivo || "2",
            alumno: selectedStudent.nombre,
            grupo: selectedStudent.grupo,
            docente: selectedTeacher.docente,
            materia: selectedTeacher.materia,
            ...ratings,
            comentarios: document.getElementById('eval-comments').value
        };

        try {
            await fetch(GOOGLE_SHEETS_API_URL, {
                method: 'POST',
                mode: 'no-cors',
                body: JSON.stringify(payload)
            });
            showStep('success');
        } catch (e) {
            alert("Error al enviar: " + e.message);
        } finally {
            loader.style.display = 'none';
            steps.survey.style.opacity = '1';
            steps.survey.style.pointerEvents = 'auto';
        }
    };

    init();
})();
