/**
 * PORTAL ESTUDIANTIL — Vista Alumno
 * Calificaciones PEC + Cuestionario de evaluación
 */

// ── PREGUNTAS DEL CUESTIONARIO ──────────────────────────────────────
const PREGUNTAS_ALU = [
  { id:"q1",  texto:"¿Tu tutor/asesor te orientó adecuadamente durante el desarrollo del proyecto?" },
  { id:"q2",  texto:"¿Las instrucciones y criterios de evaluación del PEC fueron claros y accesibles?" },
  { id:"q3",  texto:"¿Contaste con los materiales, espacios y recursos necesarios para tu proyecto?" },
  { id:"q4",  texto:"¿El ambiente en el plantel fue favorable para el trabajo en equipo?" },
  { id:"q5",  texto:"¿La evaluación de tu proyecto fue justa y transparente?" },
  { id:"q6",  texto:"¿Tu equipo trabajó de forma colaborativa, responsable y organizada?" },
  { id:"q7",  texto:"¿Recibiste retroalimentación útil y oportuna de tus docentes?" },
  { id:"q8",  texto:"¿Las tutorías que recibiste te ayudaron a resolver dudas e impulsar tu proyecto?" },
  { id:"q9",  texto:"¿Estás satisfecho/a con el proceso del PEC en general?" },
  { id:"q10", texto:"¿Recomendarías a otros estudiantes participar activamente en el PEC?" },
];

const LABELS_LIKERT = ["Muy def.","Deficiente","Regular","Bueno","Excelente"];

let usuario  = null;
let stepActual = 1;
const TOTAL_STEPS = 2;
const respuestas  = {};

// ── CACHÉ DE DATOS PESADOS ───────────────────────────────────────────
const CACHE_KEY  = 'portal_data_cache';
const CACHE_TTL  = 10 * 60 * 1000;  // 10 minutos
const EVAL_FLAG  = 'portal_came_from_eval';

const portalCache = {
  save(dataCal) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({
        ts: Date.now(),
        dataCal
      }));
    } catch(e) {}
  },
  load() {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (Date.now() - obj.ts > CACHE_TTL) { sessionStorage.removeItem(CACHE_KEY); return null; }
      return obj.dataCal;
    } catch(e) { return null; }
  },
  clear() { sessionStorage.removeItem(CACHE_KEY); }
};

// ── CACHÉ PEC (directorio de docentes) ───────────────────────────────
// Compartida entre renderMaterias, renderEvalDirectivosStatus y eval docentes
const PEC_CACHE_KEY = 'portal_pec_cache';
const PEC_CACHE_TTL = 15 * 60 * 1000; // 15 minutos
let _pecDbPromise   = null; // dedup de llamadas paralelas en la misma carga

async function getPecData() {
  // 1. sessionStorage (persiste entre navegaciones en la misma pestaña)
  try {
    const raw = sessionStorage.getItem(PEC_CACHE_KEY);
    if (raw) {
      const obj = JSON.parse(raw);
      if (Date.now() - obj.ts < PEC_CACHE_TTL) return obj.data;
    }
  } catch(e) {}

  // 2. Si ya hay una petición en vuelo, reutilizarla
  if (_pecDbPromise) return _pecDbPromise;

  // 3. Nueva petición con dedup
  _pecDbPromise = fetch(`${portalAPI.PEC_API_URL}?_t=${Date.now()}`, { method: 'GET', redirect: 'follow' })
    .then(r => r.json())
    .then(data => {
      _pecDbPromise = null;
      try { sessionStorage.setItem(PEC_CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); } catch(e) {}
      return data;
    })
    .catch(e => { _pecDbPromise = null; throw e; });

  return _pecDbPromise;
}

// ── INICIALIZACIÓN ──────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  try {
    usuario = portalSession.requireAlumno();
    if (!usuario) return;

    // ── Inyección de datos del usuario (siempre inmediata) ──────────
    const setH = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    const initials = usuario.nombre.split(" ").slice(0,2).map(w => w[0]).join("").toUpperCase();

    // Header
    setH("h-nombre",        usuario.nombre);
    setH("header-initials", initials);
    const avSm = document.getElementById("header-avatar-sm");
    if (avSm) avSm.textContent = initials;

    // Perfil
    setH("hero-name",  usuario.nombre);
    setH("hero-group", `Grupo ${usuario.grupo}`);
    const pName  = document.getElementById("hero-name");
    const pGroup = document.getElementById("hero-group");
    if (!pName)  { const el = document.getElementById("profile-name");  if(el) el.textContent = usuario.nombre; }
    if (!pGroup) { const el = document.getElementById("profile-group"); if(el) el.textContent = `Grupo ${usuario.grupo}`; }

    const avatarEl = document.getElementById("hero-avatar");
    if (avatarEl) avatarEl.textContent = initials;
    const profileAv = document.getElementById("profile-avatar");
    if (profileAv) profileAv.childNodes[0] && (profileAv.firstChild.nodeType === 3
        ? profileAv.firstChild.textContent = initials
        : profileAv.insertBefore(document.createTextNode(initials), profileAv.firstChild));

    const hGrupoEl = document.getElementById("h-grupo");
    if (hGrupoEl) hGrupoEl.textContent = usuario.grupo;

    // Links de encuesta (siempre frescos)
    const encuestaBase = "../pec/encuesta.html";
    const encBase = new URLSearchParams({ nombre: usuario.nombre, grupo: usuario.grupo });
    const lp = document.getElementById("btn-eval-go");
    const ld = document.getElementById("btn-eval-dir-go");
    if (lp) lp.href = `${encuestaBase}?${encBase.toString()}&ir=profesores`;
    if (ld) ld.href = `${encuestaBase}?${encBase.toString()}&ir=directivos`;

    // ── ¿Viene de una evaluación? ───────────────────────────────────
    const cameDFromEval = sessionStorage.getItem(EVAL_FLAG) === '1';
    if (cameDFromEval) sessionStorage.removeItem(EVAL_FLAG);

    const cachedCal = portalCache.load();

    if (cameDFromEval && cachedCal) {
      // ── SOFT-REFRESH: datos pesados desde caché, solo eval se actualiza ──
      // Ocultar loading completo inmediatamente
      document.getElementById("loading")?.classList.add("hidden");

      // Restaurar desde caché sin petición
      const cfg = cachedCal.config || {};
      renderFechas(cfg);
      renderCalificaciones(cachedCal.calificaciones || {}, cfg);
      renderAccesoPortal(usuario.grupo);
      renderMaterias(usuario.grupo);
      renderPreguntas();
      lucide.createIcons();

      // Mostrar secciones según config cacheada
      const secDoc = document.getElementById("section-evaluacion-docentes");
      const secDir = document.getElementById("section-evaluacion-directivos");
      const secPec = document.getElementById("section-pec-encuesta");
      if (secDoc) secDoc.style.display = cfg.eval_docentes_activa ? 'block' : 'none';
      if (secDir) secDir.style.display = cfg.eval_docentes_activa ? 'block' : 'none';
      if (secPec) secPec.style.display = cfg.eval_pec_activa      ? 'block' : 'none';

      // Refresh parcial de evaluaciones con mini-spinner inline
      if (cfg.eval_docentes_activa) {
        _evalMiniSpinner("eval-loading-status",      true);
        _evalMiniSpinner("eval-dir-loading-status",  true);
        // Refrescar en paralelo
        Promise.all([
          renderEvalDocenteStatus(usuario.nombre,     usuario.grupo),
          renderEvalDirectivosStatus(usuario.nombre,  usuario.grupo),
        ]).catch(console.error);
      }

    } else {
      // ── CARGA COMPLETA ───────────────────────────────────────────
      renderPreguntas();
      lucide.createIcons();

      try {
        const [dataCal, dataEnc] = await Promise.all([
          portalAPI.getCalAlumno(usuario.curp),
          portalAPI.getEncuestaStatus(usuario.curp, "alumno"),
        ]);
        // Guardar en caché para la próxima vez
        portalCache.save(dataCal);

        const cfg = dataCal.config || {};
        renderFechas(cfg);
        renderCalificaciones(dataCal.calificaciones || {}, cfg);
        renderAccesoPortal(usuario.grupo);
        renderMaterias(usuario.grupo);

        if (dataEnc.respondido) mostrarEncuestaEnviada();

        const secDoc = document.getElementById("section-evaluacion-docentes");
        const secDir = document.getElementById("section-evaluacion-directivos");
        const secPec = document.getElementById("section-pec-encuesta");

        if (secDoc) {
          if (cfg.eval_docentes_activa) {
            secDoc.style.display = 'block';
            renderEvalDocenteStatus(usuario.nombre, usuario.grupo);
          } else {
            secDoc.style.display = 'none';
          }
        }
        if (secDir) {
          if (cfg.eval_docentes_activa) {
            secDir.style.display = 'block';
            renderEvalDirectivosStatus(usuario.nombre, usuario.grupo);
          } else {
            secDir.style.display = 'none';
          }
        }
        if (secPec) secPec.style.display = cfg.eval_pec_activa ? 'block' : 'none';

      } catch(e) {
        console.error(e);
      }
    }

  } catch(e) {
    console.error("Error en inicialización del portal:", e);
  } finally {
    document.getElementById("loading")?.classList.add("hidden");
    lucide.createIcons();
  }
});

// Mini-spinner inline para las tarjetas de evaluación (no bloquea el resto)
function _evalMiniSpinner(elId, show) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (show) {
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.gap = '0.5rem';
    el.innerHTML = `
      <span style="width:14px;height:14px;border:2px solid #e2e8f0;border-top-color:#059669;border-radius:50%;display:inline-block;animation:spin 0.6s linear infinite;flex-shrink:0;"></span>
      <span style="font-size:0.75rem;color:#94a3b8;">Actualizando...</span>`;
  } else {
    el.style.display = 'none';
  }
}

// ── FECHAS ──────────────────────────────────────────────────────────
function renderFechas(config) {
  const set = (id, val) => {
    const el = document.getElementById(id);
    el.textContent = val || "Por definir";
    if (!val) el.classList.add("empty");
  };
  set("fecha-captura",   config.portal_fecha_captura);
  set("fecha-aclaracion",config.portal_fecha_aclaracion);
  set("fecha-cierre",    config.portal_fecha_cierre);
}

// ── CALIFICACIONES ──────────────────────────────────────────────────
function renderCalificaciones(cal, config) {
  const grid = document.getElementById("grades-grid");
  if (!grid) return;

  // Renderizar los 3 parciales como anotaciones de libreta
  grid.innerHTML = [1, 2, 3].map(p => {
    const key    = "p" + p;
    const activa = config["portal_p" + p + "_activa"];
    const val    = cal[key];
    const esActivo = p == (config.parcial_activo || 1);

    if (!activa || val === null || val === undefined) {
      return `
        <div class="grade-card locked">
          <div class="grade-card-label">Parcial ${p}</div>
          <div class="locked-msg">
            <i data-lucide="lock"></i>
            <span>No disponible aún</span>
          </div>
        </div>`;
    }

    const colorClass = val >= 1.8 ? "excellent" : val >= 1.2 ? "warning" : "fail";
    const borderClass= val >= 1.8 ? "excellent-border" : val >= 1.2 ? "warning-border" : "fail-border";
    const statusText = val >= 1.8 ? "Aprobado" : val >= 1.2 ? "En riesgo" : "Reprobado";
    const statusClass= val >= 1.8 ? "aprobado"  : val >= 1.2 ? "riesgo"    : "reprobado";
    const pct = Math.round((val / 2) * 100);

    // Desglose de materias
    const mats = cal[key + "_materias"] || cal[key + "_detalle"] || [];
    let desgloseHTML = "";
    if (Array.isArray(mats) && mats.length > 0) {
      const items = mats.map(m => {
        const nombre = m.nombre || m.materia || m.name || "Materia";
        const nota   = typeof m.cal === "number" ? m.cal.toFixed(1)
                     : typeof m.puntaje === "number" ? m.puntaje.toFixed(1)
                     : m.cal ?? m.puntaje ?? "—";
        return `<span>${nombre}: <b>${nota}</b></span>`;
      }).join(' · ');
      desgloseHTML = `<div class="detalle-materias">${items}</div>`;
    }

    const colorFill = colorClass === 'excellent' ? '#059669' : colorClass === 'warning' ? '#d97706' : '#dc2626';
    const labelExtra = esActivo ? `<span class="status-proceso">Activo</span>` : '';

    return `
      <div class="grade-card ${borderClass}">
        <div style="min-width:62px;">
          <div class="grade-card-label">Parcial ${p} ${labelExtra}</div>
        </div>
        <div class="grade-number ${colorClass}">${val.toFixed(2)}</div>
        <div class="grade-of">/ 2.00</div>
        <div class="grade-bar" style="flex:1;">
          <div class="grade-bar-fill" style="width:${pct}%; background:${colorFill};"></div>
        </div>
        <div class="grade-status ${statusClass}">${statusText}</div>
      </div>
      ${desgloseHTML ? `<div style="padding:0 0.25rem 0.5rem;">${desgloseHTML}</div>` : ''}
    `;
  }).join("");

  lucide.createIcons();

  // Actualizar Metric Chip
  const activo = config.parcial_activo || 1;
  const valActivo = cal["p" + activo];
  const metricScore = document.getElementById("metric-score");
  if (metricScore && valActivo !== undefined && valActivo !== null) {
    metricScore.textContent = valActivo.toFixed(2);
    metricScore.style.color = valActivo >= 1.8 ? '#4ade80' : valActivo >= 1.2 ? '#facc15' : '#f87171';
  }
}




// ── CUESTIONARIO — RENDER ───────────────────────────────────────────
function renderPreguntas() {
  // Si los elementos no existen (sección PEC desactivada), no hacer nada
  const s1 = document.getElementById("step-1");
  const s2 = document.getElementById("step-2");
  if (!s1 || !s2) return;

  // Paso 1: preguntas 1-5
  s1.innerHTML = preguntasHTML(PREGUNTAS_ALU.slice(0,5), "q-green");
  // Paso 2: preguntas 6-10 + comentario
  s2.innerHTML =
    preguntasHTML(PREGUNTAS_ALU.slice(5,10), "q-green") +
    `<div class="survey-question">
       <div class="q-text" style="margin-bottom:.6rem;">
         ¿Tienes algún comentario adicional sobre el proceso PEC?
       </div>
       <textarea class="survey-textarea" id="comentarios" rows="4"
         placeholder="Comparte tus sugerencias, experiencias o comentarios (opcional)..."></textarea>
     </div>`;

  bindLikert();
}

function preguntasHTML(preguntas, colorClass) {
  return preguntas.map((p, i) => {
    const num = PREGUNTAS_ALU.indexOf(p) + 1;
    return `
      <div class="survey-question" id="wrap-${p.id}">
        <div class="q-text">
          <span class="q-num" style="background:#d1fae5;color:#047857;">${num}</span>
          ${p.texto}
        </div>
        <div class="likert-scale" data-qid="${p.id}">
          ${[1,2,3,4,5].map(v => `
            <button class="likert-btn" data-value="${v}" onclick="selLikert(this,'${p.id}',${v})">
              ${v}<small>${LABELS_LIKERT[v-1]}</small>
            </button>`).join("")}
        </div>
        <div class="likert-labels">
          <span>Muy deficiente</span><span>Excelente</span>
        </div>
        <div class="q-required" id="req-${p.id}">Por favor selecciona una opción</div>
      </div>`;
  }).join("");
}

function bindLikert() {
  // Asegurar que los botones tienen sus event listeners (ya están inline)
}

function selLikert(btn, qid, val) {
  respuestas[qid] = val;
  const scale = btn.closest(".likert-scale");
  scale.querySelectorAll(".likert-btn").forEach((b, i) => {
    b.classList.remove("sel-1","sel-2","sel-3","sel-4","sel-5");
    if (i + 1 === val) b.classList.add("sel-" + val);
  });
  // Ocultar mensaje de error si existía
  const req = document.getElementById("req-" + qid);
  if (req) req.classList.remove("show");
}

// ── WIZARD NAVIGATION ───────────────────────────────────────────────
function prevStep() {
  if (stepActual <= 1) return;
  setStep(stepActual - 1);
}

function nextStep() {
  // Validar preguntas del paso actual
  const pregsActuales = stepActual === 1 ? PREGUNTAS_ALU.slice(0,5) : PREGUNTAS_ALU.slice(5,10);
  let valid = true;
  pregsActuales.forEach(p => {
    if (!respuestas[p.id]) {
      document.getElementById("req-" + p.id)?.classList.add("show");
      valid = false;
    }
  });
  if (!valid) { scrollToFirst(); return; }

  if (stepActual < TOTAL_STEPS) setStep(stepActual + 1);
}

function setStep(n) {
  // Ocultar todos los pasos
  document.querySelectorAll(".survey-step").forEach(s => s.classList.remove("active"));
  document.getElementById("step-" + n)?.classList.add("active");

  // Actualizar barra de progreso
  document.getElementById("prog-current").textContent = n;
  [1,2].forEach(i => {
    const el = document.getElementById("prog-" + i);
    el.classList.remove("done","active");
    if (i < n) el.classList.add("done");
    else if (i === n) el.classList.add("active");
  });

  // Botones de navegación
  document.getElementById("btn-back").disabled = n === 1;
  const isLast = n === TOTAL_STEPS;
  document.getElementById("btn-next").style.display = isLast ? "none" : "inline-flex";
  document.getElementById("btn-send").style.display = isLast ? "inline-flex" : "none";

  stepActual = n;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function scrollToFirst() {
  const first = document.querySelector(".q-required.show");
  if (first) first.scrollIntoView({ behavior:"smooth", block:"center" });
}

// ── ENVIAR ENCUESTA ─────────────────────────────────────────────────
async function enviarEncuesta() {
  // Validar último paso
  const pregsActuales = PREGUNTAS_ALU.slice(5,10);
  let valid = true;
  pregsActuales.forEach(p => {
    if (!respuestas[p.id]) {
      document.getElementById("req-" + p.id)?.classList.add("show");
      valid = false;
    }
  });
  if (!valid) { scrollToFirst(); return; }

  const btn = document.getElementById("btn-send");
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner-ring" style="width:18px;height:18px;border-width:2px;"></div> Enviando...';

  try {
    const comentarios = document.getElementById("comentarios")?.value?.trim() || "";
    const data = await portalAPI.saveEncAlumno(usuario.curp, usuario.grupo, {
      ...respuestas, comentarios
    });
    if (data.status !== "success") throw new Error(data.message);
    mostrarEncuestaEnviada();
  } catch(e) {
    alert("Error al enviar: " + e.message);
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="send" style="width:16px;height:16px;"></i> Enviar evaluación';
    lucide.createIcons();
  }
}

function mostrarEncuestaEnviada() {
  document.getElementById("survey-form").style.display = "none";
  document.getElementById("survey-done").style.display = "flex";
}

// ── ACCESO DIRECTO AL PORTAL (Detección inteligente) ───────
function renderAccesoPortal(grupo) {
  const container = document.getElementById('portal-acceso-directo');
  if (!container) return;

  const semestre = String(grupo).substring(0, 1);
  let config = null;

  if (semestre === '2') {
    config = {
      titulo:    'Cultura Digital II',
      semLabel:  '2° Semestre',
      url:       '../cultura-digital/index.html',
      icon:      'monitor',
      bg:        'linear-gradient(135deg, #059669 0%, #10b981 100%)',
      bgLight:   '#d1fae5',
      color:     '#059669',
      shadow:    'rgba(5,150,105,0.30)',
    };
  } else if (semestre === '4') {
    config = {
      titulo:    'Cultura Digital III',
      semLabel:  '4° Semestre',
      url:       '../cultura-digital-iii/index.html',
      icon:      'layers',
      bg:        'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
      bgLight:   '#dbeafe',
      color:     '#0284c7',
      shadow:    'rgba(2,132,199,0.30)',
    };
  }

  if (!config) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  container.innerHTML = `
    <a href="${config.url}"
       onclick="sessionStorage.setItem('portal_came_from_eval','1')"
       style="display:flex; align-items:center; gap:0.75rem;
              background:${config.bg};
              border-radius:16px; padding:0.9rem 1.1rem;
              text-decoration:none; color:white;
              box-shadow:0 4px 18px ${config.shadow};
              border:none; width:100%; box-sizing:border-box;">
      <div style="width:40px; height:40px; border-radius:11px;
                  background:rgba(255,255,255,0.2); border:1.5px solid rgba(255,255,255,0.3);
                  display:flex; align-items:center; justify-content:center; flex-shrink:0;">
        <i data-lucide="${config.icon}" style="width:20px; height:20px; color:white;"></i>
      </div>
      <div style="flex:1; min-width:0;">
        <div style="font-size:0.6rem; font-weight:700; color:rgba(255,255,255,0.72);
                    text-transform:uppercase; letter-spacing:0.07em; margin-bottom:0.12rem;">
          ${config.semLabel} · Acceso rápido
        </div>
        <div style="font-size:0.95rem; font-weight:800; line-height:1.15;">${config.titulo}</div>
      </div>
      <i data-lucide="arrow-right" style="width:17px; height:17px; color:rgba(255,255,255,0.7); flex-shrink:0;"></i>
    </a>
  `;
  lucide.createIcons();
}

// ── MATERIAS DEL GRUPO (Informativo) ────────────────────────
async function renderMaterias(grupo) {
  const container = document.getElementById('materias-container');
  if (!container) return;

  try {
    const db = await getPecData();

    if (!db || !db.directorio) {
      container.innerHTML = '<p style="font-size:0.75rem; color:#94a3b8; padding:0.55rem 0;">Sin datos de materias.</p>';
      return;
    }

    // Normalización idéntica a la usada en eval docentes/directivos
    const norm        = (g) => String(g).toUpperCase().replace(/\s+/g,'').replace(/[°º]/g,'').replace(/^GRUPO/i,'');
    const soloDigitos = (g) => String(g).replace(/[^0-9]/g,'');
    const targetNorm  = norm(grupo);
    const isNum       = /^\d+$/.test(targetNorm);

    const filtrados = db.directorio.filter(d => {
      const gd = String(d.grupo || '');
      // Excluir registros genéricos (sin grupo asignado) — esos son directivos
      if (!gd || ['todos','all',''].includes(gd.toLowerCase())) return false;
      if (isNum) return soloDigitos(gd) === targetNorm;
      return norm(gd) === targetNorm;
    });

    if (filtrados.length === 0) {
      container.innerHTML = '<p style="font-size:0.75rem; color:#94a3b8; padding:0.55rem 0;">No hay materias registradas para este grupo.</p>';
      return;
    }

    container.innerHTML = filtrados.map(m => `
      <div style="display:flex; align-items:flex-start; gap:0.45rem;">
        <div style="width:24px; height:24px; border-radius:6px; background:#eff6ff; color:#1d4ed8;
                    display:flex; align-items:center; justify-content:center; flex-shrink:0;
                    font-size:0.58rem; font-weight:800; margin-top:1px;">
          ${(m.docente || '?').substring(0,2).toUpperCase()}
        </div>
        <div style="flex:1; min-width:0;">
          <div style="font-size:0.7rem; font-weight:600; color:#1e293b; line-height:1.2;
                      white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${m.docente}">${m.docente || 'Docente'}</div>
          <div style="font-size:0.62rem; color:#64748b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${m.materia || 'Materia'}</div>
          ${m.correo ? `<a href="mailto:${m.correo}" style="font-size:0.56rem; color:#2563eb; text-decoration:none; font-family:monospace; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:block;">${m.correo}</a>` : ''}
        </div>
      </div>`).join('');

    lucide.createIcons();
  } catch(e) {
    console.error("[renderMaterias] Error:", e);
    container.innerHTML = '<p style="font-size:0.75rem; color:#ef4444; padding:0.55rem 0;">Error al cargar materias.</p>';
  }
}

async function renderEvalDocenteStatus(nombre, grupo) {
  const loadingEl = document.getElementById("eval-loading-status");
  const progressEl = document.getElementById("eval-progress-container");
  const barFill    = document.getElementById("eval-bar-fill");
  const countText  = document.getElementById("eval-count-text");
  const percentText= document.getElementById("eval-percent-text");
  const btnGo      = document.getElementById("btn-eval-go");

  try {
    const prog = await portalAPI.getEvalDocenteProgress(nombre, grupo);
    
    if (loadingEl) loadingEl.style.display = "none";
    if (progressEl) progressEl.style.display = "block";

    const percent = prog.total > 0 ? Math.round((prog.listos / prog.total) * 100) : 0;
    
    // Update Metric Chip
    const metricEval = document.getElementById("metric-eval");
    if (metricEval) metricEval.textContent = percent + "%";

    if (barFill) barFill.style.width = percent + "%";
    if (percentText) percentText.textContent = percent + "%";

    const actionBox = document.getElementById("eval-action-box");
    
    if (countText) {
        if (prog.pendientes === 0 && prog.total > 0) {
          countText.innerHTML = '<span style="color:#059669; font-weight:800;">✨ Evaluación completada</span>';
          if (percentText) percentText.innerHTML = '<span style="color:#10b981">100%</span>';
          
          // Mostrar mensaje de éxito en lugar de la barra si está al 100%
          const card = document.querySelector('#section-evaluacion-docentes');
          if (card && !document.getElementById('eval-thanks')) {
             const thanks = document.createElement('div');
             thanks.id = 'eval-thanks';
             thanks.style.fontSize = '0.72rem';
             thanks.style.color = '#64748b';
             thanks.style.marginTop = '0.5rem';
             thanks.textContent = 'Gracias por tu valiosa participación en este proceso institucional.';
             card.appendChild(thanks);
          }
          if (actionBox) actionBox.style.display = "none";
        } else {
          countText.textContent = `Te faltan ${prog.pendientes} docentes por evaluar`;
          if (actionBox) actionBox.style.display = "block";
        }
      }

    if (btnGo) {
      btnGo.href = `../pec/encuesta.html?nombre=${encodeURIComponent(nombre)}&grupo=${encodeURIComponent(grupo)}&ir=profesores`;
    }

  } catch (e) {
    console.error("Error al renderizar progreso eval:", e);
    if (loadingEl) loadingEl.textContent = "Error al conectar con PEC.";
  }

}

// ── PROGRESO EVALUACIÓN DIRECTIVOS ────────────────────────────────
async function renderEvalDirectivosStatus(nombre, grupo) {
  const loadingEl   = document.getElementById("eval-dir-loading-status");
  const progressEl  = document.getElementById("eval-dir-progress-container");
  const barFill     = document.getElementById("eval-dir-bar-fill");
  const countText   = document.getElementById("eval-dir-count-text");
  const percentText = document.getElementById("eval-dir-percent-text");

  try {
    const db = await getPecData();

    if (!db || !db.directorio) {
      if (loadingEl) loadingEl.textContent = "Sin datos.";
      return;
    }

    const norm        = (g) => String(g).toUpperCase().replace(/\s+/g,'').replace(/[°º]/g,'').replace(/^GRUPO/i,'');
    const soloDigitos = (g) => String(g).replace(/[^0-9]/g,'');
    const targetNorm  = norm(grupo);
    const isNum       = /^\d+$/.test(targetNorm);

    // ── Paso 1: separar docentes regulares del directorio del grupo ──
    const grupoDocentes = db.directorio.filter(d => {
      if (isNum) return soloDigitos(String(d.grupo || '')) === targetNorm;
      return norm(String(d.grupo || '')) === targetNorm;
    });
    const docentesSet = new Set(grupoDocentes.map(d => d.docente));

    // ── Paso 2: buscar directivos en directorio por múltiples campos ──
    const camposDirectivo = ['rol','tipo','cargo','categoria','puesto','perfil'];
    let directivosEnDir = db.directorio.filter(d => {
      return camposDirectivo.some(f => {
        const v = String(d[f] || '').toLowerCase();
        return v.includes('direct') || v.includes('admin');
      });
    });

    // ── Paso 3: si no hay directivos en el directorio por rol,
    //           infíerelos del feedbackHistory del alumno:
    //           son evaluaciones donde el 'docente' NO es un docente regular del grupo
    const historialAlumno = (db.feedbackHistory || []).filter(h =>
      h.alumno === nombre && h.parcial === "Semestral"
    );

    let listos = 0;
    let total  = 0;

    if (directivosEnDir.length > 0) {
      const directivosSet = new Set(directivosEnDir.map(d => d.docente));
      total  = directivosSet.size;
      listos = historialAlumno.filter(h => directivosSet.has(h.docente)).length;
    } else {
      // Fallback: directivos = evaluaciones donde el docente NO es del grupo
      const evaluadosNoDocentes = [...new Set(
        historialAlumno
          .filter(h => !docentesSet.has(h.docente))
          .map(h => h.docente)
      )];
      listos = evaluadosNoDocentes.length;
      const todosDirectivos = db.directorio.filter(d => {
        const grupoVal = String(d.grupo || '').toLowerCase();
        return grupoVal === '' || grupoVal === 'todos' || grupoVal === 'all';
      });
      total = todosDirectivos.length > 0
        ? new Set(todosDirectivos.map(d => d.docente)).size
        : Math.max(1, listos);
    }

    const percent = total > 0 ? Math.round((listos / total) * 100) : (listos > 0 ? 100 : 0);

    if (loadingEl)   loadingEl.style.display   = 'none';
    if (progressEl)  progressEl.style.display  = 'block';
    if (barFill)     barFill.style.width        = Math.min(percent, 100) + '%';
    if (percentText) percentText.textContent    = Math.min(percent, 100) + '%';

    if (countText) {
      if (listos > 0 && listos >= total) {
        countText.innerHTML  = '<span style="color:#059669; font-weight:800;">✨ Evaluación completada</span>';
        if (percentText) percentText.innerHTML = '<span style="color:#059669">100%</span>';
        if (barFill) barFill.style.width = '100%';
        const actionBox = document.getElementById("eval-dir-action-box");
        if (actionBox) actionBox.style.display = "none";
      } else if (listos > 0) {
        const pend = total - listos;
        countText.textContent = `Te ${pend === 1 ? 'falta' : 'faltan'} ${pend} directivo${pend !== 1 ? 's' : ''} por evaluar`;
        const actionBox = document.getElementById("eval-dir-action-box");
        if (actionBox) actionBox.style.display = "block";
      } else {
        countText.textContent = 'Pendiente de evaluación';
        const actionBox = document.getElementById("eval-dir-action-box");
        if (actionBox) actionBox.style.display = "block";
      }
    }

    const btnGo = document.getElementById("btn-eval-dir-go");
    if (btnGo) {
      btnGo.href = `../pec/encuesta.html?nombre=${encodeURIComponent(nombre)}&grupo=${encodeURIComponent(grupo)}&ir=directivos`;
    }

  } catch(e) {
    console.error("[Directivos] Error:", e);
    if (loadingEl) loadingEl.textContent = "Error al conectar.";
  }
}

// ── LOGOUT ──────────────────────────────────────────────────────────
function logout() {
  portalSession.clear();
  window.location.href = "index.html";
}

