// pec/js/app_encuesta_v2.js
// Lógica Refinada para la Encuesta de Opinión PEC (v2.0)
// Enfocada en Estudiantes (Evaluación Docente y Directiva)

(function() {
    // Estado Global de la Sesión de Encuesta
    let allData = null;
    let selectedStudent = null;
    let selectedTeacher = null;
    let ratings = { c1:0, c2:0, c3:0, c4:0 };

    // Pasos de la UI
    const steps = {
        login: document.getElementById('step-login'),
        choice: document.getElementById('step-choice'),
        teachers: document.getElementById('step-teachers'),
        survey: document.getElementById('step-survey'),
        success: document.getElementById('step-success')
    };

    const loader = document.getElementById('student-loader');
    const showLoader = () => loader.style.display = 'block';
    const hideLoader = () => loader.style.display = 'none';

    // --- 1. INICIALIZACIÓN ---
    async function init() {
        showLoader();
        try {
            // Intentamos traer todos los datos (Directorio + Alumnos)
            allData = await api.fetchAllData();
            window._log("DEBUG - Datos para Encuesta:", allData);
            
            if(!allData.alumnosFull || allData.alumnosFull.length === 0) {
                console.warn("No se encontró la lista 'alumnosFull'. Usando 'sinEquipo' como fallback.");
                allData.alumnosFull = data.sinEquipo || [];
            }

            populateGroups();
            feather.replace();
        } catch (e) {
            console.error(e);
            alert("No se pudieron cargar los datos de la encuesta. Verifica la conexión.");
        }
        hideLoader();
    }

    function populateGroups() {
        const select = document.getElementById('student-group');
        if(!select) return;

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
        if(!select) return;

        select.innerHTML = '<option value="">-- Busca tu nombre --</option>';
        
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

    // --- 2. NAVEGACIÓN Y LOGIN ---
    const btnStart = document.getElementById('btn-start');
    if(btnStart) {
        btnStart.onclick = () => {
            const name = document.getElementById('student-name').value;
            const group = document.getElementById('student-group').value;
            const enteredPin = document.getElementById('student-pin').value.trim();
            
            const alumnoData = allData.alumnosFull.find(a => a.nombre === name && a.grupo === group);
            if (!alumnoData) return;

            // Validación de PIN (Sensible a mayúsculas/minúsculas o guiones)
            const pinCorrecto = String(alumnoData.pin || "").trim();
            if (enteredPin !== pinCorrecto) {
                alert("⚠️ Código incorrecto. Por favor revisa tu PIN o matrícula.");
                return;
            }

            selectedStudent = { nombre: name, grupo: group };
            showStep('choice');
        };
    }

    const btnBackLogin = document.getElementById('btn-back-to-login');
    if(btnBackLogin) btnBackLogin.onclick = () => showStep('login');

    window.surveyController = {
        choosePath: (path) => {
            if (path === 'profesores') {
                showStep('teachers');
                loadTeachers(selectedStudent.grupo);
            } else {
                showStep('teachers');
                loadDirectors();
            }
        },
        reset: async () => {
             showLoader();
             try {
                 // Recargar datos (allData) para actualizar el historial de evaluados (feedbackHistory)
                 allData = await api.fetchAllData();
                 
                 // Limpiar estado de la encuesta anterior
                 selectedTeacher = null;
                 ratings = { c1:0, c2:0, c3:0, c4:0 };
                 const comments = document.getElementById('eval-comments');
                 if(comments) comments.value = '';
                 
                 // Regresar a la pantalla de elección (Profesores vs Directivos)
                 showStep('choice');
             } catch(e) {
                 console.error(e);
                 alert("⚠️ Hubo un problema al actualizar el historial. Intenta de nuevo.");
             } finally {
                 hideLoader();
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
        
        // Dots de progreso
        document.querySelectorAll('.step-dot').forEach(d => d.classList.remove('active'));
        if(s === 'login') document.getElementById('dot-1').classList.add('active');
        if(s === 'choice' || s === 'teachers') document.getElementById('dot-2').classList.add('active');
        if(s === 'survey' || s === 'success') document.getElementById('dot-3').classList.add('active');
        
        window.scrollTo(0,0);
        feather.replace();
    }

    // --- 3. CARGA DE LISTAS ---
    function loadTeachers(grupo) {
        const container = document.getElementById('teacher-list');
        const title = document.querySelector('#step-teachers h2');
        title.innerHTML = `<i data-feather="users"></i> Profesores del Grupo ${grupo}`;
        container.innerHTML = '';
        
        const clean = (g) => String(g).replace(/[^0-9]/g, '');
        const targetClean = clean(grupo);
        const pActivo = "Semestral"; // Evaluación fija de semestre

        const misMaestros = (allData.directorio || []).filter(d => clean(d.grupo) === targetClean);
        
        // Deduplicar por si el maestro da más de una materia en el mismo grupo
        const docentesUnicos = {};
        misMaestros.forEach(m => {
            if(!docentesUnicos[m.docente]) docentesUnicos[m.docente] = m;
        });

        renderList(Object.values(docentesUnicos), container, pActivo);
    }

    function loadDirectors() {
        const container = document.getElementById('teacher-list');
        const title = document.querySelector('#step-teachers h2');
        title.innerHTML = '<i data-feather="briefcase"></i> Cuerpo Directivo';
        container.innerHTML = '';

        const directivos = [
            { docente: "DIRECTORA DEL PLANTEL", materia: "Gestión Directiva", isDirector: true },
            { docente: "SUBDIRECTOR ACADÉMICO", materia: "Planteamiento Académico", isDirector: true }
        ];

        const pActivo = "Semestral"; // Evaluación fija de semestre
        renderList(directivos, container, pActivo);
    }

    function renderList(items, container, pActivo) {
        // Historial (para no calificar dos veces)
        const historial = allData.feedbackHistory || [];

        if(items.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:#64748b; padding:2rem;">No se encontraron docentes asignados.</p>';
            return;
        }

        items.forEach(m => {
            const yaEvaluado = historial.some(h => 
                String(h.parcial) === pActivo && 
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
                <div style="background:${yaEvaluado ? '#d1fae5' : '#f5f3ff'}; width:42px; height:42px; border-radius:12px; display:flex; align-items:center; justify-content:center; color:${yaEvaluado ? '#10b981' : '#6366f1'};">
                    <i data-feather="${yaEvaluado ? 'check-circle' : (m.isDirector ? 'award' : 'user')}"></i>
                </div>
                <div style="flex:1;">
                    <div style="font-weight:800; color:#1e293b; font-size:0.95rem;">${m.docente}</div>
                    <div style="font-size:0.75rem; color:#64748b; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">${m.materia}</div>
                </div>
                ${yaEvaluado ? '<span style="font-size:0.65rem; font-weight:800; color:#059669; padding:2px 8px; border-radius:6px; border:1px solid #10b981;">LISTO</span>' : '<i data-feather="chevron-right" style="width:18px; color:#cbd5e1;"></i>'}
            `;
            
            if (!yaEvaluado) btn.onclick = () => openSurvey(m);
            container.appendChild(btn);
        });
        feather.replace();
    }

    // --- 4. FORMULARIO DE EVALUACIÓN ---
    const criteriosDocentes = [
        { id: 'c1', texto: '1. ¿El profesor explica con claridad los temas y resuelve tus dudas?' },
        { id: 'c2', texto: '2. ¿Te trata con respeto, amabilidad y fomenta un buen ambiente?' },
        { id: 'c3', texto: '3. ¿Demuestra dominio y conocimiento profundo de su materia?' },
        { id: 'c4', texto: '4. ¿Es organizado con el tiempo y cumple con los acuerdos de evaluación?' }
    ];

    const criteriosDirectivos = [
        { id: 'c1', texto: '1. Gestión Institucional: ¿Qué tan efectiva es la dirección para resolver problemas y atender las necesidades del plantel?' },
        { id: 'c2', texto: '2. Atención a la Comunidad: ¿Qué tan satisfecho estás con la atención, disponibilidad y trato que brindan a los padres y alumnos?' },
        { id: 'c3', texto: '3. Clima y Seguridad: ¿Qué tanto se esfuerza la dirección por garantizar un ambiente de seguridad, orden y sana convivencia?' },
        { id: 'c4', texto: '4. Comunicación y Cumplimiento: ¿Consideras que la dirección informa con claridad y cumple con los acuerdos realizados con la comunidad?' }
    ];

    function openSurvey(m) {
        selectedTeacher = m;
        document.getElementById('eval-teacher-name').textContent = m.docente;
        document.getElementById('eval-subject-name').textContent = m.materia;
        
        const container = document.getElementById('encuesta-form');
        container.innerHTML = '';
        ratings = { c1:0, c2:0, c3:0, c4:0 };

        const listaCriterios = m.isDirector ? criteriosDirectivos : criteriosDocentes;

        listaCriterios.forEach(crit => {
            const div = document.createElement('div');
            div.style.marginBottom = '2rem';
            div.innerHTML = `
                <label style="display:block; font-weight:700; font-size:1rem; color:#1e293b; margin-bottom:0.75rem; line-height:1.4;">${crit.texto}</label>
                <div class="star-rating" data-crit="${crit.id}" style="display:flex; gap:12px; justify-content:center;">
                    ${[1,2,3,4,5].map(n => `
                        <div class="star-box" data-val="${n}" style="cursor:pointer; transition: transform 0.2s;">
                            <i data-feather="star" style="width:32px; height:32px; fill:none; color:#cbd5e1;"></i>
                        </div>
                    `).join('')}
                </div>
                <div style="display:flex; justify-content:space-between; width:100%; font-size:0.65rem; color:#94a3b8; font-weight:700; margin-top:8px;">
                    <span>POBRE</span>
                    <span>EXCELENTE</span>
                </div>
            `;
            container.appendChild(div);
        });

        feather.replace();
        initStarEvents();
        showStep('survey');
    }

    function initStarEvents() {
        document.querySelectorAll('.star-box').forEach(box => {
            box.onclick = (e) => {
                const parent = box.closest('.star-rating');
                if (!parent) return;
                
                const val = parseInt(box.dataset.val);
                const critId = parent.dataset.crit;
                ratings[critId] = val;
                
                // Colorización interactiva
                parent.querySelectorAll('.star-box').forEach(b => {
                    const bVal = parseInt(b.dataset.val);
                    const icon = b.querySelector('svg'); // Feather reemplaza <i> por <svg>
                    if(icon) {
                        if(bVal <= val) {
                            icon.style.stroke = '#f59e0b'; // stroke en lugar de color
                            icon.style.fill = '#f59e0b';
                            b.style.transform = 'scale(1.15)';
                        } else {
                            icon.style.stroke = '#cbd5e1';
                            icon.style.fill = 'none';
                            b.style.transform = 'scale(1)';
                        }
                    }
                });
            };
        });
    }

    const btnBackList = document.getElementById('btn-back-to-list');
    if(btnBackList) {
        btnBackList.onclick = () => {
            if (selectedTeacher && selectedTeacher.isDirector) loadDirectors();
            else loadTeachers(selectedStudent.grupo);
            showStep('teachers');
        };
    }

    const btnSubmit = document.getElementById('btn-submit-eval');
    if(btnSubmit) {
        btnSubmit.onclick = async () => {
            // Validación: Todas las estrellas deben estar seleccionadas
            if(Object.values(ratings).some(v => v === 0)) {
                alert("⚠️ Por favor selecciona una calificación con estrellas para todas las preguntas.");
                return;
            }

            showLoader();
            const payload = {
                action: 'eval-docente',
                parcial: 'Semestral',
                alumno: selectedStudent.nombre,
                grupo: selectedStudent.grupo,
                docente: selectedTeacher.docente,
                materia: selectedTeacher.materia,
                c1: ratings.c1,
                c2: ratings.c2,
                c3: ratings.c3,
                c4: ratings.c4,
                comentarios: document.getElementById('eval-comments').value
            };

            window._log("DEBUG - Enviando Encuesta:", payload);

            try {
                // Usamos la API configurada
                // Nota: la API de GAS requiere POST con JSON
                const response = await fetch(api.GOOGLE_SHEETS_API_URL || "https://script.google.com/macros/s/AKfycbz4q9VlhAvvVJ1XYOwqNTJ9eMkVRm3HgoyFJNpEQaPJsDdK1JcfhbTX1CRfDg38x79fsA/exec", {
                    method: 'POST',
                    mode: 'no-cors', // Para evitar problemas de CORS en GAS
                    body: JSON.stringify(payload)
                });
                
                // Como usamos no-cors, no podemos leer el JSON de respuesta fácilmente, 
                // pero si no hay error de red, asumimos éxito tras un delay.
                setTimeout(() => {
                    showStep('success');
                }, 1000);
            } catch (e) {
                console.error(e);
                alert("Hubo un problema al enviar tu encuesta: " + e.message);
            } finally {
                hideLoader();
            }
        };
    }

    // Iniciar!
    init();
})();
