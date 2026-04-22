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
    prefectura:  { title: 'Reportes de Uniforme',   sub: 'Seguimiento de incidencias · Prefectura' }
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

    if (title)   title.textContent = 'Cargando ' + (label || 'materia') + '…';
    if (loading) loading.classList.remove('hidden');

    /* Recargar solo si cambió la URL */
    var fullHref = href + (href.indexOf('?') === -1 ? '?' : '&') + 'd2embed=1';
    if (iframe.src !== location.origin + '/' + fullHref && iframe.getAttribute('src') !== fullHref) {
      iframe.src = fullHref;
    }

    iframe.onload = function() {
      if (loading) loading.classList.add('hidden');
    };

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

    /* Portal docente → nueva pestaña */
    var btnPD = document.getElementById('d2-nav-btn-pdocente');
    if (btnPD) btnPD.addEventListener('click', function() { window.open('../portal-docente/index.html', '_blank'); });

    /* Reportes de Uniforme → módulo embebido */
    var btnUni = document.getElementById('d2-nav-btn-uniforme');
    if (btnUni) btnUni.addEventListener('click', function() { activateMod('prefectura'); });

    /* Botón CURPs → activar módulo */
    var btnCurps = navEsp.querySelector('[data-mod="curps"]');
    if (btnCurps) {
      btnCurps.addEventListener('click', function() { activateMod('curps'); });
    }
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

    iframe.src = '../tutorias/index.html?d2embed=1';
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
    iframe.src = '../prefectura/index.html?d2embed=1';
    iframe.onload = function() {
      if (loading) loading.classList.add('hidden');
    };
  }

})();
