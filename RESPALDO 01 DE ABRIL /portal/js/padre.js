/**
 * PORTAL ESTUDIANTIL — Vista Padre/Tutor
 * Calificación PEC del hijo + Cuestionario institucional (4 secciones)
 */

// ── DEFINICIÓN DEL CUESTIONARIO ─────────────────────────────────────
const SECCIONES = [
  {
    id: "escuela",
    label: "Institución / Plantel",
    color: "#059669",
    preguntas: [
      { id:"e1", texto:"Las instalaciones del plantel son adecuadas, seguras y en buen estado." },
      { id:"e2", texto:"La comunicación entre la escuela y los padres de familia es efectiva y oportuna." },
      { id:"e3", texto:"El plantel garantiza la seguridad y el bienestar de los estudiantes." },
      { id:"e4", texto:"Los servicios administrativos (control escolar, trámites) son eficientes y amables." },
      { id:"e5", texto:"En general, recomendarías esta institución a otras familias del sector." },
    ]
  },
  {
    id: "director",
    label: "Director/a",
    color: "#1d4ed8",
    preguntas: [
      { id:"d1", texto:"Demuestra liderazgo efectivo y visión institucional clara." },
      { id:"d2", texto:"Atiende las necesidades y problemáticas de la comunidad escolar." },
      { id:"d3", texto:"Promueve un ambiente de respeto, inclusión y participación." },
      { id:"d4", texto:"Está accesible y disponible para escuchar a padres de familia y alumnos." },
    ]
  },
  {
    id: "subdirector",
    label: "Subdirector/a",
    color: "#7c3aed",
    preguntas: [
      { id:"s1", texto:"Apoya adecuadamente el proceso académico y el desarrollo de los estudiantes." },
      { id:"s2", texto:"Coordina de manera eficiente las actividades del plantel." },
      { id:"s3", texto:"Resuelve situaciones y problemas de forma oportuna y justa." },
      { id:"s4", texto:"Mantiene una comunicación clara y efectiva con padres y alumnos." },
    ]
  },
  {
    id: "general",
    label: "Evaluación General",
    color: "#d97706",
    isGeneral: true,
  }
];

const LABELS_LIKERT = ["Muy def.","Deficiente","Regular","Bueno","Excelente"];
const STEP_NAMES = ["Institución","Director/a","Subdirector/a","General"];

let usuario    = null;
let stepActual = 1;
const TOTAL_STEPS = 4;
const respuestas  = {};

// ── INICIALIZACIÓN ──────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  usuario = portalSession.requirePadre();
  if (!usuario) return;

  // Header
  document.getElementById("h-nombre").textContent = usuario.nombre;
  document.getElementById("h-hijo").textContent   = `Alumno: ${usuario.nombreHijo}`;
  document.getElementById("h-avatar").textContent =
    usuario.nombre.split(" ").slice(0,2).map(w => w[0]).join("").toUpperCase();

  // Info del hijo en la sección de calificaciones
  document.getElementById("hijo-nombre").textContent = usuario.nombreHijo || "tu hijo/a";
  document.getElementById("hijo-grupo").textContent  = usuario.grupoHijo  || "—";

  // Renderizar cuestionario vacío primero
  renderCuestionario();
  lucide.createIcons();

  // Cargar datos del servidor
  try {
    const [dataCal, dataEnc] = await Promise.all([
      portalAPI.getCalPadre(usuario.folio),
      portalAPI.getEncuestaStatus(usuario.folio, "padre"),
    ]);

    renderFechas(dataCal.config || {});
    renderCalificaciones(dataCal.calificaciones || {}, dataCal.config || {});

    // Nombres de directivos en el cuestionario
    if (dataCal.directivos) {
      const d = dataCal.directivos;
      document.getElementById("nombre-director").textContent    = d.director    || "Director General";
      document.getElementById("nombre-subdirector").textContent = d.subdirector || "Subdirector Académico";
    }

    if (dataEnc.respondido) mostrarEncuestaEnviada();

  } catch(e) {
    console.error(e);
  } finally {
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
  set("fecha-captura",    config.portal_fecha_captura);
  set("fecha-aclaracion", config.portal_fecha_aclaracion);
  set("fecha-cierre",     config.portal_fecha_cierre);
}

// ── CALIFICACIONES ──────────────────────────────────────────────────
function renderCalificaciones(cal, config) {
  const grid = document.getElementById("grades-grid");
  grid.innerHTML = [1,2,3].map(p => {
    const activa = config["portal_p" + p + "_activa"];
    const val    = cal["p" + p];

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

    return `
      <div class="grade-card">
        <div class="grade-card-label">Parcial ${p}</div>
        <div class="grade-number ${colorClass}">${val.toFixed(2)}</div>
        <div class="grade-of">de 2.00 pts</div>
        <div style="width:100%;background:#f1f5f9;border-radius:999px;height:6px;overflow:hidden;margin:2px 0;">
          <div style="height:100%;border-radius:999px;width:${pct}%;
            background:${colorClass==='excellent'?'#059669':colorClass==='warning'?'#d97706':'#dc2626'};
            transition:width .6s ease;"></div>
        </div>
        <div class="grade-status ${statusClass}">${statusText}</div>
      </div>`;
  }).join("");
  lucide.createIcons();
}

// ── CUESTIONARIO — RENDER ───────────────────────────────────────────
function renderCuestionario() {
  // Paso 1-3: preguntas Likert
  SECCIONES.slice(0,3).forEach((sec, idx) => {
    const el = document.getElementById("step-" + (idx+1));
    // Mantener el título ya en el HTML, solo agregar preguntas
    el.innerHTML += preguntasHTML(sec.preguntas, sec.color);
  });

  // Paso 4: calificación general + comentarios
  document.getElementById("step-4").innerHTML += `
    <div class="survey-question">
      <div class="q-text">¿Qué calificación (1 a 10) le otorgas al plantel en general?</div>
      <div class="rating-grid" id="rating-general">
        ${[1,2,3,4,5,6,7,8,9,10].map(v =>
          `<button class="rating-btn" data-value="${v}" onclick="selRating(this,${v})">${v}</button>`
        ).join("")}
      </div>
      <div class="q-required" id="req-cal_general">Por favor selecciona una calificación</div>
    </div>

    <div class="survey-question">
      <div class="q-text">Comentarios generales sobre el plantel y la experiencia educativa:</div>
      <textarea class="survey-textarea" id="comentarios" rows="4"
        placeholder="Escribe tus observaciones, lo que más te gustó o en qué puede mejorar..."></textarea>
    </div>

    <div class="survey-question">
      <div class="q-text">Sugerencias concretas de mejora para la institución:</div>
      <textarea class="survey-textarea" id="sugerencias" rows="3"
        placeholder="¿Qué cambios o mejoras propondrías? (opcional)"></textarea>
    </div>`;
}

function preguntasHTML(preguntas, color) {
  return preguntas.map((p, i) => `
    <div class="survey-question" id="wrap-${p.id}">
      <div class="q-text">
        <span class="q-num" style="background:${color}22;color:${color};">${i+1}</span>
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
    </div>`).join("");
}

// ── SELECCIÓN LIKERT ────────────────────────────────────────────────
function selLikert(btn, qid, val) {
  respuestas[qid] = val;
  btn.closest(".likert-scale").querySelectorAll(".likert-btn").forEach((b, i) => {
    b.classList.remove("sel-1","sel-2","sel-3","sel-4","sel-5");
    if (i + 1 === val) b.classList.add("sel-" + val);
  });
  document.getElementById("req-" + qid)?.classList.remove("show");
}

function selRating(btn, val) {
  respuestas["cal_general"] = val;
  document.querySelectorAll(".rating-btn").forEach(b => b.classList.remove("selected"));
  btn.classList.add("selected");
  document.getElementById("req-cal_general")?.classList.remove("show");
}

// ── WIZARD NAVIGATION ───────────────────────────────────────────────
function prevStep() {
  if (stepActual <= 1) return;
  setStep(stepActual - 1);
}

function nextStep() {
  if (!validarPasoActual()) return;
  if (stepActual < TOTAL_STEPS) setStep(stepActual + 1);
}

function validarPasoActual() {
  if (stepActual === 4) {
    if (!respuestas["cal_general"]) {
      document.getElementById("req-cal_general")?.classList.add("show");
      scrollToFirst();
      return false;
    }
    return true;
  }
  const sec = SECCIONES[stepActual - 1];
  let valid = true;
  sec.preguntas.forEach(p => {
    if (!respuestas[p.id]) {
      document.getElementById("req-" + p.id)?.classList.add("show");
      valid = false;
    }
  });
  if (!valid) scrollToFirst();
  return valid;
}

function setStep(n) {
  document.querySelectorAll(".survey-step").forEach(s => s.classList.remove("active"));
  document.getElementById("step-" + n)?.classList.add("active");

  // Barra de progreso
  document.getElementById("prog-current").textContent = n;
  document.getElementById("prog-name").textContent    = STEP_NAMES[n-1];
  [1,2,3,4].forEach(i => {
    const el = document.getElementById("prog-" + i);
    el.classList.remove("done","active");
    if (i < n) el.classList.add("done");
    else if (i === n) el.classList.add("active");
  });

  // Botones
  document.getElementById("btn-back").disabled = n === 1;
  const isLast = n === TOTAL_STEPS;
  document.getElementById("btn-next").style.display = isLast ? "none"        : "inline-flex";
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
  if (!validarPasoActual()) return;

  const btn = document.getElementById("btn-send");
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner-ring" style="width:18px;height:18px;border-width:2px;"></div> Enviando...';

  try {
    const data = await portalAPI.saveEncPadre(usuario.folio, {
      ...respuestas,
      comentarios: document.getElementById("comentarios")?.value?.trim() || "",
      sugerencias:  document.getElementById("sugerencias")?.value?.trim()  || "",
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
