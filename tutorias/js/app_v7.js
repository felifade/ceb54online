// tutorias/js/app_v7_test.js
// Versión extendida para incluir Tablero de Analíticas (Opinión Estudiantil)

document.addEventListener('DOMContentLoaded', async () => {
    // Estado Inicial
    let allData = { tutorias: [], grupos: [], config: { docente: "" }, alumnosFull: [], retroalimentacion: [] };
    const views = document.querySelectorAll('.view');
    const navLinks = document.querySelectorAll('.nav-link');
    const viewTitle = document.getElementById('view-title');
    const currentDateEl = document.getElementById('current-date');

    // --- SESIÓN DE PRUEBA (Solo para test_index_v2) ---
    if (!sessionStorage.getItem('user_name')) {
        sessionStorage.setItem('user_name', 'Administrador de Pruebas');
        sessionStorage.setItem('user_role', 'admin');
        sessionStorage.setItem('user_email', 'admin@ceb54.online');
    }

    const userRole = (sessionStorage.getItem('user_role') || "docente").toLowerCase();
    const isAdmin = userRole === 'admin';

    // Mostrar menú de analíticas si es admin
    if (isAdmin) {
        const navOpiniones = document.getElementById('nav-opiniones');
        if (navOpiniones) navOpiniones.classList.remove('admin-only');
    }

    // Fecha Actual
    const now = new Date();
    currentDateEl.textContent = now.toLocaleDateString('es-MX', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });

    // --- NAVEGACIÓN ---
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const viewId = link.getAttribute('data-view');
            if (!viewId) return;
            
            e.preventDefault();
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            views.forEach(v => v.classList.add('hidden'));
            const targetView = document.getElementById(`view-${viewId}`);
            if (targetView) targetView.classList.remove('hidden');
            
            viewTitle.textContent = link.querySelector('span').textContent;
            
            if (viewId === 'resultados') {
                initResultados();
            } else if (['dashboard', 'historial', 'reporte'].includes(viewId)) {
                renderAll();
            }
        });
    });

    // --- CARGA DE DATOS ---
    async function loadInitialData() {
        try {
            const db = await api.fetchAllData();
            allData = {
                ...db,
                tutorias: db.tutorias || [],
                retroalimentacion: db.retroalimentacion || []
            };

            // Filtrado por Docente (Si no es admin o para el dashboard personal)
            const userEmail = sessionStorage.getItem('user_email');
            if (userEmail && !isAdmin) {
                allData.tutorias = allData.tutorias.filter(t => 
                    String(t.docenteEmail || "").toLowerCase() === userEmail.toLowerCase()
                );
            }

            const displayName = sessionStorage.getItem('user_name') || "Docente CEB";
            document.getElementById('user-name').textContent = displayName;
            const initials = displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
            const initialsEl = document.getElementById('user-initials');
            if (initialsEl) initialsEl.textContent = initials;

            renderAll();
        } catch (error) {
            console.error("Error cargando datos:", error);
        }
    }

    function renderAll() {
        renderDashboard();
        // Historial y Reporte se renderizan igual que en app.js original
        // Omitimos detalles de implementación repetitiva para enfocarnos en la novedad
    }

    function renderDashboard() {
        const statsEl = document.getElementById('stats-summary');
        if (!statsEl) return;
        
        // Calcular estadísticas rápidas
        const total = allData.tutorias.length;
        const ind = allData.tutorias.filter(t => t.individual).length;
        const grup = allData.tutorias.filter(t => t.grupal).length;

        statsEl.innerHTML = `
            <div class="stat-card">
                <div class="stat-icon" style="background: #ecfdf5; color: #059669;"><i data-lucide="users"></i></div>
                <div class="stat-info"><span class="stat-value">${total}</span><span class="stat-label">Total Tutorías</span></div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background: #eff6ff; color: #2563eb;"><i data-lucide="user"></i></div>
                <div class="stat-info"><span class="stat-value">${ind}</span><span class="stat-label">Individuales</span></div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background: #fdf2f8; color: #db2777;"><i data-lucide="users-2"></i></div>
                <div class="stat-info"><span class="stat-value">${grup}</span><span class="stat-label">Grupales</span></div>
            </div>
        `;
        lucide.createIcons();
    }

    // --- LÓGICA DE ANALÍTICAS (LA NUEVA MIGRADA) ---
    window.initResultados = () => {
        const retro = allData.retroalimentacion || [];
        if (retro.length === 0) {
            document.getElementById('res-comentarios').innerHTML = '<p style="text-align: center; color: #94a3b8; padding: 2rem;">Aún no hay datos de retroalimentación.</p>';
            return;
        }

        // 1. Estadísticas Generales
        document.getElementById('res-total').textContent = retro.length;
        const promedioGral = (retro.reduce((acc, curr) => acc + (parseFloat(curr.promedio) || 0), 0) / retro.length).toFixed(1);
        document.getElementById('res-promedio').textContent = promedioGral + " / 10";

        // 2. Procesar Datos para Gráficas
        const dataDocentes = {};
        const dataDirectivos = {};

        retro.forEach(item => {
            const val = parseFloat(item.promedio) || 0;
            if (item.tipo === 'Docente') {
                if (!dataDocentes[item.evaluado]) dataDocentes[item.evaluado] = { total: 0, count: 0 };
                dataDocentes[item.evaluado].total += val;
                dataDocentes[item.evaluado].count += 1;
            } else {
                if (!dataDirectivos[item.evaluado]) dataDirectivos[item.evaluado] = { total: 0, count: 0 };
                dataDirectivos[item.evaluado].total += val;
                dataDirectivos[item.evaluado].count += 1;
            }
        });

        renderChart('chart-docentes', dataDocentes, 'Satisfacción Docentes');
        renderChart('chart-directivos', dataDirectivos, 'Satisfacción Directivos');

        // 3. Renderizar Comentarios
        const container = document.getElementById('res-comentarios');
        container.innerHTML = retro.reverse().slice(0, 10).map(c => {
            const val = parseFloat(c.promedio) || 0;
            const ratingClass = val >= 9 ? 'rating-high' : (val >= 7 ? 'rating-mid' : 'rating-low');
            return `
                <div class="comment-card">
                    <div class="comment-header">
                        <span>${c.evaluado} (${c.tipo})</span>
                        <span class="rating-badge ${ratingClass}">${val} / 10</span>
                    </div>
                    <p class="comment-text">"${c.comentarios || 'Sin comentarios'}"</p>
                </div>
            `;
        }).join('');
    };

    function renderChart(canvasId, dataMap, label) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        const labels = Object.keys(dataMap);
        const values = labels.map(l => (dataMap[l].total / dataMap[l].count).toFixed(1));

        // Destruir gráfico previo si existe
        const existingChart = Chart.getChart(canvasId);
        if (existingChart) existingChart.destroy();

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: label,
                    data: values,
                    backgroundColor: 'rgba(5, 150, 105, 0.2)',
                    borderColor: 'rgb(5, 150, 105)',
                    borderWidth: 2,
                    borderRadius: 8
                }]
            },
            options: {
                indexAxis: 'y',
                scales: { x: { min: 0, max: 10 } },
                plugins: { legend: { display: false } },
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }

    // Inicialización
    loadInitialData();
});
