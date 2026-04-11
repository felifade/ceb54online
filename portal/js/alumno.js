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

// ── INICIALIZACIÓN ──────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  try {
    usuario = portalSession.requireAlumno();
    if (!usuario) return;

    // Header
    document.getElementById("h-nombre").textContent = usuario.nombre;
    document.getElementById("h-grupo").textContent  = `Grupo ${usuario.grupo}`;
    document.getElementById("h-avatar").textContent =
      usuario.nombre.split(" ").slice(0,2).map(w => w[0]).join("").toUpperCase();

    // Links a la encuesta de docentes/directivos con datos pre-cargados
    const encuestaBase = "../pec/encuesta.html";
    const encBase = new URLSearchParams({ nombre: usuario.nombre, grupo: usuario.grupo });
    const lp = document.getElementById("link-profesores");
    const ld = document.getElementById("link-directivos");
    if (lp) lp.href = `${encuestaBase}?${encBase}&ir=profesores`;
    if (ld) ld.href = `${encuestaBase}?${encBase}&ir=directivos`;

    // Renderizar cuestionario (solo si los elementos existen en el DOM)
    renderPreguntas();
    lucide.createIcons();

    // Cargar datos del servidor
    try {
      const [dataCal, dataEnc] = await Promise.all([
        portalAPI.getCalAlumno(usuario.curp),
        portalAPI.getEncuestaStatus(usuario.curp, "alumno"),
      ]);
      // DEBUG — revisa en consola si la API devuelve materias por parcial
      console.log("DEBUG portal cal:", JSON.stringify(dataCal, null, 2));
      const cfg = dataCal.config || {};
      renderFechas(cfg);
      renderCalificaciones(dataCal.calificaciones || {}, cfg);
      if (dataEnc.respondido) mostrarEncuestaEnviada();
      // Mostrar/ocultar secciones según config del servidor
      const secDoc = document.getElementById("section-evaluacion-docentes");
      const secPec = document.getElementById("section-pec-encuesta");
      if (secDoc) secDoc.style.display = cfg.eval_docentes_activa ? '' : 'none';
      if (secPec) secPec.style.display = cfg.eval_pec_activa      ? '' : 'none';
    } catch(e) {
      console.error(e);
    }
  } catch(e) {
    console.error("Error en inicialización del portal:", e);
  } finally {
    // Siempre ocultar el loading, pase lo que pase
    document.getElementById("loading").classList.add("hidden");
    lucide.createIcons();
  }
});

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
  grid.innerHTML = [1,2,3].map(p => {
    const key    = "p" + p;
    const activa = config["portal_p" + p + "_activa"];
    const val    = cal[key];

    if (!activa || val === null || val === undefined) {
      return `
        <div class="grade-card locked">
          <div class="grade-card-label">Parcial ${p}</div>
          <div class="locked-msg">
            <i data-lucide="lock" style="width:28px;height:28px;"></i>
            <span>No disponible</span>
          </div>
        </div>`;
    }

    const colorClass = val >= 1.8 ? "excellent" : val >= 1.2 ? "warning" : "fail";
    const statusText = val >= 1.8 ? "Aprobado" : val >= 1.2 ? "En riesgo" : "Reprobado";
    const statusClass= val >= 1.8 ? "aprobado" : val >= 1.2 ? "riesgo"    : "reprobado";
    const pct = Math.round((val / 2) * 100);

    // Desglose por materia — busca p1_materias, p1_detalle o materias dentro del objeto
    // La API puede devolver el desglose bajo cualquiera de estas claves
    const mats = cal[key + "_materias"] || cal[key + "_detalle"] || [];
    let desgloseHTML = "";
    if (Array.isArray(mats) && mats.length > 0) {
      const items = mats.map(m => {
        const nombre = m.nombre || m.materia || m.name || "Materia";
        const nota   = typeof m.cal === "number" ? m.cal.toFixed(1)
                     : typeof m.puntaje === "number" ? m.puntaje.toFixed(1)
                     : m.cal ?? m.puntaje ?? "—";
        return `<span style="white-space:nowrap;">${nombre}: <strong style="color:#374151;">${nota}</strong></span>`;
      }).join('<span style="color:#d1d5db;"> &middot; </span>');
      desgloseHTML = `<div class="detalle-materias">${items}</div>`;
    }

    return `
      <div class="grade-card">
        <div class="grade-card-label">Parcial ${p}</div>
        <div class="grade-number ${colorClass}">${val.toFixed(2)}</div>
        <div class="grade-of">de 2.00 pts</div>
        <div style="width:100%; background:#f1f5f9; border-radius:999px; height:6px; overflow:hidden; margin:2px 0;">
          <div style="height:100%; border-radius:999px; width:${pct}%;
            background:${colorClass==='excellent'?'#059669':colorClass==='warning'?'#d97706':'#dc2626'};
            transition:width .6s ease;"></div>
        </div>
        <div class="grade-status ${statusClass}">${statusText}</div>
        ${desgloseHTML}
      </div>`;
  }).join("");

  lucide.createIcons();
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

// ── LOGOUT ──────────────────────────────────────────────────────────
function logout() {
  portalSession.clear();
  window.location.href = "index.html";
}
