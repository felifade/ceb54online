/* pec/js/app_calendario.js */

/**
 * CONFIGURACIÓN GLOBAL DEL CALENDARIO ESCOLAR
 */
const CONFIG_CALENDARIO = {
    fechaInicioSemana1: "2026-02-11", // Miércoles
    fechaFinSemestre: "2026-07-30",  // Límite para el cálculo de semanas
    mostrarRangoFechas: true,
};

/**
 * EVENTOS PUNTUALES (Fallback Local)
 */
const FECHAS_CLAVE_FALLBACK = [
    { id: "fc001", titulo: "Inicio de clases",                                    fecha: "2026-02-11", categoria: "academico",   prioridad: "alta", visiblePortalAlumno: true },
    { id: "fc002", titulo: "Inicio primer parcial",                               fecha: "2026-02-11", categoria: "evaluacion",  visiblePortalAlumno: true },
    { id: "fc003", titulo: "Fin primer parcial",                                  fecha: "2026-03-13", categoria: "evaluacion",  visiblePortalAlumno: true },
    { id: "fc004", titulo: "Inicio segundo parcial",                              fecha: "2026-03-16", categoria: "evaluacion",  visiblePortalAlumno: true },
    { id: "fc004", titulo: "Entrega PEC Estudiantes",                             fecha: "2026-04-24", categoria: "evaluacion",  visiblePortalAlumno: true },
    { id: "fc004", titulo: "Captura PEC Docentes",                                fecha: "2026-04-28", categoria: "evaluacion" },
    { id: "fc005", titulo: "Revisión y aclaraciones PEC",                         fecha: "2026-04-29", categoria: "evaluacion",  visiblePortalAlumno: true },
    { id: "fc005", titulo: "Fin segundo parcial",                                 fecha: "2026-04-30", categoria: "evaluacion",  visiblePortalAlumno: true },
    { id: "fc006", titulo: "Inicio tercer parcial",                               fecha: "2026-05-04", categoria: "evaluacion",  visiblePortalAlumno: true },
    { id: "fc006", titulo: "Fecha Limite de Captura",                             fecha: "2026-05-10", categoria: "evaluacion" },
    { id: "fc007", titulo: "No realizar modificaciones Control Escolar",          fecha: "2026-05-12", categoria: "restriccion", estadoManual: "restriccion", prioridad: "alta" },
    { id: "fc008", titulo: "Reunión con padres",                                  fecha: "2026-05-13", hora: "07:00", categoria: "reunion",    prioridad: "alta", visiblePortalAlumno: true },
    { id: "fc009", titulo: "Entrega de calificaciones segundo parcial ambos turnos", fecha: "2026-05-13", categoria: "control",  visiblePortalAlumno: true },
    { id: "fc010", titulo: "Entrega de calificaciones intrasemestrales",          fecha: "2026-05-20", categoria: "control",    visiblePortalAlumno: true },
    { id: "fc012", titulo: "Inicio evaluación final",                             fecha: "2026-06-12", categoria: "evaluacion", visiblePortalAlumno: true },
    { id: "fc013", titulo: "Fin de clases",                                       fecha: "2026-06-19", categoria: "academico",  visiblePortalAlumno: true },
    { id: "fc014", titulo: "Captura de actas finales",                            fecha: "2026-06-22", categoria: "control" },
    { id: "fc015", titulo: "Reunión previa intersemestral",                       fecha: "2026-06-25", categoria: "academico",  visiblePortalAlumno: true },
    { id: "fc016", titulo: "Inicio intersemestral",                               fecha: "2026-06-26", categoria: "academico",  visiblePortalAlumno: true },
    { id: "fc017", titulo: "Entrega de calificaciones intersemestral",            fecha: "2026-07-10", categoria: "control",    visiblePortalAlumno: true }
];

let FECHAS_CLAVE = [];

/**
 * CUMPLEAÑOS (Fallback Local)
 * Se utilizará si la lectura desde Google Sheets falla o está vacía.
 */
const CUMPLEANOS_FALLBACK = [
    { nombre: "José Alfredo Agudo García", fecha: "2026-11-29", cargo: "Docente" },
    { nombre: "Irma Alvarez Pérez", fecha: "2026-05-20", cargo: "Docente" },
    { nombre: "Elvia Abigail Arenas Orozco", fecha: "2026-07-29", cargo: "Docente" },
    { nombre: "Alicia Arias Licea", fecha: "2026-01-21", cargo: "Docente" },
    { nombre: "Alicia Arteaga Badillo", fecha: "2026-06-23", cargo: "Docente" },
    { nombre: "Fabiola Alejandra Becerra Hernández", fecha: "2026-08-09", cargo: "Docente" },
    { nombre: "Antolín Blancas Hernández", fecha: "2026-09-02", cargo: "Docente" },
    { nombre: "Yessica Yoselin Blancas Ventura", fecha: "2026-03-21", cargo: "Docente" },
    { nombre: "José Mauro Roberto Bustamante Abonce", fecha: "2026-11-21", cargo: "Docente" },
    { nombre: "Laura María Cadena Galindo", fecha: "2026-04-08", cargo: "Docente" },
    { nombre: "Rosalia Camargo Azpeitia", fecha: "2026-05-09", cargo: "Docente" },
    { nombre: "Pedro Camargo Contreras", fecha: "2026-03-30", cargo: "Docente" },
    { nombre: "Teresa Cano López", fecha: "2026-05-03", cargo: "Docente" },
    { nombre: "Ángela Gabriela Canseco Prado", fecha: "2026-07-06", cargo: "Docente" },
    { nombre: "Gabriel Canseco Prado", fecha: "2026-01-04", cargo: "Docente" },
    { nombre: "Germán Canuto Chávez", fecha: "2026-05-28", cargo: "Docente" },
    { nombre: "Claudia Carranza Quíroz", fecha: "2026-01-15", cargo: "Docente" },
    { nombre: "Javier Castillo Cruz", fecha: "2026-10-03", cargo: "Docente" },
    { nombre: "Verónica Dolores Castillo Moreno", fecha: "2026-03-24", cargo: "Docente" },
    { nombre: "Miguel Ángel Cervantes Guevara", fecha: "2026-10-31", cargo: "Docente" },
    { nombre: "Luis Antonio Covarrubias Sánchez", fecha: "2026-12-04", cargo: "Docente" },
    { nombre: "Leticia Enriquez Aguilar", fecha: "2026-01-09", cargo: "Docente" },
    { nombre: "Martín Espinosa Arteaga", fecha: "2026-02-02", cargo: "Docente" },
    { nombre: "Guillermo Estrada Contreras", fecha: "2026-02-25", cargo: "Docente" },
    { nombre: "Martha Flores Mendoza", fecha: "2026-12-14", cargo: "Docente" },
    { nombre: "Juana María García López", fecha: "2026-01-26", cargo: "Docente" },
    { nombre: "Marisandra García Máximo", fecha: "2026-09-28", cargo: "Docente" },
    { nombre: "Erika Itzel Gayosso Tolentino", fecha: "2026-07-17", cargo: "Docente" },
    { nombre: "Edgar Gomez Castillo", fecha: "2026-07-20", cargo: "Docente" },
    { nombre: "José González Hernández", fecha: "2026-01-17", cargo: "Docente" },
    { nombre: "Claudia Nayeli González Gardini", fecha: "2026-04-08", cargo: "Docente" },
    { nombre: "Laura González Munive", fecha: "2026-10-19", cargo: "Docente" },
    { nombre: "Sivonney Hernández Camargo", fecha: "2026-09-07", cargo: "Docente" },
    { nombre: "Luis Ignacio Hernández Hernández", fecha: "2026-03-24", cargo: "Docente" },
    { nombre: "Martín Hernández López", fecha: "2026-10-24", cargo: "Docente" },
    { nombre: "José Yoshimar Hernández Ortíz", fecha: "2026-12-15", cargo: "Docente" },
    { nombre: "Luis Francisco Hernández Picazo", fecha: "2026-04-02", cargo: "Docente" },
    { nombre: "Soila Hernández Vargas", fecha: "2026-09-11", cargo: "Docente" },
    { nombre: "Alfonso Herrera Gómez", fecha: "2026-04-11", cargo: "Docente" },
    { nombre: "Lirio Yuselín Islas Montes", fecha: "2026-12-10", cargo: "Docente" },
    { nombre: "Aurora Juárez Flores", fecha: "2026-09-10", cargo: "Docente" },
    { nombre: "Elsa Erika Jurado Hernández", fecha: "2026-01-09", cargo: "Docente" },
    { nombre: "José Luis López Mejía", fecha: "2026-05-06", cargo: "Docente" },
    { nombre: "Martha María López García", fecha: "2026-08-28", cargo: "Docente" },
    { nombre: "Felipe López Salazar", fecha: "2026-03-22", cargo: "Docente" },
    { nombre: "Luz María del Carmen López Vázquez", fecha: "2026-08-04", cargo: "Docente" },
    { nombre: "Gustavo León Lugo Cabrera", fecha: "2026-04-12", cargo: "Docente" },
    { nombre: "Daniel Martínez Flores", fecha: "2026-12-10", cargo: "Docente" },
    { nombre: "Grindelia Martínez Flores", fecha: "2026-11-29", cargo: "Docente" },
    { nombre: "Martín Martínez Ruíz", fecha: "2026-01-13", cargo: "Docente" },
    { nombre: "María de la Luz Melo Balderas", fecha: "2026-04-15", cargo: "Docente" },
    { nombre: "María Isabel Mendoza García", fecha: "2026-04-22", cargo: "Docente" },
    { nombre: "Hernán Saide Oviedo Juárez", fecha: "2026-12-02", cargo: "Docente" },
    { nombre: "Ana Karen Pedraza Espinosa", fecha: "2026-10-22", cargo: "Docente" },
    { nombre: "Olga Leticia Priego Cardoza", fecha: "2026-11-10", cargo: "Docente" },
    { nombre: "Jaime Abraham Ramírez Enciso", fecha: "2026-08-22", cargo: "Docente" },
    { nombre: "Diana Bethsabe Ríos Silva", fecha: "2026-12-03", cargo: "Docente" },
    { nombre: "María Elena Rubio García", fecha: "2026-08-18", cargo: "Docente" },
    { nombre: "Jerusalén Sánchez Meza", fecha: "2026-08-30", cargo: "Docente" },
    { nombre: "Julia Dallan Trejo Martínez", fecha: "2026-04-21", cargo: "Docente" },
    { nombre: "Ismael Vázquez Alamilla", fecha: "2026-04-14", cargo: "Docente" },
    { nombre: "Jorge Daivids Vilchis Aldana", fecha: "2026-04-30", cargo: "Docente" },
    { nombre: "Elizabeth Villegas Sánchez", fecha: "2026-11-06", cargo: "Docente" },
    { nombre: "Sandra María del Rocio Zamudio Fonseca", fecha: "2026-04-16", cargo: "Docente" },
];

// Esta variable se llenará dinámicamente o usará el fallback.
let CUMPLEANOS = [];

/**
 * PERIODOS ESPECIALES (Fallback Local)
 */
const PERIODOS_ESPECIALES_FALLBACK = [
    { titulo: "Suspensión de labores", fecha: "2026-05-01", categoria: "festivo", tipo: "dia" },
    { titulo: "Batalla de Puebla", fecha: "2026-05-05", categoria: "festivo", tipo: "dia" },
    { titulo: "Día del Maestro", fecha: "2026-05-15", categoria: "festivo", tipo: "dia" },
    { titulo: "Receso escolar (Vacaciones)", inicio: "2026-03-30", fin: "2026-04-10", categoria: "vacaciones", tipo: "periodo" },
];

let PERIODOS_ESPECIALES = [];

let viewMode = 'grouped';
let cronogramaMap = null;

// Convertir a async para poder cargar datos desde Google Sheets
document.addEventListener("DOMContentLoaded", async () => {
    if (window.feather) feather.replace();
    const userName = sessionStorage.getItem('user_name');
    if (userName && document.getElementById('topbar-user-name')) {
        document.getElementById('topbar-user-name').textContent = userName;
    }
    const menuToggle = document.getElementById('menu-toggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));
    }

    // -- FASE 2: Carga de BD Calendario (Eventos, Periodos, Cumpleaños) --
    if (window.apiCalendario) {
        const datos = await window.apiCalendario.fetchDatosCalendario();
        if (datos && (datos.cumpleanos.length > 0 || datos.eventos.length > 0)) {
            const visibles = arr => arr.filter(item => String(item.visible).toUpperCase() !== 'NO');
            
            CUMPLEANOS = visibles(datos.cumpleanos);
            
            const eventosGSheet = visibles(datos.eventos);
            
            FECHAS_CLAVE = eventosGSheet.filter(e => String(e.tipo).toLowerCase() === 'evento').map(e => ({
                id: e.titulo.replace(/\s+/g, ''),
                titulo: e.titulo,
                fecha: e.fecha_inicio,
                hora: e.hora || "",
                categoria: e.categoria || "evento",
                prioridad: e.prioridad || "",
                descripcion: e.descripcion || "",
                visiblePortalAlumno: String(e.portal_alumno || "no").toUpperCase() === "SI"
            }));

            PERIODOS_ESPECIALES = eventosGSheet.filter(e => String(e.tipo).toLowerCase() === 'periodo').map(p => ({
                titulo: p.titulo,
                inicio: p.fecha_inicio,
                fin: p.fecha_fin || p.fecha_inicio,
                categoria: p.categoria || "periodo",
                tipo: "periodo"
            }));

            console.log("Calendario: Datos cargados desde Sheets.");
        } else {
            // GAS respondió pero sin datos — usar fallback local
            CUMPLEANOS        = CUMPLEANOS_FALLBACK;
            FECHAS_CLAVE      = FECHAS_CLAVE_FALLBACK;
            PERIODOS_ESPECIALES = PERIODOS_ESPECIALES_FALLBACK;
            console.warn("Calendario: GAS sin datos — usando fallback local.");
        }
    } else {
        // apiCalendario no disponible — usar fallback local
        CUMPLEANOS        = CUMPLEANOS_FALLBACK;
        FECHAS_CLAVE      = FECHAS_CLAVE_FALLBACK;
        PERIODOS_ESPECIALES = PERIODOS_ESPECIALES_FALLBACK;
        console.warn("Calendario: apiCalendario no disponible — usando fallback local.");
    }

    // Generar el cronograma cronológico primero
    cronogramaMap = generarCronogramaEfectivo();
    initCalendario();

    // Disparar evento para que widgets en otras páginas sepan que ya pueden renderizar
    document.dispatchEvent(new Event('calendarioDataLista'));
});

/**
 * Genera el mapa cronológico completo de semanas del semestre
 */
function generarCronogramaEfectivo() {
    const cronograma = [];
    const fechaInicio = new Date(CONFIG_CALENDARIO.fechaInicioSemana1 + 'T00:00:00');
    const fechaFin = new Date(CONFIG_CALENDARIO.fechaFinSemestre + 'T23:59:59');

    let curIni = new Date(fechaInicio);
    let curFin = new Date(fechaInicio);
    // La Semana 1 termina el domingo de esa misma semana
    curFin.setDate(fechaInicio.getDate() + (7 - fechaInicio.getDay()) % 7);
    curFin.setHours(23, 59, 59, 999);

    let numAcademica = 0; // Solo cuenta semanas NO vacacionales

    while (curIni <= fechaFin) {
        const esVacaciones = esSemanaDePausa(curIni, curFin);

        // Las semanas vacacionales no incrementan el contador académico
        if (!esVacaciones) numAcademica++;

        cronograma.push({
            num:          esVacaciones ? 0 : numAcademica,
            label:        esVacaciones ? 'VACACIONAL' : `SEMANA ${numAcademica}`,
            start:        new Date(curIni),
            end:          new Date(curFin),
            esVacaciones: esVacaciones
        });

        curIni = new Date(curFin);
        curIni.setDate(curFin.getDate() + 1);
        curIni.setHours(0, 0, 0, 0);
        curFin = new Date(curIni);
        curFin.setDate(curIni.getDate() + 6);
        curFin.setHours(23, 59, 59, 999);
    }
    return cronograma;
}

function esSemanaDePausa(start, end) {
    return PERIODOS_ESPECIALES.some(p => {
        if (p.categoria !== 'vacaciones') return false;
        const pStart = new Date(p.inicio + 'T00:00:00');
        const pEnd = new Date(p.fin + 'T23:59:59');
        return (start <= pEnd && end >= pStart);
    });
}

function getInfoSemana(fechaStr) {
    const d = new Date(fechaStr + 'T00:00:00');
    return cronogramaMap.find(s => d >= s.start && d <= s.end);
}

function initCalendario() {
    const container = document.getElementById('calendario-container');
    if (!container) return;

    container.innerHTML = `
        <div class="calendario-header">
            <div>
                <h2>📅 Planeación Semestral 2026-B</h2>
                <p style="margin: 5px 0 0; opacity: 0.8; font-size: 0.9rem;">Todas las semanas escolares disponibles para planeación</p>
            </div>
            <div class="view-type-toggle">
                <button class="view-btn ${viewMode === 'grouped' ? 'active' : ''}" id="view-grouped">Calendario</button>
                <button class="view-btn ${viewMode === 'list' ? 'active' : ''}" id="view-list">Sólo Eventos</button>
                <button class="view-btn ${viewMode === 'birthdays' ? 'active' : ''}" id="view-birthdays">🎂 Cumpleaños</button>
                <button class="view-btn ${viewMode === 'dias' ? 'active' : ''}" id="view-dias" style="border-color:rgba(124,58,237,0.4);${viewMode==='dias'?'':'color:#7c3aed;'}">🧪 Por días</button>
            </div>
        </div>
        <div id="calendario-content"></div>
    `;

    renderEventos();

    document.getElementById('view-grouped').addEventListener('click', () => {
        if (viewMode === 'grouped') return;
        viewMode = 'grouped';
        renderEventos();
        updateToggles();
    });
    document.getElementById('view-list').addEventListener('click', () => {
        if (viewMode === 'list') return;
        viewMode = 'list';
        renderEventos();
        updateToggles();
    });
    document.getElementById('view-birthdays').addEventListener('click', () => {
        if (viewMode === 'birthdays') return;
        viewMode = 'birthdays';
        renderEventos();
        updateToggles();
    });
    document.getElementById('view-dias').addEventListener('click', () => {
        if (viewMode === 'dias') return;
        viewMode = 'dias';
        renderEventos();
        updateToggles();
    });
}

function updateToggles() {
    document.getElementById('view-grouped').classList.toggle('active', viewMode === 'grouped');
    document.getElementById('view-list').classList.toggle('active', viewMode === 'list');
    const bBtn = document.getElementById('view-birthdays');
    if (bBtn) bBtn.classList.toggle('active', viewMode === 'birthdays');
    const dBtn = document.getElementById('view-dias');
    if (dBtn) dBtn.classList.toggle('active', viewMode === 'dias');
}

function renderEventos() {
    const content = document.getElementById('calendario-content');
    if (!content) return;

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    let items = [
        ...FECHAS_CLAVE.map(ev => ({ ...ev, tipo: 'evento' })),
        ...PERIODOS_ESPECIALES.map(p => ({ ...p, tipo: p.tipo || 'periodo' }))
    ].sort((a, b) => new Date(a.fecha || a.inicio) - new Date(b.fecha || b.inicio));

    if (viewMode === 'list') {
        // En vista lista plana, sí filtramos solo por eventos reales existentes (sin cumpleaños)
        content.innerHTML = `<div class="calendario-grid">${items.map(item => renderItem(item, hoy)).join('')}</div>`;
    } else if (viewMode === 'birthdays') {
        content.innerHTML = renderCumpleanos(hoy);
    } else if (viewMode === 'dias') {
        content.innerHTML = renderVistaDias(hoy);
    } else {
        const agrupar = agruparJerarquiaCompleta(items);
        content.innerHTML = renderJerarquiaCompleta(agrupar, hoy);
    }

    if (window.feather) feather.replace();
}

/**
 * Organiza TODAS las semanas del semestre en meses, rellenando con eventos donde existan.
 */
function agruparJerarquiaCompleta(items) {
    const meses = {};

    // 1. Pre-poblar con TODAS las semanas del cronograma cronológico
    cronogramaMap.forEach(s => {
        const dStr = s.start.toISOString().split('T')[0];
        const [year, month] = dStr.split('-');
        const mesKey = `${year}-${month}`;

        if (!meses[mesKey]) meses[mesKey] = { semanas: {} };
        const sKey = `W-${s.start.getTime()}`;
        meses[mesKey].semanas[sKey] = { info: s, items: [] };
    });

    // 2. Inyectar eventos en las semanas pre-existentes
    items.forEach(item => {
        const semanasAfectadas = [];
        if (item.tipo === 'periodo') {
            let cur = new Date(item.inicio + 'T00:00:00');
            const fin = new Date(item.fin + 'T00:00:00');
            while (cur <= fin) {
                const s = getInfoSemana(cur.toISOString().split('T')[0]);
                if (s && !semanasAfectadas.find(x => x.start.getTime() === s.start.getTime())) {
                    semanasAfectadas.push(s);
                }
                cur.setDate(cur.getDate() + 1);
            }
        } else {
            const s = getInfoSemana(item.fecha);
            if (s) semanasAfectadas.push(s);
        }

        semanasAfectadas.forEach(s => {
            const sKey = `W-${s.start.getTime()}`;
            const dStr = s.start.toISOString().split('T')[0];
            const [year, month] = dStr.split('-');
            const mesKey = `${year}-${month}`;

            if (meses[mesKey] && meses[mesKey].semanas[sKey]) {
                const yaExiste = meses[mesKey].semanas[sKey].items.find(x => (x.id || x.titulo) === (item.id || item.titulo));
                if (!yaExiste) meses[mesKey].semanas[sKey].items.push(item);
            }
        });
    });

    // 3. Inyectar CUMPLEAÑOS en las semanas correspondientes
    CUMPLEANOS.forEach(c => {
        const s = getInfoSemana(c.fecha);
        if (s) {
            const sKey = `W-${s.start.getTime()}`;
            const dStr = s.start.toISOString().split('T')[0];
            const [year, month] = dStr.split('-');
            const mesKey = `${year}-${month}`;

            if (meses[mesKey] && meses[mesKey].semanas[sKey]) {
                meses[mesKey].semanas[sKey].items.push({
                    ...c,
                    titulo: c.nombre,
                    tipo: 'cumple'
                });
            }
        }
    });

    return meses;
}

function renderJerarquiaCompleta(meses, hoy) {
    return Object.keys(meses).sort().map(mesKey => {
        const [year, month] = mesKey.split('-');
        const nombreMes = obtenerNombreMes(month);
        const semanas = meses[mesKey].semanas;

        const semanasOrdenadas = Object.keys(semanas).sort((a, b) => semanas[a].info.start - semanas[b].info.start);

        return `
            <div class="mes-seccion">
                <h3 class="mes-titulo">${nombreMes} ${year}</h3>
                ${semanasOrdenadas.map(sKey => {
            const sem = semanas[sKey];
            const sInfo = sem.info;
            const tipoSemana = detectarTipoSemana(sem.items, sInfo);
            const tieneEventos = sem.items.length > 0;

            return `
                        <div class="semana-bloque ${tipoSemana.clase} ${!tieneEventos ? 'semana-vacia' : ''}">
                            <div class="semana-header">
                                <div class="semana-id">
                                    <span class="semana-num">${sInfo.label}</span>
                                    <span class="semana-parcial-label">${tipoSemana.parcial || ''}</span>
                                </div>
                                <span class="semana-rango">${formatearRango(sInfo.start, sInfo.end)}</span>
                                ${tipoSemana.tag ? `<span class="semana-tipo-badge">${tipoSemana.tag}</span>` : ''}
                            </div>
                            <div class="calendario-grid">
                                ${(() => {
                    const eventos  = sem.items.filter(i => i.tipo !== 'cumple');
                    const cumples  = sem.items.filter(i => i.tipo === 'cumple');
                    const eventosHTML = eventos.length > 0
                        ? eventos.map(item => renderItem(item, hoy)).join('')
                        : !cumples.length
                            ? `<div class="vacio-container"><i data-feather="calendar" style="width:14px; opacity:0.5;"></i> <p class="semana-sin-eventos">Sin eventos programados</p></div>`
                            : '';
                    const cumpleHTML = cumples.length > 0
                        ? `<div style="margin-top:${eventos.length?'0.5rem':'0'};padding:0.35rem 0.6rem;display:flex;flex-wrap:wrap;gap:0.3rem 0.75rem;border-top:${eventos.length?'1px dashed rgba(0,0,0,0.07)':'none'};align-items:center;">
                            <span style="font-size:0.72rem;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;">🎂 Cumpleaños</span>
                            ${cumples.map(c => {
                                const fc = new Date(c.fecha + 'T00:00:00');
                                const esHoy = fc.getMonth() === hoy.getMonth() && fc.getDate() === hoy.getDate();
                                const dia = parseInt(c.fecha.split('-')[2]);
                                const mes = obtenerNombreMes(fc.getMonth()+1).toLowerCase();
                                return `<span style="font-size:0.75rem;color:${esHoy?'#d97706':'#64748b'};font-weight:${esHoy?'700':'500'};white-space:nowrap;">${c.nombre.split(' ').slice(0,3).join(' ')} <span style="opacity:0.6;">(${dia} ${mes})</span>${esHoy?' 🎉':''}</span>`;
                            }).join('')}
                           </div>`
                        : '';
                    return eventosHTML + cumpleHTML;
                })()}
                            </div>
                        </div>
                    `;
        }).join('')}
            </div>
        `;
    }).join('');
}

function detectarTipoSemana(items, info) {
    let result = { tag: '', clase: '', parcial: '' };

    // Parciales solo en semanas académicas (num > 0)
    if (!info.esVacaciones && info.num >= 1 && info.num <= 5)  result.parcial = "1er Parcial";
    else if (!info.esVacaciones && info.num >= 6 && info.num <= 10)  result.parcial = "2do Parcial";
    else if (!info.esVacaciones && info.num >= 11 && info.num <= 15) result.parcial = "3er Parcial";
    else if (!info.esVacaciones && info.num === 16)                  result.parcial = "Globales";

    if (info.esVacaciones) {
        result.tag = 'VACACIONAL';
        result.clase = 'semana-vacacional';
    } else if (items.some(i => i.categoria === 'evaluacion')) {
        result.tag = 'EVALUACIÓN';
        result.clase = 'semana-evaluacion';
    } else if (items.some(i => i.categoria === 'restriccion')) {
        result.tag = 'RESTRICCIÓN';
        result.clase = 'semana-restriccion';
    }

    return result;
}

function renderItem(item, hoy) {
    if (item.tipo === 'cumple') {
        const fechaC = new Date(item.fecha + 'T00:00:00');
        const esHoy = fechaC.getMonth() === hoy.getMonth() && fechaC.getDate() === hoy.getDate();
        const dia = parseInt(item.fecha.split('-')[2]);
        const mesNombre = obtenerNombreMes(fechaC.getMonth() + 1).toLowerCase();

        return `
            <div class="evento-card cumple-mini-card ${esHoy ? 'cumple-hoy-resaltado' : ''}">
                <div class="cumple-mini-content">
                    <span class="cumple-icon">🎂</span>
                    <span class="cumple-nombre">${item.nombre}</span>
                    <span class="cumple-dia">(${dia} ${mesNombre})</span>
                </div>
            </div>
        `;
    }

    const fechaBase = item.fecha || item.inicio;
    const fechaEv = new Date(fechaBase + 'T00:00:00');
    const proximos7Dias = new Date(hoy);
    proximos7Dias.setDate(hoy.getDate() + 7);

    const estadoObj = calcularEstado(item, fechaEv, hoy, proximos7Dias);
    const esPeriodo = item.tipo === 'periodo';

    return `
        <div class="evento-card ${estadoObj.clase} ${esPeriodo ? 'card-periodo' : ''}">
            <div class="evento-header">
                <span class="evento-badge badge-${estadoObj.valor}">${estadoObj.label}</span>
                ${item.prioridad === 'alta' ? '<i data-feather="alert-circle" style="color:#ef4444; width:16px;"></i>' : ''}
                ${esPeriodo ? '<i data-feather="layers" style="color:var(--clr-primary); width:16px;"></i>' : ''}
            </div>
            <div class="evento-info">
                <h3 class="evento-titulo">${item.titulo}</h3>
                <div class="evento-meta">
                    <i data-feather="calendar"></i>
                    <span>${esPeriodo ? `${formatearFechaSimple(item.inicio)} al ${formatearFechaSimple(item.fin)}` : formatearFechaLarga(item.fecha)}</span>
                </div>
                ${item.hora ? `<div class="evento-meta"><i data-feather="clock"></i><span>${item.hora} hrs</span></div>` : ''}
                ${item.descripcion ? `<p class="evento-desc">${item.descripcion}</p>` : ''}
            </div>
            <div class="evento-footer">
                <span class="evento-categoria">${item.categoria}</span>
            </div>
        </div>
    `;
}

function calcularEstado(item, fechaEv, hoy, proximos7Dias) {
    if (item.estadoManual) return { valor: item.estadoManual, label: item.estadoManual.toUpperCase(), clase: item.estadoManual };
    if (item.categoria === 'vacaciones') return { valor: 'vacaciones', label: 'VACACIONES', clase: 'vacaciones' };
    if (item.categoria === 'festivo') return { valor: 'festivo', label: 'FESTIVO', clase: 'restriccion' };

    if (fechaEv < hoy) return { valor: "realizado", label: "REALIZADO", clase: "realizado" };
    const dateE = new Date(fechaEv);
    dateE.setHours(0, 0, 0, 0);
    if (dateE.getTime() === hoy.getTime() || (dateE > hoy && dateE <= proximos7Dias)) return { valor: "proximo", label: "PRÓXIMO", clase: "proximo" };
    return { valor: "pendiente", label: "PENDIENTE", clase: "pendiente" };
}

function formatearRango(start, end) {
    const d1 = start.getDate();
    const m1 = obtenerNombreMes(start.getMonth() + 1).toLowerCase();
    const d2 = end.getDate();
    const m2 = obtenerNombreMes(end.getMonth() + 1).toLowerCase();
    return m1 === m2 ? `${d1} al ${d2} de ${m1}` : `${d1} de ${m1} al ${d2} de ${m2}`;
}

function formatearFechaSimple(fechaStr) {
    const [y, m, d] = fechaStr.split('-');
    return `${parseInt(d)} de ${obtenerNombreMes(m).toLowerCase()}`;
}

function formatearFechaLarga(fechaStr) {
    const opciones = { weekday: 'long', day: 'numeric', month: 'long' };
    const date = new Date(fechaStr + 'T00:00:00');
    return date.toLocaleDateString('es-MX', opciones).toUpperCase();
}

function obtenerNombreMes(monthNumber) {
    const meses = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
    return meses[parseInt(monthNumber, 10) - 1];
}

function renderCumpleanos(hoy) {
    const listado = CUMPLEANOS.sort((a, b) => {
        const d1 = new Date('2000-' + a.fecha.substring(5));
        const d2 = new Date('2000-' + b.fecha.substring(5));
        return d1 - d2;
    });

    return `
        <div class="cumple-container">
            <h3 class="mes-titulo">🎂 Próximos Cumpleaños</h3>
            <div class="calendario-grid">
                ${listado.map(c => {
        const fechaC = new Date(c.fecha + 'T00:00:00');
        const esMesActual = fechaC.getMonth() === hoy.getMonth();
        return `
                        <div class="evento-card cumple-card ${esMesActual ? 'cumple-hoy' : ''}">
                            <div class="evento-header">
                                <span class="evento-badge ${esMesActual ? 'badge-proximo' : 'badge-realizado'}">${obtenerNombreMes(fechaC.getMonth() + 1)}</span>
                                <i data-feather="gift" style="color:var(--clr-primary); width:16px;"></i>
                            </div>
                            <div class="evento-info">
                                <h3 class="evento-titulo">${c.nombre}</h3>
                                <div class="evento-meta">
                                    <i data-feather="calendar"></i>
                                    <span>${formatearFechaSimple(c.fecha)}</span>
                                </div>
                                ${c.cargo ? `<p class="evento-desc">${c.cargo}</p>` : ''}
                            </div>
                        </div>
                    `;
    }).join('')}
            </div>
        </div>
    `;
}

/* ══════════════════════════════════════════════════════════════════
   VISTA EXPERIMENTAL: Por días (Lun–Vie)
   Reutiliza: cronogramaMap, FECHAS_CLAVE, CUMPLEANOS, PERIODOS_ESPECIALES
   No modifica ningún dato ni función existente.
══════════════════════════════════════════════════════════════════ */
function renderVistaDias(hoy) {
    const DIAS_NOMBRE = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    const DIAS_LABORALES = [1, 2, 3, 4, 5]; // lun–vie
    const CAT_COLOR = {
        evaluacion: { bg: '#fef3c7', border: '#d97706', text: '#92400e' },
        reunion:    { bg: '#ede9fe', border: '#7c3aed', text: '#4c1d95' },
        control:    { bg: '#e0f2fe', border: '#0284c7', text: '#0c4a6e' },
        academico:  { bg: '#dcfce7', border: '#16a34a', text: '#14532d' },
        restriccion:{ bg: '#fee2e2', border: '#dc2626', text: '#991b1b' },
        festivo:    { bg: '#f1f5f9', border: '#94a3b8', text: '#475569' },
    };

    // Construir mapa fecha→items para acceso rápido
    const mapaEventos = {}; // "yyyy-MM-dd" → [{...}]

    const addToMap = (fecha, item) => {
        if (!fecha) return;
        const key = typeof fecha === 'string' ? fecha.substring(0, 10)
                  : fecha instanceof Date ? fecha.toISOString().substring(0, 10) : null;
        if (!key) return;
        if (!mapaEventos[key]) mapaEventos[key] = [];
        mapaEventos[key].push(item);
    };

    FECHAS_CLAVE.forEach(ev => addToMap(ev.fecha, { ...ev, _tipo: 'evento' }));

    PERIODOS_ESPECIALES.forEach(p => {
        if (!p.inicio) return;
        let cur = new Date(p.inicio + 'T00:00:00');
        const fin = new Date((p.fin || p.inicio) + 'T00:00:00');
        while (cur <= fin) {
            addToMap(cur.toISOString().substring(0, 10), { ...p, _tipo: 'periodo' });
            cur.setDate(cur.getDate() + 1);
        }
    });

    CUMPLEANOS.forEach(c => addToMap(c.fecha, { ...c, _tipo: 'cumple' }));

    // Renderizar por semanas del cronograma
    const bloques = cronogramaMap.map(sem => {
        const esVac = sem.esVacaciones;

        // Calcular los 5 días laborales de esta semana
        const dias = DIAS_LABORALES.map(numDia => {
            // Encontrar el día exacto dentro del rango de la semana
            let d = new Date(sem.start);
            // Avanzar hasta que coincida con el día de semana
            while (d.getDay() !== numDia && d <= sem.end) d.setDate(d.getDate() + 1);
            if (d > sem.end) return null; // La semana no llega a ese día
            const key = d.toISOString().substring(0, 10);
            return { dia: numDia, fecha: d, key, items: mapaEventos[key] || [] };
        }).filter(Boolean);

        const esHoy = !esVac && dias.some(d => d.fecha.getTime() === hoy.getTime());

        // Encabezado de semana
        const encabezado = `
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;
               padding:0.6rem 0.9rem;background:${esVac?'#f1f5f9':'#0f172a'};border-radius:10px 10px 0 0;
               border-bottom:2px solid ${esVac?'#e2e8f0':'#1e293b'};">
            <div style="display:flex;align-items:center;gap:0.6rem;">
              <span style="font-size:0.7rem;font-weight:800;text-transform:uppercase;letter-spacing:1px;
                   color:${esVac?'#64748b':'#94a3b8'};">${sem.label}</span>
              ${esHoy ? '<span style="font-size:0.62rem;background:#059669;color:white;padding:1px 7px;border-radius:20px;font-weight:700;">HOY</span>' : ''}
              ${esVac ? '<span style="font-size:0.62rem;background:#e2e8f0;color:#64748b;padding:1px 7px;border-radius:20px;font-weight:700;">VACACIONAL</span>' : ''}
            </div>
            <span style="font-size:0.7rem;color:${esVac?'#94a3b8':'#64748b'};">${formatearRango(sem.start, sem.end)}</span>
          </div>`;

        // Si es vacacional, mostrar bloque simple sin días
        if (esVac) {
            return `
              <div style="margin-bottom:1.25rem;border-radius:10px;border:1px solid #e2e8f0;overflow:hidden;opacity:0.7;">
                ${encabezado}
                <div style="padding:0.75rem 0.9rem;background:#f8fafc;font-size:0.8rem;color:#94a3b8;font-style:italic;">
                  Período vacacional — sin actividades académicas
                </div>
              </div>`;
        }

        // Grid de días laborales
        const diasHTML = dias.map(({ dia, fecha, items }) => {
            const esHoyDia = fecha.getTime() === hoy.getTime();
            const eventos = items.filter(i => i._tipo === 'evento' || i._tipo === 'periodo');
            const cumples = items.filter(i => i._tipo === 'cumple');
            const tieneAlgo = eventos.length > 0 || cumples.length > 0;

            const eventosHTML = eventos.map(ev => {
                const cat = ev.categoria || 'academico';
                const c = CAT_COLOR[cat] || CAT_COLOR.academico;
                return `<div style="font-size:0.72rem;padding:2px 6px;border-radius:5px;margin-bottom:2px;
                              background:${c.bg};border-left:2px solid ${c.border};color:${c.text};
                              line-height:1.3;font-weight:500;">${ev.titulo}</div>`;
            }).join('');

            const cumpleHTML = cumples.map(c => {
                const nombre = c.nombre.split(' ').slice(0, 2).join(' ');
                return `<div style="font-size:0.68rem;color:#d97706;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${c.nombre}">🎂 ${nombre}</div>`;
            }).join('');

            return `
              <div style="flex:1;min-width:0;border-left:1px solid ${esHoyDia?'#059669':'#f1f5f9'};
                   padding:0.4rem 0.5rem;background:${esHoyDia?'#f0fdf4':'white'};min-height:60px;">
                <div style="font-size:0.65rem;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;
                     color:${esHoyDia?'#059669':'#94a3b8'};margin-bottom:4px;">${DIAS_NOMBRE[dia]}</div>
                ${tieneAlgo ? eventosHTML + cumpleHTML
                    : `<span style="font-size:0.65rem;color:#e2e8f0;">—</span>`}
              </div>`;
        }).join('');

        return `
          <div style="margin-bottom:1.25rem;border-radius:10px;border:1px solid #e2e8f0;overflow:hidden;
               box-shadow:0 1px 3px rgba(0,0,0,0.05);">
            ${encabezado}
            <div style="display:flex;flex-wrap:wrap;">
              ${diasHTML}
            </div>
          </div>`;
    }).join('');

    return `
      <div style="margin-bottom:0.75rem;padding:0.6rem 0.9rem;background:#ede9fe;border-radius:10px;
           border:1px solid #c4b5fd;display:flex;align-items:center;gap:0.5rem;">
        <span style="font-size:0.75rem;font-weight:700;color:#4c1d95;">🧪 Vista experimental — Por días</span>
        <span style="font-size:0.72rem;color:#7c3aed;">Los eventos se distribuyen por día dentro de cada semana.</span>
      </div>
      ${bloques}`;
}

// Exponer para uso desde otras páginas
window.renderVistaDias = renderVistaDias;

/**
 * Variante del widget semanal por días filtrada para portales de alumnos/padres.
 * Solo muestra eventos con visiblePortalAlumno === true.
 * @param {HTMLElement} container  El div donde renderizar
 * @param {Date} hoy
 */
window.renderVistaDiasPortal = function(container, hoy) {
    if (!container || typeof cronogramaMap === 'undefined' || !cronogramaMap) return;

    hoy = hoy || new Date(); hoy.setHours(0,0,0,0);
    const sem = cronogramaMap.find(s => hoy >= s.start && hoy <= s.end);
    if (!sem) { container.innerHTML = '<p style="font-size:0.82rem;color:#94a3b8;padding:0.5rem 0;">Fuera del período escolar.</p>'; return; }

    const DIAS_NOMBRE  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    const DIAS_LABORALES = [1,2,3,4,5];
    const CAT_COLOR = {
        evaluacion: { bg:'#fef3c7', border:'#d97706', text:'#92400e' },
        reunion:    { bg:'#ede9fe', border:'#7c3aed', text:'#4c1d95' },
        control:    { bg:'#e0f2fe', border:'#0284c7', text:'#0c4a6e' },
        academico:  { bg:'#dcfce7', border:'#16a34a', text:'#14532d' },
        restriccion:{ bg:'#fee2e2', border:'#dc2626', text:'#991b1b' },
        festivo:    { bg:'#f1f5f9', border:'#94a3b8', text:'#475569' },
    };

    // Solo eventos marcados para el portal
    const fuenteEventos = FECHAS_CLAVE.filter(ev => ev.visiblePortalAlumno);

    const mapaEventos = {};
    const addToMap = (fecha, item) => {
        if (!fecha) return;
        const key = String(fecha).substring(0,10);
        if (!mapaEventos[key]) mapaEventos[key] = [];
        mapaEventos[key].push(item);
    };
    fuenteEventos.forEach(ev => addToMap(ev.fecha, { ...ev, _tipo:'evento' }));
    CUMPLEANOS.forEach(c => addToMap(c.fecha, { ...c, _tipo:'cumple' }));

    const diasHTML = DIAS_LABORALES.map(numDia => {
        let d = new Date(sem.start);
        while (d.getDay() !== numDia && d <= sem.end) d.setDate(d.getDate()+1);
        if (d > sem.end) return '';
        const key = d.toISOString().substring(0,10);
        const items = mapaEventos[key] || [];
        const esHoyDia = d.getTime() === hoy.getTime();
        const eventos = items.filter(i => i._tipo === 'evento');
        const cumples = items.filter(i => i._tipo === 'cumple');

        const contenido = [
            ...eventos.map(ev => {
                const c = CAT_COLOR[ev.categoria] || CAT_COLOR.academico;
                return `<div style="font-size:0.72rem;padding:2px 6px;border-radius:5px;margin-bottom:2px;background:${c.bg};border-left:2px solid ${c.border};color:${c.text};line-height:1.3;font-weight:500;">${ev.titulo}</div>`;
            }),
            ...cumples.map(c => {
                const nombre = c.nombre.split(' ').slice(0,2).join(' ');
                return `<div style="font-size:0.68rem;color:#d97706;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${c.nombre}">🎂 ${nombre}</div>`;
            })
        ].join('') || `<span style="font-size:0.65rem;color:#e2e8f0;">—</span>`;

        return `<div style="flex:1;min-width:0;border-left:1px solid ${esHoyDia?'#059669':'#f1f5f9'};padding:0.4rem 0.5rem;background:${esHoyDia?'#f0fdf4':'white'};min-height:55px;">
            <div style="font-size:0.65rem;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;color:${esHoyDia?'#059669':'#94a3b8'};margin-bottom:4px;">${DIAS_NOMBRE[numDia]}</div>
            ${contenido}
        </div>`;
    }).join('');

    const esVac = sem.esVacaciones;
    container.innerHTML = `
        <div style="border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
            <div style="padding:0.5rem 0.75rem;background:${esVac?'#f1f5f9':'#0f172a'};display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.4rem;">
                <span style="font-size:0.7rem;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:${esVac?'#64748b':'#94a3b8'};">${sem.label} ${esVac?'· Vacacional':''}</span>
                <span style="font-size:0.68rem;color:${esVac?'#94a3b8':'#64748b'};">${formatearRango(sem.start, sem.end)}</span>
            </div>
            ${esVac
                ? `<div style="padding:0.6rem 0.75rem;font-size:0.8rem;color:#94a3b8;background:#f8fafc;font-style:italic;">Período vacacional — sin actividades</div>`
                : `<div style="display:flex;flex-wrap:wrap;">${diasHTML}</div>`
            }
        </div>`;
};

window.logout = function () {
    sessionStorage.clear();
    window.location.href = 'login.html';
};
