/**
 * pec/js/app_areas.js
 * Configuración oficial y modular para las secciones institucionales.
 * Se utilizan las funciones proporcionadas oficialmente por la institución.
 */

const FUNCIONES_DIRECCION = [
  "Dirigir y supervisar el funcionamiento general del plantel conforme a la normatividad de la DGB.",
  "Coordinar la planeación institucional y el cumplimiento del Plan de Mejora Continua.",
  "Tomar decisiones académicas y administrativas para el buen desempeño del centro educativo.",
  "Representar al plantel ante autoridades educativas y la comunidad.",
  "Supervisar el cumplimiento de los procesos de evaluación y control escolar.",
  "Promover un ambiente escolar basado en el respeto, la disciplina y la convivencia.",
  "Autorizar proyectos institucionales, estrategias académicas y actividades escolares."
];

const FUNCIONES_SUBDIRECCION = [
  "Coordinar el desarrollo académico del plantel conforme a los programas de la DGB.",
  "Dar seguimiento al desempeño docente y al cumplimiento de planeaciones didácticas.",
  "Organizar y supervisar las reuniones de academia.",
  "Analizar indicadores académicos como reprobación, aprovechamiento y asistencia.",
  "Apoyar a la dirección en la implementación del Plan de Mejora Continua.",
  "Supervisar la correcta aplicación de evaluaciones parciales y finales.",
  "Brindar acompañamiento pedagógico a los docentes."
];

const FUNCIONES_ORIENTACION = [
  "Brindar acompañamiento socioemocional a los estudiantes.",
  "Detectar factores de riesgo académico, personal o familiar.",
  "Implementar estrategias de prevención de abandono escolar.",
  "Dar seguimiento a alumnos en situación de riesgo académico.",
  "Orientar a los estudiantes en la toma de decisiones personales y académicas.",
  "Coordinar actividades de formación socioemocional.",
  "Canalizar a estudiantes a instancias externas cuando sea necesario."
];

const FUNCIONES_PREFECTURA = [
  "Supervisar la disciplina y el orden dentro del plantel.",
  "Registrar y dar seguimiento a la asistencia de los estudiantes.",
  "Vigilar el cumplimiento del reglamento escolar.",
  "Reportar incidencias conductuales a las áreas correspondientes.",
  "Apoyar en la organización de entradas, salidas y cambios de clase.",
  "Colaborar con docentes y orientación educativa en el seguimiento de alumnos.",
  "Promover un ambiente de respeto y convivencia escolar."
];

const FUNCIONES_TUTORIAS = [
  "Dar seguimiento académico personalizado a los estudiantes.",
  "Identificar alumnos en riesgo de reprobación o abandono.",
  "Establecer estrategias de apoyo para mejorar el rendimiento escolar.",
  "Mantener comunicación con padres de familia sobre el desempeño del alumno.",
  "Registrar avances y observaciones en el sistema de tutorías.",
  "Canalizar a orientación educativa cuando se detecten situaciones específicas.",
  "Promover hábitos de estudio y responsabilidad académica."
];

/**
 * REUNIONES DE ACADEMIA (Solo Subdirección)
 */
const REUNIONES_ACADEMIA = {
    "2025-2026": [
        { 
            titulo: "Primera Reunión Ordinaria", 
            fecha: "27 de Marzo 2026", 
            descripcion: "Seguimiento de Academia. <br><br> <b>Enlaces de descarga:</b> <br> • <a href='https://drive.google.com/file/d/1WMBK7AowOVNcGjcZYGmOi84sDMucLLQn/view?usp=share_link' target='_blank' style='color:#2563eb; font-weight:700;'>PDM Turno Matutino</a> <br> • <a href='https://drive.google.com/file/d/1U3sncwrFJgrdfuHGpB77CEWu4iXyorsM/view?usp=sharing' target='_blank' style='color:#2563eb; font-weight:700;'>PDM Turno Vespertino</a>" 
        },
        { 
            titulo: "Reunión de Evaluación de Medio Término", 
            fecha: "18 de Noviembre 2025", 
            descripcion: "Análisis de resultados del primer y segundo parcial, estrategias de regularización." 
        },
        { 
            titulo: "Cierre de Semestre y Evaluación Global", 
            fecha: "20 de Enero 2026", 
            descripcion: "Entrega de resultados finales, análisis de metas cumplidas y planeación del siguiente periodo." 
        }
    ]
};

/**
 * DOCUMENTOS (Solo Subdirección)
 */
const DOCUMENTOS_SUBDIRECCION = [
    {
        titulo: "Calendario de Evaluaciones",
        descripcion: "Fechas oficiales para la captura y entrega de resultados.",
        url: "#"
    },
    {
        titulo: "Manual del Docente",
        descripcion: "Lineamientos académicos y procesos de planeación institucional.",
        url: "#"
    }
];

/**
 * LÓGICA DE RENDERIZADO
 */
document.addEventListener('DOMContentLoaded', () => {
    const areaPath = window.location.pathname;
    
    // Identificar el área por el nombre del archivo
    if (areaPath.includes('area_direccion')) {
        renderFunciones(FUNCIONES_DIRECCION, 'shield-check');
    } else if (areaPath.includes('area_subdireccion')) {
        renderFunciones(FUNCIONES_SUBDIRECCION, 'book-open');
        renderReuniones(REUNIONES_ACADEMIA);
        renderDocumentos(DOCUMENTOS_SUBDIRECCION);
    } else if (areaPath.includes('area_orientacion')) {
        renderFunciones(FUNCIONES_ORIENTACION, 'heart');
    } else if (areaPath.includes('area_prefectura')) {
        renderFunciones(FUNCIONES_PREFECTURA, 'eye');
    } else if (areaPath.includes('area_tutorias')) {
        renderFunciones(FUNCIONES_TUTORIAS, 'clipboard-list');
    }
    
    // Inicializar iconos de Lucide
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
});

/**
 * Renderiza las funciones como tarjetas elegantes (Opción A)
 */
function renderFunciones(lista, defaultIcon = 'check-circle-2') {
    const container = document.getElementById('funciones-container');
    if (!container) return;
    
    container.innerHTML = lista.map(item => `
        <div class="funcion-item">
            <div class="funcion-icon-mini">
                <i data-lucide="${defaultIcon}"></i>
            </div>
            <div class="funcion-text">${item}</div>
        </div>
    `).join('');
}

function renderReuniones(reuniones) {
    const container = document.getElementById('reuniones-container');
    if (!container) return;
    
    const periodo = "2025-2026";
    const lista = reuniones[periodo] || [];
    
    container.innerHTML = lista.map((reu, index) => `
        <div class="reunion-card">
            <div class="reunion-index">${index + 1}</div>
            <div class="reunion-info">
                <h4>${reu.titulo}</h4>
                <div class="reunion-meta">
                    <i data-lucide="calendar"></i> ${reu.fecha}
                </div>
                <p>${reu.descripcion}</p>
            </div>
        </div>
    `).join('');
}

function renderDocumentos(docs) {
    const container = document.getElementById('documentos-container');
    if (!container) return;
    
    container.innerHTML = docs.map(doc => `
        <div class="doc-card">
            <div class="doc-icon-wrap">
                <i data-lucide="file-text" class="icon-doc"></i>
            </div>
            <div class="doc-body">
                <h3>${doc.titulo}</h3>
                <p>${doc.descripcion}</p>
                <a href="${doc.url}" target="_blank" class="btn-doc">
                    Ver documento <i data-lucide="external-link"></i>
                </a>
            </div>
        </div>
    `).join('');
}
