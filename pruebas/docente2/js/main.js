/* ═══════════════════════════════════════════════════════════
   Docente 2.0 — main.js
   ─ Login único con correo/contraseña (mismo API que tutorias)
   ─ Establece las mismas sessionStorage keys que tutorias/pec
     → auth.js de cada módulo NO redirige al login
   ─ Un solo iframe por módulo; pestañas controlan vista interna
     vía contentDocument DOM manipulation (mismo origen)
   ─ Materias dinámicas según email autenticado
   ═══════════════════════════════════════════════════════════ */

(function() {

  /* ── API — mismo endpoint que tutorias/js/api.js ─────── */
  var API_URL = 'https://script.google.com/macros/s/AKfycbz4q9VlhAvvVJ1XYOwqNTJ9eMkVRm3HgoyFJNpEQaPJsDdK1JcfhbTX1CRfDg38x79fsA/exec';

  /* ── Materias por docente (email → módulos externos) ─── */
  var _FELIPE_MATERIAS = [
    { label: 'Cultura Digital II',  href: '../cultura-digital/index.html',    icon: 'monitor' },
    { label: 'Cultura Digital III', href: '../cultura-digital-iii/index.html', icon: 'code' }
  ];
  var MATERIA_MAP = {
    'felifade@icloud.com':    _FELIPE_MATERIAS,
    'd.flopez54@dgb.edu.mx': _FELIPE_MATERIAS
  };

  /* Íconos SVG inline para las materias */
  var MATERIA_ICONS = {
    monitor: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
    code:    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>'
  };

  /* El chrome de los iframes se oculta via ?d2embed=1 en la URL
     (clase .d2-embedded en <html> aplicada antes de que cargue el CSS) */

  /* ── Etiquetas de vistas para el loader ─────────────── */
  var TUT_VIEW_LABELS = {
    dashboard: 'Dashboard', captura: 'Registrar sesión',
    historial: 'Historial', reporte: 'Generar reporte', encuesta: 'Opinión estudiantil'
  };
  var PEC_VIEW_LABELS = {
    pecportal: 'Portal PEC', dashboard: 'Dashboard', rapida: 'Vista rápida',
    directorio: 'Directorio', auditoria: 'Auditoría',
    grupos: 'Evaluar equipos', edicion: 'Editar capturas'
  };

  function setLoaderSub(subId, label) {
    var el = document.getElementById(subId);
    if (el) el.textContent = label ? label : '';
  }

  /* ── Estado interno ──────────────────────────────────── */
  var state = {
    mod:          'info',
    tutView:      'dashboard',
    pecView:      'pecportal',
    tutLoaded:    false,
    pecLoaded:    false,
    tutQueue:     null,
    pecQueue:     null,
    pecInCalif:   false   /* true cuando el iframe está mostrando calificaciones.html */
  };

  var MOD_META = {
    info:     { title: 'Información General', sub: 'Datos del docente · Accesos rápidos' },
    tutorias: { title: 'Tutorías',            sub: 'Registro de sesiones, historial y reportes' },
    pec:      { title: 'PEC',                 sub: 'Proyecto Educativo Colaborativo — CEB 5/4' },
    horario:  { title: 'Horario',             sub: 'Horario definitivo de clases — CEB 5/4' },
    sabanas:  { title: 'Mis Calificaciones',  sub: 'Calificaciones por materia · Parciales · Global' },
    curps:       { title: 'Buscar CURP',            sub: 'Consulta rápida de CURP de alumnos' },
    materia:     { title: 'Mi Materia',             sub: 'Portal de actividades del docente' },
    prefectura:  { title: 'Reportes de Uniforme',   sub: 'Seguimiento de incidencias · Prefectura' },
    directorio:  { title: 'Directorio PEC',          sub: 'Grupos · Materias · Ponderaciones por parcial' },
    edicion_pec:      { title: 'Edición Rápida PEC',              sub: 'Modificación ágil de evaluaciones · Solo autorizado' },
    intrasemestral:   { title: 'Calificaciones Intrasemestrales', sub: 'Consulta previa · Feb–Jun 2026 · Temporal' }
  };

  /* Emails autorizados para herramientas especiales (CURP + portal docente) */
  var ESPECIAL_EMAILS = ['felifade@icloud.com', 'd.flopez54@dgb.edu.mx'];
  var _sabanasLoaded = false;

  /* ── DOM refs ────────────────────────────────────────── */
  var loginOverlay = document.getElementById('d2-login-overlay');
  var loginForm    = document.getElementById('d2-login-form');
  var loginError   = document.getElementById('d2-login-error');
  var loginBtn     = document.getElementById('d2-login-btn');
  var app          = document.getElementById('d2-app');
  var sidebar      = document.getElementById('d2-sidebar');
  var mainArea     = document.querySelector('.d2-main');
  var sideOver     = document.getElementById('d2-sidebar-overlay');
  var hamburger    = document.getElementById('d2-hamburger');
  var btnLogout    = document.getElementById('d2-btn-logout');
  var btnCollapse     = document.getElementById('d2-btn-collapse');
  var pecSubnavDash   = document.getElementById('d2-pec-subnav-dash');
  var pecSubnavCap    = document.getElementById('d2-pec-subnav-cap');

  /* ════════════════════════════════════════════════════════
     LOGIN
  ════════════════════════════════════════════════════════ */
  loginForm.addEventListener('submit', function(e) {
    e.preventDefault();
    var email    = document.getElementById('d2-email').value.trim().toLowerCase();
    var password = document.getElementById('d2-password').value;

    setLoginBusy(true);
    hideLoginError();

    fetch(API_URL, {
      method:  'POST',
      body:    JSON.stringify({ action: 'login', email: email, password: password }),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      redirect: 'follow'
    })
    .then(function(r) { return r.json(); })
    .then(function(result) {
      if (result.status === 'success') {
        var rol = result.rol || '';
        if (rol === 'Administrativo') {
          showLoginError('Este acceso es exclusivo para docentes. Ingresa desde el Portal Administrativo.');
          return;
        }
        sessionStorage.setItem('tutorias_auth', 'true');
        sessionStorage.setItem('user_name',  result.nombre || email);
        sessionStorage.setItem('user_email', email);
        sessionStorage.setItem('user_role',  rol || 'Docente');
        sessionStorage.setItem('session_ts', Date.now());
        showApp();
      } else {
        showLoginError(result.message || 'Credenciales incorrectas. Verifica e intenta de nuevo.');
      }
    })
    .catch(function() {
      showLoginError('Error de conexión con el servidor. Intenta de nuevo.');
    })
    .finally(function() {
      setLoginBusy(false);
    });
  });

  function setLoginBusy(busy) {
    loginBtn.disabled = busy;
    loginBtn.innerHTML = busy
      ? '<div class="d2-spinner" style="width:16px;height:16px;border-width:2px;border-top-color:#fff;"></div> Verificando…'
      : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:17px;height:17px;"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg> Entrar al sistema';
  }

  function showLoginError(msg) {
    loginError.textContent = msg;
    loginError.classList.add('show');
  }
  function hideLoginError() {
    loginError.classList.remove('show');
  }

  /* ════════════════════════════════════════════════════════
     SESIÓN
  ════════════════════════════════════════════════════════ */
  /* Verificar sesión activa al cargar */
  (function() {
    var auth  = sessionStorage.getItem('tutorias_auth');
    var email = sessionStorage.getItem('user_email');
    var role  = sessionStorage.getItem('user_role');
    if (auth === 'true' && email) {
      if (role === 'Administrativo') {
        sessionStorage.removeItem('tutorias_auth');
        sessionStorage.removeItem('user_email');
        sessionStorage.removeItem('user_name');
        sessionStorage.removeItem('user_role');
      } else {
        showApp();
      }
    }
  })();

  function showApp() {
    loginOverlay.classList.add('fade-out');
    setTimeout(function() {
      loginOverlay.classList.add('hidden');
      app.style.display = 'block';
      initApp();
    }, 280);
  }

  function initApp() {
    populateSidebarUser();
    populateMaterias();
    setupEspecial();
    activateMod('info');
    if (typeof d2RenderInfo === 'function') d2RenderInfo();
  }

  /* Exponer logout al window para que los iframes puedan llamarlo */
  window.d2Logout = doLogout;

  function doLogout() {
    sessionStorage.removeItem('tutorias_auth');
    sessionStorage.removeItem('user_name');
    sessionStorage.removeItem('user_email');
    sessionStorage.removeItem('user_role');
    sessionStorage.removeItem('d2_mod');
    window.location.href = '../index.html';
  }

  btnLogout.addEventListener('click', doLogout);

  /* ════════════════════════════════════════════════════════
     SIDEBAR USER INFO
  ════════════════════════════════════════════════════════ */
  function populateSidebarUser() {
    var name = sessionStorage.getItem('user_name') || '—';
    var role = sessionStorage.getItem('user_role') || 'Docente';
    document.getElementById('d2-sidebar-uname').textContent = name;
    document.getElementById('d2-sidebar-urole').textContent = role + ' · CEB 5/4';
    /* Initials avatar */
    var parts    = name.trim().split(/\s+/);
    var initials = parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
    document.getElementById('d2-sidebar-avatar').textContent = initials;
  }

  /* ════════════════════════════════════════════════════════
     MATERIAS DINÁMICAS
  ════════════════════════════════════════════════════════ */
  function populateMaterias() {
    var email    = (sessionStorage.getItem('user_email') || '').toLowerCase().trim();
    var materias = MATERIA_MAP[email] || [];
    if (!materias.length) return;

    /* Si es usuario especial, las materias se inyectan en setupEspecial — no aquí */
    if (ESPECIAL_EMAILS.indexOf(email) !== -1) return;

    var wrap  = document.getElementById('d2-nav-materias');
    var items = document.getElementById('d2-materias-items');
    if (!wrap || !items) return;

    items.innerHTML = materias.map(function(m) {
      var ico = MATERIA_ICONS[m.icon] || MATERIA_ICONS['monitor'];
      return '<button class="d2-nav-item" data-mod="materia" data-href="' + m.href + '" data-label="' + m.label + '">' +
               ico + '<span>' + m.label + '</span>' +
             '</button>';
    }).join('');
    wrap.style.display = 'block';

    items.querySelectorAll('.d2-nav-item').forEach(function(btn) {
      btn.addEventListener('click', function() {
        activateMateria(btn.dataset.href, btn.dataset.label);
      });
    });
  }

  /* Carga una materia en el iframe compartido */
  function activateMateria(href, label) {
    /* Actualizar topbar con el nombre de la materia */
    document.getElementById('d2-topbar-title').textContent = label || 'Mi Materia';
    document.getElementById('d2-topbar-sub').textContent   = 'Portal de actividades del docente';

    /* Marcar activo en sidebar */
    document.querySelectorAll('.d2-nav-item[data-mod]').forEach(function(b) {
      b.classList.toggle('active', b.dataset.mod === 'materia' && b.dataset.href === href);
    });

    /* Mostrar panel */
    document.querySelectorAll('.d2-module').forEach(function(el) {
      el.classList.toggle('active', el.id === 'd2-mod-materia');
    });

    var iframe  = document.getElementById('d2-iframe-materia');
    var loading = document.getElementById('d2-materia-loading');
    var title   = document.getElementById('d2-materia-loader-title');

    /* Recargar solo si cambió la URL */
    var fullHref = href + (href.indexOf('?') === -1 ? '?' : '&') + 'd2embed=1';
    var needsLoad = iframe.getAttribute('src') !== fullHref;

    if (needsLoad) {
      if (title)   title.textContent = 'Cargando ' + (label || 'materia') + '…';
      if (loading) loading.classList.remove('hidden');
      iframe.onload = function() {
        if (loading) loading.classList.add('hidden');
      };
      iframe.src = fullHref;
    }

    closeSidebar();
    window.scrollTo(0, 0);
  }

  /* ════════════════════════════════════════════════════════
     HERRAMIENTAS ESPECIALES (Felipe / Admin)
  ════════════════════════════════════════════════════════ */
  function setupEspecial() {
    var email = (sessionStorage.getItem('user_email') || '').toLowerCase().trim();
    var role  = (sessionStorage.getItem('user_role')  || '').toLowerCase();
    var isEspecial = ESPECIAL_EMAILS.indexOf(email) !== -1 || role.indexOf('admin') !== -1 || role.indexOf('direct') !== -1;
    if (!isEspecial) return;

    var navEsp = document.getElementById('d2-nav-especial');
    if (!navEsp) return;
    navEsp.style.display = 'block';

    /* Inyectar materias del docente al inicio de la sección especial */
    var materias = MATERIA_MAP[email] || [];
    if (materias.length) {
      var label = navEsp.querySelector('.d2-nav-label');
      materias.forEach(function(m) {
        var ico = MATERIA_ICONS[m.icon] || MATERIA_ICONS['monitor'];
        var btn = document.createElement('button');
        btn.className = 'd2-nav-item';
        btn.dataset.mod   = 'materia';
        btn.dataset.href  = m.href;
        btn.dataset.label = m.label;
        btn.innerHTML = ico + '<span>' + m.label + '</span>';
        btn.addEventListener('click', function() { activateMateria(m.href, m.label); });
        navEsp.insertBefore(btn, label ? label.nextSibling : null);
      });
    }

    /* Reportes de Uniforme → módulo embebido */
    var btnUni = document.getElementById('d2-nav-btn-uniforme');
    if (btnUni) btnUni.addEventListener('click', function() { activateMod('prefectura'); });

    /* Directorio PEC → módulo nativo */
    var btnDir = document.getElementById('d2-nav-btn-directorio');
    if (btnDir) btnDir.addEventListener('click', function() { activateMod('directorio'); });

    /* Botón CURPs → activar módulo */
    var btnCurps = navEsp.querySelector('[data-mod="curps"]');
    if (btnCurps) {
      btnCurps.addEventListener('click', function() { activateMod('curps'); });
    }

    /* Edición Rápida PEC */
    var btnEdPec = document.getElementById('d2-nav-btn-edicion-pec');
    if (btnEdPec) btnEdPec.addEventListener('click', function() { activateMod('edicion_pec'); });
  }

  /* ════════════════════════════════════════════════════════
     MÓDULO NAVIGATION
  ════════════════════════════════════════════════════════ */
  document.querySelectorAll('.d2-nav-item[data-mod]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var mod = btn.dataset.mod;
      if (mod && mod !== 'ext') activateMod(mod);
    });
  });

  function activateMod(modId) {
    state.mod = modId;
    sessionStorage.setItem('d2_mod', modId);

    /* Sidebar active */
    document.querySelectorAll('.d2-nav-item[data-mod]').forEach(function(b) {
      b.classList.toggle('active', b.dataset.mod === modId);
    });

    /* Module panels */
    document.querySelectorAll('.d2-module').forEach(function(el) {
      el.classList.toggle('active', el.id === 'd2-mod-' + modId);
    });

    /* Topbar */
    var meta = MOD_META[modId];
    if (meta) {
      document.getElementById('d2-topbar-title').textContent = meta.title;
      document.getElementById('d2-topbar-sub').textContent   = meta.sub;
    }

    /* Lazy-load iframes / módulos nativos */
    if (modId === 'tutorias') lazyLoadTutorias();
    if (modId === 'pec')      lazyLoadPec();
    if (modId === 'horario' && typeof d2RenderHorario === 'function') d2RenderHorario();
    if (modId === 'sabanas')  lazyLoadSabanas();
    if (modId === 'curps')       loadCurps();
    if (modId === 'prefectura')  lazyLoadPrefectura();
    if (modId === 'directorio')  initDirectorio();
    if (modId === 'edicion_pec')    initEdicionPEC();
    if (modId === 'intrasemestral') lazyLoadIntrasemestral();

    closeSidebar();
    window.scrollTo(0, 0);
  }

  /* ════════════════════════════════════════════════════════
     MÓDULO: BUSCAR CURP
  ════════════════════════════════════════════════════════ */
  var _curpsData = null;   /* caché local */

  function loadCurps() {
    if (_curpsData) { d2CurpRender(_curpsData, ''); return; }
    var status = document.getElementById('d2-curp-status');
    var wrap   = document.getElementById('d2-curp-table-wrap');
    if (status) status.style.display = 'block';
    if (wrap)   wrap.style.display   = 'none';

    fetch(API_URL + '?action=getAlumnos&_t=' + Date.now())
      .then(function(r) { return r.json(); })
      .then(function(res) {
        var alumnos = (res.alumnos || []).filter(function(a) {
          return a.nombre || a.curp;
        });
        /* Ordenar por grupo luego nombre */
        alumnos.sort(function(a, b) {
          var g = String(a.grupo || '').localeCompare(String(b.grupo || ''));
          if (g !== 0) return g;
          return String(a.nombre || '').localeCompare(String(b.nombre || ''));
        });
        _curpsData = alumnos;
        d2CurpRender(alumnos, '');
      })
      .catch(function(err) {
        if (status) status.textContent = 'Error al cargar la lista. Intenta de nuevo.';
        console.error('[CURP]', err);
      });
  }

  function d2CurpRender(alumnos, query) {
    var status = document.getElementById('d2-curp-status');
    var wrap   = document.getElementById('d2-curp-table-wrap');
    var tbody  = document.getElementById('d2-curp-tbody');
    var footer = document.getElementById('d2-curp-footer');
    if (!tbody) return;

    var q = (query || '').toLowerCase().trim();
    var filtered = q
      ? alumnos.filter(function(a) {
          return (String(a.nombre || '')).toLowerCase().indexOf(q) !== -1
              || (String(a.curp   || '')).toLowerCase().indexOf(q) !== -1
              || (String(a.grupo  || '')).toLowerCase().indexOf(q) !== -1;
        })
      : alumnos;

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="padding:1.5rem; text-align:center; color:var(--d2-text-muted);">Sin resultados para "' + query + '"</td></tr>';
    } else {
      tbody.innerHTML = filtered.map(function(a, i) {
        var curp = String(a.curp || '—');
        return '<tr style="border-top:1px solid var(--d2-border); transition:background .15s;" '
          + 'onmouseover="this.style.background=\'var(--d2-surface)\'" onmouseout="this.style.background=\'\'">'
          + '<td style="padding:.6rem 1rem; color:var(--d2-text-muted);">' + (i+1) + '</td>'
          + '<td style="padding:.6rem 1rem; font-weight:600;">' + (a.nombre || '—') + '</td>'
          + '<td style="padding:.6rem 1rem;">' + (a.grupo || '—') + '</td>'
          + '<td style="padding:.6rem 1rem; font-family:monospace; font-size:.82rem; letter-spacing:.02em;">' + curp + '</td>'
          + '<td style="padding:.6rem 1rem; text-align:center;">'
          + '<button onclick="navigator.clipboard.writeText(\'' + curp + '\').then(function(){var b=this;b.textContent=\'✓\';setTimeout(function(){b.textContent=\'📋\';},1200);}.bind(this))" '
          + 'style="background:none; border:1px solid var(--d2-border); border-radius:6px; padding:.25rem .5rem; cursor:pointer; font-size:.9rem;" title="Copiar CURP">📋</button>'
          + '</td></tr>';
      }).join('');
    }

    if (footer) footer.textContent = filtered.length + ' alumno' + (filtered.length !== 1 ? 's' : '') + (q ? ' encontrado' + (filtered.length !== 1 ? 's' : '') : ' en total');
    if (status) status.style.display = 'none';
    if (wrap)   wrap.style.display   = 'block';
  }

  /* Exponer filtro al HTML inline */
  window.d2CurpFilter = function(q) {
    if (_curpsData) d2CurpRender(_curpsData, q);
  };

  /* ════════════════════════════════════════════════════════
     IFRAME — TUTORÍAS  (carga lazy, chrome oculto)
  ════════════════════════════════════════════════════════ */
  function lazyLoadTutorias() {
    var iframe = document.getElementById('d2-iframe-tutorias');
    if (state.tutLoaded) return;                /* ya cargado */
    if (iframe.src && iframe.src !== 'about:blank') return; /* en proceso */

    iframe.onload = function() {
      overrideIframeLogout(iframe);
      state.tutLoaded = true;
      hidePanelLoader('d2-tutorias-loading');

      /* Restaurar última vista — pequeño delay para que d2SwitchView esté listo */
      if (state.tutQueue) {
        var _tq = state.tutQueue;
        state.tutQueue = null;
        setTimeout(function() { tutSwitchView(_tq); }, 80);
      }
    };

    iframe.src = '../../tutorias/index.html?d2embed=1';
  }

  /* ════════════════════════════════════════════════════════
     IFRAME — PEC  (carga lazy, chrome oculto)
  ════════════════════════════════════════════════════════ */
  function lazyLoadPec() {
    var iframe = document.getElementById('d2-iframe-pec');
    if (state.pecLoaded) return;
    if (iframe.src && iframe.src !== 'about:blank') return;

    iframe.onload = function() {
      overrideIframeLogout(iframe);
      state.pecLoaded = true;
      hidePanelLoader('d2-pec-loading');

      if (state.pecQueue) {
        var _pq = state.pecQueue;
        state.pecQueue = null;
        setTimeout(function() { pecSwitchView(_pq); }, 80);
      }
    };

    iframe.src = '../pec/index.html?d2embed=1';
  }

  /* El logout dentro del iframe está oculto por .d2-embedded,
     así que no es necesario sobrescribirlo */
  function overrideIframeLogout() {}

  /* ── Loaders de panel ──────────────────────────────────── */
  function hidePanelLoader(id) {
    var el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  }
  function showPanelLoader(id) {
    var el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
  }

  /* ════════════════════════════════════════════════════════
     TAB SWITCHING — controla vista dentro del iframe
  ════════════════════════════════════════════════════════ */

  /* Tutorías: selectores .nav-link[data-view="X"] */
  document.getElementById('d2-tabs-tutorias').querySelectorAll('.d2-tab').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var view = btn.dataset.view;
      setTabActive('d2-tabs-tutorias', view);
      state.tutView = view;
      if (state.tutLoaded) {
        tutSwitchView(view);
      } else {
        state.tutQueue = view;
        setLoaderSub('d2-tutorias-loading-sub', TUT_VIEW_LABELS[view] || view);
        lazyLoadTutorias();
      }
    });
  });

  /* PEC — 3 pestañas principales (data-group) */
  document.getElementById('d2-tabs-pec').querySelectorAll('.d2-tab').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var group = btn.dataset.group;
      setPecGroupActive(group);

      if (group === 'calif') {
        state.pecInCalif = true;
        var iframe = document.getElementById('d2-iframe-pec');
        showPanelLoader('d2-pec-loading');
        setLoaderSub('d2-pec-loading-sub', 'Calificaciones');
        iframe.onload = function() { hidePanelLoader('d2-pec-loading'); };
        iframe.src = '../pec/calificaciones.html?d2embed=1';
        return;
      }

      /* Si veníamos de calificaciones, recargar index.html */
      var reloadNeeded = state.pecInCalif;
      if (reloadNeeded) {
        state.pecInCalif = false;
        state.pecLoaded  = false;
        document.getElementById('d2-iframe-pec').removeAttribute('src');
      }

      var view = group === 'cap'
        ? _subnavActiveView(pecSubnavCap, 'grupos')
        : _subnavActiveView(pecSubnavDash, 'dashboard');

      state.pecView  = view;
      state.pecQueue = view;

      if (!reloadNeeded && state.pecLoaded) {
        pecSwitchView(view);
      } else {
        setLoaderSub('d2-pec-loading-sub', PEC_VIEW_LABELS[view] || view);
        lazyLoadPec();
      }
    });
  });

  /* Sub-nav Dashboard */
  if (pecSubnavDash) {
    pecSubnavDash.querySelectorAll('.d2-subnav-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        _setSubnavActive(pecSubnavDash, btn.dataset.subview);
        state.pecView = btn.dataset.subview;
        if (state.pecLoaded) pecSwitchView(btn.dataset.subview);
        else {
          state.pecQueue = btn.dataset.subview;
          setLoaderSub('d2-pec-loading-sub', PEC_VIEW_LABELS[btn.dataset.subview] || btn.dataset.subview);
          lazyLoadPec();
        }
      });
    });
  }

  /* Sub-nav Captura */
  if (pecSubnavCap) {
    pecSubnavCap.querySelectorAll('.d2-subnav-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        _setSubnavActive(pecSubnavCap, btn.dataset.subview);
        state.pecView = btn.dataset.subview;
        if (state.pecLoaded) pecSwitchView(btn.dataset.subview);
        else {
          state.pecQueue = btn.dataset.subview;
          setLoaderSub('d2-pec-loading-sub', PEC_VIEW_LABELS[btn.dataset.subview] || btn.dataset.subview);
          lazyLoadPec();
        }
      });
    });
  }

  function setPecGroupActive(group) {
    document.getElementById('d2-tabs-pec').querySelectorAll('.d2-tab').forEach(function(b) {
      b.classList.toggle('active', b.dataset.group === group);
    });
    if (pecSubnavDash) pecSubnavDash.style.display = (group === 'dash')  ? 'flex' : 'none';
    if (pecSubnavCap)  pecSubnavCap.style.display  = (group === 'cap')   ? 'flex' : 'none';
  }

  function _setSubnavActive(nav, view) {
    if (!nav) return;
    nav.querySelectorAll('.d2-subnav-btn').forEach(function(b) {
      b.classList.toggle('active', b.dataset.subview === view);
    });
  }

  function _subnavActiveView(nav, fallback) {
    if (!nav) return fallback;
    var active = nav.querySelector('.d2-subnav-btn.active');
    return active ? active.dataset.subview : fallback;
  }

  function setTabActive(tabsId, view) {
    document.getElementById(tabsId).querySelectorAll('.d2-tab').forEach(function(b) {
      b.classList.toggle('active', b.dataset.view === view);
    });
  }

  /* postMessage funciona tanto en file:// como en http://:
     el iframe recibe el mensaje en su listener 'message' */
  function tutSwitchView(view) {
    var iframe = document.getElementById('d2-iframe-tutorias');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'd2SwitchView', view: view }, '*');
    }
  }

  function pecSwitchView(view) {
    var iframe = document.getElementById('d2-iframe-pec');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'd2SwitchView', view: view }, '*');
    }
  }

  /* ════════════════════════════════════════════════════════
     MOBILE SIDEBAR
  ════════════════════════════════════════════════════════ */
  hamburger.addEventListener('click', function() {
    sidebar.classList.toggle('open');
    sideOver.classList.toggle('active');
  });
  sideOver.addEventListener('click', closeSidebar);

  function closeSidebar() {
    sidebar.classList.remove('open');
    sideOver.classList.remove('active');
  }

  /* ════════════════════════════════════════════════════════
     SIDEBAR COLLAPSE TOGGLE
  ════════════════════════════════════════════════════════ */
  if (btnCollapse) {
    btnCollapse.addEventListener('click', function() {
      var collapsed = sidebar.classList.toggle('collapsed');
      if (mainArea) mainArea.classList.toggle('sidebar-collapsed', collapsed);
    });
  }

  /* ════════════════════════════════════════════════════════
     MÓDULO: MIS CALIFICACIONES (SÁBANAS)
  ════════════════════════════════════════════════════════ */
  function lazyLoadSabanas() {
    if (_sabanasLoaded) return;
    _sabanasLoaded = true;

    var container = document.getElementById('d2-sab-body');
    container.innerHTML = '<div style="text-align:center;padding:3rem;color:#94a3b8"><span style="font-size:2rem;display:inline-block;animation:spin 1s linear infinite">⏳</span><p style="margin-top:0.5rem;font-size:0.85rem">Cargando calificaciones…</p></div>';

    var nombre = sessionStorage.getItem('user_name') || '';
    if (!nombre) {
      container.innerHTML = '<div style="text-align:center;padding:3rem;color:#94a3b8">No se encontró sesión activa. Intenta cerrar sesión y volver a entrar.</div>';
      return;
    }

    var qs = new URLSearchParams({ action: 'getCalifSabanasDocente', docente: nombre, _t: Date.now() }).toString();
    fetch(API_URL + '?' + qs, { redirect: 'follow' })
      .then(function(r){ return r.json(); })
      .then(function(data) {
        if (data.error || !data.registros) {
          container.innerHTML = '<div style="text-align:center;padding:3rem;color:#64748b">No se encontraron calificaciones para <strong>' + nombre + '</strong>.</div>';
          return;
        }
        _renderSabanas(container, data.registros, nombre);
      })
      .catch(function(err) {
        container.innerHTML = '<div style="color:#dc2626;padding:1rem">Error al cargar: ' + (err&&err.message||String(err)) + '</div>';
      });
  }

  function _renderSabanas(container, regs, nombre) {
    if (!regs.length) {
      container.innerHTML = '<div style="text-align:center;padding:3rem;color:#94a3b8">Sin calificaciones registradas para ' + nombre + '.</div>';
      return;
    }

    // Detectar parciales disponibles (>5% de registros con valor)
    var n = regs.length || 1;
    var p1c = regs.filter(function(r){ return _sabNum(r.p1_total)!==null; }).length;
    var p2c = regs.filter(function(r){ return _sabNum(r.p2_total)!==null; }).length;
    var p3c = regs.filter(function(r){ return _sabNum(r.p3_total)!==null; }).length;
    var glc = regs.filter(function(r){ return _sabNum(r.global)!==null; }).length;
    var parcDisp = { p1: p1c>n*0.05, p2: p2c>n*0.05, p3: p3c>n*0.05, gl: glc>n*0.05 };

    // Estado parcial seleccionado (expuesto globalmente para onclick)
    window._sabSelParc = window._sabSelParc || 'all';

    // Agrupar por asignatura × grupo
    var gruposMap = {};
    regs.forEach(function(r) {
      var key = (r.asignatura||'Sin materia') + '___' + (r.grupo||'');
      if (!gruposMap[key]) gruposMap[key] = { asignatura: r.asignatura||'Sin materia', grupo: r.grupo||'', alumnos: [] };
      gruposMap[key].alumnos.push(r);
    });
    var sortedKeys = Object.keys(gruposMap).sort();

    // Agrupar alumnos únicos por grupo (para resumen y promedios)
    var grupoUnico = {};
    regs.forEach(function(r) {
      var g = r.grupo || '';
      var k = String(r.curp||r.nombre||'');
      if (!k) return;
      if (!grupoUnico[g]) grupoUnico[g] = {};
      if (!grupoUnico[g][k]) grupoUnico[g][k] = { nombre: r.nombre, curp: r.curp, grupo: g, materias: [] };
      grupoUnico[g][k].materias.push(r);
    });

    function _sabPromAlumno(alu, sp) {
      var vals = [];
      alu.materias.forEach(function(m) {
        var p1=_sabNum(m.p1_total), p2=_sabNum(m.p2_total), p3=_sabNum(m.p3_total), gl=_sabNum(m.global);
        if (sp==='p1') { if(p1!==null) vals.push(p1); }
        else if (sp==='p2') { if(p2!==null) vals.push(p2); }
        else if (sp==='p3') { if(p3!==null) vals.push(p3); }
        else if (sp==='gl') { if(gl!==null) vals.push(gl); }
        else {
          if (parcDisp.gl && gl!==null) vals.push(gl);
          else { if(parcDisp.p1&&p1!==null)vals.push(p1); if(parcDisp.p2&&p2!==null)vals.push(p2); if(parcDisp.p3&&p3!==null)vals.push(p3); }
        }
      });
      return vals.length ? vals.reduce(function(s,v){return s+v;},0)/vals.length : null;
    }

    function _sabIsRiesgo(alu, sp) {
      return alu.materias.some(function(m) {
        var p1=_sabNum(m.p1_total), p2=_sabNum(m.p2_total), p3=_sabNum(m.p3_total), gl=_sabNum(m.global);
        if (sp==='p1') return p1!==null && p1<6;
        if (sp==='p2') return p2!==null && p2<6;
        if (sp==='p3') return p3!==null && p3<6;
        if (sp==='gl') return gl!==null && gl<6;
        // all: any available
        if (parcDisp.p1 && p1!==null && p1<6) return true;
        if (parcDisp.p2 && p2!==null && p2<6) return true;
        if (parcDisp.p3 && p3!==null && p3<6) return true;
        if (parcDisp.gl && gl!==null && gl<6) return true;
        return false;
      });
    }

    function _sabIsCellRiesgo(v, sp, field) {
      // Returns true if THIS specific cell is the one failing in sp
      if (v===null) return false;
      if (sp==='all') return v<6;
      if (sp==='p1' && field==='p1') return v<6;
      if (sp==='p2' && field==='p2') return v<6;
      if (sp==='p3' && field==='p3') return v<6;
      if (sp==='gl' && field==='gl') return v<6;
      return false;
    }

    // ── CSS ────────────────────────────────────────────────
    var css = '<style id="sab-style">'
      + '.sab-tab-bar{display:flex;gap:0;border-bottom:2px solid #e2e8f0;margin-bottom:1.25rem}'
      + '.sab-tab{padding:0.6rem 1rem;font-size:0.82rem;font-weight:600;border:none;background:none;cursor:pointer;color:#64748b;border-bottom:3px solid transparent;margin-bottom:-2px;transition:color .15s;white-space:nowrap}'
      + '.sab-tab:hover{color:#7c3aed}.sab-tab.active{color:#7c3aed;border-bottom-color:#7c3aed}'
      + '.sab-parc-bar{display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-bottom:1rem;padding:0.6rem 0.875rem;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0}'
      + '.sab-parc-bar .spl{font-size:0.75rem;font-weight:700;color:#64748b}'
      + '.sab-pb{padding:0.25rem 0.8rem;border-radius:20px;border:1.5px solid #e2e8f0;background:#fff;font-size:0.75rem;font-weight:600;color:#64748b;cursor:pointer}'
      + '.sab-pb:disabled{opacity:0.35;cursor:not-allowed}'
      + '.sab-pb.sall.on{border-color:#475569;background:#f1f5f9;color:#1e293b}'
      + '.sab-pb.sp1.on{border-color:#2563eb;background:#dbeafe;color:#2563eb}'
      + '.sab-pb.sp2.on{border-color:#7c3aed;background:#ede9fe;color:#7c3aed}'
      + '.sab-pb.sp3.on{border-color:#d97706;background:#fef3c7;color:#d97706}'
      + '.sab-pb.sgl.on{border-color:#16a34a;background:#dcfce7;color:#16a34a}'
      + '.sab-section{background:#fff;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,0.07);margin-bottom:1.25rem;overflow:hidden}'
      + '.sab-hdr{background:linear-gradient(135deg,#1e1065,#4c1d95);color:#fff;padding:0.75rem 1.25rem;font-weight:700;font-size:0.9rem;display:flex;align-items:center;gap:0.75rem}'
      + '.sab-hdr .sab-grupo{background:rgba(255,255,255,0.2);border-radius:8px;padding:2px 10px;font-size:0.78rem}'
      + '.sab-table{width:100%;border-collapse:collapse;font-size:0.82rem}'
      + '.sab-table th{text-align:left;padding:0.45rem 0.7rem;background:#f8fafc;color:#64748b;font-size:0.7rem;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;border-bottom:1px solid #e2e8f0}'
      + '.sab-table td{padding:0.5rem 0.7rem;border-bottom:1px solid #f1f5f9}'
      + '.sab-table tr:last-child td{border-bottom:none}'
      + '.sab-table tr.row-fail td{background:#fff5f5}'
      + '.sab-table tr.row-fail td:first-child{border-left:3px solid #dc2626}'
      + '.cf{font-weight:700;color:#dc2626}.cp{font-weight:600;color:#16a34a}.cn{color:#94a3b8}'
      + '.kpi-row{display:grid;grid-template-columns:repeat(3,1fr);gap:0.75rem;margin-bottom:1.25rem}'
      + '.kpi-s{border-radius:12px;padding:0.875rem;text-align:center}'
      + '.kpi-s.blue{background:#dbeafe;border-left:4px solid #2563eb}.kpi-s.red{background:#fee2e2;border-left:4px solid #dc2626}.kpi-s.green{background:#dcfce7;border-left:4px solid #16a34a}'
      + '.kpi-sv{font-family:system-ui,sans-serif;font-size:1.6rem;font-weight:800;line-height:1}'
      + '.kpi-sl{font-size:0.68rem;font-weight:600;color:#64748b;text-transform:uppercase;margin-top:3px}'
      + '.kpi-s.blue .kpi-sv{color:#2563eb}.kpi-s.red .kpi-sv{color:#dc2626}.kpi-s.green .kpi-sv{color:#16a34a}'
      + '.g-resumen-card{background:#fff;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.07);margin-bottom:1rem;overflow:hidden}'
      + '.g-resumen-hdr{padding:0.75rem 1rem;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #f1f5f9;font-weight:700;font-size:0.88rem}'
      + '.g-resumen-body{padding:0.75rem 1rem}'
      + '.badge-fail{background:#fee2e2;color:#dc2626;border-radius:6px;padding:2px 8px;font-size:0.7rem;font-weight:700}'
      + '.badge-ok{background:#dcfce7;color:#16a34a;border-radius:6px;padding:2px 8px;font-size:0.7rem;font-weight:700}'
      + '.badge-warn{background:#fef3c7;color:#d97706;border-radius:6px;padding:2px 8px;font-size:0.7rem;font-weight:700}'
      + '.top-row{display:flex;align-items:center;gap:0.5rem;padding:0.35rem 0;border-bottom:1px solid #f1f5f9}'
      + '.top-row:last-child{border-bottom:none}'
      + '@keyframes spin{to{transform:rotate(360deg)}}'
      + '</style>';

    // ── Render function called on parcial switch ─────────
    window._sabSetParc = function(p) {
      window._sabSelParc = p;
      // update button states
      ['all','p1','p2','p3','gl'].forEach(function(k){
        var btn = document.querySelector('.sab-pb.s'+k);
        if (btn) btn.classList.toggle('on', k===p);
      });
      // re-render active tab
      var activeTab = document.querySelector('.sab-tab.active');
      if (activeTab) _sabRenderTab(activeTab.dataset.tab);
    };

    window._sabSwitchTab = function(tab) {
      document.querySelectorAll('.sab-tab').forEach(function(b){ b.classList.toggle('active', b.dataset.tab===tab); });
      _sabRenderTab(tab);
    };

    function _sabRenderTab(tab) {
      var sp = window._sabSelParc || 'all';
      var body = document.getElementById('sab-tab-body');
      if (!body) return;
      if (tab === 'calif')   body.innerHTML = _sabHtmlCalif(sp);
      if (tab === 'resumen') body.innerHTML = _sabHtmlResumen(sp);
      if (tab === 'top')     body.innerHTML = _sabHtmlTop(sp);
    }

    // ── TAB: CALIFICACIONES ──────────────────────────────
    function _sabHtmlCalif(sp) {
      var spHdr = { p1:'P1', p2:'P2', p3:'P3', gl:'Global', all:'Activo' };
      var html2 = '';
      sortedKeys.forEach(function(key) {
        var g = gruposMap[key];
        var alumnos = g.alumnos.slice().sort(function(a,b){ return String(a.nombre||'').localeCompare(String(b.nombre||'')); });
        var rows = alumnos.map(function(a, i) {
          var p1=_sabNum(a.p1_total), p2=_sabNum(a.p2_total), p3=_sabNum(a.p3_total), gl=_sabNum(a.global);
          var isRiesgo = (sp==='p1'&&p1!==null&&p1<6) || (sp==='p2'&&p2!==null&&p2<6)
                       || (sp==='p3'&&p3!==null&&p3<6) || (sp==='gl'&&gl!==null&&gl<6)
                       || (sp==='all'&&((parcDisp.p1&&p1!==null&&p1<6)||(parcDisp.p2&&p2!==null&&p2<6)||(parcDisp.p3&&p3!==null&&p3<6)||(parcDisp.gl&&gl!==null&&gl<6)));
          var pHdr = spHdr[sp] || 'Act.';
          // highlight the active parcial cell with border-bottom
          var thAct = function(f){ return sp===f||sp==='all'?'border-bottom:2px solid #7c3aed':''; };
          return '<tr class="'+(isRiesgo?'row-fail':'')+'">'
            + '<td style="color:#94a3b8;font-size:0.72rem">'+(i+1)+'</td>'
            + '<td><strong>'+_sabEsc(a.nombre)+'</strong></td>'
            + '<td style="text-align:center;'+thAct('p1')+'">'+_sabCell(p1)+'</td>'
            + '<td style="text-align:center;'+thAct('p2')+'">'+_sabCell(p2)+'</td>'
            + '<td style="text-align:center;'+thAct('p3')+'">'+_sabCell(p3)+'</td>'
            + '<td style="text-align:center;'+thAct('gl')+'">'+_sabCell(gl)+'</td>'
            + '</tr>';
        }).join('');
        var repCount = alumnos.filter(function(a){
          var p1=_sabNum(a.p1_total), p2=_sabNum(a.p2_total), p3=_sabNum(a.p3_total), gl=_sabNum(a.global);
          if (sp==='p1') return p1!==null&&p1<6;
          if (sp==='p2') return p2!==null&&p2<6;
          if (sp==='p3') return p3!==null&&p3<6;
          if (sp==='gl') return gl!==null&&gl<6;
          return (parcDisp.p1&&p1!==null&&p1<6)||(parcDisp.p2&&p2!==null&&p2<6)||(parcDisp.p3&&p3!==null&&p3<6)||(parcDisp.gl&&gl!==null&&gl<6);
        }).length;
        var repBadge = repCount>0 ? '<span style="background:#fee2e2;color:#dc2626;border-radius:6px;padding:2px 8px;font-size:0.72rem;font-weight:700;margin-left:8px">⚠ '+repCount+' en riesgo</span>' : '';
        html2 += '<div class="sab-section">'
          + '<div class="sab-hdr">📚 '+_sabEsc(g.asignatura)+' <span class="sab-grupo">'+_sabEsc(g.grupo)+'</span>'+repBadge+'</div>'
          + '<div style="overflow-x:auto"><table class="sab-table">'
          + '<thead><tr><th>#</th><th>Nombre</th><th>P1</th><th>P2</th><th>P3</th><th>Global</th></tr></thead>'
          + '<tbody>'+rows+'</tbody></table></div></div>';
      });
      return html2;
    }

    // ── TAB: RESUMEN GRUPOS ──────────────────────────────
    function _sabHtmlResumen(sp) {
      var html2 = '';
      var gruposArr = Object.keys(grupoUnico).sort();
      // KPIs globales
      var totalAlu = 0, totalRiesgo = 0, allProms = [];
      gruposArr.forEach(function(g) {
        var alus = Object.values(grupoUnico[g]);
        totalAlu += alus.length;
        alus.forEach(function(a){
          if (_sabIsRiesgo(a,sp)) totalRiesgo++;
          var p = _sabPromAlumno(a,sp);
          if (p!==null) allProms.push(p);
        });
      });
      var promGen = allProms.length ? (allProms.reduce(function(s,v){return s+v;},0)/allProms.length) : null;
      var spLabel = sp==='p1'?'1er Parcial':sp==='p2'?'2do Parcial':sp==='p3'?'3er Parcial':sp==='gl'?'Global':'Todos';
      html2 += '<div class="kpi-row">'
        + '<div class="kpi-s blue"><div class="kpi-sv">'+totalAlu+'</div><div class="kpi-sl">Total alumnos</div></div>'
        + '<div class="kpi-s red"><div class="kpi-sv">'+totalRiesgo+'</div><div class="kpi-sl">En riesgo · '+spLabel+'</div></div>'
        + '<div class="kpi-s green"><div class="kpi-sv">'+(promGen!==null?promGen.toFixed(1):'—')+'</div><div class="kpi-sl">Promedio general</div></div>'
        + '</div>';
      gruposArr.forEach(function(g) {
        var alus = Object.values(grupoUnico[g]);
        var proms = [], riesgo = [], aprobados = [];
        alus.forEach(function(a){
          var p = _sabPromAlumno(a,sp);
          if (p!==null) proms.push(p);
          if (_sabIsRiesgo(a,sp)) riesgo.push(a); else aprobados.push(a);
        });
        var prom = proms.length ? (proms.reduce(function(s,v){return s+v;},0)/proms.length) : null;
        var pct = alus.length ? Math.round(riesgo.length/alus.length*100) : 0;
        var badge = pct>=50?'badge-fail':pct>=25?'badge-warn':'badge-ok';
        var riesgoList = riesgo.slice(0,8).map(function(a){
          return '<span style="display:inline-block;background:#fee2e2;color:#dc2626;border-radius:6px;padding:1px 7px;font-size:0.7rem;font-weight:600;margin:2px">'+_sabEsc(a.nombre)+'</span>';
        }).join('')+(riesgo.length>8?'<span style="font-size:0.7rem;color:#94a3b8"> +más…</span>':'');
        html2 += '<div class="g-resumen-card">'
          + '<div class="g-resumen-hdr"><span>👥 Grupo '+_sabEsc(g)+'</span>'
          + '<span><span class="'+badge+'">'+pct+'% reprobación</span>'
          + ' <span style="color:#64748b;font-size:0.78rem;margin-left:8px">'+alus.length+' alumnos</span>'
          + ' <span style="color:#16a34a;font-size:0.78rem;font-weight:600;margin-left:8px">Prom. '+(prom!==null?prom.toFixed(1):'—')+'</span></span></div>'
          + (riesgo.length ? '<div class="g-resumen-body"><div style="font-size:0.75rem;color:#64748b;margin-bottom:4px">En riesgo ('+riesgo.length+'):</div>'+riesgoList+'</div>' : '<div class="g-resumen-body" style="font-size:0.8rem;color:#16a34a">✅ Sin alumnos en riesgo</div>')
          + '</div>';
      });
      return html2;
    }

    // ── TAB: MEJORES PROMEDIOS ───────────────────────────
    function _sabHtmlTop(sp) {
      var spLabel = sp==='p1'?'1er Parcial':sp==='p2'?'2do Parcial':sp==='p3'?'3er Parcial':sp==='gl'?'Global':'Todos';
      var allAlus = [];
      Object.keys(grupoUnico).forEach(function(g){
        Object.values(grupoUnico[g]).forEach(function(a){
          var p = _sabPromAlumno(a,sp);
          allAlus.push({ nombre: a.nombre, grupo: g, prom: p, riesgo: _sabIsRiesgo(a,sp) });
        });
      });
      allAlus = allAlus.filter(function(a){ return a.prom!==null; })
        .sort(function(a,b){ return b.prom-a.prom; });
      if (!allAlus.length) return '<div style="text-align:center;padding:2rem;color:#94a3b8">Sin datos para '+spLabel+'</div>';
      var topRows = allAlus.map(function(a, i){
        var medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':(i+1)+'.';
        var col = a.prom>=8?'#16a34a':a.prom>=6?'#2563eb':'#dc2626';
        var badge = a.riesgo ? '<span style="background:#fee2e2;color:#dc2626;border-radius:6px;padding:1px 7px;font-size:0.68rem;font-weight:700;margin-left:6px">⚠</span>' : '';
        return '<div class="top-row">'
          + '<span style="min-width:28px;font-size:0.8rem;font-weight:700;color:#94a3b8">'+medal+'</span>'
          + '<span style="flex:1;font-size:0.82rem;font-weight:600">'+_sabEsc(a.nombre)+badge+'</span>'
          + '<span style="font-size:0.75rem;color:#64748b;margin-right:12px">Gpo. '+_sabEsc(a.grupo)+'</span>'
          + '<span style="font-size:0.9rem;font-weight:800;color:'+col+'">'+a.prom.toFixed(1)+'</span>'
          + '</div>';
      }).join('');
      return '<div style="background:#ede9fe;border-radius:10px;padding:0.5rem 1rem;margin-bottom:1rem;font-size:0.8rem;color:#4c1d95">📅 Ordenado por promedio · <strong>'+spLabel+'</strong></div>'
        + '<div style="background:#fff;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.07);padding:0.875rem 1.25rem">'+topRows+'</div>';
    }

    // ── Build shell HTML ─────────────────────────────────
    var spLabel = window._sabSelParc==='p1'?'1er Parcial':window._sabSelParc==='p2'?'2do Parcial':window._sabSelParc==='p3'?'3er Parcial':window._sabSelParc==='gl'?'Global':'Todos';
    var grupoCount = Object.keys(grupoUnico).length;
    var banner = '<div style="margin-bottom:0.875rem;padding:0.75rem 1rem;background:#ede9fe;border-radius:12px;font-size:0.85rem;color:#4c1d95">'
      + '<strong>'+_sabEsc(nombre)+'</strong> · '+regs.length+' registros · '+grupoCount+' grupo(s) · '+sortedKeys.length+' materia(s)</div>';

    var parcBtns = '<div class="sab-parc-bar">'
      + '<span class="spl">📅 Parcial:</span>'
      + '<button class="sab-pb sall'+(window._sabSelParc==='all'?' on':'')+'" onclick="window._sabSetParc(\'all\')">Todos</button>'
      + '<button class="sab-pb sp1'+(window._sabSelParc==='p1'?' on':'')+'" onclick="window._sabSetParc(\'p1\')"'+(parcDisp.p1?'':' disabled')+'>P1</button>'
      + '<button class="sab-pb sp2'+(window._sabSelParc==='p2'?' on':'')+'" onclick="window._sabSetParc(\'p2\')"'+(parcDisp.p2?'':' disabled')+'>P2</button>'
      + '<button class="sab-pb sp3'+(window._sabSelParc==='p3'?' on':'')+'" onclick="window._sabSetParc(\'p3\')"'+(parcDisp.p3?'':' disabled')+'>P3</button>'
      + '<button class="sab-pb sgl'+(window._sabSelParc==='gl'?' on':'')+'" onclick="window._sabSetParc(\'gl\')"'+(parcDisp.gl?'':' disabled')+'>Global</button>'
      + '</div>';

    var tabs = '<div class="sab-tab-bar">'
      + '<button class="sab-tab active" data-tab="calif" onclick="window._sabSwitchTab(\'calif\')">📋 Calificaciones</button>'
      + '<button class="sab-tab" data-tab="resumen" onclick="window._sabSwitchTab(\'resumen\')">📊 Resumen grupos</button>'
      + '<button class="sab-tab" data-tab="top" onclick="window._sabSwitchTab(\'top\')">🏆 Mejores promedios</button>'
      + '</div>';

    container.innerHTML = css + '<div style="padding:1.25rem">' + banner + parcBtns + tabs + '<div id="sab-tab-body"></div></div>';
    _sabRenderTab('calif');
  }

  function _sabNum(v) {
    if (v===''||v===null||v===undefined) return null;
    var n = Number(v); return isNaN(n) ? null : n;
  }
  /* ════════════════════════════════════════════════════════
     MÓDULO: DIRECTORIO PEC
  ════════════════════════════════════════════════════════ */
  var _dirData    = null;   /* caché de filas */
  var _dirDirty   = {};     /* {key: nuevoPonderacion} para cambios pendientes */
  var _dirInited  = false;

  function _dirTurno(grupo) {
    var g = String(grupo || '').trim().toUpperCase();
    if (g.charAt(0) === 'V') return 'Vespertino';
    if (g.charAt(0) === 'M') return 'Matutino';
    return 'Otro';
  }
  function _dirKey(r) { return r.grupo + '||' + r.materia + '||' + r.parcial; }

  function initDirectorio() {
    if (_dirInited) { _dirApplyFilters(); return; }
    _dirInited = true;

    /* Bind filtros */
    ['d2-dir-groupby','d2-dir-semestre','d2-dir-turno','d2-dir-parcial','d2-dir-grupo','d2-dir-search'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('change', _dirApplyFilters);
      if (el && id === 'd2-dir-search') el.addEventListener('input', _dirApplyFilters);
    });

    /* Limpiar filtros */
    var clearBtn = document.getElementById('d2-dir-clear-btn');
    if (clearBtn) clearBtn.addEventListener('click', function() {
      ['d2-dir-semestre','d2-dir-turno','d2-dir-parcial','d2-dir-grupo'].forEach(function(id) {
        var el = document.getElementById(id); if (el) el.value = '';
      });
      var s = document.getElementById('d2-dir-search'); if (s) s.value = '';
      _dirApplyFilters();
    });

    /* Guardar */
    var saveBtn = document.getElementById('d2-dir-save-btn');
    if (saveBtn) saveBtn.addEventListener('click', _dirSave);

    /* Recargar */
    var reloadBtn = document.getElementById('d2-dir-reload-btn');
    if (reloadBtn) reloadBtn.addEventListener('click', function() { _dirData = null; _dirDirty = {}; _dirInited = false; initDirectorio(); });

    _dirLoad();
  }

  function _dirLoad() {
    var status = document.getElementById('d2-dir-status');
    var wrap   = document.getElementById('d2-dir-table-wrap');
    if (status) { status.textContent = 'Cargando directorio…'; status.style.display = 'block'; }
    if (wrap)   wrap.style.display = 'none';

    var ctrl    = new AbortController();
    var timer   = setTimeout(function() { ctrl.abort(); }, 20000);

    fetch(API_URL + '?action=getDirectorio&_t=' + Date.now(), { signal: ctrl.signal })
      .then(function(r) { clearTimeout(timer); return r.json(); })
      .then(function(res) {
        if (res.status === 'error' || !res.directorio) throw new Error(res.message || 'Sin datos');
        _dirData = res.directorio;
        _dirPopulateGrupos();
        _dirPopulateSemestres();
        _dirApplyFilters();
      })
      .catch(function(e) {
        clearTimeout(timer);
        var status = document.getElementById('d2-dir-status');
        var msg = e.name === 'AbortError'
          ? 'El servidor tardó demasiado. Actualiza el GAS y vuelve a intentarlo.'
          : 'Error al cargar el directorio: ' + (e.message || 'verifica que el GAS esté desplegado.');
        if (status) { status.textContent = msg; status.style.display = 'block'; }
        console.error('[Directorio]', e);
      });
  }

  function _dirExtractSem(grupo) {
    return String(grupo || '').replace(/^[A-Za-z]+/, '').charAt(0);
  }

  function _dirPopulateGrupos() {
    var sel = document.getElementById('d2-dir-grupo');
    if (!sel || !_dirData) return;
    var grupos = [...new Set(_dirData.map(function(r) { return r.grupo; }))].sort();
    var current = sel.value;
    sel.innerHTML = '<option value="">Todos los grupos</option>' +
      grupos.map(function(g) { return '<option value="' + g + '">' + g + '</option>'; }).join('');
    if (current) sel.value = current;
  }

  function _dirPopulateSemestres() {
    var sel = document.getElementById('d2-dir-semestre');
    if (!sel || !_dirData) return;
    var sems = [...new Set(_dirData.map(function(r) { return _dirExtractSem(r.grupo); }))]
      .filter(Boolean).sort();
    sel.innerHTML = '<option value="">Todos los semestres</option>' +
      sems.map(function(s) { return '<option value="' + s + '">' + s + '° Semestre</option>'; }).join('');
  }

  function _dirApplyFilters() {
    if (!_dirData) return;
    var sem     = (document.getElementById('d2-dir-semestre') || {}).value || '';
    var turno   = (document.getElementById('d2-dir-turno')    || {}).value || '';
    var parcial = (document.getElementById('d2-dir-parcial')  || {}).value || '';
    var grupo   = (document.getElementById('d2-dir-grupo')    || {}).value || '';
    var q       = ((document.getElementById('d2-dir-search')  || {}).value || '').toLowerCase().trim();

    var filtered = _dirData.filter(function(r) {
      if (sem     && _dirExtractSem(r.grupo) !== sem) return false;
      if (turno   && _dirTurno(r.grupo).charAt(0) !== turno) return false;
      if (parcial && String(r.parcial).replace(/\D/g, '') !== parcial) return false;
      if (grupo   && r.grupo !== grupo) return false;
      if (q && (r.materia + ' ' + r.docente + ' ' + r.grupo).toLowerCase().indexOf(q) === -1) return false;
      return true;
    });

    var clearBtn = document.getElementById('d2-dir-clear-btn');
    if (clearBtn) clearBtn.style.display = (sem || turno || parcial || grupo || q) ? 'flex' : 'none';

    var groupBy = (document.getElementById('d2-dir-groupby') || {}).value || 'grupo';
    _dirRender(filtered, groupBy);
  }

  function _dirPondInput(r) {
    if (!r) return '<td style="padding:.5rem .6rem; text-align:center; color:var(--d2-text-muted); font-size:0.75rem;">—</td>';
    var key     = _dirKey(r);
    var pond    = _dirDirty.hasOwnProperty(key) ? _dirDirty[key] : r.ponderacion;
    var isDirty = _dirDirty.hasOwnProperty(key);
    return '<td style="padding:.5rem .6rem; text-align:center;">'
      + '<input type="number" step="0.05" min="0" max="10"'
      + ' value="' + pond + '"'
      + ' data-key="' + key + '" data-orig="' + r.ponderacion + '"'
      + ' oninput="window._d2DirChange(this)"'
      + ' style="width:68px; text-align:center; padding:.3rem .3rem; border:1.5px solid '
      + (isDirty ? '#f59e0b' : 'var(--d2-border)') + '; border-radius:6px;'
      + ' font-size:0.88rem; font-family:inherit; background:' + (isDirty ? '#fffbeb' : 'var(--d2-surface)') + '; color:var(--d2-text);">'
      + '</td>';
  }

  /* ── Render helpers ──────────────────────────────────── */
  function _dirUpdateThead(groupBy) {
    var th = document.getElementById('d2-dir-thead');
    if (!th) return;
    var left = (groupBy === 'grupo')
      ? '<th style="padding:.7rem 1rem .7rem 1.4rem; text-align:left; font-weight:700;">Materia</th>'
        + '<th style="padding:.7rem .8rem; text-align:left; font-weight:700;">Docente</th>'
      : '<th style="padding:.7rem 1rem .7rem 1.4rem; text-align:left; font-weight:700;">Grupo</th>'
        + '<th style="padding:.7rem .8rem; text-align:left; font-weight:700;">Turno</th>';
    th.innerHTML = '<tr style="background:#0f172a; color:#94a3b8; text-transform:uppercase; font-size:0.7rem; letter-spacing:.06em;">'
      + left
      + '<th style="padding:.7rem 1rem; text-align:center; font-weight:700;">Parcial 1</th>'
      + '<th style="padding:.7rem 1rem; text-align:center; font-weight:700;">Parcial 2</th>'
      + '<th style="padding:.7rem 1rem; text-align:center; font-weight:700;">Parcial 3</th>'
      + '</tr>';
  }
  function _hGrupo(grp) {
    var turno = _dirTurno(grp);
    var badge = turno === 'Vespertino'
      ? 'background:rgba(254,249,195,.22);color:#fef9c3;'
      : 'background:rgba(219,234,254,.22);color:#bfdbfe;';
    return '<tr><td colspan="5" style="padding:.55rem 1rem; background:#1e40af; color:#fff;'
      + ' border-left:4px solid #93c5fd; font-size:0.83rem; font-weight:800;">'
      + grp
      + '<span style="font-size:0.7rem; font-weight:500; margin-left:.55rem; padding:.1rem .5rem; border-radius:20px; ' + badge + '">' + turno + '</span>'
      + '</td></tr>';
  }
  function _dirGrupoModeRow(p, idx) {
    var bg = (idx % 2 === 0) ? '#ffffff' : '#f8fafc';
    return '<tr style="border-top:1px solid #e2e8f0; background:' + bg + ';">'
      + '<td style="padding:.5rem 1rem .5rem 2rem; font-size:0.84rem; font-weight:600; color:#0f172a;">' + p.materia + '</td>'
      + '<td style="padding:.5rem .8rem; font-size:0.78rem; color:#475569;">' + p.docente + '</td>'
      + _dirPondInput(p.p1)
      + _dirPondInput(p.p2)
      + _dirPondInput(p.p3)
      + '</tr>';
  }
  function _hMatTop(mat, docStr) {
    return '<tr><td colspan="5" style="padding:.55rem 1rem; background:#1e40af; color:#fff;'
      + ' border-left:4px solid #93c5fd; font-size:0.83rem; font-weight:800;">'
      + mat
      + (docStr ? '<span style="font-size:0.72rem; font-weight:500; margin-left:.7rem; opacity:.8;">' + docStr + '</span>' : '')
      + '</td></tr>';
  }
  function _hDoc(doc) {
    return '<tr><td colspan="5" style="padding:.55rem 1rem; background:#065f46; color:#fff;'
      + ' border-left:4px solid #6ee7b7; font-size:0.72rem; font-weight:800;'
      + ' text-transform:uppercase; letter-spacing:.08em;">&#9656; ' + doc + '</td></tr>';
  }
  function _hMatGreen(mat) {
    return '<tr><td colspan="5" style="padding:.42rem 1rem .42rem 1.5rem;'
      + ' background:#f0fdf4; border-top:1px solid #bbf7d0;">'
      + '<span style="font-weight:700; font-size:0.82rem; color:#065f46;">' + mat + '</span>'
      + '</td></tr>';
  }
  function _dirGroupRow(p, idx) {
    var turno = _dirTurno(p.grupo);
    var bg = (idx % 2 === 0) ? '#ffffff' : '#f8fafc';
    return '<tr style="border-top:1px solid #e2e8f0; background:' + bg + ';">'
      + '<td style="padding:.5rem 1rem .5rem 2rem; font-weight:700; font-size:0.84rem; color:#0f172a;">' + p.grupo + '</td>'
      + '<td style="padding:.5rem .8rem;">'
      + '<span style="font-size:0.71rem; padding:.15rem .5rem; border-radius:20px; font-weight:600;'
      + (turno === 'Vespertino' ? 'background:#fef9c3;color:#854d0e;' : 'background:#dbeafe;color:#1e40af;')
      + '">' + turno + '</span>'
      + '</td>'
      + _dirPondInput(p.p1)
      + _dirPondInput(p.p2)
      + _dirPondInput(p.p3)
      + '</tr>';
  }

  function _dirRender(rows, groupBy) {
    var status = document.getElementById('d2-dir-status');
    var wrap   = document.getElementById('d2-dir-table-wrap');
    var tbody  = document.getElementById('d2-dir-tbody');
    var count  = document.getElementById('d2-dir-count');
    if (!tbody) return;

    if (status) status.style.display = 'none';
    if (wrap)   wrap.style.display = 'block';

    groupBy = groupBy || 'grupo';
    _dirUpdateThead(groupBy);

    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="padding:1.5rem; text-align:center; color:#64748b;">Sin resultados para los filtros seleccionados</td></tr>';
      if (count) count.textContent = '0 registros';
      return;
    }

    /* Pivot: una entrada por grupo+materia.
       Normaliza parcial: "Parcial 1"→"p1", "1"→"p1" */
    var pivots = {};
    rows.forEach(function(r) {
      var pk   = r.grupo + '\x00' + r.materia;
      var pKey = 'p' + String(r.parcial).replace(/\D/g, '');
      if (!pivots[pk]) pivots[pk] = { grupo: r.grupo, materia: r.materia, docente: r.docente };
      pivots[pk][pKey] = r;
    });
    var pivotArr = Object.keys(pivots).map(function(pk) { return pivots[pk]; })
      .sort(function(a, b) { return (a.grupo + a.materia).localeCompare(b.grupo + b.materia); });

    var html = '';
    var total = 0;

    if (groupBy === 'grupo') {
      var byGrp = {};
      pivotArr.forEach(function(p) {
        if (!byGrp[p.grupo]) byGrp[p.grupo] = [];
        byGrp[p.grupo].push(p);
      });
      Object.keys(byGrp).sort().forEach(function(grp) {
        html += _hGrupo(grp);
        byGrp[grp].sort(function(a, b) { return a.materia.localeCompare(b.materia); })
          .forEach(function(p, i) { html += _dirGrupoModeRow(p, i); total++; });
      });

    } else if (groupBy === 'materia') {
      var byMat = {};
      pivotArr.forEach(function(p) {
        if (!byMat[p.materia]) byMat[p.materia] = { docentes: {}, rows: [] };
        byMat[p.materia].docentes[p.docente] = true;
        byMat[p.materia].rows.push(p);
      });
      Object.keys(byMat).sort().forEach(function(mat) {
        var md = byMat[mat];
        var docStr = Object.keys(md.docentes).sort().join(', ');
        html += _hMatTop(mat, docStr);
        md.rows.forEach(function(p, i) { html += _dirGroupRow(p, i); total++; });
      });

    } else { /* docente */
      var byDoc = {};
      pivotArr.forEach(function(p) {
        if (!byDoc[p.docente]) byDoc[p.docente] = {};
        if (!byDoc[p.docente][p.materia]) byDoc[p.docente][p.materia] = [];
        byDoc[p.docente][p.materia].push(p);
      });
      Object.keys(byDoc).sort().forEach(function(doc) {
        html += _hDoc(doc);
        Object.keys(byDoc[doc]).sort().forEach(function(mat) {
          html += _hMatGreen(mat);
          byDoc[doc][mat].forEach(function(p, i) { html += _dirGroupRow(p, i); total++; });
        });
      });
    }

    tbody.innerHTML = html;
    if (count) count.textContent = total + ' registro' + (total !== 1 ? 's' : '');
  }

  window._d2DirChange = function(input) {
    var key  = input.dataset.key;
    var orig = input.dataset.orig;
    var val  = input.value.trim();
    if (val === orig) {
      delete _dirDirty[key];
    } else {
      _dirDirty[key] = val;
    }
    var hasDirty = Object.keys(_dirDirty).length > 0;
    var saveBtn  = document.getElementById('d2-dir-save-btn');
    var pending  = document.getElementById('d2-dir-pending');
    if (saveBtn) {
      saveBtn.style.background    = hasDirty ? '#16a34a' : 'var(--d2-border)';
      saveBtn.style.color         = hasDirty ? '#fff'    : 'var(--d2-text-muted)';
      saveBtn.style.cursor        = hasDirty ? 'pointer' : 'not-allowed';
      saveBtn.style.pointerEvents = hasDirty ? 'auto'    : 'none';
    }
    if (pending) pending.style.display = hasDirty ? 'inline' : 'none';
    input.style.border = (val !== orig) ? '1.5px solid #f59e0b' : '1.5px solid var(--d2-border)';
    input.style.background = (val !== orig) ? '#fffbeb' : 'var(--d2-surface)';
  };

  function _dirSave() {
    var keys = Object.keys(_dirDirty);
    if (!keys.length) return;

    var saveBtn = document.getElementById('d2-dir-save-btn');
    if (saveBtn) { saveBtn.textContent = 'Guardando…'; saveBtn.style.opacity = '.7'; saveBtn.style.pointerEvents = 'none'; }

    /* Construir lista de actualizaciones desde _dirData */
    var updates = keys.map(function(key) {
      var parts = key.split('||');
      return { grupo: parts[0], materia: parts[1], parcial: parts[2], ponderacion: _dirDirty[key] };
    });

    var promises = updates.map(function(u) {
      return fetch(API_URL, {
        method:   'POST',
        headers:  { 'Content-Type': 'text/plain;charset=utf-8' },
        redirect: 'follow',
        body: JSON.stringify({ action: 'setPonderacion', grupo: u.grupo, materia: u.materia, parcial: u.parcial, ponderacion: u.ponderacion })
      }).then(function(r) { return r.json(); });
    });

    Promise.all(promises).then(function(results) {
      var errors = results.filter(function(r) { return r.status !== 'success'; });
      if (errors.length === 0) {
        /* Actualizar caché local */
        updates.forEach(function(u) {
          var key = u.grupo + '||' + u.materia + '||' + u.parcial;
          var row = _dirData.find(function(r) { return _dirKey(r) === key; });
          if (row) row.ponderacion = u.ponderacion;
          delete _dirDirty[key];
        });
        if (saveBtn) { saveBtn.textContent = '✓ Guardado'; setTimeout(function() { saveBtn.textContent = 'Guardar cambios'; }, 2000); }
        var pending = document.getElementById('d2-dir-pending');
        if (pending) pending.style.display = 'none';
        _dirApplyFilters();
      } else {
        if (saveBtn) { saveBtn.textContent = '⚠ Error al guardar'; saveBtn.style.opacity = '1'; saveBtn.style.pointerEvents = 'auto'; }
        setTimeout(function() { if (saveBtn) saveBtn.textContent = 'Guardar cambios'; }, 3000);
        console.error('[Directorio] Errores al guardar:', errors);
      }
    }).catch(function(e) {
      if (saveBtn) { saveBtn.textContent = '⚠ Error de red'; saveBtn.style.opacity = '1'; saveBtn.style.pointerEvents = 'auto'; }
      setTimeout(function() { if (saveBtn) saveBtn.textContent = 'Guardar cambios'; }, 3000);
      console.error('[Directorio] Error de red:', e);
    });
  }

  function _sabEsc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function _sabCell(v) {
    if (v === null) return '<span class="cn">—</span>';
    return v < 6 ? '<span class="cf">'+v.toFixed(1)+'</span>' : '<span class="cp">'+v.toFixed(1)+'</span>';
  }

  /* ════════════════════════════════════════════════════════
     IFRAME — PREFECTURA (carga lazy)
  ════════════════════════════════════════════════════════ */
  var _prefecturaLoaded = false;

  function lazyLoadPrefectura() {
    var iframe  = document.getElementById('d2-iframe-prefectura');
    var loading = document.getElementById('d2-prefectura-loading');
    if (!iframe) return;
    if (_prefecturaLoaded) return;
    _prefecturaLoaded = true;

    if (loading) loading.classList.remove('hidden');
    iframe.src = '../../prefectura/index.html?d2embed=1';
    iframe.onload = function() {
      if (loading) loading.classList.add('hidden');
    };
  }

  /* ════════════════════════════════════════════════════════
     MÓDULO: CALIFICACIONES INTRASEMESTRALES (temporal)
  ════════════════════════════════════════════════════════ */
  var _intrasemestralLoaded = false;

  function lazyLoadIntrasemestral() {
    var iframe  = document.getElementById('d2-iframe-intrasemestral');
    var loading = document.getElementById('d2-intrasemestral-loading');
    if (!iframe) return;
    if (_intrasemestralLoaded) return;
    _intrasemestralLoaded = true;

    if (loading) loading.classList.remove('hidden');
    iframe.src = '../calificaciones/intrasemestral.html';
    iframe.onload = function() {
      if (loading) loading.classList.add('hidden');
    };
  }

  /* ════════════════════════════════════════════════════════
     MÓDULO: EDICIÓN RÁPIDA PEC
     Solo Felipe / Admin — edición inline de evaluaciones
  ════════════════════════════════════════════════════════ */
  var _pecEdData   = null;
  var _pecEdInited = false;
  var _pecEdRowMap = {};   /* rowIndex → row object para el handler de guardado */

  function initEdicionPEC() {
    if (_pecEdInited) { _pecEdFilter(); return; }
    _pecEdInited = true;

    ['d2-ed-semestre', 'd2-ed-parcial', 'd2-ed-grupo'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('change', _pecEdFilter);
    });
    ['d2-ed-materia', 'd2-ed-alumno'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('input', _pecEdFilter);
    });

    var reloadBtn = document.getElementById('d2-ed-reload-btn');
    if (reloadBtn) reloadBtn.addEventListener('click', function() {
      _pecEdData = null; _pecEdRowMap = {}; _pecEdInited = false;
      initEdicionPEC();
    });

    _pecEdLoad();
  }

  function _pecEdLoad() {
    var status   = document.getElementById('d2-ed-status');
    var wrap     = document.getElementById('d2-ed-table-wrap');
    var cierreEl = document.getElementById('d2-ed-cierre');
    if (status)   { status.textContent = 'Cargando evaluaciones…'; status.style.display = 'block'; }
    if (wrap)     wrap.style.display = 'none';
    if (cierreEl) cierreEl.style.display = 'none';

    var email = (sessionStorage.getItem('user_email') || '').toLowerCase().trim();
    var ctrl  = new AbortController();
    var timer = setTimeout(function() { ctrl.abort(); }, 18000);

    fetch(API_URL + '?action=getEdicion&userEmail=' + encodeURIComponent(email) + '&_t=' + Date.now(), {
      redirect: 'follow',
      signal: ctrl.signal
    })
      .then(function(r) { clearTimeout(timer); return r.text(); })
      .then(function(txt) {
        var res;
        try { res = JSON.parse(txt); } catch(parseErr) {
          console.error('[EdicionPEC] Respuesta no JSON:', txt.substring(0, 300));
          throw new Error('El GAS no devolvió JSON. Necesitas republicar el script en Google Apps Script.');
        }
        if (res.status === 'error') throw new Error(res.message || 'Error en el servidor');

        _pecEdData = res.evaluaciones || [];

        if (cierreEl) {
          if (!res.edicionAbierta) {
            cierreEl.textContent = '⚠ Periodo de edición cerrado' + (res.fechaCierre ? ' el ' + res.fechaCierre : '') + '. Solo administradores pueden modificar.';
            cierreEl.style.display = 'block';
          } else if (res.fechaCierre) {
            cierreEl.textContent = 'Edición abierta hasta el ' + res.fechaCierre;
            cierreEl.style.display = 'block';
            cierreEl.style.borderColor = '#3b82f6';
            cierreEl.style.background  = '#eff6ff';
            cierreEl.style.color       = '#1e40af';
          }
        }

        if (_pecEdData.length === 0 && status) {
          status.textContent = 'Sin evaluaciones registradas para tu usuario. Si es un error, verifica que el correo ' + (email || '(no detectado)') + ' esté en el directorio.';
          status.style.display = 'block';
          if (wrap) wrap.style.display = 'none';
          return;
        }

        _pecEdPopulateGrupos();
        _pecEdFilter();
      })
      .catch(function(e) {
        clearTimeout(timer);
        var msg = e.name === 'AbortError'
          ? 'El servidor tardó demasiado (18 s). Recarga o verifica que el GAS esté desplegado.'
          : (e.message || 'Error desconocido al cargar evaluaciones.');
        if (status) { status.textContent = '⚠ ' + msg; status.style.display = 'block'; }
        if (wrap) wrap.style.display = 'none';
        console.error('[EdicionPEC]', e);
      });
  }

  function _pecEdPopulateGrupos() {
    if (!_pecEdData) return;

    var semestres = [], grupos = [];
    _pecEdData.forEach(function(r) {
      var sem = _pecEdSemestre(r.grupoId);
      if (semestres.indexOf(sem) === -1) semestres.push(sem);
      if (r.grupoId && grupos.indexOf(r.grupoId) === -1) grupos.push(r.grupoId);
    });
    semestres.sort();
    grupos.sort();

    var selSem = document.getElementById('d2-ed-semestre');
    if (selSem) {
      var curSem = selSem.value;
      selSem.innerHTML = '<option value="">Todos los semestres</option>' +
        semestres.map(function(s) { return '<option value="' + s + '">' + s + '</option>'; }).join('');
      if (curSem) selSem.value = curSem;
    }

    var selGrp = document.getElementById('d2-ed-grupo');
    if (selGrp) {
      var curGrp = selGrp.value;
      selGrp.innerHTML = '<option value="">Todos los grupos</option>' +
        grupos.map(function(g) { return '<option value="' + g + '">' + g + '</option>'; }).join('');
      if (curGrp) selGrp.value = curGrp;
    }
  }

  function _pecEdFilter() {
    if (!_pecEdData) return;
    var semestre = (document.getElementById('d2-ed-semestre') || {}).value || '';
    var parcial  = (document.getElementById('d2-ed-parcial')  || {}).value || '';
    var grupo    = (document.getElementById('d2-ed-grupo')    || {}).value || '';
    var matQ     = ((document.getElementById('d2-ed-materia') || {}).value || '').toLowerCase().trim();
    var alumQ    = ((document.getElementById('d2-ed-alumno')  || {}).value || '').toLowerCase().trim();

    var filtered = _pecEdData.filter(function(r) {
      if (semestre && _pecEdSemestre(r.grupoId) !== semestre)        return false;
      if (parcial  && r.parcial !== parcial)                          return false;
      if (grupo    && r.grupoId !== grupo)                            return false;
      if (matQ     && r.materia.toLowerCase().indexOf(matQ)  === -1) return false;
      if (alumQ    && r.alumno.toLowerCase().indexOf(alumQ)  === -1)  return false;
      return true;
    });
    _pecEdRender(filtered);
  }

  function _pecEdSemestre(grupoId) {
    var m = String(grupoId || '').match(/(\d)/);
    return m ? m[1] + 'º Semestre' : 'Sin semestre';
  }

  function _pecEdRender(rows) {
    var status = document.getElementById('d2-ed-status');
    var wrap   = document.getElementById('d2-ed-table-wrap');
    var tbody  = document.getElementById('d2-ed-tbody');
    var count  = document.getElementById('d2-ed-count');
    if (!tbody) return;

    if (status) status.style.display = 'none';
    if (wrap)   wrap.style.display = 'block';

    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="padding:1.5rem; text-align:center; color:#64748b;">Sin resultados para los filtros seleccionados</td></tr>';
      if (count) count.textContent = '0 registros';
      return;
    }

    /* Ordenar: semestre → grupo → equipo → parcial → alumno */
    rows = rows.slice().sort(function(a, b) {
      var sa = _pecEdSemestre(a.grupoId), sb = _pecEdSemestre(b.grupoId);
      if (sa !== sb) return sa.localeCompare(sb);
      if (a.grupoId !== b.grupoId) return a.grupoId.localeCompare(b.grupoId);
      if ((a.equipoId || '') !== (b.equipoId || '')) return (a.equipoId || '').localeCompare(b.equipoId || '');
      if (String(a.parcial) !== String(b.parcial)) return String(a.parcial).localeCompare(String(b.parcial));
      return (a.alumno || '').localeCompare(b.alumno || '');
    });

    _pecEdRowMap = {};
    rows.forEach(function(r) { _pecEdRowMap[r.rowIndex] = r; });

    var html         = '';
    var lastSem      = null;
    var lastEqKey    = null;
    var rowIdx       = 0;

    rows.forEach(function(r) {
      var sem   = _pecEdSemestre(r.grupoId);
      var eqKey = r.grupoId + '\x00' + (r.equipoId || '') + '\x00' + r.parcial;

      /* ── Encabezado de semestre ── */
      if (sem !== lastSem) {
        lastSem   = sem;
        lastEqKey = null;
        html += '<tr><td colspan="8" style="padding:.65rem 1.1rem; background:#1e40af;'
          + ' font-size:0.75rem; font-weight:800; text-transform:uppercase; letter-spacing:.08em;'
          + ' color:#fff; border-left:4px solid #60a5fa;">&#9656; ' + sem + '</td></tr>';
      }

      /* ── Encabezado de equipo (cambia por grupo + equipo + parcial) ── */
      if (eqKey !== lastEqKey) {
        lastEqKey = eqKey;
        rowIdx    = 0;
        var isVesp = String(r.grupoId || '').toUpperCase().charAt(0) === 'V';
        var tBadge = isVesp
          ? 'background:#fef9c3;color:#854d0e;'
          : 'background:#dbeafe;color:#1e40af;';
        var tLabel = isVesp ? 'Vespertino' : 'Matutino';
        html += '<tr><td colspan="8" style="padding:.45rem 1rem .45rem 1.4rem; background:#fef3c7; border-top:2px solid #fde68a;">'
          + '<span style="font-weight:800; font-size:0.84rem; color:#92400e;">' + _pecEdEsc(r.grupoId) + '</span>'
          + '<span style="font-size:0.7rem; padding:.1rem .45rem; border-radius:20px; margin-left:.35rem; font-weight:600; ' + tBadge + '">' + tLabel + '</span>'
          + '<span style="margin:0 .5rem; color:#d97706;">|</span>'
          + '<span style="font-weight:700; font-size:0.84rem; color:#92400e;">' + _pecEdEsc(r.equipoNombre || r.equipoId) + '</span>'
          + '<span style="margin:0 .5rem; color:#d97706;">|</span>'
          + '<span style="font-size:0.81rem; color:#78350f;">' + _pecEdEsc(r.materia) + '</span>'
          + '<span style="margin-left:.5rem; font-size:0.72rem; background:#d97706; color:#fff; padding:.1rem .55rem; border-radius:20px; font-weight:700;">Parcial ' + _pecEdEsc(r.parcial) + '</span>'
          + '</td></tr>';
      }

      var isEdited  = r.tipoRegistro === 'EDICION';
      var bg        = (rowIdx % 2 === 0) ? '#ffffff' : '#fafafa';
      var ri        = r.rowIndex;
      var editBadge = isEdited
        ? '<div style="font-size:0.68rem; color:#64748b; margin-top:3px; max-width:90px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="' + _pecEdEsc(r.fechaEdicion) + ' · ' + _pecEdEsc(r.usuarioEdicion) + '">' + _pecEdEsc(r.usuarioEdicion || '') + '</div>'
        : '';

      html += '<tr style="border-top:1px solid #e2e8f0; background:' + bg + ';" id="d2-ed-row-' + ri + '">'
        + '<td style="padding:.5rem .6rem; text-align:center;">'
          + '<span style="background:#0f172a; color:#94a3b8; padding:.15rem .5rem; border-radius:20px; font-weight:700; font-size:0.76rem;">P' + _pecEdEsc(r.parcial) + '</span>'
        + '</td>'
        + '<td style="padding:.5rem .6rem; font-weight:700; font-size:0.84rem; white-space:nowrap; color:#0f172a;">' + _pecEdEsc(r.grupoId) + '</td>'
        + '<td style="padding:.5rem .6rem; font-size:0.82rem; max-width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#334155;" title="' + _pecEdEsc(r.equipoNombre) + '">' + _pecEdEsc(r.equipoNombre || r.equipoId) + '</td>'
        + '<td style="padding:.5rem .6rem; font-size:0.82rem; max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#334155;" title="' + _pecEdEsc(r.materia) + '">' + _pecEdEsc(r.materia) + '</td>'
        + '<td style="padding:.5rem .6rem; font-size:0.84rem; font-weight:600; white-space:nowrap; color:#0f172a;">' + _pecEdEsc(r.alumno) + '</td>'
        + '<td style="padding:.5rem .4rem; text-align:center;">'
          + '<input type="number" id="d2-ed-pts-' + ri + '" step="0.5" min="0" max="10" value="' + r.puntaje + '"'
          + ' style="width:58px; text-align:center; padding:.3rem .2rem; border:1.5px solid #e2e8f0; border-radius:6px;'
          + ' font-size:0.92rem; font-weight:700; font-family:inherit;'
          + ' background:' + (isEdited ? '#fffbeb' : '#ffffff') + '; color:#0f172a;">'
        + '</td>'
        + '<td style="padding:.5rem .4rem;">'
          + '<input type="text" id="d2-ed-obs-' + ri + '" value="' + _pecEdEsc(r.observaciones) + '" placeholder="Observaciones…"'
          + ' style="width:100%; min-width:110px; padding:.3rem .45rem; border:1.5px solid #e2e8f0; border-radius:6px; font-size:0.82rem; font-family:inherit; background:#ffffff; color:#0f172a;">'
        + '</td>'
        + '<td style="padding:.5rem .4rem; text-align:center;">'
          + '<button id="d2-ed-savebtn-' + ri + '" onclick="window._d2EdSaveRow(' + ri + ')"'
          + ' style="padding:.35rem .9rem; background:' + (isEdited ? '#f59e0b' : '#3b82f6') + '; color:#fff; border:none; border-radius:6px;'
          + ' font-size:0.8rem; font-weight:700; font-family:inherit; cursor:pointer; white-space:nowrap; transition:background .2s; min-width:76px;">'
          + (isEdited ? '&#9998; Editar' : 'Guardar')
          + '</button>'
          + editBadge
        + '</td>'
        + '</tr>';
      rowIdx++;
    });

    tbody.innerHTML = html;
    if (count) count.textContent = rows.length + ' registro' + (rows.length !== 1 ? 's' : '');
  }

  window._d2EdSaveRow = function(rowIndex) {
    var row     = _pecEdRowMap[rowIndex];
    var ptsEl   = document.getElementById('d2-ed-pts-' + rowIndex);
    var obsEl   = document.getElementById('d2-ed-obs-' + rowIndex);
    var saveBtn = document.getElementById('d2-ed-savebtn-' + rowIndex);
    if (!row || !ptsEl) return;

    var nuevoPuntaje = parseFloat(ptsEl.value);
    if (isNaN(nuevoPuntaje) || nuevoPuntaje < 0 || nuevoPuntaje > 10) {
      alert('El puntaje debe ser un número entre 0 y 10');
      return;
    }

    var email   = (sessionStorage.getItem('user_email') || '').toLowerCase().trim();
    var nuevaObs = obsEl ? obsEl.value.trim() : '';
    if (saveBtn) { saveBtn.textContent = '…'; saveBtn.disabled = true; saveBtn.style.background = '#94a3b8'; }

    fetch(API_URL, {
      method:   'POST',
      headers:  { 'Content-Type': 'text/plain;charset=utf-8' },
      redirect: 'follow',
      body: JSON.stringify({
        action:       'editarEvaluacion',
        userEmail:    email,
        parcial:      row.parcial,
        equipoId:     row.equipoId,
        materia:      row.materia,
        alumno:       row.alumno,
        nuevoPuntaje: nuevoPuntaje,
        nuevaObs:     nuevaObs,
        motivo:       'Edición rápida desde Docente 2.0'
      })
    })
    .then(function(r) { return r.json(); })
    .then(function(res) {
      if (res.status === 'success') {
        if (saveBtn) { saveBtn.textContent = '✓ Listo'; saveBtn.style.background = '#22c55e'; saveBtn.disabled = false; }
        row.puntaje        = nuevoPuntaje;
        row.observaciones  = nuevaObs;
        row.tipoRegistro   = 'EDICION';
        row.usuarioEdicion = email;
        if (ptsEl) ptsEl.style.background = '#fffbeb';
        setTimeout(function() {
          if (saveBtn) { saveBtn.textContent = '✎ Editar'; saveBtn.style.background = '#f59e0b'; }
        }, 2000);
      } else {
        if (saveBtn) { saveBtn.textContent = '⚠ ' + (res.message || 'Error'); saveBtn.style.background = '#ef4444'; saveBtn.disabled = false; }
        setTimeout(function() {
          if (saveBtn) { saveBtn.textContent = row.tipoRegistro === 'EDICION' ? '✎ Editar' : '💾 Guardar'; saveBtn.style.background = row.tipoRegistro === 'EDICION' ? '#f59e0b' : ''; }
        }, 4000);
      }
    })
    .catch(function(e) {
      if (saveBtn) { saveBtn.textContent = '⚠ Sin conexión'; saveBtn.style.background = '#ef4444'; saveBtn.disabled = false; }
      setTimeout(function() {
        if (saveBtn) { saveBtn.textContent = row.tipoRegistro === 'EDICION' ? '✎ Editar' : '💾 Guardar'; saveBtn.style.background = row.tipoRegistro === 'EDICION' ? '#f59e0b' : ''; }
      }, 4000);
      console.error('[EdicionPEC]', e);
    });
  };

  function _pecEdEsc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

})();
