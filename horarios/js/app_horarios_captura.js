// ============================================================
// app_horarios_captura.js — Lógica del formulario de Captura
// Módulo de Horarios CEB 5/4
//
// Prefijo de funciones: horCap* (aislado de app_horarios.js)
// Solo se inicializa cuando el panel #pane-captura existe.
// NO modifica ningún otro módulo del sistema.
// ============================================================

// ── ESTADO DE LA SESIÓN DE CAPTURA ───────────────────────────
var _hcAdminKey   = null;   // se solicita una vez por sesión
var _hcDocentes   = [];     // lista cacheada de DOCENTES_RAW
var _hcCatalogo   = [];     // lista cacheada de CATALOGO_UAC
var _hcUACMap     = {};     // { uac: componente } — lookup rápido
var _hcFilasCarga = 0;      // contador de filas en Bloque B
var _hcFilasExt   = 0;      // contador de filas en Bloque C
var _hcModo       = 'alta'; // 'alta' | 'edicion'

// ── BLOQUES HORARIOS PREDEFINIDOS ────────────────────────────
// Solo bloques de 1 h o 2 h; lista completa de 07:00 a 20:00.
var HC_BLOQUES = [
  '',
  '07:00-08:00', '07:00-09:00',
  '08:00-09:00', '08:00-10:00',
  '09:00-10:00', '09:00-11:00',
  '10:00-11:00', '10:00-12:00',
  '11:00-12:00', '11:00-13:00',
  '12:00-13:00', '12:00-14:00',
  '13:00-14:00', '13:00-15:00',
  '14:00-15:00', '14:00-16:00',
  '15:00-16:00', '15:00-17:00',
  '16:00-17:00', '16:00-18:00',
  '17:00-18:00', '17:00-19:00',
  '18:00-19:00', '18:00-20:00',
  '19:00-20:00'
];

// ── INICIALIZACIÓN ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  var pane = document.getElementById('pane-captura');
  if (!pane) return;

  // Conectar botones
  var btnAddCarga = document.getElementById('hc-btn-add-carga');
  var btnAddExt   = document.getElementById('hc-btn-add-ext');
  var btnCargar   = document.getElementById('hc-btn-cargar');
  var btnGuardar  = document.getElementById('hc-btn-guardar');
  var btnNuevo    = document.getElementById('hc-btn-nuevo');
  var btnLimpiar  = document.getElementById('hc-btn-limpiar');
  var btnRegen    = document.getElementById('hc-btn-regen');

  if (btnAddCarga) btnAddCarga.addEventListener('click', function() { horCapAddFilaCarga(); });
  if (btnAddExt)   btnAddExt.addEventListener('click',   function() { horCapAddFilaExt(); });
  if (btnCargar)   btnCargar.addEventListener('click',   horCapCargarDocente);
  if (btnGuardar)  btnGuardar.addEventListener('click',  horCapGuardar);
  if (btnNuevo)    btnNuevo.addEventListener('click',    horCapNuevo);
  if (btnLimpiar)  btnLimpiar.addEventListener('click',  horCapLimpiar);
  if (btnRegen)    btnRegen.addEventListener('click',    horCapRegen);

  // Al cambiar a pestaña "captura", cargar docentes si aún no están
  document.querySelectorAll('.hor-tab-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      if (btn.dataset.tab === 'captura' && _hcDocentes.length === 0) {
        horCapCargarListaDocentes();
      }
    });
  });

  // Pre-carga en segundo plano (cubre el caso de abrir la pestaña directamente)
  horCapCargarListaDocentes();
  horCapCargarCatalogo();

  // Establecer modo inicial
  horCapSetModo('alta');
  horCapActualizarResumen();
});

// ── MODO: ALTA / EDICIÓN ─────────────────────────────────────
function horCapSetModo(modo) {
  _hcModo = modo;

  var badge    = document.getElementById('hc-modo-badge');
  var btnGuard = document.getElementById('hc-btn-guardar');

  if (modo === 'edicion') {
    if (badge) {
      badge.textContent = '✏️ Modo edición';
      badge.className   = 'hc-modo-badge hc-modo-edicion';
    }
    if (btnGuard) btnGuard.textContent = '💾 Guardar cambios';
  } else {
    if (badge) {
      badge.textContent = '✨ Nuevo docente';
      badge.className   = 'hc-modo-badge hc-modo-alta';
    }
    if (btnGuard) btnGuard.innerHTML =
      '<i data-lucide="save" style="width:15px;height:15px;"></i> Guardar';
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
}

// ── CARGAR LISTA DE DOCENTES ─────────────────────────────────
async function horCapCargarListaDocentes() {
  var sel = document.getElementById('hc-sel-docente');
  if (!sel) return;

  try {
    _hcDocentes = await horariosAPI.getDocentes();
    sel.innerHTML = '<option value="">— Nuevo docente —</option>';
    _hcDocentes.forEach(function(d) {
      var opt = document.createElement('option');
      opt.value             = d.clave;
      opt.textContent       = d.nombre + ' (' + d.clave + ')';
      opt.dataset.nombre    = d.nombre;
      opt.dataset.formacion = d.formacion || '';
      sel.appendChild(opt);
    });
  } catch (e) {
    console.warn('[Captura Horarios] No se pudo cargar lista de docentes:', e.message);
  }
}

// ── CARGAR CATÁLOGO UAC ──────────────────────────────────────
async function horCapCargarCatalogo() {
  try {
    _hcCatalogo = await horariosAPI.getCatalogoUAC();
    _hcUACMap   = {};
    _hcCatalogo.forEach(function(item) {
      _hcUACMap[item.uac] = item.componente || '';
    });
  } catch (e) {
    // No es crítico — el catálogo puede no existir todavía
    _hcCatalogo = [];
    _hcUACMap   = {};
    console.warn('[Captura Horarios] CATALOGO_UAC no disponible:', e.message);
  }
}

// ── CARGAR DATOS COMPLETOS DE DOCENTE ────────────────────────
async function horCapCargarDocente() {
  var sel       = document.getElementById('hc-sel-docente');
  var inpNombre = document.getElementById('hc-nombre');
  var inpClave  = document.getElementById('hc-clave');
  var inpForm   = document.getElementById('hc-formacion');
  var inpCiclo  = document.getElementById('hc-ciclo');

  if (!sel || sel.value === '') {
    // Modo nuevo: resetear todo
    if (inpNombre) inpNombre.value = '';
    if (inpClave) {
      inpClave.value    = '';
      inpClave.readOnly = false;
      inpClave.classList.remove('hc-input-readonly');
    }
    if (inpForm) inpForm.value = '';
    horCapLimpiarTablas();
    horCapSetModo('alta');
    horCapStatus('Formulario listo para un nuevo docente.', 'info');
    return;
  }

  // Llenar datos del docente desde el selector
  var opt = sel.options[sel.selectedIndex];
  if (inpNombre) inpNombre.value = opt.dataset.nombre    || '';
  if (inpClave)  inpClave.value  = sel.value;
  if (inpForm)   inpForm.value   = opt.dataset.formacion || '';

  // Clave en solo lectura para evitar edición accidental en modo edición
  if (inpClave) {
    inpClave.readOnly = true;
    inpClave.classList.add('hc-input-readonly');
  }

  var clave = sel.value;
  var ciclo = inpCiclo ? inpCiclo.value.trim() : '';

  horCapSetModo('edicion');
  horCapLimpiarTablas();

  if (!ciclo) {
    horCapStatus('Docente cargado. Ingresa el ciclo escolar para cargar su horario completo.', 'info');
    return;
  }

  horCapStatus('Cargando datos del docente…', 'info');
  try {
    var datos = await horariosAPI.getDocenteData(clave, ciclo);

    var carga = datos.carga || [];
    carga.forEach(function(f) { horCapAddFilaCarga(f); });

    var extra = datos.extra || [];
    extra.forEach(function(f) { horCapAddFilaExt(f); });

    var totalFilas = carga.length + extra.length;
    horCapStatus(
      totalFilas > 0
        ? '✅ Docente cargado: ' + carga.length + ' materia(s), ' + extra.length + ' extraescolar(es).'
        : '✅ Docente cargado. Sin registros previos para el ciclo ' + ciclo + '.',
      'ok'
    );
  } catch (e) {
    horCapStatus('No se pudo cargar el horario del docente: ' + e.message, 'error');
  }
}

// ── LIMPIAR SOLO TABLAS (sin tocar Bloque A) ─────────────────
function horCapLimpiarTablas() {
  ['hc-body-carga', 'hc-body-ext'].forEach(function(tbodyId) {
    var tbody = document.getElementById(tbodyId);
    if (tbody) tbody.innerHTML = '';
    var tableId = tbodyId === 'hc-body-carga' ? 'hc-tabla-carga' : 'hc-tabla-ext';
    var table   = document.getElementById(tableId);
    if (table) {
      var wrap = table.closest('.hc-table-wrap');
      if (wrap) wrap.classList.remove('hc-visible');
    }
  });
  var he1 = document.getElementById('hc-carga-empty');
  var he2 = document.getElementById('hc-ext-empty');
  if (he1) he1.style.display = '';
  if (he2) he2.style.display = '';
  _hcFilasCarga = 0;
  _hcFilasExt   = 0;
  horCapActualizarResumen();
}

// ── AGREGAR FILA: CARGA HORARIA ──────────────────────────────
function horCapAddFilaCarga(datos) {
  var tbody = document.getElementById('hc-body-carga');
  var wrap  = document.querySelector('#hc-tabla-carga').closest('.hc-table-wrap');
  var hint  = document.getElementById('hc-carga-empty');
  if (!tbody) return;

  _hcFilasCarga++;
  var id = 'hcr' + Date.now() + _hcFilasCarga;
  var d  = datos || {};

  // Componente: preferir valor cargado, caer en catálogo si no viene
  var materia    = d.materia    || d.uac    || '';
  var componente = d.componente || _hcUACMap[materia] || '';

  var tr = document.createElement('tr');
  tr.id  = id;
  tr.innerHTML = [
    horCapTdInput(        id+'_grupo',   d.grupo  || '',  'Ej. 201',  '70px'),
    horCapTdInput(        id+'_turno',   d.turno  || '',  'M / V',    '52px'),
    horCapTdSelectUAC(    id+'_materia', materia),
    horCapTdInputReadonly(id+'_comp',    componente),
    horCapTdSelectBloque( id+'_lun',     d.lunes     || ''),
    horCapTdSelectBloque( id+'_mar',     d.martes    || ''),
    horCapTdSelectBloque( id+'_mie',     d.miercoles || ''),
    horCapTdSelectBloque( id+'_jue',     d.jueves    || ''),
    horCapTdSelectBloque( id+'_vie',     d.viernes   || ''),
    '<td class="hc-td-calc" id="'+id+'_tot">0</td>',
    '<td><button class="hc-btn-del" onclick="horCapDelFila(\''+id+'\')" title="Eliminar fila">'+
      '<i data-lucide="x"></i></button></td>'
  ].join('');

  tbody.appendChild(tr);

  // Recalcular total al cambiar cualquier día
  ['_lun','_mar','_mie','_jue','_vie'].forEach(function(sfx) {
    var sel = document.getElementById(id + sfx);
    if (sel) sel.addEventListener('change', function() {
      horCapCalcTotalFila(id);
      horCapActualizarResumen();
    });
  });

  // Auto-completar componente al cambiar UAC
  var matSel = document.getElementById(id + '_materia');
  var compEl = document.getElementById(id + '_comp');
  if (matSel && compEl) {
    matSel.addEventListener('change', function() {
      compEl.value = _hcUACMap[matSel.value] || '';
    });
  }

  if (wrap) wrap.classList.add('hc-visible');
  if (hint) hint.style.display = 'none';
  if (typeof lucide !== 'undefined') lucide.createIcons();
  horCapCalcTotalFila(id);
  horCapActualizarResumen();
}

// ── AGREGAR FILA: EXTRAESCOLARES ─────────────────────────────
function horCapAddFilaExt(datos) {
  var tbody = document.getElementById('hc-body-ext');
  var wrap  = document.querySelector('#hc-tabla-ext').closest('.hc-table-wrap');
  var hint  = document.getElementById('hc-ext-empty');
  if (!tbody) return;

  _hcFilasExt++;
  var id = 'hce' + Date.now() + _hcFilasExt;
  var d  = datos || {};

  var tr = document.createElement('tr');
  tr.id  = id;
  tr.innerHTML = [
    horCapTdInput(       id+'_act', d.actividad || d.actividad_extraescolar || '', 'Actividad de fortalecimiento', '200px'),
    horCapTdSelectBloque(id+'_lun', d.lunes     || ''),
    horCapTdSelectBloque(id+'_mar', d.martes    || ''),
    horCapTdSelectBloque(id+'_mie', d.miercoles || ''),
    horCapTdSelectBloque(id+'_jue', d.jueves    || ''),
    horCapTdSelectBloque(id+'_vie', d.viernes   || ''),
    '<td class="hc-td-calc" id="'+id+'_tot">0</td>',
    '<td><button class="hc-btn-del" onclick="horCapDelFila(\''+id+'\')" title="Eliminar fila">'+
      '<i data-lucide="x"></i></button></td>'
  ].join('');

  tbody.appendChild(tr);

  ['_lun','_mar','_mie','_jue','_vie'].forEach(function(sfx) {
    var sel = document.getElementById(id + sfx);
    if (sel) sel.addEventListener('change', function() {
      horCapCalcTotalExt(id);
      horCapActualizarResumen();
    });
  });

  if (wrap) wrap.classList.add('hc-visible');
  if (hint) hint.style.display = 'none';
  if (typeof lucide !== 'undefined') lucide.createIcons();
  horCapCalcTotalExt(id);
  horCapActualizarResumen();
}

// ── ELIMINAR FILA ────────────────────────────────────────────
function horCapDelFila(id) {
  var tr = document.getElementById(id);
  if (!tr) return;

  var tbody = tr.closest('tbody');
  tr.remove();

  if (tbody && tbody.rows.length === 0) {
    var wrap = tbody.closest('.hc-table-wrap');
    var hint = tbody.id === 'hc-body-carga'
      ? document.getElementById('hc-carga-empty')
      : document.getElementById('hc-ext-empty');
    if (wrap) wrap.classList.remove('hc-visible');
    if (hint) hint.style.display = '';
  }

  horCapActualizarResumen();
}

// ── CALCULAR TOTALES POR FILA ─────────────────────────────────
function horCapCalcTotalFila(id) {
  var total = 0;
  ['_lun','_mar','_mie','_jue','_vie'].forEach(function(sfx) {
    var el = document.getElementById(id + sfx);
    if (!el || !el.value) return;
    var hrs = horCapParseHorasRango(el.value);
    if (hrs > 0) total += hrs;
  });
  var td = document.getElementById(id + '_tot');
  if (td) td.textContent = total > 0 ? horCapFmt(total) : '0';
}

function horCapCalcTotalExt(id) {
  horCapCalcTotalFila(id);
}

// ── ACTUALIZAR RESUMEN (Bloque D) ────────────────────────────
function horCapActualizarResumen() {
  var totalFrente = 0;
  var totalExtra  = 0;

  document.querySelectorAll('#hc-body-carga tr').forEach(function(tr) {
    ['_lun','_mar','_mie','_jue','_vie'].forEach(function(sfx) {
      var el = document.getElementById(tr.id + sfx);
      if (el && el.value) totalFrente += horCapParseHorasRango(el.value);
    });
  });

  document.querySelectorAll('#hc-body-ext tr').forEach(function(tr) {
    ['_lun','_mar','_mie','_jue','_vie'].forEach(function(sfx) {
      var el = document.getElementById(tr.id + sfx);
      if (el && el.value) totalExtra += horCapParseHorasRango(el.value);
    });
  });

  var totalGen = totalFrente + totalExtra;
  var elF = document.getElementById('hc-sum-frente');
  var elE = document.getElementById('hc-sum-extra');
  var elT = document.getElementById('hc-sum-total');
  if (elF) elF.textContent = horCapFmt(totalFrente);
  if (elE) elE.textContent = horCapFmt(totalExtra);
  if (elT) elT.textContent = horCapFmt(totalGen);
}

// ── GUARDAR (Alta o Edición) ──────────────────────────────────
async function horCapGuardar() {
  // 1. Admin key
  if (!_hcAdminKey) {
    _hcAdminKey = window.prompt('Clave de administrador\n(la misma de Regenerar HORARIOS_WEB):');
    if (!_hcAdminKey) return;
  }

  // 2. Leer campos del docente
  var nombre = ((document.getElementById('hc-nombre')    || {}).value || '').trim();
  var clave  = ((document.getElementById('hc-clave')     || {}).value || '').trim();
  var form   = ((document.getElementById('hc-formacion') || {}).value || '').trim();
  var ciclo  = ((document.getElementById('hc-ciclo')     || {}).value || '').trim();

  if (!nombre || !clave) {
    horCapStatus('El nombre y la clave del docente son obligatorios.', 'error');
    return;
  }

  var filasCarga = horCapRecolectarCarga(clave, ciclo);
  var filasExt   = horCapRecolectarExt(clave, nombre, ciclo);

  // 3. Confirmación diferenciada por modo
  var esEdicion = _hcModo === 'edicion';
  var msg = esEdicion
    ? '⚠️ MODO EDICIÓN\nSe reemplazarán los registros de:\n'
    : 'Se guardará:\n';
  msg += '• Docente: ' + nombre + '\n';
  if (ciclo)             msg += '• Ciclo: ' + ciclo + '\n';
  if (filasCarga.length) msg += '• Carga horaria: ' + filasCarga.length + ' fila(s)\n';
  if (filasExt.length)   msg += '• Extraescolares: ' + filasExt.length  + ' fila(s)\n';
  if (esEdicion && ciclo) msg += '\n(Los registros previos de este docente/ciclo serán reemplazados)';
  if (!window.confirm(msg + '\n\n¿Continuar?')) return;

  horCapStatus('Guardando…', 'info');

  var errores = [];
  var okMsgs  = [];

  // 4. Guardar datos del docente (igual en ambos modos)
  try {
    var r1 = await horariosAPI.saveDocente(_hcAdminKey, { nombre: nombre, clave: clave, formacion: form });
    okMsgs.push(r1.message);
    if (r1.accion === 'nuevo') await horCapCargarListaDocentes();
  } catch(e) {
    errores.push('Docente: ' + e.message);
    _hcAdminKey = null;
  }

  // 5. Carga horaria
  // En modo Alta sin filas no es un error — simplemente no hay carga que guardar.
  if (ciclo && (esEdicion || filasCarga.length > 0)) {
    try {
      var apiCarga = esEdicion
        ? horariosAPI.replaceCargaHoraria(_hcAdminKey, clave, ciclo, filasCarga)
        : horariosAPI.saveCargaHoraria(_hcAdminKey, filasCarga);
      var r2 = await apiCarga;
      okMsgs.push(r2.message);
    } catch(e) { errores.push('Carga horaria: ' + e.message); }
  }

  // 6. Extraescolares
  // En modo Alta sin filas no es un error — simplemente no hay nada que guardar.
  // En modo Edición siempre se llama (aunque esté vacío) para poder borrar registros previos.
  if (ciclo && (esEdicion || filasExt.length > 0)) {
    try {
      var apiExt = esEdicion
        ? horariosAPI.replaceExtraescolares(_hcAdminKey, clave, ciclo, filasExt)
        : horariosAPI.saveExtraescolares(_hcAdminKey, filasExt);
      var r3 = await apiExt;
      if (r3) okMsgs.push(r3.message);
    } catch(e) { errores.push('Extraescolares: ' + e.message); }
  }

  if (errores.length) {
    horCapStatus('⚠️ ' + errores.join(' | '), 'error');
    return;
  }

  // ── 7. Regenerar HORARIOS_WEB y refrescar la vista ───────────
  horCapStatus('✅ Datos guardados. Regenerando vista…', 'info');

  try {
    var rRegen = await horariosAPI.regenerar(_hcAdminKey);
    if (rRegen.status !== 'ok') throw new Error(rRegen.message || 'Error al regenerar');
  } catch (eRegen) {
    horCapStatus(
      '✅ Datos guardados. ⚠️ No se pudo regenerar la vista: ' + eRegen.message +
      ' — usa el botón "Regenerar" manualmente.',
      'error'
    );
    return;
  }

  // Esperar que GAS termine de escribir, limpiar caché y recargar datos
  horariosAPI.clearCache();
  await new Promise(function(resolve) { setTimeout(resolve, 500); });

  try {
    _horData = await horariosAPI.getHorariosWeb(true);
    if (typeof horInitApp === 'function') horInitApp();
    horCapStatus('✅ Cambios guardados y vista actualizada correctamente.', 'ok');
  } catch (eRefresh) {
    horCapStatus(
      '✅ Datos guardados. No se pudo refrescar la vista: ' + eRefresh.message,
      'error'
    );
  }
}

// ── RECOLECTAR FILAS DE CARGA ────────────────────────────────
function horCapRecolectarCarga(clave, ciclo) {
  var filas = [];
  document.querySelectorAll('#hc-body-carga tr').forEach(function(tr) {
    var id = tr.id;
    var g = function(sfx) {
      var el = document.getElementById(id + sfx);
      return el ? el.value.trim() : '';
    };
    var materia = g('_materia');
    if (!materia) return;

    var lunes = g('_lun'), martes = g('_mar'), mie = g('_mie'),
        jue   = g('_jue'), vie    = g('_vie');
    var hrs = [lunes, martes, mie, jue, vie]
      .map(function(v) { return horCapParseHorasRango(v); })
      .reduce(function(a, b) { return a + b; }, 0);

    filas.push({
      clave: clave, ciclo: ciclo,
      grupo: g('_grupo'), turno: g('_turno'),
      materia: materia, componente: g('_comp'),
      lunes: lunes, martes: martes, miercoles: mie, jueves: jue, viernes: vie,
      total: horCapFmt(hrs)
    });
  });
  return filas;
}

// ── RECOLECTAR FILAS DE EXTRAESCOLARES ───────────────────────
function horCapRecolectarExt(clave, docente, ciclo) {
  var filas = [];
  document.querySelectorAll('#hc-body-ext tr').forEach(function(tr) {
    var id = tr.id;
    var g = function(sfx) {
      var el = document.getElementById(id + sfx);
      return el ? el.value.trim() : '';
    };
    var actividad = g('_act');
    if (!actividad) return;

    var lunes = g('_lun'), martes = g('_mar'), mie = g('_mie'),
        jue   = g('_jue'), vie    = g('_vie');
    var total = [lunes, martes, mie, jue, vie]
      .map(function(v) { return horCapParseHorasRango(v); })
      .reduce(function(a, b) { return a + b; }, 0);

    filas.push({
      clave: clave, docente: docente, ciclo: ciclo,
      actividad: actividad,
      lunes: lunes, martes: martes, miercoles: mie, jueves: jue, viernes: vie,
      total: horCapFmt(total)
    });
  });
  return filas;
}

// ── NUEVO DOCENTE ────────────────────────────────────────────
function horCapNuevo() {
  var sel = document.getElementById('hc-sel-docente');
  if (sel) sel.value = '';
  ['hc-nombre','hc-clave','hc-formacion'].forEach(function(fid) {
    var el = document.getElementById(fid);
    if (el) el.value = '';
  });
  var inpClave = document.getElementById('hc-clave');
  if (inpClave) {
    inpClave.readOnly = false;
    inpClave.classList.remove('hc-input-readonly');
  }
  horCapLimpiarTablas();
  horCapSetModo('alta');
  horCapStatus('Formulario listo para un nuevo docente.', 'info');
}

// ── LIMPIAR TODO ─────────────────────────────────────────────
function horCapLimpiar() {
  if (!window.confirm('¿Limpiar todo el formulario? Los datos no guardados se perderán.')) return;
  ['hc-ciclo','hc-nombre','hc-clave','hc-formacion'].forEach(function(fid) {
    var el = document.getElementById(fid);
    if (el) el.value = '';
  });
  var sel = document.getElementById('hc-sel-docente');
  if (sel) sel.value = '';
  var inpClave = document.getElementById('hc-clave');
  if (inpClave) {
    inpClave.readOnly = false;
    inpClave.classList.remove('hc-input-readonly');
  }
  horCapLimpiarTablas();
  horCapSetModo('alta');
  horCapStatus('Formulario limpiado.', 'info');
}

// ── REGENERAR ────────────────────────────────────────────────
async function horCapRegen() {
  if (!_hcAdminKey) {
    _hcAdminKey = window.prompt('Clave de administrador:');
    if (!_hcAdminKey) return;
  }
  horCapStatus('Regenerando HORARIOS_WEB…', 'info');
  try {
    var r = await horariosAPI.regenerar(_hcAdminKey);
    if (r.status === 'ok') {
      horariosAPI.clearCache();
      horCapStatus('✅ ' + r.message, 'ok');
    } else {
      horCapStatus('❌ ' + r.message, 'error');
      _hcAdminKey = null;
    }
  } catch(e) {
    horCapStatus('Error: ' + e.message, 'error');
    _hcAdminKey = null;
  }
}

// ── MENSAJE DE ESTADO ────────────────────────────────────────
function horCapStatus(msg, tipo) {
  var el = document.getElementById('hc-status');
  if (!el) return;
  el.className     = 'hc-status hc-' + (tipo || 'info');
  el.textContent   = msg;
  el.style.display = '';
  if (tipo === 'ok') setTimeout(function() { el.style.display = 'none'; }, 6000);
}

// ── HELPERS HTML ─────────────────────────────────────────────

/** Input de texto libre (grupo, turno, actividad). */
function horCapTdInput(id, value, placeholder, width) {
  return '<td><input id="' + id + '" class="hc-td-input" ' +
    'type="text" value="' + horCapEsc(value) + '" ' +
    'placeholder="' + horCapEsc(placeholder) + '" ' +
    'style="min-width:' + (width || '100px') + '"></td>';
}

/** Input de solo lectura para componente (auto-llenado desde catálogo). */
function horCapTdInputReadonly(id, value) {
  return '<td><input id="' + id + '" class="hc-td-input hc-td-readonly" ' +
    'type="text" value="' + horCapEsc(value) + '" ' +
    'readonly placeholder="Auto" title="Se autocompleta al seleccionar la UAC"></td>';
}

/** Select de UAC alimentado por CATALOGO_UAC.
 *  Si el valor cargado no está en el catálogo se agrega como opción de advertencia. */
function horCapTdSelectUAC(id, currentValue) {
  var opts  = '<option value="">— Materia / UAC —</option>';
  var found = false;

  _hcCatalogo.forEach(function(item) {
    var sel = (item.uac === currentValue) ? ' selected' : '';
    if (item.uac === currentValue) found = true;
    opts += '<option value="' + horCapEsc(item.uac) + '"' + sel + '>' +
            horCapEsc(item.uac) + '</option>';
  });

  // Valor previo no presente en el catálogo (datos anteriores o catálogo vacío)
  if (currentValue && !found) {
    opts += '<option value="' + horCapEsc(currentValue) + '" selected>' +
            horCapEsc(currentValue) + ' ⚠️</option>';
  }

  return '<td><select id="' + id + '" class="hc-td-select hc-td-select-uac">' +
         opts + '</select></td>';
}

/** Select de bloque horario predefinido (máx. 2 h).
 *  Si el valor cargado no está en la lista se agrega con advertencia. */
function horCapTdSelectBloque(id, currentValue) {
  var normVal = String(currentValue || '').trim();

  var opts = HC_BLOQUES.map(function(b) {
    var lbl = b || '—';
    var sel = (b === normVal) ? ' selected' : '';
    return '<option value="' + b + '"' + sel + '>' + lbl + '</option>';
  }).join('');

  // Valor previo con formato diferente (p.ej. sin cero inicial, o solo hora de inicio)
  if (normVal && HC_BLOQUES.indexOf(normVal) === -1) {
    opts += '<option value="' + horCapEsc(normVal) + '" selected>' +
            horCapEsc(normVal) + ' ⚠️</option>';
  }

  return '<td><select id="' + id + '" class="hc-td-select hc-td-select-bloque">' +
         opts + '</select></td>';
}

// ── HELPERS DE CÁLCULO ────────────────────────────────────────
function horCapParseHorasRango(v) {
  if (!v) return 0;
  var m = /^(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})$/.exec(String(v).trim());
  if (!m) return 0;
  var diff = horCapParseMin(m[2]) - horCapParseMin(m[1]);
  return diff > 0 ? Math.round(diff / 60 * 100) / 100 : 0;
}

function horCapParseMin(t) {
  var parts = String(t).split(':').map(Number);
  return (parts[0] || 0) * 60 + (parts[1] || 0);
}

function horCapFmt(n) {
  return n > 0 ? (Math.round(n * 10) / 10) + '' : '0';
}

function horCapEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
