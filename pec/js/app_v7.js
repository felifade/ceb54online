// pec/js/app_v7.js
// Versión oficial de producción con soporte para analíticas (Admin)

document.addEventListener("DOMContentLoaded", () => {
    // Inicializar íconos
    feather.replace();

    // --- SEGURIDAD Y SESIÓN (Vía login.html/auth.js) ---
    const userName = sessionStorage.getItem('user_name') || "Docente";
    const userRole = (sessionStorage.getItem('user_role') || "docente").toLowerCase();
    const isAdmin = userRole === 'admin';

    // Establecer UI inicial
    const userNameEl = document.getElementById('topbar-user-name');
    if (userNameEl) userNameEl.textContent = userName;

    // Visibilidad por rol (Solo mostrar analíticas si es admin)
    document.querySelectorAll('.admin-only').forEach(el => {
        if (isAdmin) el.style.display = 'flex';
        else el.style.display = 'none';
    });

    // DOM Elements
    const views = document.querySelectorAll('.view');
    const navItems = document.querySelectorAll('.nav-item');
    const loader = document.getElementById('loading');
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');

    let currentView = 'dashboard';

    // Navegación
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const hasTarget = item.getAttribute('target');
            if (hasTarget) return; 

            e.preventDefault();
            const viewName = item.getAttribute('data-view');
            if (!viewName) return;

            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            views.forEach(v => {
                v.classList.add('hidden');
                v.classList.remove('active');
            });
            
            const selectedView = document.getElementById(`view-${viewName}`);
            if (selectedView) {
                selectedView.classList.remove('hidden');
                selectedView.classList.add('active');
                const titleEl = document.getElementById('view-title');
                if (titleEl) titleEl.textContent = item.querySelector('span').textContent;
                currentView = viewName;
                loadViewData(viewName);
            }

            if(window.innerWidth <= 768 && sidebar) sidebar.classList.remove('open');
        });
    });

    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => sidebar.classList.toggle('open'));
    }

    // Funciones de Carga
    const showLoader = () => loader && loader.classList.remove('hidden');
    const hideLoader = () => loader && loader.classList.add('hidden');

    const loadViewData = async (view) => {
        if (view === 'dashboard') await initDashboard();
        if (view === 'grupos') await initGrupos();
        if (view === 'directorio') await initDirectorio();
    };

    async function initDashboard() {
        showLoader();
        try {
            const data = await api.getDashboardData();
            const gEl = document.getElementById('dash-grupos');
            const aEl = document.getElementById('dash-avance');
            if (gEl) gEl.textContent = data.totalGrupos;
            if (aEl) aEl.textContent = data.avance + "%";
            
            const listGrupos = document.getElementById('dash-lista-grupos');
            if (listGrupos) {
                listGrupos.innerHTML = (data.grupos || []).sort().map(g => `<div class="tag">${g}</div>`).join('');
            }
        } catch (e) { console.error(e); }
        hideLoader();
    }

    async function initGrupos() {
        showLoader();
        const selectGrupo = document.getElementById('select-grupo');
        if (selectGrupo && selectGrupo.options.length <= 1) {
            const data = await api.fetchAllData();
            const grupos = (data.grupos || []).sort();
            grupos.forEach(g => {
                const opt = document.createElement('option');
                opt.value = g; opt.textContent = `Grupo ${g}`;
                selectGrupo.appendChild(opt);
            });
        }
        hideLoader();
    }

    const selectEl = document.getElementById('select-grupo');
    if (selectEl) {
        selectEl.addEventListener('change', async (e) => {
            const grupo = e.target.value;
            const container = document.getElementById('equipos-container');
            if(!grupo || !container) { 
                if(container) container.classList.add('hidden'); 
                return; 
            }
            
            showLoader();
            const equipos = await api.getEquiposPorGrupo(grupo);
            container.innerHTML = equipos.map(eq => `
                <div class="equipo-card">
                    <div class="equipo-header">
                        <h3 class="equipo-title">${eq.nombre}</h3>
                        <span class="badge ${eq.estado === 'Evaluado' ? 'evaluado' : 'pendiente'}">${eq.estado}</span>
                    </div>
                    <div class="equipo-body">
                        <ul class="integrantes-list">${eq.integrantes.map(i => `<li>${i}</li>`).join('')}</ul>
                    </div>
                </div>
            `).join('');
            container.classList.remove('hidden');
            feather.replace();
            hideLoader();
        });
    }

    async function initDirectorio() {
        showLoader();
        const dir = await api.getDirectorio();
        const container = document.getElementById('dir-segundos');
        if (container) {
            container.innerHTML = dir.map(d => `
                <div class="equipo-card" style="padding:1rem;">
                    <strong style="color:var(--clr-primary);">${d.grupo}</strong> - ${d.materia}<br>
                    <small>${d.docente}</small>
                </div>
            `).join('');
        }
        hideLoader();
    }

    // Iniciar Dashboard
    initDashboard();
});
