/* ── mod_conflictos.js — Vista de Conflictos ──────────────────────── */

genRegisterModule('conflictos', {
  async render(container) {
    if (!_genApp.ciclo) {
      container.innerHTML = '<div class="gen-empty-state"><p>Selecciona un ciclo escolar primero.</p></div>';
      return;
    }
    container.innerHTML = '<div class="gen-loading"><div class="gen-spinner"></div><span>Analizando conflictos…</span></div>';
    try {
      var [conflictos, docentes, grupos, materias, aulas] = await Promise.all([
        genAPI.getConflictos(_genApp.ciclo, _genApp.version),
        genAPI.getDocentes(),
        genAPI.getGrupos(),
        genAPI.getMaterias(),
        genAPI.getAulas()
      ]);
      _genApp.docentes = docentes;
      _genApp.grupos   = grupos;
      _genApp.materias = materias;
      _genApp.aulas    = aulas;
      container.innerHTML = _conflictosHTML(conflictos);
    } catch(err) {
      genShowError('Error al analizar: ' + err.message);
    }
  }
});

function _conflictosHTML(conflictos) {
  var errores  = conflictos.filter(function(c) { return c.severidad === 'error'; });
  var warnings = conflictos.filter(function(c) { return c.severidad === 'warning'; });

  var statusBanner = errores.length === 0 && warnings.length === 0
    ? '<div class="gen-conflict-banner gen-conflict-ok"><span>✓</span> Sin conflictos detectados. El horario está limpio.</div>'
    : '<div class="gen-conflict-banner gen-conflict-error">' +
      '<span>⚠</span> Se detectaron <strong>' + errores.length + ' errores</strong> y ' +
      '<strong>' + warnings.length + ' advertencias</strong>.</div>';

  var rows = conflictos.length === 0 ? '' : conflictos.map(function(c) {
    var icon   = c.severidad === 'error' ? '🔴' : '🟡';
    var tipo   = _conflictoTipoLabel(c.tipo);
    var detail = _conflictoDetail(c);
    return '<tr class="gen-conflict-row gen-conflict-' + c.severidad + '">' +
      '<td>' + icon + '</td>' +
      '<td><strong>' + genEsc(tipo) + '</strong></td>' +
      '<td>' + genEsc(c.dia || '—') + '</td>' +
      '<td>' + genEsc(String(c.bloque || '—')) + '</td>' +
      '<td>' + detail + '</td>' +
      '<td>' + genEsc(c.mensaje) + '</td>' +
      '</tr>';
  }).join('');

  return `
<div class="gen-page-header">
  <div>
    <h1 class="gen-page-title">Detección de Conflictos</h1>
    <p class="gen-page-sub">Ciclo: <strong>${genEsc(_genApp.ciclo)}</strong> — Versión: <strong>${genEsc(_genApp.version)}</strong></p>
  </div>
  <div class="gen-header-actions">
    <button class="gen-btn gen-btn-secondary" onclick="genNavTo('conflictos')">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
      Reanalizar
    </button>
    <button class="gen-btn gen-btn-primary" onclick="genNavTo('armado')">Ir a armado</button>
  </div>
</div>

${statusBanner}

${conflictos.length > 0 ? `
<div class="gen-table-wrapper" style="margin-top:16px">
  <table class="gen-table">
    <thead>
      <tr>
        <th style="width:32px"></th>
        <th>Tipo</th>
        <th>Día</th>
        <th>Bloque</th>
        <th>Entidades</th>
        <th>Descripción</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</div>` : ''}`;
}

function _conflictoTipoLabel(tipo) {
  var map = {
    'DOCENTE_DUPLICADO':     'Docente duplicado',
    'GRUPO_DUPLICADO':       'Grupo duplicado',
    'AULA_DUPLICADA':        'Aula duplicada',
    'DOCENTE_NO_DISPONIBLE': 'Docente no disponible'
  };
  return map[tipo] || tipo;
}

function _conflictoDetail(c) {
  var parts = [];
  if (c.docente_id) {
    var d = genById(_genApp.docentes, c.docente_id);
    if (d) parts.push('Docente: ' + genEsc(genNombreDocente(d)));
  }
  if (c.grupo_id) {
    var g = genById(_genApp.grupos, c.grupo_id);
    if (g) parts.push('Grupo: ' + genEsc(genLabelGrupo(g)));
  }
  if (c.aula_id) {
    var a = genById(_genApp.aulas, c.aula_id);
    if (a) parts.push('Aula: ' + genEsc(a.nombre || a.clave));
  }
  return parts.join('<br>') || '—';
}
