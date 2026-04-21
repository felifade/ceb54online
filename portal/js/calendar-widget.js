/**
 * CalendarWidget — Componente unificado de calendario institucional
 * Vistas: Mensajes (default) · Semana · Tarjetas
 * Compatible con alumno.html, padre.html y portal-docente
 *
 * Uso:
 *   const w = new CalendarWidget('contenedor-id', { filtro: 'alumno' | 'todos' });
 *   w.mount();   // escucha calendarioDataLista y renderiza
 */
(function (global) {
  'use strict';

  // ── Constantes UI ────────────────────────────────────────────────
  const MESES  = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const MESES_L = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const DIAS_C = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

  const CAT = {
    academico:   { bg:'#dbeafe', fg:'#1d4ed8', label:'Académico'  },
    evaluacion:  { bg:'#fef3c7', fg:'#92400e', label:'Evaluación' },
    restriccion: { bg:'#fee2e2', fg:'#991b1b', label:'Restricción'},
    reunion:     { bg:'#ede9fe', fg:'#6d28d9', label:'Reunión'    },
    control:     { bg:'#e0f2fe', fg:'#0369a1', label:'Control'    },
    festivo:     { bg:'#dcfce7', fg:'#15803d', label:'Festivo'    },
    vacaciones:  { bg:'#dcfce7', fg:'#15803d', label:'Vacaciones' },
    periodo:     { bg:'#f0fdf4', fg:'#166534', label:'Período'    },
  };
  const catCfg = k => CAT[String(k||'').toLowerCase()] || { bg:'#f1f5f9', fg:'#475569', label: k||'Evento' };

  // ── CSS inyectado una sola vez ───────────────────────────────────
  const CSS = `
    .cwgt{font-family:system-ui,-apple-system,sans-serif;font-size:13.5px;color:#1e293b;}
    .cwgt-tabs{display:flex;gap:3px;border-bottom:2px solid #e2e8f0;margin-bottom:14px;}
    .cwgt-tab{padding:8px 16px;border:none;background:none;cursor:pointer;font-size:13px;
      font-weight:500;color:#64748b;border-bottom:2.5px solid transparent;margin-bottom:-2px;
      border-radius:8px 8px 0 0;transition:color .15s,background .15s;}
    .cwgt-tab:hover{color:#7c3aed;background:#f5f3ff;}
    .cwgt-tab.active{color:#7c3aed;border-bottom-color:#7c3aed;font-weight:700;}
    /* ── Mensajes ── */
    .cwgt-msg-list{}
    .cwgt-msg-item{display:flex;gap:12px;padding:10px 2px;border-bottom:1px solid #f1f5f9;align-items:flex-start;}
    .cwgt-msg-item:last-child{border-bottom:none;}
    .cwgt-msg-left{border-radius:8px;padding:8px 10px;min-width:70px;text-align:center;flex-shrink:0;}
    .cwgt-msg-cat{display:block;font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px;}
    .cwgt-msg-fecha{display:block;font-size:14px;font-weight:800;color:#1e293b;}
    .cwgt-msg-hora{display:block;font-size:11px;color:#64748b;margin-top:1px;}
    .cwgt-msg-body{flex:1;min-width:0;}
    .cwgt-msg-titulo{font-weight:600;color:#0f172a;font-size:13px;line-height:1.4;}
    .cwgt-msg-desc{color:#64748b;font-size:12px;margin-top:3px;line-height:1.45;}
    .cwgt-hoy-strip{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;
      padding:8px 12px;margin-bottom:12px;font-size:12px;color:#15803d;font-weight:600;}
    /* ── Semana ── */
    .cwgt-sem-nav{display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap;}
    .cwgt-sem-nav-label{flex:1;text-align:center;font-weight:600;font-size:13px;min-width:160px;}
    .cwgt-sem-btn{border:1.5px solid #e2e8f0;background:white;border-radius:6px;
      padding:5px 12px;cursor:pointer;font-size:12px;color:#334155;transition:background .12s;}
    .cwgt-sem-btn:hover{background:#f8fafc;}
    .cwgt-sem-btn.today{border-color:#7c3aed;color:#7c3aed;}
    .cwgt-sem-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;}
    .cwgt-dia{background:white;border:1.5px solid #e2e8f0;border-radius:10px;padding:8px 6px;min-height:90px;}
    .cwgt-dia.hoy{border-color:#7c3aed;background:#f5f3ff;}
    .cwgt-dia-hdr{margin-bottom:6px;}
    .cwgt-dia-nom{font-size:10px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.04em;}
    .cwgt-dia-num{font-size:20px;font-weight:800;color:#1e293b;line-height:1.1;}
    .cwgt-dia.hoy .cwgt-dia-num{color:#7c3aed;}
    .cwgt-ev-chip{border-radius:5px;padding:3px 7px;margin-bottom:3px;font-size:11px;font-weight:500;line-height:1.4;}
    .cwgt-cumple-chip{border-radius:5px;padding:3px 7px;margin-bottom:3px;font-size:11px;
      background:#fce7f3;color:#9d174d;}
    .cwgt-dia-vacio{color:#cbd5e1;font-size:11px;text-align:center;padding:10px 0;}
    /* ── Tarjetas ── */
    .cwgt-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:10px;}
    .cwgt-card{background:white;border-radius:10px;border:1px solid #e2e8f0;padding:12px;
      border-top-width:3px;transition:box-shadow .15s;}
    .cwgt-card:hover{box-shadow:0 4px 12px rgba(0,0,0,.08);}
    .cwgt-card-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:7px;gap:4px;}
    .cwgt-card-badge{font-size:9.5px;font-weight:800;padding:2px 8px;border-radius:20px;text-transform:uppercase;}
    .cwgt-card-fecha{font-size:11px;color:#64748b;font-weight:600;white-space:nowrap;}
    .cwgt-card-titulo{font-weight:600;color:#0f172a;font-size:12.5px;line-height:1.4;}
    .cwgt-card-desc{color:#64748b;font-size:11.5px;margin-top:4px;line-height:1.4;}
    .cwgt-card-hora{color:#7c3aed;font-size:11px;margin-top:6px;font-weight:700;}
    /* Vacío */
    .cwgt-empty{color:#94a3b8;text-align:center;padding:24px 0;font-size:13px;}
    /* Responsive */
    @media(max-width:520px){
      .cwgt-sem-grid{grid-template-columns:repeat(3,1fr);}
      .cwgt-grid{grid-template-columns:repeat(2,1fr);}
      .cwgt-tab{padding:7px 10px;font-size:12px;}
    }
  `;

  function injectCSS() {
    if (document.getElementById('_cwgt_css')) return;
    const s = document.createElement('style');
    s.id = '_cwgt_css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // ── Helpers ──────────────────────────────────────────────────────
  function esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // "JOSE ALFREDO AGUDO GARCIA" → { pila:"Jose", iniciales:"A.A.G." }
  function parseCumple(c) {
    var partes = String(c.nombre || '').trim().split(/\s+/);
    var pila   = partes[0] ? partes[0].charAt(0).toUpperCase() + partes[0].slice(1).toLowerCase() : '';
    var inic   = partes.slice(1).filter(Boolean).map(function(p) { return p.charAt(0).toUpperCase() + '.'; }).join('');
    return { pila: pila, iniciales: inic, cargo: c.cargo || '' };
  }

  // Chip compacto para celdas de semana: "🎂 José A.G. · Docente"
  function cumpleChipHtml(c) {
    var p = parseCumple(c);
    var nombre = esc(p.pila + (p.iniciales ? ' ' + p.iniciales : ''));
    var cargo  = p.cargo ? ' <span style="opacity:.65;font-size:9.5px;">· ' + esc(p.cargo) + '</span>' : '';
    return '<div class="cwgt-cumple-chip">🎂 ' + nombre + cargo + '</div>';
  }

  // Fila de strip para vista Mensajes: nombre completo + cargo
  function cumpleStripItem(c) {
    var p = parseCumple(c);
    var nombre = esc(p.pila + (p.iniciales ? ' ' + p.iniciales : ''));
    var cargo  = p.cargo ? ' <span style="font-weight:400;opacity:.7">· ' + esc(p.cargo) + '</span>' : '';
    return nombre + cargo;
  }
  function fmtFecha(str) {
    try { const d = new Date(str + 'T12:00:00'); return d.getDate() + ' ' + MESES[d.getMonth()]; }
    catch(e) { return str || ''; }
  }
  function isoDate(d) { return d.toISOString().slice(0,10); }
  function semanaLunes(offset) {
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const dow = hoy.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    const lun = new Date(hoy); lun.setDate(hoy.getDate() + diff + offset * 7);
    return lun;
  }

  // ── Clase principal ───────────────────────────────────────────────
  function CalendarWidget(containerId, options) {
    this.containerId = containerId;
    this.filtro      = (options && options.filtro) || 'alumno';
    this.views       = (options && options.views)  || ['mensajes','semana','tarjetas'];
    this.view        = (options && options.view)   || this.views[0];
    this.semOff      = 0;
    this.eventos     = [];
    this.cumpleanos  = [];
  }

  CalendarWidget.prototype.mount = function () {
    injectCSS();
    const self = this;
    document.addEventListener('calendarioDataLista', function () {
      self._loadData();
      self._paint();
    });
    // Si los datos ya estaban listos antes de que se montara el widget
    if (typeof FECHAS_CLAVE !== 'undefined' && FECHAS_CLAVE.length > 0) {
      self._loadData();
      self._paint();
    }
  };

  CalendarWidget.prototype._loadData = function () {
    const raw = (typeof FECHAS_CLAVE !== 'undefined' ? FECHAS_CLAVE : []);
    const cmp = (typeof CUMPLEANOS   !== 'undefined' ? CUMPLEANOS   : []);

    // Normalizar campos (soporta formato FECHAS_CLAVE y formato GAS raw)
    this.eventos = raw.map(function (e) {
      return {
        titulo:     e.titulo  || '',
        fecha:      e.fecha   || e.fecha_inicio || '',
        fechaFin:   e.fechaFin|| e.fecha_fin    || e.fecha || e.fecha_inicio || '',
        hora:       e.hora    || '',
        categoria:  e.categoria || 'academico',
        descripcion:e.descripcion || '',
        visiblePortalAlumno: e.visiblePortalAlumno !== undefined
          ? e.visiblePortalAlumno
          : String(e.portal_alumno || 'no').toUpperCase() === 'SI'
      };
    }).filter(function (e) {
      return e.titulo && e.fecha;
    });

    if (this.filtro === 'alumno') {
      this.eventos = this.eventos.filter(function (e) { return e.visiblePortalAlumno; });
    }

    this.cumpleanos = cmp.map(function (c) {
      return { nombre: c.nombre || '', fecha: c.fecha || '', cargo: c.cargo || '' };
    });
  };

  CalendarWidget.prototype._paint = function () {
    const el = document.getElementById(this.containerId);
    if (!el) return;

    const self = this;
    const allLabels = { mensajes:'📋 Mensajes', semana:'📅 Semana', tarjetas:'🗂 Tarjetas' };
    const views  = this.views;
    const labels = views.map(function(v) { return allLabels[v] || v; });

    // Tabs
    const tabsHtml = views.map(function (v, i) {
      return '<button class="cwgt-tab' + (v === self.view ? ' active' : '') +
        '" data-v="' + v + '">' + labels[i] + '</button>';
    }).join('');

    el.innerHTML = '<div class="cwgt"><div class="cwgt-tabs">' + tabsHtml +
      '</div><div class="cwgt-body" id="_cwgt_body_' + this.containerId + '"></div></div>';

    // Bind tabs
    el.querySelectorAll('.cwgt-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        self.view = btn.dataset.v;
        el.querySelectorAll('.cwgt-tab').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        if (self.view === 'semana') self.semOff = 0;
        self._renderBody();
      });
    });

    this._renderBody();
  };

  CalendarWidget.prototype._renderBody = function () {
    const body = document.getElementById('_cwgt_body_' + this.containerId);
    if (!body) return;
    if      (this.view === 'mensajes') body.innerHTML = this._viewMensajes();
    else if (this.view === 'semana')   { body.innerHTML = this._viewSemana(); this._bindSemNav(body); }
    else                               body.innerHTML = this._viewTarjetas();
  };

  // ── Vista Mensajes ────────────────────────────────────────────────
  CalendarWidget.prototype._viewMensajes = function () {
    const hoy    = new Date(); hoy.setHours(0,0,0,0);
    const hoyStr = isoDate(hoy);

    // Cumpleaños hoy / esta semana
    const viernesStr = isoDate(new Date(hoy.getTime() + 4 * 864e5));
    const cumpleHoy  = this.cumpleanos.filter(function (c) {
      return c.fecha && c.fecha.slice(5) >= hoyStr.slice(5) && c.fecha.slice(5) <= viernesStr.slice(5);
    });

    let stripHtml = '';
    if (cumpleHoy.length) {
      stripHtml = '<div class="cwgt-hoy-strip">🎂 Esta semana: ' +
        cumpleHoy.map(cumpleStripItem).join(' &nbsp;·&nbsp; ') + '</div>';
    }

    const proximos = this.eventos
      .filter(function (e) { return e.fecha >= hoyStr; })
      .sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; })
      .slice(0, 20);

    if (!proximos.length) {
      return stripHtml + '<div class="cwgt-empty">Sin eventos próximos</div>';
    }

    const items = proximos.map(function (e) {
      const cfg  = catCfg(e.categoria);
      const hora = e.hora ? '<span class="cwgt-msg-hora">' + esc(e.hora) + '</span>' : '';
      const desc = e.descripcion
        ? '<div class="cwgt-msg-desc">' + esc(e.descripcion) + '</div>' : '';
      return '<div class="cwgt-msg-item">' +
        '<div class="cwgt-msg-left" style="background:' + cfg.bg + '">' +
          '<span class="cwgt-msg-cat" style="color:' + cfg.fg + '">' + esc(cfg.label) + '</span>' +
          '<span class="cwgt-msg-fecha">' + fmtFecha(e.fecha) + '</span>' +
          hora +
        '</div>' +
        '<div class="cwgt-msg-body">' +
          '<div class="cwgt-msg-titulo">' + esc(e.titulo) + '</div>' +
          desc +
        '</div></div>';
    }).join('');

    return stripHtml + '<div class="cwgt-msg-list">' + items + '</div>';
  };

  // ── Tarjeta resumen de semana actual ─────────────────────────────
  function _semanaResumen(lunes, hoy) {
    const vier = new Date(lunes); vier.setDate(lunes.getDate() + 4);
    const fmtD = function(d) { return d.getDate() + ' ' + MESES[d.getMonth()]; };
    const rango = fmtD(lunes) + ' – ' + fmtD(vier);

    // Número de semana ISO aproximado
    const startOfYear = new Date(hoy.getFullYear(), 0, 1);
    const semNum = Math.ceil(((hoy - startOfYear) / 864e5 + startOfYear.getDay() + 1) / 7);

    const esFinde   = hoy.getDay() === 0 || hoy.getDay() === 6;
    const esGala    = hoy.getDay() === 2 || hoy.getDay() === 4;

    // Detectar vacaciones: si la semana actual no tiene ningún evento de tipo 'periodo' cubriendo hoy
    // (usamos simplemente día de la semana + si hay cronogramaMap disponible)
    var esVacacio = false;
    if (typeof cronogramaMap !== 'undefined' && cronogramaMap.length) {
      var semCron = cronogramaMap.find(function(s) { return hoy >= s.start && hoy <= s.end; });
      esVacacio = semCron && semCron.esVacaciones;
      if (semCron && semCron.num) { return _semanaResumenHtml(rango, semCron.num, esFinde, esGala, esVacacio); }
    }
    return _semanaResumenHtml(rango, semNum, esFinde, esGala, esVacacio);
  }

  function _semanaResumenHtml(rango, num, esFinde, esGala, esVacacio) {
    var bg, fg, badge, icon;
    if (esVacacio)    { bg='#ede9fe'; fg='#6d28d9'; badge='🌴 Vacaciones';        icon='🏝'; }
    else if (esFinde) { bg='#f1f5f9'; fg='#64748b'; badge='🏡 Fin de semana';     icon='🏡'; }
    else if (esGala)  { bg='#dbeafe'; fg='#1d4ed8'; badge='👔 Uniforme de gala';  icon='👔'; }
    else              { bg='#d1fae5'; fg='#065f46'; badge='👟 Pants + tenis';     icon='👟'; }
    return '<div class="cwgt-sem-card" style="background:' + bg + ';border-radius:10px;' +
      'padding:10px 14px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;gap:8px;">' +
      '<div style="display:flex;align-items:center;gap:10px;">' +
        '<span style="font-size:1.4rem;line-height:1;">' + icon + '</span>' +
        '<div>' +
          '<div style="font-size:11px;font-weight:800;color:' + fg + ';text-transform:uppercase;letter-spacing:.04em;">Semana ' + num + '</div>' +
          '<div style="font-size:12px;color:#475569;margin-top:1px;">' + rango + '</div>' +
        '</div>' +
      '</div>' +
      '<span style="font-size:11px;font-weight:700;color:' + fg + ';white-space:nowrap;">' + badge + '</span>' +
    '</div>';
  }

  // ── Vista Semana ──────────────────────────────────────────────────
  CalendarWidget.prototype._viewSemana = function () {
    const self   = this;
    const lunes  = semanaLunes(this.semOff);
    const hoy    = new Date(); hoy.setHours(0,0,0,0);
    const vier   = new Date(lunes); vier.setDate(lunes.getDate() + 4);

    // Tarjeta resumen solo cuando se muestra la semana actual
    const resumenHtml = this.semOff === 0 ? _semanaResumen(lunes, hoy) : '';

    const label  = lunes.getDate() + ' ' + MESES_L[lunes.getMonth()] +
      (lunes.getMonth() !== vier.getMonth()
        ? ' – ' + vier.getDate() + ' ' + MESES_L[vier.getMonth()]
        : ' – ' + vier.getDate()) +
      ' ' + lunes.getFullYear();

    const days = [0,1,2,3,4].map(function (d) {
      const dia    = new Date(lunes); dia.setDate(lunes.getDate() + d);
      const dStr   = isoDate(dia);
      const esHoy  = dia.getTime() === hoy.getTime();
      const mmdd   = dStr.slice(5); // MM-DD para comparar cumpleaños

      const evs = self.eventos.filter(function (e) {
        return dStr >= e.fecha && dStr <= (e.fechaFin || e.fecha);
      }).sort(function (a, b) { return (a.hora||'') < (b.hora||'') ? -1 : 1; });

      const cmpHoy = self.cumpleanos.filter(function (c) {
        return c.fecha && c.fecha.slice(5) === mmdd;
      });

      const chips = evs.map(function (e) {
        const cfg = catCfg(e.categoria);
        return '<div class="cwgt-ev-chip" style="background:' + cfg.bg + ';color:' + cfg.fg + '">' +
          esc(e.titulo) + '</div>';
      }).join('') +
      cmpHoy.map(cumpleChipHtml).join('');

      return '<div class="cwgt-dia' + (esHoy ? ' hoy' : '') + '">' +
        '<div class="cwgt-dia-hdr">' +
          '<div class="cwgt-dia-nom">' + DIAS_C[dia.getDay()] + '</div>' +
          '<div class="cwgt-dia-num">' + dia.getDate() + '</div>' +
        '</div>' +
        (chips || '<div class="cwgt-dia-vacio">—</div>') +
      '</div>';
    }).join('');

    return resumenHtml +
    '<div class="cwgt-sem-nav">' +
      '<button class="cwgt-sem-btn" data-nav="-1">← Ant</button>' +
      '<span class="cwgt-sem-nav-label">' + label + '</span>' +
      '<button class="cwgt-sem-btn" data-nav="1">Sig →</button>' +
      '<button class="cwgt-sem-btn today" data-nav="0">Hoy</button>' +
    '</div>' +
    '<div class="cwgt-sem-grid">' + days + '</div>';
  };

  CalendarWidget.prototype._bindSemNav = function (body) {
    const self = this;
    body.querySelectorAll('[data-nav]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const n = parseInt(btn.dataset.nav, 10);
        self.semOff = n === 0 ? 0 : self.semOff + n;
        self._renderBody();
      });
    });
  };

  // ── Vista Tarjetas ────────────────────────────────────────────────
  CalendarWidget.prototype._viewTarjetas = function () {
    const hoyStr = isoDate(new Date());
    const proximos = this.eventos
      .filter(function (e) { return e.fecha >= hoyStr; })
      .sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; })
      .slice(0, 12);

    if (!proximos.length) return '<div class="cwgt-empty">Sin eventos próximos</div>';

    const cards = proximos.map(function (e) {
      const cfg  = catCfg(e.categoria);
      const desc = e.descripcion
        ? '<div class="cwgt-card-desc">' + esc(e.descripcion) + '</div>' : '';
      const hora = e.hora
        ? '<div class="cwgt-card-hora">🕐 ' + esc(e.hora) + '</div>' : '';
      return '<div class="cwgt-card" style="border-top-color:' + cfg.fg + '">' +
        '<div class="cwgt-card-head">' +
          '<span class="cwgt-card-badge" style="background:' + cfg.bg + ';color:' + cfg.fg + '">' +
            esc(cfg.label) + '</span>' +
          '<span class="cwgt-card-fecha">' + fmtFecha(e.fecha) + '</span>' +
        '</div>' +
        '<div class="cwgt-card-titulo">' + esc(e.titulo) + '</div>' +
        desc + hora +
      '</div>';
    }).join('');

    return '<div class="cwgt-grid">' + cards + '</div>';
  };

  global.CalendarWidget = CalendarWidget;

})(window);
