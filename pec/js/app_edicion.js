/**
 * app_edicion.js — Módulo de Edición Posterior de Capturas PEC v1.0
 * AISLADO: No modifica ni depende del flujo de captura (app_v6.js).
 * Único punto de entrada externo: window.initEdicionView()
 */

window.initEdicionView = (function () {

  // Estado local del módulo
  let _estado = {
    isAdmin:        false,
    edicionAbierta: true,
    fechaCierre:    "",
    evaluaciones:   [],   // resultado de la última búsqueda
    registro:       null, // registro seleccionado para editar
  };

  // ── Helpers ──────────────────────────────────────────────────────────────

  function _isAdmin() {
    return (sessionStorage.getItem('user_role') || '').toLowerCase() === 'admin';
  }

  function _userEmail() {
    return sessionStorage.getItem('user_email') || '';
  }

  // ── Render principal ──────────────────────────────────────────────────────

  function _renderBase() {
    const container = document.getElementById('view-edicion');
    if (!container) return;

    container.innerHTML = `
      <div style="max-width: 1100px; margin: 0 auto;">

        <!-- Banner de estado -->
        <div id="edicion-banner" style="display:none; padding:10px 16px; border-radius:10px;
             font-size:0.88rem; font-weight:600; margin-bottom:1.5rem;"></div>

        <!-- Filtros de búsqueda -->
        <div class="panel" style="margin-bottom:1.5rem;">
          <h2 style="margin-top:0; margin-bottom:1rem; font-size:1.1rem; color:#1e293b;">
            🔍 Buscar Registros a Editar
          </h2>
          <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:1rem; margin-bottom:1rem;">
            <div>
              <label style="font-size:0.8rem; font-weight:600; color:#64748b; display:block; margin-bottom:4px;">Parcial</label>
              <select id="edit-f-parcial" class="input-control">
                <option value="">Todos</option>
                <option value="1">Parcial 1</option>
                <option value="2">Parcial 2</option>
                <option value="3">Parcial 3</option>
              </select>
            </div>
            <div>
              <label style="font-size:0.8rem; font-weight:600; color:#64748b; display:block; margin-bottom:4px;">Grupo</label>
              <input type="text" id="edit-f-grupo" class="input-control" placeholder="Ej: M201">
            </div>
            <div>
              <label style="font-size:0.8rem; font-weight:600; color:#64748b; display:block; margin-bottom:4px;">Equipo</label>
              <input type="text" id="edit-f-equipo" class="input-control" placeholder="Ej: Equipo 3">
            </div>
            <div>
              <label style="font-size:0.8rem; font-weight:600; color:#64748b; display:block; margin-bottom:4px;">Materia</label>
              <input type="text" id="edit-f-materia" class="input-control" placeholder="Buscar materia...">
            </div>
          </div>
          <div style="display:flex; gap:0.75rem; flex-wrap:wrap;">
            <button id="edit-btn-buscar" class="btn btn-primary" style="min-width:130px;">
              Buscar
            </button>
            <button id="edit-btn-limpiar" class="btn btn-outline" style="min-width:100px;">
              Limpiar
            </button>
          </div>
        </div>

        <!-- Tabla de resultados -->
        <div class="panel" id="edit-panel-resultados" style="display:none;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem;">
            <h2 style="margin:0; font-size:1.1rem; color:#1e293b;">Registros encontrados</h2>
            <span id="edit-count" style="background:#f1f5f9; color:#475569; padding:4px 12px; border-radius:99px; font-size:0.8rem; font-weight:600;"></span>
          </div>
          <div style="overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; font-size:0.85rem;" id="edit-tabla">
              <thead>
                <tr style="background:#f8fafc; border-bottom:2px solid #e2e8f0; color:#64748b; font-size:0.75rem; text-transform:uppercase; letter-spacing:0.5px;">
                  <th style="padding:10px 8px; text-align:left;">Fecha</th>
                  <th style="padding:10px 8px; text-align:center;">Parcial</th>
                  <th style="padding:10px 8px; text-align:left;">Grupo</th>
                  <th style="padding:10px 8px; text-align:left;">Equipo</th>
                  <th style="padding:10px 8px; text-align:left;">Materia</th>
                  <th style="padding:10px 8px; text-align:left;">Alumno</th>
                  <th style="padding:10px 8px; text-align:center;">Puntaje</th>
                  <th style="padding:10px 8px; text-align:center;">Tipo</th>
                  <th style="padding:10px 8px; text-align:center;">Acción</th>
                </tr>
              </thead>
              <tbody id="edit-tbody"></tbody>
            </table>
          </div>
        </div>

        <!-- Bitácora (solo admin) -->
        ${_isAdmin() ? `
        <div class="panel" style="margin-top:1.5rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem;">
            <h2 style="margin:0; font-size:1.1rem; color:#1e293b;">📋 Bitácora de Cambios</h2>
            <button id="edit-btn-bitacora" class="btn btn-secondary" style="font-size:0.8rem;">Cargar Bitácora</button>
          </div>
          <div id="edit-bitacora-container">
            <p style="color:#94a3b8; font-style:italic; font-size:0.85rem;">Haz clic en "Cargar Bitácora" para ver el historial de cambios.</p>
          </div>
        </div>` : ''}

      </div>

      <!-- Modal de edición -->
      <div id="modal-edicion" style="
        display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5);
        z-index:1000; align-items:center; justify-content:center; padding:1rem;">
        <div style="background:white; border-radius:16px; width:100%; max-width:500px;
             box-shadow:0 20px 60px rgba(0,0,0,0.2); overflow:hidden;">
          <div style="background:linear-gradient(135deg,#1e293b,#0f172a); color:white; padding:1.25rem 1.5rem; display:flex; justify-content:space-between; align-items:center;">
            <h3 style="margin:0; font-size:1rem;">✏️ Editar Registro</h3>
            <button id="modal-edicion-cerrar" style="background:none; border:none; color:white; cursor:pointer; font-size:1.2rem; line-height:1;">✕</button>
          </div>
          <div style="padding:1.5rem;">
            <div id="modal-edicion-info" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px; margin-bottom:1rem; font-size:0.85rem; color:#475569; line-height:1.7;"></div>

            <div style="margin-bottom:1rem;">
              <label style="font-size:0.85rem; font-weight:600; color:#334155; display:block; margin-bottom:4px;">Nuevo Puntaje (0 – 10)</label>
              <input type="number" id="modal-edicion-puntaje" class="input-control" min="0" max="10" step="0.1" placeholder="Ej: 8.5">
            </div>

            <div style="margin-bottom:1rem;">
              <label style="font-size:0.85rem; font-weight:600; color:#334155; display:block; margin-bottom:4px;">Observaciones (opcional)</label>
              <textarea id="modal-edicion-obs" class="input-control" rows="2" placeholder="Actualización de observaciones..."></textarea>
            </div>

            <div style="margin-bottom:1.5rem;">
              <label style="font-size:0.85rem; font-weight:700; color:#b91c1c; display:block; margin-bottom:4px;">Motivo del cambio <span style="color:#ef4444;">*</span></label>
              <textarea id="modal-edicion-motivo" class="input-control" rows="2" placeholder="Ej: Error de captura, alumno no presente, corrección de acta..."></textarea>
            </div>

            <div id="modal-edicion-error" style="display:none; background:#fef2f2; border:1px solid #fecaca; color:#dc2626; padding:10px 14px; border-radius:8px; font-size:0.85rem; margin-bottom:1rem;"></div>

            <div style="display:flex; gap:0.75rem;">
              <button id="modal-edicion-cerrar2" class="btn btn-outline" style="flex:1;">Cancelar</button>
              <button id="modal-edicion-guardar" class="btn btn-primary" style="flex:2;">Guardar Cambio</button>
            </div>
          </div>
        </div>
      </div>
    `;

    _bindEventos();
  }

  // ── Eventos ───────────────────────────────────────────────────────────────

  function _bindEventos() {
    document.getElementById('edit-btn-buscar').addEventListener('click', _buscar);
    document.getElementById('edit-btn-limpiar').addEventListener('click', _limpiarFiltros);

    // Modal
    document.getElementById('modal-edicion-cerrar').addEventListener('click',  _cerrarModal);
    document.getElementById('modal-edicion-cerrar2').addEventListener('click', _cerrarModal);
    document.getElementById('modal-edicion-guardar').addEventListener('click', _guardarCambio);

    // Bitácora (solo admin)
    const btnBit = document.getElementById('edit-btn-bitacora');
    if (btnBit) btnBit.addEventListener('click', _cargarBitacora);
  }

  // ── Búsqueda ──────────────────────────────────────────────────────────────

  async function _buscar() {
    const btn = document.getElementById('edit-btn-buscar');
    btn.disabled = true;
    btn.textContent = 'Buscando...';

    try {
      const filtros = {
        parcial: document.getElementById('edit-f-parcial').value,
        grupo:   document.getElementById('edit-f-grupo').value.trim(),
        materia: document.getElementById('edit-f-materia').value.trim(),
      };

      const resp = await api.buscarParaEditar(filtros);
      _estado.isAdmin        = resp.isAdmin;
      _estado.edicionAbierta = resp.edicionAbierta;
      _estado.fechaCierre    = resp.fechaCierre;

      // Filtrar client-side por equipo y materia (texto libre)
      const txtEquipo  = document.getElementById('edit-f-equipo').value.trim().toLowerCase();
      const txtMateria = document.getElementById('edit-f-materia').value.trim().toLowerCase();

      _estado.evaluaciones = resp.evaluaciones.filter(ev => {
        if (txtEquipo  && !ev.equipoNombre.toLowerCase().includes(txtEquipo))  return false;
        if (txtMateria && !ev.materia.toLowerCase().includes(txtMateria))       return false;
        return true;
      });

      _mostrarBanner();
      _renderTabla();

    } catch (err) {
      _mostrarBanner('error', `Error: ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Buscar';
    }
  }

  function _limpiarFiltros() {
    document.getElementById('edit-f-parcial').value = '';
    document.getElementById('edit-f-grupo').value   = '';
    document.getElementById('edit-f-equipo').value  = '';
    document.getElementById('edit-f-materia').value = '';
    document.getElementById('edit-panel-resultados').style.display = 'none';
    document.getElementById('edicion-banner').style.display = 'none';
    _estado.evaluaciones = [];
  }

  // ── Banner de estado ──────────────────────────────────────────────────────

  function _mostrarBanner(tipo, msg) {
    const banner = document.getElementById('edicion-banner');
    banner.style.display = 'block';

    if (tipo === 'error') {
      banner.style.background = '#fef2f2';
      banner.style.border     = '1px solid #fecaca';
      banner.style.color      = '#dc2626';
      banner.textContent      = msg;
      return;
    }

    const isAdmin  = _estado.isAdmin;
    const abierta  = _estado.edicionAbierta;
    const cierre   = _estado.fechaCierre;

    if (isAdmin) {
      banner.style.background = '#eff6ff';
      banner.style.border     = '1px solid #bfdbfe';
      banner.style.color      = '#1d4ed8';
      banner.textContent      = `🔑 Admin: puedes editar cualquier registro${cierre ? ` (cierre: ${cierre})` : ''}.`;
    } else if (abierta) {
      banner.style.background = '#f0fdf4';
      banner.style.border     = '1px solid #bbf7d0';
      banner.style.color      = '#166534';
      banner.textContent      = `✅ Edición abierta${cierre ? ` hasta ${cierre}` : ''}. Solo puedes modificar tus propios registros.`;
    } else {
      banner.style.background = '#fef3c7';
      banner.style.border     = '1px solid #fde68a';
      banner.style.color      = '#92400e';
      banner.textContent      = `🔒 Periodo de edición cerrado (${cierre}). Solo el administrador puede hacer cambios.`;
    }
  }

  // ── Tabla de resultados ───────────────────────────────────────────────────

  function _renderTabla() {
    const panel = document.getElementById('edit-panel-resultados');
    const tbody = document.getElementById('edit-tbody');
    const count = document.getElementById('edit-count');
    const evs   = _estado.evaluaciones;

    count.textContent = `${evs.length} registro(s)`;
    panel.style.display = evs.length > 0 ? 'block' : 'none';

    if (evs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:2rem; color:#94a3b8; font-style:italic;">Sin resultados. Ajusta los filtros.</td></tr>';
      return;
    }

    const miEmail = _userEmail();
    tbody.innerHTML = evs.map((ev, idx) => {
      const esMio        = ev.docenteEmail === miEmail;
      const puedeEditar  = _estado.isAdmin || (_estado.edicionAbierta && esMio);
      const btnStyle     = puedeEditar
        ? 'background:#3b82f6; color:white; border:none; padding:5px 12px; border-radius:6px; cursor:pointer; font-size:0.8rem; font-weight:600;'
        : 'background:#e2e8f0; color:#94a3b8; border:none; padding:5px 12px; border-radius:6px; cursor:not-allowed; font-size:0.8rem;';

      // Badge tipo_registro — "" o "CAPTURA" = verde, "EDICION" = ámbar
      const tipo = ev.tipoRegistro || "CAPTURA";
      const tipoBadge = tipo === "EDICION"
        ? `<span style="background:#fef3c7; color:#92400e; padding:2px 7px; border-radius:99px; font-size:0.65rem; font-weight:700;" title="Editado por ${ev.usuarioEdicion || '?'} el ${ev.fechaEdicion || '?'}">EDICIÓN</span>`
        : `<span style="background:#d1fae5; color:#065f46; padding:2px 7px; border-radius:99px; font-size:0.65rem; font-weight:700;">CAPTURA</span>`;

      return `
        <tr style="border-bottom:1px solid #f1f5f9; ${idx % 2 === 0 ? '' : 'background:#fafafa;'}">
          <td style="padding:9px 8px; color:#64748b; font-size:0.8rem;">${ev.fecha}</td>
          <td style="padding:9px 8px; text-align:center;">
            <span style="background:#fef08a; color:#854d0e; padding:2px 8px; border-radius:99px; font-size:0.75rem; font-weight:700;">P${ev.parcial}</span>
          </td>
          <td style="padding:9px 8px; font-weight:600; color:#1e293b;">${ev.grupoId}</td>
          <td style="padding:9px 8px; color:#334155;">${ev.equipoNombre || ev.equipoId}</td>
          <td style="padding:9px 8px; color:#475569; max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${ev.materia}">${ev.materia}</td>
          <td style="padding:9px 8px; color:#475569;">${ev.alumno || '—'}</td>
          <td style="padding:9px 8px; text-align:center; font-weight:800; font-size:1rem; color:${ev.puntaje >= 6 ? '#059669' : '#dc2626'};">
            ${ev.puntaje.toFixed(1)}
          </td>
          <td style="padding:9px 8px; text-align:center;">${tipoBadge}</td>
          <td style="padding:9px 8px; text-align:center;">
            <button style="${btnStyle}" ${puedeEditar ? '' : 'disabled title="Sin permiso"'}
              data-idx="${idx}" class="edit-btn-editar">
              Editar
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Vincular botones de editar
    tbody.querySelectorAll('.edit-btn-editar').forEach(btn => {
      btn.addEventListener('click', () => {
        const ev = _estado.evaluaciones[parseInt(btn.dataset.idx)];
        _abrirModal(ev);
      });
    });
  }

  // ── Modal de edición ──────────────────────────────────────────────────────

  function _abrirModal(ev) {
    _estado.registro = ev;
    const modal = document.getElementById('modal-edicion');

    document.getElementById('modal-edicion-info').innerHTML = `
      <strong>Parcial:</strong> ${ev.parcial} &nbsp;|&nbsp;
      <strong>Grupo:</strong> ${ev.grupoId} &nbsp;|&nbsp;
      <strong>Equipo:</strong> ${ev.equipoNombre || ev.equipoId}<br>
      <strong>Materia:</strong> ${ev.materia}<br>
      <strong>Alumno:</strong> ${ev.alumno || '(equipo completo)'} &nbsp;|&nbsp;
      <strong>Puntaje actual:</strong> <span style="font-weight:800; color:#1d4ed8;">${ev.puntaje.toFixed(1)}</span>
    `;

    document.getElementById('modal-edicion-puntaje').value = ev.puntaje;
    document.getElementById('modal-edicion-obs').value     = ev.observaciones || '';
    document.getElementById('modal-edicion-motivo').value  = '';
    document.getElementById('modal-edicion-error').style.display = 'none';

    modal.style.display = 'flex';
  }

  function _cerrarModal() {
    document.getElementById('modal-edicion').style.display = 'none';
    _estado.registro = null;
  }

  async function _guardarCambio() {
    const ev      = _estado.registro;
    if (!ev) return;

    const motivo  = document.getElementById('modal-edicion-motivo').value.trim();
    const puntaje = document.getElementById('modal-edicion-puntaje').value;
    const obs     = document.getElementById('modal-edicion-obs').value.trim();
    const errDiv  = document.getElementById('modal-edicion-error');

    // Validaciones cliente
    if (!motivo) {
      errDiv.textContent = 'El motivo del cambio es obligatorio.';
      errDiv.style.display = 'block';
      return;
    }
    const p = parseFloat(puntaje);
    if (isNaN(p) || p < 0 || p > 10) {
      errDiv.textContent = 'El puntaje debe ser un número entre 0 y 10.';
      errDiv.style.display = 'block';
      return;
    }

    errDiv.style.display = 'none';
    const btn = document.getElementById('modal-edicion-guardar');
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    try {
      const result = await api.editarEvaluacion({
        parcial:       ev.parcial,
        equipoId:      ev.equipoId,
        equipoNombre:  ev.equipoNombre,
        materia:       ev.materia,
        alumno:        ev.alumno,
        nuevoPuntaje:  p,
        nuevaObs:      obs,
        motivo:        motivo
      });

      if (result.status !== 'success') {
        errDiv.textContent = result.message || 'Error desconocido.';
        errDiv.style.display = 'block';
        return;
      }

      // Actualizar registro en memoria para que la tabla se refresque
      ev.puntaje       = p;
      ev.observaciones = obs || ev.observaciones;
      _cerrarModal();
      _renderTabla();
      alert('✅ Cambio guardado y registrado en bitácora.');

    } catch (err) {
      errDiv.textContent = `Error: ${err.message}`;
      errDiv.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Guardar Cambio';
    }
  }

  // ── Bitácora (admin) ──────────────────────────────────────────────────────

  async function _cargarBitacora() {
    const btn = document.getElementById('edit-btn-bitacora');
    const container = document.getElementById('edit-bitacora-container');
    btn.disabled = true;
    btn.textContent = 'Cargando...';

    try {
      const bitacora = await api.getBitacora();

      if (bitacora.length === 0) {
        container.innerHTML = '<p style="color:#94a3b8; font-style:italic; font-size:0.85rem;">No hay cambios registrados aún.</p>';
        return;
      }

      container.innerHTML = `
        <div style="overflow-x:auto;">
          <table style="width:100%; border-collapse:collapse; font-size:0.8rem;">
            <thead>
              <tr style="background:#f8fafc; border-bottom:2px solid #e2e8f0; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; font-size:0.7rem;">
                <th style="padding:8px;">Fecha Cambio</th>
                <th style="padding:8px;">Usuario</th>
                <th style="padding:8px; text-align:center;">Parcial</th>
                <th style="padding:8px;">Equipo</th>
                <th style="padding:8px;">Materia</th>
                <th style="padding:8px;">Alumno</th>
                <th style="padding:8px; text-align:center;">Ant.</th>
                <th style="padding:8px; text-align:center;">Nuevo</th>
                <th style="padding:8px;">Motivo</th>
              </tr>
            </thead>
            <tbody>
              ${bitacora.map((b, i) => `
                <tr style="border-bottom:1px solid #f1f5f9; ${i % 2 === 0 ? '' : 'background:#fafafa;'}">
                  <td style="padding:7px 8px; color:#64748b;">${b.fechaCambio}</td>
                  <td style="padding:7px 8px; color:#475569;">${b.usuarioEmail}</td>
                  <td style="padding:7px 8px; text-align:center; font-weight:700;">P${b.parcial}</td>
                  <td style="padding:7px 8px;">${b.equipoNombre || b.equipoId}</td>
                  <td style="padding:7px 8px; max-width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${b.materia}">${b.materia}</td>
                  <td style="padding:7px 8px;">${b.alumno || '—'}</td>
                  <td style="padding:7px 8px; text-align:center; color:#dc2626; font-weight:700;">${b.puntajeAnterior}</td>
                  <td style="padding:7px 8px; text-align:center; color:#059669; font-weight:700;">${b.puntajeNuevo}</td>
                  <td style="padding:7px 8px; color:#475569; font-style:italic;">${b.motivo}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<p style="color:#dc2626; font-size:0.85rem;">Error al cargar bitácora: ${err.message}</p>`;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Recargar Bitácora';
    }
  }

  // ── Punto de entrada ──────────────────────────────────────────────────────

  return async function initEdicionView() {
    _renderBase();
  };

})();
