/* ── mod_dashboard.js — Dashboard del Generador de Horarios ──── */

genRegisterModule('dashboard', {
  async render(container) {
    if (!_genApp.ciclo) {
      container.innerHTML =
        '<div class="gen-empty-state">' +
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' +
        '<p>Selecciona un ciclo escolar para ver el dashboard.</p>' +
        '<button class="gen-btn gen-btn-primary" onclick="document.getElementById(\'gen-ciclo-btn\').click()">Seleccionar ciclo</button>' +
        '</div>';
      return;
    }

    container.innerHTML =
      '<div class="gen-loading"><div class="gen-spinner"></div><span>Cargando dashboard…</span></div>';

    try {
      /* Cargar estructura (ya filtra por ciclo + periodo) y resumen en paralelo.
         El resumen del backend se usa solo para avance y conflictos. */
      var results = await Promise.all([
        genAPI.getEstructura(_genApp.ciclo, true),
        genAPI.getResumen(_genApp.ciclo, _genApp.version).catch(function() { return {}; }),
        genAPI.getAulas().catch(function() { return _genApp.aulas || []; })
      ]);
      var estructura = Array.isArray(results[0]) ? results[0] : [];
      var resumen    = results[1] || {};
      var aulas      = Array.isArray(results[2]) ? results[2] : [];

      /* ── Indicadores desde Estructura (ciclo + periodo) ──────────── */
      var docSet   = {};
      var grupoSet = {};
      var uacSet   = {};
      estructura.forEach(function(row) {
        var doc = String(row.docente || '').trim();
        var grp = String(row.grupo   || '').trim();
        var uac = String(row.uac     || '').trim();
        if (doc) docSet[doc]   = true;
        if (grp) grupoSet[grp] = true;
        if (uac) uacSet[uac]   = true;
      });

      var nDocentes = Object.keys(docSet).length;
      var nGrupos   = Object.keys(grupoSet).length;
      var nMaterias = Object.keys(uacSet).length;
      var nAulas    = aulas.filter(function(a) { return String(a.activo) !== 'false'; }).length;

      /* ── Avance y conflictos (backend, por versión) ───────────────── */
      var pct              = Number(resumen.porcentajeAvance  || 0);
      var gruposConHorario = Number(resumen.gruposConHorario  || 0);
      var totalGruposRes   = Number(resumen.totalGrupos       || nGrupos);
      var totalConflictos  = Number(resumen.totalConflictos   || 0);
      var totalWarnings    = Number(resumen.totalWarnings     || 0);

      container.innerHTML = _dashHTML({
        nDocentes, nGrupos, nMaterias, nAulas,
        gruposConHorario, totalGruposRes, pct,
        totalConflictos, totalWarnings,
        sinDatos: estructura.length === 0
      });
      _dashBindProgress(pct);

    } catch(err) {
      genShowError('No se pudo cargar el dashboard: ' + err.message);
    }
  }
});

/* ── HTML del Dashboard ─────────────────────────────────────────── */
function _dashHTML(s) {
  var periodoTxt = _genApp.periodo
    ? ' &nbsp;·&nbsp; Periodo <strong>' + _genApp.periodo + '</strong>'
    : ' &nbsp;·&nbsp; <span style="color:var(--gen-muted);font-weight:400">Ambos periodos</span>';
  var conflictoClass = s.totalConflictos > 0
    ? 'gen-stat-danger'
    : (s.totalWarnings > 0 ? 'gen-stat-warning' : 'gen-stat-ok');
  var fuente = 'Estructura Educativa · Ciclo ' + genEsc(_genApp.ciclo) +
    (_genApp.periodo ? ' · Periodo ' + _genApp.periodo : '');

  /* ── Estado vacío ────────────────────────────────────────────── */
  if (s.sinDatos) {
    return '<div class="gen-page-header"><div>' +
      '<h1 class="gen-page-title">Dashboard</h1>' +
      '<p class="gen-page-sub">Ciclo: <strong>' + genEsc(_genApp.ciclo) + '</strong>' + periodoTxt + '</p>' +
      '</div></div>' +
      '<div class="gen-empty-state">' +
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>' +
      '<p>No hay datos en la Estructura Educativa para el ciclo <strong>' + genEsc(_genApp.ciclo) + '</strong>' +
      (_genApp.periodo ? ' · Periodo ' + _genApp.periodo : '') + '.</p>' +
      '<button class="gen-btn gen-btn-primary" onclick="genNavTo(\'estructura\')">Ir a Estructura Educativa</button>' +
      '</div>';
  }

  /* ── Dashboard con datos ─────────────────────────────────────── */
  return `
<div class="gen-page-header">
  <div>
    <h1 class="gen-page-title">Dashboard</h1>
    <p class="gen-page-sub">Ciclo: <strong>${genEsc(_genApp.ciclo)}</strong>${periodoTxt} &nbsp;·&nbsp; Versión: <strong>${genEsc(_genApp.version)}</strong></p>
  </div>
  <div class="gen-header-actions">
    <button class="gen-btn gen-btn-secondary" onclick="genNavTo('dashboard')">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
      Actualizar
    </button>
  </div>
</div>

<div class="gen-stats-grid">
  <div class="gen-stat-card">
    <div class="gen-stat-icon gen-stat-blue">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
    </div>
    <div class="gen-stat-info">
      <span class="gen-stat-value">${s.nDocentes}</span>
      <span class="gen-stat-label">Docentes en estructura</span>
    </div>
  </div>
  <div class="gen-stat-card">
    <div class="gen-stat-icon gen-stat-green">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
    </div>
    <div class="gen-stat-info">
      <span class="gen-stat-value">${s.nGrupos}</span>
      <span class="gen-stat-label">Grupos en estructura</span>
    </div>
  </div>
  <div class="gen-stat-card">
    <div class="gen-stat-icon gen-stat-purple">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
    </div>
    <div class="gen-stat-info">
      <span class="gen-stat-value">${s.nMaterias}</span>
      <span class="gen-stat-label">UACs únicas</span>
    </div>
  </div>
  <div class="gen-stat-card">
    <div class="gen-stat-icon gen-stat-orange">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
    </div>
    <div class="gen-stat-info">
      <span class="gen-stat-value">${s.nAulas}</span>
      <span class="gen-stat-label">Aulas activas</span>
    </div>
  </div>
</div>

<p class="gen-hint" style="margin:-6px 0 14px;font-size:0.77rem;color:var(--gen-muted)">
  Docentes, grupos y UACs contados desde <strong>${fuente}</strong> (valores únicos).
  Avance y conflictos corresponden a la versión <strong>${genEsc(_genApp.version)}</strong>.
</p>

<div class="gen-dash-row">
  <div class="gen-card gen-dash-card">
    <h3 class="gen-card-title">Avance de horarios</h3>
    <div class="gen-progress-wrapper">
      <div class="gen-progress-bar-container">
        <div class="gen-progress-bar" id="gen-dash-progress" style="width:0%"></div>
      </div>
      <span class="gen-progress-pct" id="gen-dash-pct">0%</span>
    </div>
    <div class="gen-progress-detail">
      <span>${s.gruposConHorario} de ${s.totalGruposRes} grupos con horario asignado</span>
    </div>
    <div class="gen-dash-quick-links">
      <button class="gen-btn gen-btn-sm gen-btn-secondary" onclick="genNavTo('armado')">
        Ir a armado de horarios →
      </button>
    </div>
  </div>

  <div class="gen-card gen-dash-card ${conflictoClass}">
    <h3 class="gen-card-title">Estado de conflictos</h3>
    <div class="gen-conflict-summary">
      <div class="gen-conflict-badge ${s.totalConflictos > 0 ? 'badge-error' : 'badge-ok'}">
        <span class="gen-badge-num">${s.totalConflictos}</span>
        <span class="gen-badge-label">Errores</span>
      </div>
      <div class="gen-conflict-badge ${s.totalWarnings > 0 ? 'badge-warn' : 'badge-ok'}">
        <span class="gen-badge-num">${s.totalWarnings}</span>
        <span class="gen-badge-label">Advertencias</span>
      </div>
    </div>
    <div class="gen-dash-quick-links">
      <button class="gen-btn gen-btn-sm gen-btn-secondary" onclick="genNavTo('conflictos')">
        Ver conflictos →
      </button>
    </div>
  </div>

  <div class="gen-card gen-dash-card">
    <h3 class="gen-card-title">Accesos rápidos</h3>
    <div class="gen-quick-links">
      <button class="gen-quick-link" onclick="genNavTo('docentes')">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        Docentes
      </button>
      <button class="gen-quick-link" onclick="genNavTo('grupos')">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        Grupos
      </button>
      <button class="gen-quick-link" onclick="genNavTo('carga')">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
        Carga horaria
      </button>
      <button class="gen-quick-link" onclick="genNavTo('armado')">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/></svg>
        Armar horarios
      </button>
    </div>
  </div>
</div>`;
}

/* ── Animación de la barra de progreso ──────────────────────────── */
function _dashBindProgress(pct) {
  var bar   = document.getElementById('gen-dash-progress');
  var pctEl = document.getElementById('gen-dash-pct');
  if (bar) {
    setTimeout(function() { bar.style.width = pct + '%'; }, 50);
    bar.style.background = pct === 100
      ? 'var(--gen-success)'
      : pct > 50 ? 'var(--gen-primary)' : '#f59e0b';
  }
  if (pctEl) pctEl.textContent = pct + '%';
}
