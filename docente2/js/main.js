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
  var MATERIA_MAP = {
    'felifade@icloud.com': [
      { label: 'Cultura Digital II',  href: '../cultura-digital/index.html',    icon: 'monitor' },
      { label: 'Cultura Digital III', href: '../cultura-digital-iii/index.html', icon: 'code' }
    ]
  };

  /* Íconos SVG inline para las materias */
  var MATERIA_ICONS = {
    monitor: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
    code:    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>'
  };

  /* El chrome de los iframes se oculta via ?d2embed=1 en la URL
     (clase .d2-embedded en <html> aplicada antes de que cargue el CSS) */

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
    horario:  { title: 'Horario',             sub: 'Horario definitivo de clases — CEB 5/4' }
  };

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
    var wrap     = document.getElementById('d2-nav-materias');
    var items    = document.getElementById('d2-materias-items');
    if (!materias.length || !wrap || !items) return;

    var html = materias.map(function(m) {
      var ico = MATERIA_ICONS[m.icon] || MATERIA_ICONS['monitor'];
      return '<button class="d2-nav-item" data-mod="ext" data-href="' + m.href + '">' +
               ico + '<span>' + m.label + '</span>' +
             '</button>';
    }).join('');

    items.innerHTML = html;
    wrap.style.display = 'block';

    /* wire clicks */
    items.querySelectorAll('.d2-nav-item').forEach(function(btn) {
      btn.addEventListener('click', function() {
        window.open(btn.dataset.href, '_blank');
      });
    });
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

    closeSidebar();
    window.scrollTo(0, 0);
  }

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
        state.tutQueue = view;  /* pendiente hasta que cargue */
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
        else { state.pecQueue = btn.dataset.subview; lazyLoadPec(); }
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
        else { state.pecQueue = btn.dataset.subview; lazyLoadPec(); }
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

})();
