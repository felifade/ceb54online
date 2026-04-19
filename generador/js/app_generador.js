/* ════════════════════════════════════════════════════════════════
   app_generador.js — Bootstrap y Router del Generador de Horarios
   CEB 5/4 — v1.0.0
   ════════════════════════════════════════════════════════════════ */

// ── ESTADO GLOBAL ─────────────────────────────────────────────────
var _genApp = {
  adminKey:   null,       // null = no autenticado como admin
  config:     {},
  ciclo:      '',
  version:    'v1',
  docentes:   [],
  grupos:     [],
  materias:   [],
  aulas:      [],
  carga:      [],
  horarios:   [],
  currentMod: null
};

// Paleta de colores para materias (hasta 20)
var _GEN_PALETTE_ = [
  '#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6',
  '#06b6d4','#f97316','#84cc16','#ec4899','#14b8a6',
  '#6366f1','#eab308','#22c55e','#0ea5e9','#a855f7',
  '#f43f5e','#64748b','#7c3aed','#059669','#dc2626'
];
var _genColorMap_ = {};

function genGetMateriaColor(materia_id) {
  if (!_genColorMap_[materia_id]) {
    var keys = Object.keys(_genColorMap_);
    _genColorMap_[materia_id] = _GEN_PALETTE_[keys.length % _GEN_PALETTE_.length];
  }
  return _genColorMap_[materia_id];
}

// ── HELPERS UI ────────────────────────────────────────────────────

/** Muestra un toast de notificación. tipo: 'ok' | 'error' | 'info' | 'warning' */
function genToast(msg, tipo, duracion) {
  var container = document.getElementById('gen-toast-container');
  if (!container) return;
  var t = document.createElement('div');
  t.className = 'gen-toast gen-toast-' + (tipo || 'info');
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(function() { t.classList.add('gen-toast-show'); }, 10);
  setTimeout(function() {
    t.classList.remove('gen-toast-show');
    setTimeout(function() { if (t.parentNode) t.parentNode.removeChild(t); }, 400);
  }, duracion || 3500);
}

/** Muestra un spinner de carga en el área de contenido principal. */
function genShowLoading(texto) {
  var main = document.getElementById('gen-main-content');
  if (!main) return;
  main.innerHTML = '<div class="gen-loading"><div class="gen-spinner"></div><span>' +
    (texto || 'Cargando…') + '</span></div>';
}

/** Muestra un error grande en el área principal. */
function genShowError(msg) {
  var main = document.getElementById('gen-main-content');
  if (!main) return;
  main.innerHTML = '<div class="gen-empty-state gen-error-state">' +
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' +
    '<p>' + genEsc(msg) + '</p></div>';
}

/** Escapa HTML. */
function genEsc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/** Formatea nombre de docente. */
function genNombreDocente(d) {
  if (!d) return '—';
  return [d.nombre, d.apellido_paterno, d.apellido_materno].filter(Boolean).join(' ');
}

/** Busca un objeto por id en un array. */
function genById(arr, id) {
  return arr.find(function(x) { return String(x.id) === String(id); }) || null;
}

/** Formatea label de grupo. */
function genLabelGrupo(g) {
  if (!g) return '—';
  return g.grado + '°' + g.grupo;
}

// ── MODAL GENÉRICO ────────────────────────────────────────────────
var _genModal = {
  el: null,
  titleEl: null,
  bodyEl: null,
  footer: null,

  init() {
    this.el      = document.getElementById('gen-modal');
    this.titleEl = document.getElementById('gen-modal-title');
    this.bodyEl  = document.getElementById('gen-modal-body');
    this.footer  = document.getElementById('gen-modal-footer');
    var closeBtn = document.getElementById('gen-modal-close');
    if (closeBtn) closeBtn.addEventListener('click', () => this.close());
    if (this.el) this.el.addEventListener('click', (ev) => {
      if (ev.target === this.el) this.close();
    });
  },

  open(title, bodyHtml, footerHtml) {
    if (!this.el) this.init();
    this.titleEl.textContent = title;
    this.bodyEl.innerHTML    = bodyHtml;
    this.footer.innerHTML    = footerHtml || '';
    this.el.classList.add('gen-modal-open');
    // Focus primer input si existe
    var inp = this.bodyEl.querySelector('input, select, textarea');
    if (inp) setTimeout(function() { inp.focus(); }, 80);
  },

  close() {
    if (this.el) this.el.classList.remove('gen-modal-open');
  }
};

// ── MODAL DE CONFIRMACIÓN ─────────────────────────────────────────
function genConfirm(msg, onOk) {
  _genModal.open(
    'Confirmar',
    '<p class="gen-confirm-msg">' + genEsc(msg) + '</p>',
    '<button class="gen-btn gen-btn-secondary" onclick="_genModal.close()">Cancelar</button>' +
    '<button class="gen-btn gen-btn-danger" id="gen-confirm-ok">Eliminar</button>'
  );
  document.getElementById('gen-confirm-ok').addEventListener('click', function() {
    _genModal.close();
    onOk();
  });
}

// ── AUTENTICACIÓN ─────────────────────────────────────────────────

/** Comprueba si hay clave de admin (no valida contra servidor, local). */
function genIsAdmin() {
  return !!_genApp.adminKey;
}

/** Muestra el prompt de clave de administrador. */
function genAskAdmin(onSuccess) {
  _genModal.open(
    'Acceso de administrador',
    '<p style="margin-bottom:12px;color:var(--gen-muted)">Ingresa la clave de administrador para continuar.</p>' +
    '<input type="password" id="gen-admin-inp" class="gen-input" placeholder="Clave de administrador" autocomplete="off">',
    '<button class="gen-btn gen-btn-secondary" onclick="_genModal.close()">Cancelar</button>' +
    '<button class="gen-btn gen-btn-primary" id="gen-admin-ok">Ingresar</button>'
  );
  var inp = document.getElementById('gen-admin-inp');
  var doLogin = function() {
    var val = inp.value.trim();
    if (!val) { genToast('Ingresa la clave.', 'warning'); return; }
    _genApp.adminKey = val;
    sessionStorage.setItem('gen_admin_key', val);
    _genModal.close();
    genToast('Sesión de administrador iniciada.', 'ok');
    if (onSuccess) onSuccess();
  };
  document.getElementById('gen-admin-ok').addEventListener('click', doLogin);
  inp.addEventListener('keydown', function(ev) { if (ev.key === 'Enter') doLogin(); });
}

/** Ejecuta una acción que requiere admin. Si no está autenticado, pide la clave primero. */
function genRequireAdmin(fn) {
  if (genIsAdmin()) { fn(); return; }
  genAskAdmin(fn);
}

// ── ROUTER ────────────────────────────────────────────────────────
var _genModules_ = {};

/** Registra un módulo. Los módulos se auto-registran en sus propios archivos. */
function genRegisterModule(id, mod) {
  _genModules_[id] = mod;
}

/** Navega a un módulo dado su id. */
async function genNavTo(modId) {
  // Marcar nav activo
  document.querySelectorAll('.gen-nav-item').forEach(function(el) {
    el.classList.toggle('active', el.dataset.mod === modId);
  });

  var mod = _genModules_[modId];
  if (!mod) {
    genShowError('Módulo "' + modId + '" no encontrado.');
    return;
  }

  _genApp.currentMod = modId;
  genShowLoading();

  // Cerrar sidebar en móvil
  var sidebar = document.getElementById('gen-sidebar');
  if (sidebar) sidebar.classList.remove('open');

  try {
    await mod.render(document.getElementById('gen-main-content'));
  } catch (err) {
    genShowError('Error al cargar el módulo: ' + err.message);
    console.error(err);
  }
}

// ── SELECTOR DE CICLO ─────────────────────────────────────────────

function genUpdateCicloDisplay() {
  var el = document.getElementById('gen-ciclo-display');
  if (el) el.textContent = _genApp.ciclo || 'Sin ciclo';
}

function genSetCiclo(ciclo) {
  _genApp.ciclo = ciclo;
  sessionStorage.setItem('gen_ciclo', ciclo);
  genUpdateCicloDisplay();
  genClearCache();
  // Recargar módulo actual
  if (_genApp.currentMod) genNavTo(_genApp.currentMod);
}

// ── SIDEBAR TOGGLE (MÓVIL) ────────────────────────────────────────
function genToggleSidebar() {
  var sidebar = document.getElementById('gen-sidebar');
  if (sidebar) sidebar.classList.toggle('open');
}

// ── INICIALIZACIÓN ────────────────────────────────────────────────
async function genInit() {
  _genModal.init();

  // Restaurar sesión admin desde sessionStorage
  var savedKey = sessionStorage.getItem('gen_admin_key');
  if (savedKey) _genApp.adminKey = savedKey;

  // Restaurar ciclo
  var savedCiclo = sessionStorage.getItem('gen_ciclo');
  if (savedCiclo) _genApp.ciclo = savedCiclo;
  genUpdateCicloDisplay();

  // Wire nav items
  document.querySelectorAll('.gen-nav-item').forEach(function(el) {
    el.addEventListener('click', function() {
      genNavTo(el.dataset.mod);
    });
  });

  // Sidebar toggle
  var toggleBtn = document.getElementById('gen-sidebar-toggle');
  if (toggleBtn) toggleBtn.addEventListener('click', genToggleSidebar);

  // Botón cerrar sesión admin
  var logoutBtn = document.getElementById('gen-admin-logout');
  if (logoutBtn) logoutBtn.addEventListener('click', function() {
    _genApp.adminKey = null;
    sessionStorage.removeItem('gen_admin_key');
    genToast('Sesión de administrador cerrada.', 'info');
  });

  // Botón cambiar ciclo
  var cicloBtn = document.getElementById('gen-ciclo-btn');
  if (cicloBtn) cicloBtn.addEventListener('click', function() {
    _genModal.open(
      'Cambiar ciclo escolar',
      '<label class="gen-label">Ciclo escolar (ej. 2025-2026)</label>' +
      '<input type="text" id="gen-ciclo-inp" class="gen-input" value="' + genEsc(_genApp.ciclo) + '" placeholder="2025-2026">',
      '<button class="gen-btn gen-btn-secondary" onclick="_genModal.close()">Cancelar</button>' +
      '<button class="gen-btn gen-btn-primary" id="gen-ciclo-ok">Aplicar</button>'
    );
    document.getElementById('gen-ciclo-ok').addEventListener('click', function() {
      var val = document.getElementById('gen-ciclo-inp').value.trim();
      if (!val) { genToast('Ingresa un ciclo válido.', 'warning'); return; }
      _genModal.close();
      genSetCiclo(val);
      genToast('Ciclo cambiado a ' + val, 'ok');
    });
  });

  // Navegar al dashboard por defecto
  genNavTo('dashboard');
}

document.addEventListener('DOMContentLoaded', genInit);
