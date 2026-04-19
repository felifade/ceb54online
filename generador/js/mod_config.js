/* ── mod_config.js — Configuración General ─────────────────────── */

/**
 * Normaliza un valor de hora a "HH:MM" (24h).
 * Maneja: "07:00", fracciones de día (0.291 = 07:00), valores raros, undefined.
 */
function _cfgCleanTime(val, fallback) {
  if (!val && val !== 0) return fallback || '07:00';
  // Si es número (fracción de día de Google Sheets, ej: 0.291666 = 07:00)
  if (typeof val === 'number') {
    var totalMin = Math.round(val * 24 * 60);
    var h = Math.floor(totalMin / 60) % 24;
    var m = totalMin % 60;
    return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
  }
  // Si ya es string HH:MM válido
  var str = String(val).trim();
  if (/^\d{1,2}:\d{2}$/.test(str)) {
    var parts = str.split(':');
    return String(parseInt(parts[0],10)).padStart(2,'0') + ':' + parts[1];
  }
  return fallback || '07:00';
}

genRegisterModule('config', {
  async render(container) {
    container.innerHTML = '<div class="gen-loading"><div class="gen-spinner"></div><span>Cargando configuración…</span></div>';
    try {
      var cfg = await genAPI.getConfig(true);
      _genApp.config = cfg;
      container.innerHTML = _cfgHTML(cfg);
      _cfgBind();
    } catch(err) {
      genShowError('No se pudo cargar la configuración: ' + err.message);
    }
  }
});

var _CFG_DIAS_DEFAULT_ = 'LU,MA,MI,JU,VI';

function _cfgHTML(cfg) {
  return `
<div class="gen-page-header">
  <h1 class="gen-page-title">Configuración General</h1>
</div>

<form id="gen-cfg-form" class="gen-form-card" autocomplete="off">
  <div class="gen-form-section">
    <h3 class="gen-form-section-title">Datos de la institución</h3>
    <div class="gen-form-row">
      <div class="gen-form-group">
        <label class="gen-label">Nombre de la escuela</label>
        <input type="text" name="nombre_escuela" class="gen-input" value="${genEsc(cfg.nombre_escuela || '')}" placeholder="CEB 5/4">
      </div>
      <div class="gen-form-group">
        <label class="gen-label">CCT</label>
        <input type="text" name="cct" class="gen-input" value="${genEsc(cfg.cct || '')}" placeholder="13DBP0001Z">
      </div>
    </div>
    <div class="gen-form-row">
      <div class="gen-form-group">
        <label class="gen-label">Ciclo escolar activo</label>
        <input type="text" name="ciclo_activo" class="gen-input" value="${genEsc(cfg.ciclo_activo || '')}" placeholder="2025-2026">
      </div>
      <div class="gen-form-group">
        <label class="gen-label">Turno</label>
        <select name="turno" class="gen-select">
          <option value="Matutino" ${cfg.turno === 'Matutino' ? 'selected' : ''}>Matutino</option>
          <option value="Vespertino" ${cfg.turno === 'Vespertino' ? 'selected' : ''}>Vespertino</option>
          <option value="Nocturno" ${cfg.turno === 'Nocturno' ? 'selected' : ''}>Nocturno</option>
          <option value="Mixto" ${cfg.turno === 'Mixto' ? 'selected' : ''}>Mixto</option>
        </select>
      </div>
    </div>
  </div>

  <div class="gen-form-section">
    <h3 class="gen-form-section-title">Horario de clases</h3>
    <div class="gen-form-row">
      <div class="gen-form-group">
        <label class="gen-label">Hora de inicio (HH:MM, 24h)</label>
        <input type="text" name="hora_inicio" class="gen-input gen-input-mono"
               value="${genEsc(_cfgCleanTime(cfg.hora_inicio, '07:00'))}"
               placeholder="07:00" maxlength="5" pattern="[0-9]{2}:[0-9]{2}">
        <span class="gen-hint">Formato 24h, ej: 07:00</span>
      </div>
      <div class="gen-form-group">
        <label class="gen-label">Hora de fin (HH:MM, 24h)</label>
        <input type="text" name="hora_fin" class="gen-input gen-input-mono"
               value="${genEsc(_cfgCleanTime(cfg.hora_fin, '14:30'))}"
               placeholder="14:30" maxlength="5" pattern="[0-9]{2}:[0-9]{2}">
        <span class="gen-hint">Formato 24h, ej: 14:30</span>
      </div>
      <div class="gen-form-group">
        <label class="gen-label">Duración del bloque (min)</label>
        <input type="number" name="duracion_bloque" class="gen-input" value="${genEsc(cfg.duracion_bloque || '50')}" min="30" max="120">
      </div>
      <div class="gen-form-group">
        <label class="gen-label">Número de bloques por día</label>
        <input type="number" name="num_bloques" class="gen-input" value="${genEsc(cfg.num_bloques || '8')}" min="4" max="12">
      </div>
    </div>
    <div class="gen-form-row">
      <div class="gen-form-group">
        <label class="gen-label">Días de la semana (separados por coma)</label>
        <input type="text" name="dias_semana" class="gen-input" value="${genEsc(cfg.dias_semana || _CFG_DIAS_DEFAULT_)}" placeholder="LU,MA,MI,JU,VI">
        <span class="gen-hint">Usa: LU, MA, MI, JU, VI, SA</span>
      </div>
    </div>
    <div id="gen-cfg-bloques-preview" class="gen-bloques-preview"></div>
  </div>

  <div class="gen-form-section">
    <h3 class="gen-form-section-title">Seguridad</h3>
    <div class="gen-form-row">
      <div class="gen-form-group">
        <label class="gen-label">Clave de administrador (GAS)</label>
        <input type="text" name="admin_key_display" class="gen-input gen-input-mono" value="CEB54_GENERADOR_ADMIN" readonly>
        <span class="gen-hint">Esta clave está definida en el código del GAS. Para cambiarla, edita GEN_ADMIN_KEY_ en generador.gs.</span>
      </div>
    </div>
  </div>

  <div class="gen-form-actions">
    <button type="button" class="gen-btn gen-btn-secondary" onclick="genNavTo('dashboard')">Cancelar</button>
    <button type="button" class="gen-btn gen-btn-primary" id="gen-cfg-save">Guardar configuración</button>
  </div>
</form>`;
}

function _cfgBind() {
  _cfgUpdatePreview();
  // Safari no dispara 'input' en type="time" — escuchar también 'change'
  document.querySelectorAll('#gen-cfg-form input[name="hora_inicio"], #gen-cfg-form input[name="num_bloques"], #gen-cfg-form input[name="duracion_bloque"]').forEach(function(el) {
    el.addEventListener('input', _cfgUpdatePreview);
    el.addEventListener('change', _cfgUpdatePreview);
  });

  document.getElementById('gen-cfg-save').addEventListener('click', async function() {
    genRequireAdmin(async function() {
      var form = document.getElementById('gen-cfg-form');
      var cfg  = {};
      form.querySelectorAll('input[name], select[name]').forEach(function(el) {
        if (el.name !== 'admin_key_display') cfg[el.name] = el.value;
      });

      // Si hay ciclo configurado, propagarlo
      if (cfg.ciclo_activo && !_genApp.ciclo) {
        _genApp.ciclo = cfg.ciclo_activo;
        genUpdateCicloDisplay();
      }

      var btn = document.getElementById('gen-cfg-save');
      btn.disabled = true;
      btn.textContent = 'Guardando…';
      try {
        await genAPI.saveConfig(_genApp.adminKey, cfg);
        _genApp.config = cfg;
        genToast('Configuración guardada correctamente.', 'ok');
      } catch(err) {
        genToast('Error: ' + err.message, 'error');
        if (err.message.includes('administrador')) _genApp.adminKey = null;
      } finally {
        btn.disabled = false;
        btn.textContent = 'Guardar configuración';
      }
    });
  });
}

function _cfgUpdatePreview() {
  var preview = document.getElementById('gen-cfg-bloques-preview');
  if (!preview) return;
  var horaInicio = document.querySelector('#gen-cfg-form input[name="hora_inicio"]');
  var numBloques = document.querySelector('#gen-cfg-form input[name="num_bloques"]');
  var duracion   = document.querySelector('#gen-cfg-form input[name="duracion_bloque"]');
  if (!horaInicio || !numBloques || !duracion) return;

  var tp      = String(horaInicio.value || '07:00').split(':');
  var startMin = (parseInt(tp[0], 10) || 7) * 60 + (parseInt(tp[1], 10) || 0);
  var total    = parseInt(numBloques.value, 10) || 8;
  var dur      = parseInt(duracion.value, 10) || 50;

  var bloques = [];
  for (var i = 0; i < total; i++) {
    var bS = startMin + i * dur;
    var bE = bS + dur;
    var start = String(Math.floor(bS/60)%24).padStart(2,'0') + ':' + String(bS%60).padStart(2,'0');
    var end   = String(Math.floor(bE/60)%24).padStart(2,'0') + ':' + String(bE%60).padStart(2,'0');
    bloques.push('<span class="gen-bloque-chip">B' + (i + 1) + ': ' + start + '–' + end + '</span>');
  }
  preview.innerHTML = '<p class="gen-hint" style="margin-bottom:6px">Vista previa de bloques:</p>' + bloques.join('');
}

function _cfgFmtTime(h, totalMin) {
  var hh = Math.floor(h + totalMin / 60) % 24;
  var mm = ((h * 60 + totalMin) % 60 + 60) % 60;
  return String(hh).padStart(2,'0') + ':' + String(mm).padStart(2,'0');
}
