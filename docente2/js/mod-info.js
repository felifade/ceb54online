/* ═══════════════════════════════════════════════════════════
   Docente 2.0 — mod-info.js
   Módulo: Información General
   Lee identidad desde sessionStorage (establecida en login)
   ═══════════════════════════════════════════════════════════ */

/* ── SVG helpers ─────────────────────────────────────────── */
function _d2Svg(p) {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + p + '</svg>';
}
var _D2I = {
  user:     _d2Svg('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
  school:   _d2Svg('<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>'),
  cal:      _d2Svg('<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>'),
  mail:     _d2Svg('<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>'),
  link:     _d2Svg('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'),
  monitor:  _d2Svg('<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>'),
  code:     _d2Svg('<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>'),
  tutorias: _d2Svg('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
  pec:      _d2Svg('<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>'),
  portal:   _d2Svg('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>'),
  globe:    _d2Svg('<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>'),
  role:     _d2Svg('<rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>'),
};

/* ── Render principal ────────────────────────────────────── */
function d2RenderInfo() {
  var container = document.getElementById('d2-mod-info');
  if (!container) return;

  /* Leer identidad desde sessionStorage (ya establecida por login) */
  var nombre = sessionStorage.getItem('user_name')  || '—';
  var email  = sessionStorage.getItem('user_email') || '—';
  var rol    = sessionStorage.getItem('user_role')  || 'Docente';

  container.innerHTML = [
    _heroHTML(nombre, rol),
    _datosHTML(nombre, email, rol),
    _calendarHTML(),
    _quickLinksHTML(email),
  ].join('');

  _initCalWidget();
}

/* ── Hero card ───────────────────────────────────────────── */
function _heroHTML(nombre, rol) {
  /* Initials */
  var parts = nombre.trim().split(/\s+/);
  var ini   = parts.length >= 2
    ? (parts[0][0] + parts[parts.length-1][0]).toUpperCase()
    : nombre.slice(0,2).toUpperCase();

  return [
    '<div class="d2-profile-hero">',
      '<div class="d2-profile-avatar">' + ini + '</div>',
      '<div style="flex:1;min-width:0;">',
        '<div class="d2-profile-name">' + _esc(nombre) + '</div>',
        '<div class="d2-profile-role">CEB 5/4 "Profr. Rafael Ramírez"</div>',
        '<div class="d2-profile-chips">',
          '<span class="d2-chip indigo">' + _esc(rol) + '</span>',
          '<span class="d2-chip green">Sesión activa</span>',
          '<span class="d2-chip slate">Ciclo 2025-2026</span>',
        '</div>',
      '</div>',
    '</div>',
  ].join('');
}

/* ── Datos generales ─────────────────────────────────────── */
function _datosHTML(nombre, email, rol) {
  return [
    '<div class="d2-card">',
      '<div class="d2-card-header">',
        '<div class="d2-card-icon indigo">' + _D2I.user + '</div>',
        '<span class="d2-card-title">Datos generales</span>',
      '</div>',
      '<div class="d2-card-body">',
        '<div class="d2-info-grid">',
          _row(_D2I.user,    'Nombre',              _esc(nombre)),
          _row(_D2I.role,    'Rol',                 _esc(rol)),
          _row(_D2I.school,  'Institución',         'CEB 5/4 "Profr. Rafael Ramírez"'),
          _row(_D2I.cal,     'Ciclo escolar',       '2025 – 2026'),
          _row(_D2I.mail,    'Correo institucional', _esc(email)),
        '</div>',
      '</div>',
    '</div>',
  ].join('');
}

function _row(ico, lbl, val) {
  return [
    '<div class="d2-info-row">',
      '<div class="d2-info-ico">' + ico + '</div>',
      '<div>',
        '<div class="d2-info-lbl">' + lbl + '</div>',
        '<div class="d2-info-val">' + val + '</div>',
      '</div>',
    '</div>',
  ].join('');
}

/* ── Calendario — widget semana escolar ──────────────────── */
var _d2CalView = 'semana'; /* 'semana' | 'completo' */

function _calendarHTML() {
  return [
    '<div class="d2-card" style="overflow:hidden;">',
      '<div class="d2-card-header" style="gap:0.5rem;">',
        '<div class="d2-card-icon indigo">' + _D2I.cal + '</div>',
        '<span class="d2-card-title" style="flex:1;">Calendario escolar</span>',
        /* toggle buttons */
        '<div class="d2-cal-toggle" id="d2-cal-toggle">',
          '<button class="d2-cal-tbtn active" id="d2-cal-btn-semana" onclick="_d2CalSwitch(\'semana\')">',
            _d2Svg('<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/>'),
            'Esta semana',
          '</button>',
          '<button class="d2-cal-tbtn" id="d2-cal-btn-completo" onclick="_d2CalSwitch(\'completo\')">',
            _d2Svg('<polyline points="8 6 2 12 8 18"/><polyline points="16 6 22 12 16 18"/>'),
            'Por días',
          '</button>',
        '</div>',
      '</div>',
      '<div style="padding:0 1rem 1rem;">',
        '<div id="d2-cal-loading" style="display:flex;align-items:center;gap:0.6rem;' +
             'padding:1.5rem 0;color:#94a3b8;font-size:0.82rem;">',
          '<div style="width:16px;height:16px;border:2px solid #e2e8f0;' +
               'border-top-color:#6366f1;border-radius:50%;' +
               'animation:d2spin 0.7s linear infinite;flex-shrink:0;"></div>',
          'Cargando calendario…',
        '</div>',
        '<div id="semana-actual-widget" class="semana-actual" style="display:none;margin:0;"></div>',
        '<div id="d2-cal-full" style="display:none;"></div>',
      '</div>',
    '</div>',
  ].join('');
}

function _d2CalSwitch(view) {
  _d2CalView = view;
  var btnS = document.getElementById('d2-cal-btn-semana');
  var btnC = document.getElementById('d2-cal-btn-completo');
  if (btnS) btnS.classList.toggle('active', view === 'semana');
  if (btnC) btnC.classList.toggle('active', view === 'completo');

  var ws = document.getElementById('semana-actual-widget');
  var wf = document.getElementById('d2-cal-full');
  if (!ws || !wf) return;

  if (view === 'semana') {
    ws.style.display = 'block';
    wf.style.display = 'none';
  } else {
    ws.style.display = 'none';
    wf.style.display = 'block';
    if (!wf.dataset.rendered) {
      wf.dataset.rendered = '1';
      _d2RenderCalendarioDias();
    }
  }
}

/* ── Carga scripts del calendario y renderiza el widget ──── */
var _d2CalListening = false;
var _d2CalScriptsLoaded = false;

function _initCalWidget() {
  /* Si los datos ya están listos (scripts ya cargados antes), renderizar */
  if (typeof cronogramaMap !== 'undefined' && cronogramaMap !== null) {
    _d2RenderSemanaActual();
    return;
  }
  /* Registrar listener una sola vez */
  if (!_d2CalListening) {
    _d2CalListening = true;
    document.addEventListener('calendarioDataLista', _d2RenderSemanaActual);
  }
  /* Cargar scripts */
  if (_d2CalScriptsLoaded) return;
  _d2CalScriptsLoaded = true;
  var s1 = document.createElement('script');
  s1.src = '../pec/js/api_calendario.js?v=20260421';
  s1.onload = function() {
    var s2 = document.createElement('script');
    s2.src = '../pec/js/app_calendario.js?v=20260421';
    document.head.appendChild(s2);
  };
  document.head.appendChild(s1);
}

/* ── Render del widget — lógica extraída de acceso.html ──── */
function _d2RenderSemanaActual() {
  var widget  = document.getElementById('semana-actual-widget');
  var loading = document.getElementById('d2-cal-loading');
  if (!widget) return;
  if (typeof cronogramaMap === 'undefined' || !cronogramaMap) return;

  if (loading) loading.style.display = 'none';
  widget.style.display = 'block';

  var hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  var sem = cronogramaMap.find(function(s) { return hoy >= s.start && hoy <= s.end; });
  if (!sem) {
    widget.innerHTML = '<p class="semana-vacia-msg" style="padding:0.5rem 0;">Sin semana activa en el calendario.</p>';
    return;
  }

  var parcialMap = {
    1:'1er Parcial', 2:'1er Parcial', 3:'1er Parcial', 4:'1er Parcial', 5:'1er Parcial',
    6:'2do Parcial', 7:'2do Parcial', 8:'2do Parcial', 9:'2do Parcial', 10:'2do Parcial',
    11:'3er Parcial', 12:'3er Parcial', 13:'3er Parcial', 14:'3er Parcial', 15:'3er Parcial',
    16:'Evaluación Global'
  };
  var parcialLabel = parcialMap[sem.num] || '';

  var catIcon = { evaluacion:'📝', reunion:'👥', restriccion:'🚫',
                  control:'📁', academico:'🎓', festivo:'🎉', vacaciones:'🏖️' };

  /* Cumpleaños de la semana */
  var cumplesSemana = (typeof CUMPLEANOS !== 'undefined' ? CUMPLEANOS : []).filter(function(c) {
    var s = (typeof getInfoSemana === 'function') ? getInfoSemana(c.fecha) : null;
    return s && s.start.getTime() === sem.start.getTime();
  });
  var cumplesHTML = !cumplesSemana.length ? '' :
    '<div class="semana-cumples-box">' +
      '<b>🎂 Cumpleaños</b>' +
      '<span class="cumple-nombres">' +
        cumplesSemana.map(function(c) {
          return c.nombre + ' (' + (typeof formatearFechaSimple === 'function' ? formatearFechaSimple(c.fecha) : c.fecha) + ')';
        }).join(', ') +
      '</span>' +
    '</div>';

  /* Semana vacacional */
  if (sem.esVacaciones) {
    widget.innerHTML =
      '<div class="semana-actual-head">' +
        '<div>' +
          '<div class="semana-actual-num">🏖️ ' + sem.label + '</div>' +
          '<div class="semana-actual-rango">' + (typeof formatearRango === 'function' ? formatearRango(sem.start, sem.end) : '') + '</div>' +
          '<span class="semana-actual-parcial">PERÍODO VACACIONAL</span>' +
        '</div>' +
        '<span class="semana-actual-badge"><span class="dot-live"></span>Esta semana</span>' +
      '</div>' +
      '<div class="semana-actual-items">' +
        '<p class="semana-vacia-msg">Período de descanso — sin actividades escolares.</p>' +
        cumplesHTML +
      '</div>';
    return;
  }

  /* Semana académica */
  var fClave = typeof FECHAS_CLAVE !== 'undefined' ? FECHAS_CLAVE : [];
  var periodos = typeof PERIODOS_ESPECIALES !== 'undefined' ? PERIODOS_ESPECIALES : [];

  var eventosSemana = fClave.filter(function(ev) {
    var d = new Date(ev.fecha + 'T00:00:00');
    return d >= sem.start && d <= sem.end;
  });
  var periodosSemana = periodos.filter(function(p) {
    if (p.tipo === 'periodo') {
      var ps = new Date(p.inicio + 'T00:00:00'), pe = new Date(p.fin + 'T00:00:00');
      return ps <= sem.end && pe >= sem.start;
    }
    var d = new Date(p.fecha + 'T00:00:00');
    return d >= sem.start && d <= sem.end;
  });

  var hayEventos = eventosSemana.length || periodosSemana.length;
  var itemsHTML = !hayEventos
    ? '<p class="semana-vacia-msg">Sin eventos académicos para esta semana.</p>'
    : eventosSemana.map(function(ev) {
        return '<div class="semana-item">' +
          '<span class="semana-item-icon">' + (catIcon[ev.categoria] || '📌') + '</span>' +
          '<span class="semana-item-text">' + ev.titulo + '</span>' +
          '<span class="semana-item-cat cat-' + (ev.categoria || 'academico') + '">' + (ev.categoria || 'evento') + '</span>' +
        '</div>';
      }).join('') +
      periodosSemana.map(function(p) {
        return '<div class="semana-item">' +
          '<span class="semana-item-icon">' + (catIcon[p.categoria] || '📌') + '</span>' +
          '<span class="semana-item-text">' + p.titulo + '</span>' +
          '<span class="semana-item-cat cat-' + (p.categoria || 'academico') + '">' + (p.categoria || 'periodo') + '</span>' +
        '</div>';
      }).join('');

  widget.innerHTML =
    '<div class="semana-actual-head">' +
      '<div>' +
        '<div class="semana-actual-num">' + sem.label + '</div>' +
        '<div class="semana-actual-rango">' + (typeof formatearRango === 'function' ? formatearRango(sem.start, sem.end) : '') + '</div>' +
        (parcialLabel ? '<span class="semana-actual-parcial">' + parcialLabel + '</span>' : '') +
      '</div>' +
      '<span class="semana-actual-badge"><span class="dot-live"></span>Esta semana</span>' +
    '</div>' +
    '<div class="semana-actual-items">' + itemsHTML + cumplesHTML + '</div>';
}

/* ── Vista por días del semestre ─────────────────────────── */
function _d2RenderCalendarioDias() {
  var container = document.getElementById('d2-cal-full');
  if (!container) return;
  if (typeof cronogramaMap === 'undefined' || !cronogramaMap) return;

  var hoy = new Date(); hoy.setHours(0,0,0,0);
  var fClave   = typeof FECHAS_CLAVE       !== 'undefined' ? FECHAS_CLAVE       : [];
  var periodos = typeof PERIODOS_ESPECIALES !== 'undefined' ? PERIODOS_ESPECIALES : [];
  var cumples  = typeof CUMPLEANOS         !== 'undefined' ? CUMPLEANOS         : [];

  var DIAS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  var LAB  = [1,2,3,4,5];
  var CAT_COLOR = {
    evaluacion: { bg:'#fef3c7', bd:'#d97706', tx:'#92400e' },
    reunion:    { bg:'#ede9fe', bd:'#7c3aed', tx:'#4c1d95' },
    control:    { bg:'#e0f2fe', bd:'#0284c7', tx:'#0c4a6e' },
    academico:  { bg:'#dcfce7', bd:'#16a34a', tx:'#14532d' },
    restriccion:{ bg:'#fee2e2', bd:'#dc2626', tx:'#991b1b' },
    festivo:    { bg:'#f1f5f9', bd:'#94a3b8', tx:'#475569' }
  };

  /* construir mapa fecha → eventos */
  var mapaEv = {};
  var addEv = function(fecha, item) {
    if (!fecha) return;
    var k = String(fecha).substring(0,10);
    if (!mapaEv[k]) mapaEv[k] = [];
    mapaEv[k].push(item);
  };
  fClave.forEach(function(ev) { addEv(ev.fecha, { t:'ev', obj:ev }); });
  periodos.forEach(function(p) {
    if (!p.inicio) return;
    var cur = new Date(p.inicio + 'T00:00:00');
    var fin = new Date((p.fin || p.inicio) + 'T00:00:00');
    while (cur <= fin) { addEv(cur.toISOString().substring(0,10), { t:'ev', obj:p }); cur.setDate(cur.getDate()+1); }
  });
  cumples.forEach(function(c) { addEv(c.fecha, { t:'cumple', obj:c }); });

  var html = '';
  cronogramaMap.forEach(function(sem) {
    var esVac  = sem.esVacaciones;
    var esHoySem = !esVac && hoy >= sem.start && hoy <= sem.end;
    var rango  = typeof formatearRango === 'function' ? formatearRango(sem.start, sem.end) : '';

    /* encabezado oscuro */
    html += '<div style="margin-bottom:1rem;border-radius:10px;border:1px solid ' +
            (esHoySem ? 'rgba(99,102,241,0.3)' : '#e2e8f0') +
            ';overflow:hidden;box-shadow:' + (esHoySem ? '0 0 0 2px rgba(99,102,241,0.15)' : 'none') + ';">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.4rem;' +
            'padding:0.5rem 0.75rem;background:' + (esVac ? '#f1f5f9' : '#0f172a') +
            ';border-bottom:2px solid ' + (esVac ? '#e2e8f0' : '#1e293b') + ';">';
    html += '<div style="display:flex;align-items:center;gap:0.5rem;">';
    html += '<span style="font-size:0.68rem;font-weight:800;text-transform:uppercase;letter-spacing:1px;' +
            'color:' + (esVac ? '#64748b' : '#94a3b8') + ';">' + sem.label + '</span>';
    if (esHoySem) html += '<span style="font-size:0.6rem;background:#059669;color:#fff;padding:1px 7px;border-radius:20px;font-weight:700;">HOY</span>';
    if (esVac)    html += '<span style="font-size:0.6rem;background:#e2e8f0;color:#64748b;padding:1px 7px;border-radius:20px;font-weight:700;">VACACIONAL</span>';
    html += '</div>';
    html += '<span style="font-size:0.68rem;color:' + (esVac ? '#94a3b8' : '#64748b') + ';">' + rango + '</span>';
    html += '</div>';

    if (esVac) {
      html += '<div style="padding:0.6rem 0.75rem;background:#f8fafc;font-size:0.78rem;color:#94a3b8;font-style:italic;">' +
              'Período vacacional — sin actividades académicas</div>';
    } else {
      /* grid de días Lun–Vie */
      html += '<div style="display:flex;flex-wrap:wrap;background:#fff;">';
      LAB.forEach(function(numDia) {
        var d = new Date(sem.start);
        while (d.getDay() !== numDia && d <= sem.end) d.setDate(d.getDate()+1);
        if (d > sem.end) return;
        var key = d.toISOString().substring(0,10);
        var esHoyDia = d.getTime() === hoy.getTime();
        var items = mapaEv[key] || [];
        var evs   = items.filter(function(i) { return i.t === 'ev'; });
        var cps   = items.filter(function(i) { return i.t === 'cumple'; });

        html += '<div style="flex:1;min-width:0;border-left:1px solid ' + (esHoyDia ? '#059669' : '#f1f5f9') +
                ';padding:0.35rem 0.4rem;background:' + (esHoyDia ? '#f0fdf4' : '#fff') + ';min-height:52px;">';
        html += '<div style="font-size:0.62rem;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;' +
                'color:' + (esHoyDia ? '#059669' : '#94a3b8') + ';margin-bottom:3px;">' + DIAS[numDia] + '</div>';

        evs.forEach(function(i) {
          var cat = i.obj.categoria || 'academico';
          var c   = CAT_COLOR[cat] || CAT_COLOR.academico;
          html += '<div style="font-size:0.65rem;padding:2px 5px;border-radius:4px;margin-bottom:2px;' +
                  'background:' + c.bg + ';border-left:2px solid ' + c.bd + ';color:' + c.tx +
                  ';line-height:1.25;font-weight:500;">' + (i.obj.titulo || i.obj.nombre || '') + '</div>';
        });
        cps.forEach(function(i) {
          var nombre = i.obj.nombre.split(' ').slice(0,2).join(' ');
          html += '<div style="font-size:0.62rem;color:#d97706;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' +
                  i.obj.nombre + '">🎂 ' + nombre + '</div>';
        });
        if (!evs.length && !cps.length)
          html += '<span style="font-size:0.62rem;color:#e2e8f0;">—</span>';

        html += '</div>';
      });
      html += '</div>';
    }

    html += '</div>';
  });

  container.innerHTML = '<div style="max-height:500px;overflow-y:auto;padding-right:2px;">' + html + '</div>';
}

/* ── Accesos rápidos (dependen del email autenticado) ────── */
function _quickLinksHTML(email) {
  /* Links base para todos los docentes */
  var links = [
    { ico: _D2I.tutorias, label: 'Tutorías',       action: "d2GoMod('tutorias')" },
    { ico: _D2I.pec,      label: 'PEC',             action: "d2GoMod('pec')" },
    { ico: _D2I.portal,   label: 'Portal Alumnos',  href: '../portal/alumno.html' },
    { ico: _D2I.globe,    label: 'Sitio CEB 5/4',   href: '/' },
  ];

  /* Agregar materias específicas del docente */
  var materiasMap = {
    'felifade@icloud.com': [
      { ico: _D2I.monitor, label: 'Cultura Digital II',  href: '../cultura-digital/index.html' },
      { ico: _D2I.code,    label: 'Cultura Digital III', href: '../cultura-digital-iii/index.html' },
    ]
  };
  var extra = materiasMap[(email || '').toLowerCase().trim()] || [];
  /* Insertar materias antes de los links genéricos */
  links = extra.concat(links);

  var items = links.map(function(l) {
    var onclick = l.href
      ? 'window.open("' + l.href + '","_blank")'
      : l.action;
    return [
      '<button class="d2-quicklink" onclick="' + onclick + '">',
        '<div class="d2-quicklink-icon">' + l.ico + '</div>',
        l.label,
      '</button>',
    ].join('');
  }).join('');

  return [
    '<div class="d2-card">',
      '<div class="d2-card-header">',
        '<div class="d2-card-icon amber">' + _D2I.link + '</div>',
        '<span class="d2-card-title">Accesos rápidos</span>',
      '</div>',
      '<div class="d2-card-body">',
        '<div class="d2-quicklinks">' + items + '</div>',
      '</div>',
    '</div>',
  ].join('');
}

/* ── Navegar a módulo desde quick-link ───────────────────── */
function d2GoMod(modId) {
  var btn = document.querySelector('.d2-nav-item[data-mod="' + modId + '"]');
  if (btn) btn.click();
}

/* ── Escape HTML ─────────────────────────────────────────── */
function _esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
