/* pec/js/app_calendario.js */

/**
 * CONFIGURACIÓN DE FECHAS CLAVE - SEMESTRE B 2026
 * Edita esta constante para agregar o modificar eventos sin tocar el backend.
 */
const FECHAS_CLAVE = [
  { 
    id: "fc001",
    titulo: "Inicio de clases", 
    fecha: "2026-02-11", 
    categoria: "academico", 
    prioridad: "alta",
    descripcion: "Arranque oficial del semestre B 2026.",
    visible: true 
  },
  { 
    id: "fc002",
    titulo: "Inicio primer parcial", 
    fecha: "2026-02-11", 
    categoria: "evaluacion", 
    visible: true 
  },
  { 
    id: "fc003",
    titulo: "Fin primer parcial", 
    fecha: "2026-03-20", 
    categoria: "evaluacion", 
    visible: true 
  },
  { 
    id: "fc004",
    titulo: "Inicio segundo parcial", 
    fecha: "2026-03-23", 
    categoria: "evaluacion", 
    visible: true 
  },
  { 
    id: "fc005",
    titulo: "Fin segundo parcial", 
    fecha: "2026-05-08", 
    categoria: "evaluacion", 
    visible: true 
  },
  { 
    id: "fc006",
    titulo: "Inicio tercer parcial", 
    fecha: "2026-05-11", 
    categoria: "evaluacion", 
    visible: true 
  },
  { 
    id: "fc007",
    titulo: "No realizar modificaciones", 
    fecha: "2026-05-12", 
    categoria: "restriccion", 
    prioridad: "alta",
    descripcion: "Día bloqueado para evitar cambios en el sistema.",
    estadoManual: "restriccion",
    visible: true,
    observaciones: "Respetar fecha institucional."
  },
  { 
    id: "fc008",
    titulo: "Reunión con padres", 
    fecha: "2026-05-13", 
    hora: "07:00", 
    categoria: "reunion", 
    prioridad: "alta",
    descripcion: "Entrega de boletas y reunión con padres.",
    visible: true 
  },
  { 
    id: "fc009",
    titulo: "Entrega de calificaciones segundo parcial", 
    fecha: "2026-05-13", 
    categoria: "control", 
    visible: true 
  },
  { 
    id: "fc010",
    titulo: "Entrega de calificaciones intrasemestrales", 
    fecha: "2026-05-20", 
    categoria: "control", 
    visible: true 
  },
  { 
    id: "fc011",
    titulo: "Fin tercer parcial", 
    fecha: "2026-06-11", 
    categoria: "evaluacion", 
    visible: true 
  },
  { 
    id: "fc012",
    titulo: "Inicio evaluación final", 
    fecha: "2026-06-12", 
    categoria: "evaluacion", 
    visible: true 
  },
  { 
    id: "fc013",
    titulo: "Fin de clases", 
    fecha: "2026-06-19", 
    categoria: "academico", 
    visible: true 
  },
  { 
    id: "fc014",
    titulo: "Captura de actas finales", 
    fecha: "2026-06-22", 
    categoria: "control", 
    visible: true 
  },
  { 
    id: "fc015",
    titulo: "Reunión previa intersemestral", 
    fecha: "2026-06-25", 
    categoria: "academico", 
    visible: true 
  },
  { 
    id: "fc016",
    titulo: "Inicio intersemestral", 
    fecha: "2026-06-26", 
    categoria: "academico", 
    visible: true 
  },
  { 
    id: "fc017",
    titulo: "Entrega de calificaciones intersemestral", 
    fecha: "2026-07-10", 
    categoria: "control", 
    visible: true 
  }
];

// Estado global del componente
let viewMode = 'grouped'; // 'grouped' o 'list'

document.addEventListener("DOMContentLoaded", () => {
    if (window.feather) feather.replace();

    const userName = sessionStorage.getItem('user_name');
    if (userName) {
        const userNameEl = document.getElementById('topbar-user-name');
        if (userNameEl) userNameEl.textContent = userName;
    }

    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });
    }

    initCalendario();
});

function initCalendario() {
    const container = document.getElementById('calendario-container');
    if (!container) return;

    container.innerHTML = `
        <div class="calendario-header">
            <div>
                <h2>📅 Calendario Institucional 2026-B</h2>
                <p style="margin: 5px 0 0; opacity: 0.8; font-size: 0.9rem;">Fechas clave, cierres y eventos administrativos</p>
            </div>
            <div class="view-type-toggle">
                <button class="view-btn ${viewMode === 'grouped' ? 'active' : ''}" id="view-grouped">Tarjetas</button>
                <button class="view-btn ${viewMode === 'list' ? 'active' : ''}" id="view-list">Lista</button>
            </div>
        </div>
        <div id="calendario-content">
            <!-- Eventos inyectados -->
        </div>
    `;

    renderEventos();

    // Eventos de toggle
    document.getElementById('view-grouped').addEventListener('click', () => {
        if (viewMode === 'grouped') return;
        viewMode = 'grouped';
        updateToggleButtons();
        renderEventos();
    });
    
    document.getElementById('view-list').addEventListener('click', () => {
        if (viewMode === 'list') return;
        viewMode = 'list';
        updateToggleButtons();
        renderEventos();
    });
};

function updateToggleButtons() {
    document.getElementById('view-grouped').classList.toggle('active', viewMode === 'grouped');
    document.getElementById('view-list').classList.toggle('active', viewMode === 'list');
}

function renderEventos() {
    const content = document.getElementById('calendario-content');
    if (!content) return;

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const proximos7Dias = new Date(hoy);
    proximos7Dias.setDate(hoy.getDate() + 7);

    // Filtrar y ordenar cronológicamente
    let eventos = FECHAS_CLAVE
        .filter(ev => ev.visible !== false)
        .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    if (eventos.length === 0) {
        content.innerHTML = '<p style="text-align:center; padding: 3rem; color: #64748b;">No hay eventos programados.</p>';
        return;
    }

    if (viewMode === 'grouped') {
        const agrupar = agruparPorMes(eventos);
        content.innerHTML = Object.keys(agrupar).map(mesKey => {
            const [year, month] = mesKey.split('-');
            const nombreMes = obtenerNombreMes(month);
            return `
                <div class="mes-seccion">
                    <h3 class="mes-titulo">${nombreMes} ${year}</h3>
                    <div class="calendario-grid">
                        ${agrupar[mesKey].map(ev => renderEventoCard(ev, hoy, proximos7Dias)).join('')}
                    </div>
                </div>
            `;
        }).join('');
    } else {
        content.innerHTML = `<div class="calendario-grid">${eventos.map(ev => renderEventoCard(ev, hoy, proximos7Dias)).join('')}</div>`;
    }

    if (window.feather) feather.replace();
}

function renderEventoCard(ev, hoy, proximos7Dias) {
    const fechaEv = new Date(ev.fecha + 'T00:00:00');
    const estadoObj = calcularEstado(ev, fechaEv, hoy, proximos7Dias);
    
    return `
        <div class="evento-card ${estadoObj.clase}">
            <div class="evento-header">
                <span class="evento-badge badge-${estadoObj.valor}">${estadoObj.label}</span>
                ${ev.prioridad === 'alta' ? '<i data-feather="alert-circle" style="color:#ef4444; width:18px;"></i>' : ''}
            </div>
            <div class="evento-info">
                <h3 class="evento-titulo">${ev.titulo}</h3>
                <div class="evento-meta">
                    <i data-feather="calendar"></i>
                    <span>${formatearFecha(ev.fecha)}</span>
                </div>
                ${ev.hora ? `
                <div class="evento-meta">
                    <i data-feather="clock"></i>
                    <span>${ev.hora} hrs</span>
                </div>` : ''}
                ${ev.descripcion ? `<p class="evento-desc">${ev.descripcion}</p>` : ''}
            </div>
            <div class="evento-footer">
                <span class="evento-categoria">${ev.categoria}</span>
                ${ev.observaciones ? `<span class="evento-obs">${ev.observaciones}</span>` : ''}
            </div>
        </div>
    `;
}

function agruparPorMes(eventos) {
    const grupos = {};
    eventos.forEach(ev => {
        const [year, month, day] = ev.fecha.split('-');
        const key = `${year}-${month}`;
        if (!grupos[key]) grupos[key] = [];
        grupos[key].push(ev);
    });
    return grupos;
}

function obtenerNombreMes(monthNumber) {
    const meses = [
        "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
        "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"
    ];
    return meses[parseInt(monthNumber, 10) - 1];
}

function calcularEstado(ev, fechaEv, hoy, proximos7Dias) {
    if (ev.estadoManual) {
        let label = ev.estadoManual.charAt(0).toUpperCase() + ev.estadoManual.slice(1);
        if (ev.estadoManual === 'restriccion') label = 'RESTRICCIÓN';
        return { valor: ev.estadoManual, label: label, clase: ev.estadoManual };
    }
    if (fechaEv < hoy) return { valor: "realizado", label: "REALIZADO", clase: "realizado" };
    if (fechaEv <= proximos7Dias) return { valor: "proximo", label: "PRÓXIMO", clase: "proximo" };
    return { valor: "pendiente", label: "PENDIENTE", clase: "pendiente" };
}

function formatearFecha(fechaStr) {
    const opciones = { weekday: 'long', day: 'numeric', month: 'long' };
    const date = new Date(fechaStr + 'T00:00:00');
    return date.toLocaleDateString('es-MX', opciones).toUpperCase();
}

window.logout = function() {
    sessionStorage.clear();
    window.location.href = 'login.html';
};
