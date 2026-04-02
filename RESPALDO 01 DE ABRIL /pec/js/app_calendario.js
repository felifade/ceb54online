/* pec/js/app_calendario.js */

/**
 * CONFIGURACIÓN GLOBAL DEL CALENDARIO ESCOLAR
 */
const CONFIG_CALENDARIO = {
    fechaInicioSemana1: "2026-02-11", // Miércoles
    fechaFinSemestre: "2026-07-10",  // Límite para el cálculo de semanas
    mostrarRangoFechas: true,
};

/**
 * EVENTOS PUNTUALES
 * Agregue aquí los eventos específicos por fecha.
 */
const FECHAS_CLAVE = [
    { id: "fc001", titulo: "Inicio de clases", fecha: "2026-02-11", categoria: "academico", prioridad: "alta" },
    { id: "fc002", titulo: "Inicio primer parcial", fecha: "2026-02-11", categoria: "evaluacion" },
    { id: "fc003", titulo: "Fin primer parcial", fecha: "2026-03-20", categoria: "evaluacion" },
    { id: "fc004", titulo: "Inicio segundo parcial", fecha: "2026-03-23", categoria: "evaluacion" },
    { id: "fc004", titulo: "Entrega PEC Estudiantes", fecha: "2026-04-24", categoria: "evaluacion" },
    { id: "fc004", titulo: "Captura PEC Docentes", fecha: "2026-04-28", categoria: "evaluacion" },
    { id: "fc005", titulo: "Revisión y aclaraciones PEC", fecha: "2026-04-29", categoria: "evaluacion" },
    { id: "fc005", titulo: "Fin segundo parcial", fecha: "2026-05-08", categoria: "evaluacion" },
    { id: "fc006", titulo: "Inicio tercer parcial", fecha: "2026-05-11", categoria: "evaluacion" },
    { id: "fc007", titulo: "No realizar modificaciones", fecha: "2026-05-12", categoria: "restriccion", estadoManual: "restriccion", prioridad: "alta" },
    { id: "fc008", titulo: "Reunión con padres", fecha: "2026-05-13", hora: "07:00", categoria: "reunion", prioridad: "alta" },
    { id: "fc009", titulo: "Entrega de calificaciones segundo parcial", fecha: "2026-05-13", categoria: "control" },
    { id: "fc010", titulo: "Entrega de calificaciones intrasemestrales", fecha: "2026-05-20", categoria: "control" },
    { id: "fc011", titulo: "Fin tercer parcial", fecha: "2026-06-11", categoria: "evaluacion" },
    { id: "fc012", titulo: "Inicio evaluación final", fecha: "2026-06-12", categoria: "evaluacion" },
    { id: "fc013", titulo: "Fin de clases", fecha: "2026-06-19", categoria: "academico" },
    { id: "fc014", titulo: "Captura de actas finales", fecha: "2026-06-22", categoria: "control" },
    { id: "fc015", titulo: "Reunión previa intersemestral", fecha: "2026-06-25", categoria: "academico" },
    { id: "fc016", titulo: "Inicio intersemestral", fecha: "2026-06-26", categoria: "academico" },
    { id: "fc017", titulo: "Entrega de calificaciones intersemestral", fecha: "2026-07-10", categoria: "control" }
];
/**
 * PERIODOS ESPECIALES (Vacaciones, Festivos, Suspensiones)
 */
const PERIODOS_ESPECIALES = [
    { titulo: "Suspensión de labores", fecha: "2026-05-01", categoria: "festivo", tipo: "dia" },
    { titulo: "Batalla de Puebla", fecha: "2026-05-05", categoria: "festivo", tipo: "dia" },
    { titulo: "Día del Maestro", fecha: "2026-05-15", categoria: "festivo", tipo: "dia" },
    { titulo: "Receso escolar (Vacaciones)", inicio: "2026-03-30", fin: "2026-04-10", categoria: "vacaciones", tipo: "periodo" },
    { titulo: "Semana de Evaluación Primera Vuelta", inicio: "2026-06-12", fin: "2026-06-18", categoria: "evaluacion", tipo: "periodo" },
];

/**
 * CUMPLEAÑOS (Personalizable)
 * Agregue aquí los nombres y fechas de cumpleaños.
 */
const CUMPLEANOS = [
    { nombre: "José Alfredo Agudo García", fecha: "2026-11-29", cargo: "Docente" },
    { nombre: "Irma Alvarez Pérez", fecha: "2026-05-20", cargo: "Docente" },
    { nombre: "Elvia Abigail Arenas Orozco", fecha: "2026-07-29", cargo: "Docente" },
    { nombre: "Alicia Arias Licea", fecha: "2026-01-21", cargo: "Docente" },
    { nombre: "Alicia Arteaga Badillo", fecha: "2026-06-23", cargo: "Docente" },
    { nombre: "Fabiola Alejandra Becerra Hernández", fecha: "2026-08-09", cargo: "Docente" },
    { nombre: "Felipe López Salazar", fecha: "2026-03-22", cargo: "Docente" },
    { nombre: "Coord. Académica", fecha: "2026-05-10", cargo: "Coordinación" },
    { nombre: "Depto. Servicios Docentes", fecha: "2026-06-23", cargo: "Servicios" },
    { nombre: "Antolín Blancas Hernández", fecha: "2026-09-02", cargo: "Docente" },
    { nombre: "Yessica Yoselin Blancas Ventura", fecha: "2026-03-21", cargo: "Docente" },
    { nombre: "Leticia Servanda Briceño Zamudio", fecha: "2026-10-23", cargo: "Docente" },
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
    { nombre: "Ma. Martha Dorantes Flores", fecha: "2026-12-06", cargo: "Docente" },
    { nombre: "Leticia Enriquez Aguilar", fecha: "2026-01-09", cargo: "Docente" },
    { nombre: "Ignacio Escamilla Trejo", fecha: "2026-07-31", cargo: "Docente" },
    { nombre: "Martín Espinosa Arteaga", fecha: "2026-02-02", cargo: "Docente" },
    { nombre: "Guillermo Estrada Contreras", fecha: "2026-02-25", cargo: "Docente" },
    { nombre: "Marco Antonio Fernández Hernández", fecha: "2026-12-18", cargo: "Docente" },
    { nombre: "Martha Flores Mendoza", fecha: "2026-12-14", cargo: "Docente" },
    { nombre: "Claudia García Chávez", fecha: "2026-03-09", cargo: "Docente" },
    { nombre: "Juana María García López", fecha: "2026-01-26", cargo: "Docente" },
    { nombre: "Marisandra García Máximo", fecha: "2026-09-28", cargo: "Docente" },
    { nombre: "Erika Itzel Gayosso Tolentino", fecha: "2026-07-17", cargo: "Docente" },
    { nombre: "Edgar Gomez Castillo", fecha: "2026-07-20", cargo: "Docente" },
    { nombre: "José González Hernández", fecha: "2026-01-17", cargo: "Docente" },
    { nombre: "Claudia Nayeli González Gardini", fecha: "2026-04-08", cargo: "Docente" },
    { nombre: "Laura González Munive", fecha: "2026-10-19", cargo: "Docente" },
    { nombre: "María Elena González Rosendo", fecha: "2026-08-07", cargo: "Docente" },
    { nombre: "Sivonney Hernández Camargo", fecha: "2026-09-07", cargo: "Docente" },
    { nombre: "Luis Ignacio Hernández Hernández", fecha: "2026-03-24", cargo: "Docente" },
    { nombre: "Martín Hernández López", fecha: "2026-10-24", cargo: "Docente" },
    { nombre: "José Yoshimar Hernández Ortíz", fecha: "2026-12-15", cargo: "Docente" },
    { nombre: "Luis Francisco Hernández Picazo", fecha: "2026-04-02", cargo: "Docente" },
    { nombre: "Soila Hernández Vargas", fecha: "2026-09-11", cargo: "Docente" },
    { nombre: "Alfonso Herrera Gómez", fecha: "2026-04-11", cargo: "Docente" },
    { nombre: "Lirio Yuselín Islas Montes", fecha: "2026-12-10", cargo: "Docente" },
    { nombre: "María Goreti Islas Suarez", fecha: "2026-07-06", cargo: "Docente" },
    { nombre: "Aurora Juárez Flores", fecha: "2026-09-10", cargo: "Docente" },
    { nombre: "Elsa Erika Jurado Hernández", fecha: "2026-01-09", cargo: "Docente" },
    { nombre: "Luis Rodolfo Lira García", fecha: "2026-03-18", cargo: "Docente" },
    { nombre: "José Luis López Mejía", fecha: "2026-05-06", cargo: "Docente" },
    { nombre: "Martha María López García", fecha: "2026-08-28", cargo: "Docente" },
    { nombre: "Felipe López Salazar", fecha: "2026-03-22", cargo: "Docente" },
    { nombre: "Luz María del Carmen López Vázquez", fecha: "2026-08-04", cargo: "Docente" },
    { nombre: "Feliza Lugo Barrera", fecha: "2026-12-10", cargo: "Docente" },
    { nombre: "Gustavo León Lugo Cabrera", fecha: "2026-04-12", cargo: "Docente" },
    { nombre: "Daniel Martínez Flores", fecha: "2026-12-10", cargo: "Docente" },
    { nombre: "Grindelia Martínez Flores", fecha: "2026-11-29", cargo: "Docente" },
    { nombre: "Ruben Martínez Castro", fecha: "2026-09-28", cargo: "Docente" },
    { nombre: "Martín Martínez Ruíz", fecha: "2026-01-13", cargo: "Docente" },
    { nombre: "María de la Luz Melo Balderas", fecha: "2026-04-15", cargo: "Docente" },
    { nombre: "María Isabel Mendoza García", fecha: "2026-04-22", cargo: "Docente" },
    { nombre: "Arturo Najera Vargas", fecha: "2026-10-02", cargo: "Docente" },
    { nombre: "Hernán Saide Oviedo Juárez", fecha: "2026-12-02", cargo: "Docente" },
    { nombre: "Iracema Palma Rodríguez", fecha: "2026-10-06", cargo: "Docente" },
    { nombre: "Ana Karen Pedraza Espinosa", fecha: "2026-10-22", cargo: "Docente" },
    { nombre: "Guillermo Pérez Najera", fecha: "2026-12-21", cargo: "Docente" },
    { nombre: "Olga Leticia Priego Cardoza", fecha: "2026-11-10", cargo: "Docente" },
    { nombre: "Martín Ramírea González", fecha: "2026-11-11", cargo: "Docente" },
    { nombre: "Jaime Abraham Ramírez Enciso", fecha: "2026-08-22", cargo: "Docente" },
    { nombre: "Yolanda Reyes Jaramillo", fecha: "2026-10-02", cargo: "Docente" },
    { nombre: "Diana Bethsabe Ríos Silva", fecha: "2026-12-03", cargo: "Docente" },
    { nombre: "José Francisco Rodríguez Caudillo", fecha: "2026-11-03", cargo: "Docente" },
    { nombre: "José Luis Rosas Calderon", fecha: "2026-12-16", cargo: "Docente" },
    { nombre: "María Elena Rubio García", fecha: "2026-08-18", cargo: "Docente" },
    { nombre: "Oscar Enrique Sanchez Garnica", fecha: "2026-09-01", cargo: "Docente" },
    { nombre: "Jerusalén Sánchez Meza", fecha: "2026-08-30", cargo: "Docente" },
    { nombre: "Arely Edith Soto Islas", fecha: "2026-03-11", cargo: "Docente" },
    { nombre: "Norma Angélica Torres Islas", fecha: "2026-10-11", cargo: "Docente" },
    { nombre: "Julia Dallan Trejo Martínez", fecha: "2026-04-21", cargo: "Docente" },
    { nombre: "Ismael Vázquez Alamilla", fecha: "2026-04-14", cargo: "Docente" },
    { nombre: "Jorge Daivids Vilchis Aldana", fecha: "2026-04-30", cargo: "Docente" },
    { nombre: "Jesús Andrés Vilchis León", fecha: "2026-12-31", cargo: "Docente" },
    { nombre: "Elizabeth Villegas Sánchez", fecha: "2026-11-06", cargo: "Docente" },
    { nombre: "Sandra María del Rocio Zamudio Fonseca", fecha: "2026-04-16", cargo: "Docente" },
];


let viewMode = 'grouped';
let cronogramaMap = null;

document.addEventListener("DOMContentLoaded", () => {
    if (window.feather) feather.replace();
    const userName = sessionStorage.getItem('user_name');
    if (userName && document.getElementById('topbar-user-name')) {
        document.getElementById('topbar-user-name').textContent = userName;
    }
    const menuToggle = document.getElementById('menu-toggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));
    }

    // Generar el cronograma cronológico primero
    cronogramaMap = generarCronogramaEfectivo();
    initCalendario();
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
    curFin.setDate(fechaInicio.getDate() + (7 - fechaInicio.getDay()) % 7);
    curFin.setHours(23, 59, 59, 999);

    let numSemanaActiva = 0;

    while (curIni <= fechaFin) {
        const esVacaciones = esSemanaDePausa(curIni, curFin);
        let label = "RECESO / VACACIONES";
        let num = null;

        if (!esVacaciones) {
            numSemanaActiva++;
            num = numSemanaActiva;
            label = `SEMANA ${num}`;
        }

        cronograma.push({
            num: num,
            label: label,
            start: new Date(curIni),
            end: new Date(curFin),
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
                <button class="view-btn ${viewMode === 'list' ? 'active' : ''}" id="view-list">Eventos</button>
                <button class="view-btn ${viewMode === 'birthdays' ? 'active' : ''}" id="view-birthdays">🎂</button>
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

}

function updateToggles() {
    document.getElementById('view-grouped').classList.toggle('active', viewMode === 'grouped');
    document.getElementById('view-list').classList.toggle('active', viewMode === 'list');
    document.getElementById('view-birthdays').classList.toggle('active', viewMode === 'birthdays');
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
        // En vista lista plana, sí filtramos solo por eventos reales existentes
        content.innerHTML = `<div class="calendario-grid">${items.map(item => renderItem(item, hoy)).join('')}</div>`;
    } else if (viewMode === 'birthdays') {
        content.innerHTML = renderCumpleanos(hoy);
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
            // Encontrar en qué mes pusimos esta semana
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
                                ${tieneEventos ?
                    sem.items.map(item => renderItem(item, hoy)).join('') :
                    `<div class="vacio-container"><i data-feather="calendar" style="width:14px; opacity:0.5;"></i> <p class="semana-sin-eventos">Sin eventos programados</p></div>`
                }
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

    // Lógica de parciales solicitada
    if (info.num >= 1 && info.num <= 5) result.parcial = "1er Parcial";
    else if (info.num >= 6 && info.num <= 10) result.parcial = "2do Parcial";
    else if (info.num >= 11 && info.num <= 15) result.parcial = "3er Parcial";
    else if (info.num === 16) result.parcial = "Globales";

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

function renderCumpleanos(hoy) {
    const listado = CUMPLEANOS.sort((a, b) => new Date('2000-' + a.fecha.substring(5)) - new Date('2000-' + b.fecha.substring(5)));

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


function renderItem(item, hoy) {
    if (item.tipo === 'cumple') {
        const fechaC = new Date(item.fecha + 'T00:00:00');
        const esHoy = fechaC.getMonth() === hoy.getMonth() && fechaC.getDate() === hoy.getDate();
        const dia = parseInt(item.fecha.split('-')[2]);

        return `
            <div class="evento-card cumple-mini-card ${esHoy ? 'cumple-hoy-resaltado' : ''}">
                <div class="cumple-mini-content">
                    <span class="cumple-icon">🎂</span>
                    <span class="cumple-nombre">${item.nombre.split(' ')[0]}</span>
                    <span class="cumple-dia">(${dia})</span>
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

window.logout = function () {
    sessionStorage.clear();
    window.location.href = 'login.html';
};
