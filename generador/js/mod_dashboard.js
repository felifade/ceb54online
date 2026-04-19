/* ── mod_dashboard.js — Dashboard del Generador de Horarios ──── */

genRegisterModule('dashboard', {
  async render(container) {
    if (!_genApp.ciclo) {
      container.innerHTML = '<div class="gen-empty-state">' +
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' +
        '<p>Selecciona un ciclo escolar para ver el dashboard.</p>' +
        '<button class="gen-btn gen-btn-primary" onclick="document.getElementById(\'gen-ciclo-btn\').click()">Seleccionar ciclo</button>' +
        '</div>';
      return;
    }

    container.innerHTML = '<div class="gen-loading"><div class="gen-spinner"></div><span>Cargando resumen…</span></div>';

    try {
      var resumen = await genAPI.getResumen(_genApp.ciclo, _genApp.version);
      container.innerHTML = _dashHTML(resumen);
      _dashBindProgress(resumen);
    } catch(err) {
      genShowError('No se pudo cargar el resumen: ' + err.message);
    }
  }
});

function _dashHTML(r) {
  var conflictoClass = r.totalConflictos > 0 ? 'gen-stat-danger' : (r.totalWarnings > 0 ? 'gen-stat-warning' : 'gen-stat-ok');
  return `
<div class="gen-page-header">
  <div>
    <h1 class="gen-page-title">Dashboard</h1>
    <p class="gen-page-sub">Ciclo: <strong>${genEsc(_genApp.ciclo)}</strong> &nbsp;·&nbsp; Versión: <strong>${genEsc(_genApp.version)}</strong></p>
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
      <span class="gen-stat-value">${r.totalDocentes}</span>
      <span class="gen-stat-label">Docentes</span>
    </div>
  </div>
  <div class="gen-stat-card">
    <div class="gen-stat-icon gen-stat-green">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
    </div>
    <div class="gen-stat-info">
      <span class="gen-stat-value">${r.totalGrupos}</span>
      <span class="gen-stat-label">Grupos</span>
    </div>
  </div>
  <div class="gen-stat-card">
    <div class="gen-stat-icon gen-stat-purple">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
    </div>
    <div class="gen-stat-info">
      <span class="gen-stat-value">${r.totalMaterias}</span>
      <span class="gen-stat-label">Materias</span>
    </div>
  </div>
  <div class="gen-stat-card">
    <div class="gen-stat-icon gen-stat-orange">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
    </div>
    <div class="gen-stat-info">
      <span class="gen-stat-value">${r.totalAulas}</span>
      <span class="gen-stat-label">Aulas</span>
    </div>
  </div>
</div>

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
      <span>${r.gruposConHorario} de ${r.totalGrupos} grupos con horario asignado</span>
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
      <div class="gen-conflict-badge ${r.totalConflictos > 0 ? 'badge-error' : 'badge-ok'}">
        <span class="gen-badge-num">${r.totalConflictos}</span>
        <span class="gen-badge-label">Errores</span>
      </div>
      <div class="gen-conflict-badge ${r.totalWarnings > 0 ? 'badge-warn' : 'badge-ok'}">
        <span class="gen-badge-num">${r.totalWarnings}</span>
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

function _dashBindProgress(r) {
  var pct = r.porcentajeAvance || 0;
  var bar = document.getElementById('gen-dash-progress');
  var pctEl = document.getElementById('gen-dash-pct');
  if (bar) {
    setTimeout(function() { bar.style.width = pct + '%'; }, 50);
    bar.style.background = pct === 100 ? 'var(--gen-success)' : pct > 50 ? 'var(--gen-primary)' : '#f59e0b';
  }
  if (pctEl) pctEl.textContent = pct + '%';
}
