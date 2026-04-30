// docente2/js/mod-tutorias.js
// Migración nativa de Tutorías — app.js adaptado para Docente 2.0

var _tutInit = false;

window.tutoriasShowView = function (viewId) {
  var views = document.querySelectorAll('#d2-mod-tutorias .view');
  views.forEach(function (v) { v.classList.add('hidden'); });
  var target = document.getElementById('view-' + viewId);
  if (target) target.classList.remove('hidden');
  if (viewId === 'dashboard' || viewId === 'historial' || viewId === 'reporte' || viewId === 'encuesta') {
    if (window._tutRenderAll) window._tutRenderAll();
  }
};

window.initTutorias = async function () {
  if (_tutInit) return;
  _tutInit = true;

  var allData = { tutorias: [], grupos: [], config: { docente: '' }, alumnosFull: [] };

  // Fecha hoy en el input
  var inputFechaTutoria = document.getElementById('input-fecha-tutoria');
  if (inputFechaTutoria) {
    var hoy = new Date();
    inputFechaTutoria.value = hoy.getFullYear() + '-'
      + String(hoy.getMonth() + 1).padStart(2, '0') + '-'
      + String(hoy.getDate()).padStart(2, '0');
  }

  // ── Normalización ─────────────────────────────────────────
  function normalizeName(str) {
    if (!str) return '';
    return str.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  }

  function formatDateLocale(dateStr) {
    if (!dateStr) return '-';
    if (typeof dateStr === 'string' && dateStr.includes('-') && !dateStr.includes(':')) {
      var parts = dateStr.split('-');
      return parts[2] + '/' + parts[1] + '/' + parts[0];
    }
    try {
      var d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString();
    } catch (e) { return dateStr; }
  }

  // ── Encuesta ──────────────────────────────────────────────
  function renderEncuesta() {
    var history = allData.feedbackHistory || [];
    var userEmail = sessionStorage.getItem('user_email');
    var userName = sessionStorage.getItem('user_name');
    var isAdmin = sessionStorage.getItem('user_role') === 'admin' || allData.isAdmin === true;
    var mainView = document.getElementById('view-encuesta');
    if (!mainView || mainView.classList.contains('hidden')) return;

    if (!userEmail && !userName) {
      document.getElementById('encuesta-local-banner').style.display = 'block';
      document.getElementById('encuesta-test-selector').style.display = 'block';
      var select = document.getElementById('encuesta-debug-select');
      if (select.options.length <= 1) {
        var names = [...new Set(history.map(function (h) { return h.docente; }))].filter(Boolean).sort();
        select.innerHTML = '<option value="">-- Elige un nombre para probar reporte --</option>'
          + names.map(function (n) { return '<option value="' + n + '">' + n + '</option>'; }).join('');
        select.onchange = function (e) {
          renderEncuestaAnalysis(history.filter(function (h) { return h.docente === e.target.value; }), e.target.value);
        };
      }
    }

    if (isAdmin) {
      var adminDashboard = document.getElementById('encuesta-admin-dashboard');
      var adminPanel = document.getElementById('encuesta-admin-panel');
      if (adminDashboard) adminDashboard.style.display = 'block';
      if (adminPanel) adminPanel.style.display = 'block';

      var gTotals = { c1: 0, c2: 0, c3: 0, c4: 0 };
      history.forEach(function (r) {
        gTotals.c1 += parseFloat(r.claridad || 0);
        gTotals.c2 += parseFloat(r.respeto || 0);
        gTotals.c3 += parseFloat(r.dominio || 0);
        gTotals.c4 += parseFloat(r.org || 0);
      });
      var hCount = history.length || 1;
      var kpis = {
        c1: (gTotals.c1 / hCount).toFixed(1), c2: (gTotals.c2 / hCount).toFixed(1),
        c3: (gTotals.c3 / hCount).toFixed(1), c4: (gTotals.c4 / hCount).toFixed(1)
      };
      var globalAvg = ((parseFloat(kpis.c1) + parseFloat(kpis.c2) + parseFloat(kpis.c3) + parseFloat(kpis.c4)) / 4).toFixed(1);

      document.getElementById('encuesta-kpi-global').textContent = globalAvg;
      document.getElementById('encuesta-kpi-c1').textContent = kpis.c1;
      document.getElementById('encuesta-kpi-c2').textContent = kpis.c2;
      document.getElementById('encuesta-kpi-c3').textContent = kpis.c3;
      document.getElementById('encuesta-kpi-c4').textContent = kpis.c4;

      var grouped = {};
      history.forEach(function (r) {
        var name = r.docente || 'Desconocido';
        if (!grouped[name]) grouped[name] = { count: 0, c1: 0, c2: 0, c3: 0, c4: 0, items: [] };
        grouped[name].count++;
        grouped[name].c1 += parseFloat(r.claridad || 0);
        grouped[name].c2 += parseFloat(r.respeto || 0);
        grouped[name].c3 += parseFloat(r.dominio || 0);
        grouped[name].c4 += parseFloat(r.org || 0);
        grouped[name].items.push(r);
      });

      var ranking = Object.keys(grouped).map(function (name) {
        var g = grouped[name];
        var avgs = {
          c1: (g.c1 / g.count).toFixed(1), c2: (g.c2 / g.count).toFixed(1),
          c3: (g.c3 / g.count).toFixed(1), c4: (g.c4 / g.count).toFixed(1)
        };
        var total = ((parseFloat(avgs.c1) + parseFloat(avgs.c2) + parseFloat(avgs.c3) + parseFloat(avgs.c4)) / 4).toFixed(1);
        return { name: name, total: total, avgs: avgs, count: g.count };
      }).sort(function (a, b) { return b.total - a.total; });

      var tbody = document.getElementById('encuesta-admin-tbody');
      tbody.innerHTML = ranking.map(function (r, i) {
        return '<tr style="border-bottom:1px solid #f1f5f9;">'
          + '<td style="padding:12px;font-weight:800;color:#64748b;">#' + (i + 1) + '</td>'
          + '<td style="padding:12px;font-weight:700;color:#1e293b;">' + r.name
          + '<div style="font-size:0.65rem;color:#94a3b8;font-weight:400;">' + r.count + ' evaluaciones</div></td>'
          + '<td style="padding:12px;text-align:center;"><span style="background:' + (r.total >= 4 ? '#f0fdf4' : '#fff7ed') + ';color:' + (r.total >= 4 ? '#166534' : '#9a3412') + ';padding:4px 8px;border-radius:8px;font-weight:800;font-size:1rem;">' + r.total + '</span></td>'
          + '<td style="padding:12px;font-size:0.75rem;color:#64748b;">' + r.avgs.c1 + ' | ' + r.avgs.c2 + ' | ' + r.avgs.c3 + ' | ' + r.avgs.c4 + '</td>'
          + '<td style="padding:12px;"><span style="font-size:0.7rem;padding:2px 6px;border-radius:4px;background:#f1f5f9;color:#475569;font-weight:700;">' + (r.total >= 4.5 ? 'EXCELENTE' : r.total >= 3.5 ? 'SATISFACTORIO' : 'MEJORABLE') + '</span></td>'
          + '</tr>';
      }).join('');

      var mirrorSelect = document.getElementById('encuesta-admin-mirror-select');
      if (mirrorSelect && mirrorSelect.options.length <= 1) {
        Object.keys(grouped).sort().forEach(function (n) {
          var opt = document.createElement('option');
          opt.value = n; opt.textContent = 'Ver Dashboard de: ' + n;
          mirrorSelect.appendChild(opt);
        });
        mirrorSelect.addEventListener('change', function (e) {
          if (e.target.value === 'global') renderEncuestaAnalysis(history, 'Resumen Global Institucional');
          else renderEncuestaAnalysis(grouped[e.target.value].items, e.target.value);
        });
      }
    }

    var loggedName = userName || userEmail;
    if (loggedName) {
      var myNamesFromDir = (allData.directorio || [])
        .filter(function (d) { return normalizeName(d.correo) === normalizeName(userEmail); })
        .map(function (d) { return normalizeName(d.docente); });
      var myFeedback = myNamesFromDir.length > 0
        ? history.filter(function (h) { return myNamesFromDir.includes(normalizeName(h.docente)); })
        : history.filter(function (h) { return normalizeName(h.docente) === normalizeName(userName); });

      if (myFeedback.length > 0) renderEncuestaAnalysis(myFeedback, userName || myFeedback[0].docente);
      else if (isAdmin) renderEncuestaAnalysis(history, 'Resumen Global Institucional');
      else {
        document.getElementById('encuesta-teacher-name').textContent = 'Sin evaluaciones aún';
        document.getElementById('encuesta-comment-list').innerHTML = '<p style="text-align:center;color:#94a3b8;padding:20px;">Aún no tienes evaluaciones registradas este semestre.</p>';
      }
    }
  }

  function renderEncuestaAnalysis(lista, nombre) {
    document.getElementById('encuesta-teacher-name').textContent = 'Reporte de ' + nombre;
    var totals = { c1: 0, c2: 0, c3: 0, c4: 0 };
    lista.forEach(function (r) {
      totals.c1 += parseFloat(r.claridad || 0);
      totals.c2 += parseFloat(r.respeto || 0);
      totals.c3 += parseFloat(r.dominio || 0);
      totals.c4 += parseFloat(r.org || 0);
    });
    var count = lista.length || 1;
    var avgs = {
      c1: (totals.c1 / count).toFixed(1), c2: (totals.c2 / count).toFixed(1),
      c3: (totals.c3 / count).toFixed(1), c4: (totals.c4 / count).toFixed(1)
    };
    var globalAvg = ((parseFloat(avgs.c1) + parseFloat(avgs.c2) + parseFloat(avgs.c3) + parseFloat(avgs.c4)) / 4).toFixed(1);
    document.getElementById('encuesta-global-avg').textContent = globalAvg;
    ['c1', 'c2', 'c3', 'c4'].forEach(function (id) {
      var v = avgs[id];
      document.getElementById('encuesta-val-' + id).textContent = v;
      document.getElementById('encuesta-bar-' + id).style.width = ((v / 5) * 100) + '%';
      var full = Math.round(v);
      document.getElementById('encuesta-stars-' + id).innerHTML = Array(5).fill(0).map(function (_, i) {
        return '<i data-lucide="star" style="width:14px;fill:' + (i < full ? '#f59e0b' : 'none') + ';color:' + (i < full ? '#f59e0b' : '#cbd5e1') + ';"></i>';
      }).join('');
    });
    var comms = document.getElementById('encuesta-comment-list');
    comms.innerHTML = lista.map(function (r) {
      var txt = r.comentarios || '';
      return txt.trim()
        ? '<div class="comment-item">&ldquo;' + txt + '&rdquo;<div style="font-size:0.7rem;color:#94a3b8;margin-top:4px;">&mdash; Grupo ' + (r.grupo || '?') + '</div></div>'
        : '';
    }).join('') || '<p style="text-align:center;color:#94a3b8;">Sin comentarios.</p>';
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  // ── Render principal ──────────────────────────────────────
  function renderDashboard() {
    document.getElementById('stat-total').textContent = allData.totalTutorias;
    document.getElementById('stat-individual').textContent = allData.individual;
    document.getElementById('stat-grupal').textContent = allData.grupal;
    document.getElementById('stat-hombres').textContent = allData.hombres;
    document.getElementById('stat-mujeres').textContent = allData.mujeres;
    var list = document.getElementById('recent-activity-list');
    var recent = [...allData.tutorias].reverse().slice(0, 5);
    list.innerHTML = recent.length ? recent.map(function (t) {
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:#f8fafc;border-radius:10px;border:1px solid #f1f5f9;">'
        + '<div><div style="font-weight:700;font-size:0.9rem;">' + t.alumno + '</div>'
        + '<div style="font-size:0.75rem;color:#64748b;">' + t.grupo + ' • ' + t.asignatura + ' • Parcial ' + t.parcial + '</div></div>'
        + '<span style="font-size:0.7rem;font-weight:700;padding:4px 10px;border-radius:20px;background:' + (t.individual ? '#e0f2fe' : '#fdf2f8') + ';color:' + (t.individual ? '#0369a1' : '#db2777') + ';">' + (t.individual ? 'Individual' : 'Grupal') + '</span></div>';
    }).join('') : '<p style="color:#94a3b8;text-align:center;padding:1rem;">Sin registros aún.</p>';
  }

  function renderHistorial() {
    var tbody = document.getElementById('historial-tbody');
    var isAdmin = sessionStorage.getItem('user_role') === 'admin' || allData.isAdmin === true;
    var teacherFilter = (document.getElementById('admin-teacher-select') || {}).value || 'all';
    var filtered = allData.tutorias;
    if (isAdmin && teacherFilter !== 'all') filtered = filtered.filter(function (t) { return t.docente === teacherFilter; });
    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="10" style="padding:2.5rem;text-align:center;color:#94a3b8;font-size:0.85rem;">Sin registros para mostrar.</td></tr>';
      return;
    }
    tbody.innerHTML = filtered.map(function (t) {
      return '<tr style="border-bottom:1px solid #f8fafc;">'
        + '<td style="padding:0.4rem 0.65rem;font-size:0.78rem;white-space:nowrap;">' + formatDateLocale(t.fecha_tutoria || t.fecha) + '</td>'
        + '<td style="padding:0.4rem 0.65rem;font-size:0.78rem;"><span onclick="toggleTutoriaParcial(event,\'' + t.fecha + '\',\'' + t.alumno.replace(/'/g, "\\'") + '\',' + t.parcial + ')" title="Click para cambiar" style="cursor:pointer;font-weight:700;color:#3b82f6;background:#eff6ff;padding:2px 6px;border-radius:4px;border:1px solid #dbeafe;">P' + t.parcial + '</span></td>'
        + '<td style="padding:0.4rem 0.65rem;font-size:0.78rem;font-weight:700;">' + t.grupo + '</td>'
        + '<td style="padding:0.4rem 0.65rem;font-size:0.78rem;">' + t.alumno
        + '<span onclick="toggleTutoriaSexo(event,\'' + t.fecha + '\',\'' + t.alumno.replace(/'/g, "\\'") + '\',\'' + t.sexo + '\')" title="Click para cambiar" style="cursor:pointer;font-size:0.68rem;font-weight:700;padding:1px 5px;border-radius:4px;margin-left:3px;background:' + (t.sexo === 'H' ? '#dcfce7' : '#fce7f3') + ';color:' + (t.sexo === 'H' ? '#166534' : '#9d174d') + ';border:1px solid ' + (t.sexo === 'H' ? '#bbf7d0' : '#fbcfe8') + ';">' + t.sexo + '</span></td>'
        + '<td class="admin-only-col" style="padding:0.4rem 0.65rem;font-size:0.72rem;font-weight:600;color:#475569;display:' + (isAdmin ? 'table-cell' : 'none') + ';">' + (t.docente || '-') + '</td>'
        + '<td style="padding:0.4rem 0.65rem;font-size:0.78rem;">' + t.asignatura + '</td>'
        + '<td style="padding:0.4rem 0.65rem;font-size:0.95rem;text-align:center;" onclick="toggleAsistencia(event,\'' + t.fecha + '\',\'' + t.alumno.replace(/'/g, "\\'") + '\',\'' + t.asistencia + '\')" title="Click para cambiar">' + (t.asistencia === 'NO' ? '❌' : '✅') + '</td>'
        + '<td style="padding:0.4rem 0.65rem;font-size:0.78rem;">' + (t.individual ? 'Individual' : 'Grupal') + '</td>'
        + '<td style="padding:0.4rem 0.65rem;font-size:0.78rem;color:#64748b;word-wrap:break-word;">' + t.tema + '</td>'
        + '<td style="padding:0.4rem 0.65rem;"><button class="btn-delete" onclick="handleDeleteTutoria(\'' + t.fecha + '\',\'' + t.alumno.replace(/'/g, "\\'") + '\')" style="background:none;border:none;color:#ef4444;cursor:pointer;padding:3px;"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button></td>'
        + '</tr>';
    }).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  function renderReporte() {
    var pFilter = document.getElementById('report-parcial-filter').value;
    var isAdmin = sessionStorage.getItem('user_role') === 'admin' || allData.isAdmin === true;
    var reportTeacherFilter = (document.getElementById('report-teacher-select') || {}).value || 'all';
    var baseData = allData.tutorias;
    if (isAdmin && reportTeacherFilter !== 'all') {
      baseData = baseData.filter(function (t) { return t.docente === reportTeacherFilter; });
      document.getElementById('report-teacher-name').textContent = reportTeacherFilter.toUpperCase();
    } else if (isAdmin) {
      document.getElementById('report-teacher-name').textContent = 'RESUMEN GLOBAL INSTITUCIONAL';
    } else {
      var dn = sessionStorage.getItem('user_name') || (allData.config && allData.config.docente);
      document.getElementById('report-teacher-name').textContent = dn ? dn.toUpperCase() : '---';
    }

    var filtered = baseData.filter(function (t) { return String(t.parcial) === String(pFilter); })
      .sort(function (a, b) { return new Date(a.fecha_tutoria || a.fecha) - new Date(b.fecha_tutoria || b.fecha); });

    var stats = { p1: { h:0,m:0,g:0,i:0 }, p2: { h:0,m:0,g:0,i:0 }, p3: { h:0,m:0,g:0,i:0 } };
    baseData.forEach(function (t) {
      var key = 'p' + t.parcial;
      if (stats[key]) {
        if (t.sexo === 'H') stats[key].h++;
        if (t.sexo === 'F') stats[key].m++;
        if (t.grupal)      stats[key].g++;
        if (t.individual)  stats[key].i++;
      }
    });
    for (var i = 1; i <= 3; i++) {
      var s = stats['p' + i];
      document.getElementById('rep-p' + i + '-h').textContent = s.h;
      document.getElementById('rep-p' + i + '-m').textContent = s.m;
      document.getElementById('rep-p' + i + '-t').textContent = s.h + s.m;
      document.getElementById('rep-g-p' + i).textContent = s.g;
      document.getElementById('rep-i-p' + i).textContent = s.i;
    }
    document.getElementById('report-tbody').innerHTML = filtered.map(function (t) {
      return '<tr><td style="border:1px solid #000;padding:4px;">' + t.grupo + '</td>'
        + '<td style="border:1px solid #000;padding:4px;">' + t.alumno + '</td>'
        + '<td style="border:1px solid #000;padding:4px;text-align:center;">' + t.sexo + '</td>'
        + '<td style="border:1px solid #000;padding:4px;">' + t.asignatura + '</td>'
        + '<td style="border:1px solid #000;padding:4px;text-align:center;font-size:1.1rem;">' + (t.asistencia === 'NO' ? '❌' : '✅') + '</td>'
        + '<td style="border:1px solid #000;padding:4px;text-align:center;">' + (t.grupal ? 'X' : '') + '</td>'
        + '<td style="border:1px solid #000;padding:4px;text-align:center;">' + (t.individual ? 'X' : '') + '</td>'
        + '<td style="border:1px solid #000;padding:4px;">' + formatDateLocale(t.fecha_tutoria || t.fecha) + '</td></tr>';
    }).join('') || '<tr><td colspan="8" style="text-align:center;padding:10px;">No hay datos para este parcial</td></tr>';
  }

  function renderAll() {
    renderDashboard();
    renderHistorial();
    renderReporte();
    renderEncuesta();
  }
  window._tutRenderAll = renderAll;

  // ── Acciones inline del historial ─────────────────────────
  window.handleDeleteTutoria = async function (fecha, alumno) {
    if (!confirm('¿Estás seguro de que deseas eliminar el registro de tutoría de ' + alumno + '?')) return;
    try {
      var result = await api.eliminarTutoria(fecha, alumno);
      if (result.status === 'success') { alert('Registro eliminado con éxito.'); await loadInitialData(); }
      else alert('Error al eliminar: ' + result.message);
    } catch (e) { alert('Error de conexión: ' + e.message); }
  };

  window.toggleTutoriaSexo = async function (event, fecha, alumno, sexoActual) {
    var badge = event.currentTarget;
    var orig = badge.innerHTML;
    badge.innerHTML = '...'; badge.style.opacity = '0.5'; badge.style.pointerEvents = 'none';
    try {
      var result = await api.actualizarCampo(fecha, alumno, 'sexo', sexoActual === 'H' ? 'F' : 'H');
      if (result.status === 'success') await loadInitialData();
      else { alert('Error: ' + result.message); badge.innerHTML = orig; badge.style.opacity = '1'; badge.style.pointerEvents = 'auto'; }
    } catch (e) { alert('Error: ' + e.message); badge.innerHTML = orig; badge.style.opacity = '1'; badge.style.pointerEvents = 'auto'; }
  };

  window.toggleTutoriaParcial = async function (event, fecha, alumno, parcialActual) {
    var badge = event.currentTarget;
    var orig = badge.innerHTML;
    badge.innerHTML = '...'; badge.style.opacity = '0.5'; badge.style.pointerEvents = 'none';
    try {
      var result = await api.actualizarCampo(fecha, alumno, 'parcial', parcialActual >= 3 ? 1 : parcialActual + 1);
      if (result.status === 'success') await loadInitialData();
      else { alert('Error: ' + result.message); badge.innerHTML = orig; badge.style.opacity = '1'; badge.style.pointerEvents = 'auto'; }
    } catch (e) { alert('Error: ' + e.message); badge.innerHTML = orig; badge.style.opacity = '1'; badge.style.pointerEvents = 'auto'; }
  };

  window.toggleAsistencia = async function (event, fecha, alumno, asistenciaActual) {
    var cell = event.currentTarget;
    var orig = cell.innerHTML;
    cell.innerHTML = '...'; cell.style.opacity = '0.5'; cell.style.pointerEvents = 'none';
    try {
      var result = await api.actualizarCampo(fecha, alumno, 'asistencia', asistenciaActual === 'NO' ? 'SÍ' : 'NO');
      if (result.status === 'success') await loadInitialData();
      else { alert('Error: ' + result.message); cell.innerHTML = orig; cell.style.opacity = '1'; cell.style.pointerEvents = 'auto'; }
    } catch (e) { alert('Error: ' + e.message); cell.innerHTML = orig; cell.style.opacity = '1'; cell.style.pointerEvents = 'auto'; }
  };

  // ── Materias ──────────────────────────────────────────────
  function populateSubjects() {
    var dl = document.getElementById('list-asignatura');
    if (!dl) return;

    var allSubjects = [
      ...(allData.directorio   || []).map(function (d) { return d.materia; }),
      ...(allData.programacion || []).map(function (p) { return p.materia; }),
      ...(allData.materias     || []).map(function (m) { return typeof m === 'string' ? m : (m.materia || m.nombre || ''); }),
      ...(allData.tutorias     || []).map(function (t) { return t.asignatura || t.materia || ''; })
    ];

    var unique = [...new Set(allSubjects)].filter(Boolean).sort();
    dl.innerHTML = unique.map(function (s) {
      return '<option value="' + s.replace(/"/g, '&quot;') + '">';
    }).join('');
  }

  // ── Selección de alumnos ──────────────────────────────────
  var selectedStudentsState = [];

  function updateCountBadge() {
    var count = selectedStudentsState.filter(function (s) { return s.isSelected; }).length;
    var badge = document.getElementById('selected-count-badge');
    if (!badge) return;
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline-flex' : 'none';
  }

  function setupGroupSelection() {
    var inputGrupo      = document.getElementById('input-grupo');
    var inputSearchName = document.getElementById('input-search-name');
    var container       = document.getElementById('students-checkbox-list');
    var btnSelectAll    = document.getElementById('btn-select-all');
    var manualNameInput = document.getElementById('manual-name');
    var manualSexSelect = document.getElementById('manual-sex');
    var btnManualSex    = document.getElementById('btn-manual-sex');
    var btnAddManual    = document.getElementById('btn-add-manual-direct');

    btnManualSex.addEventListener('click', function () {
      var newSexo = btnManualSex.dataset.sexo === 'H' ? 'F' : 'H';
      btnManualSex.dataset.sexo = newSexo;
      btnManualSex.textContent = newSexo;
      btnManualSex.className = 'sexo-toggle-btn sexo-' + newSexo;
      manualSexSelect.value = newSexo;
    });

    var renderTotalList = function (searchResults) {
      searchResults = searchResults || [];
      var combined = [...selectedStudentsState];
      searchResults.forEach(function (res) {
        if (!combined.find(function (c) { return c.nombre === res.nombre; })) {
          combined.push(Object.assign({}, res, { isSelected: false }));
        }
      });

      if (!combined.length) {
        container.innerHTML = '<div class="students-empty"><i data-lucide="user-search" style="width:36px;height:36px;color:#cbd5e1;"></i><p>Ingresa el número de grupo o busca por nombre</p></div>';
        if (typeof lucide !== 'undefined') lucide.createIcons();
        btnSelectAll.style.display = 'none';
        updateCountBadge();
        return;
      }

      btnSelectAll.style.display = 'inline';
      container.innerHTML = combined.map(function (a) {
        var sx = a.sexo || 'H';
        if (sx.toUpperCase().startsWith('M') || sx.toUpperCase().startsWith('F')) sx = 'F'; else sx = 'H';
        var initials = a.nombre.split(' ').slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase();
        var avatarStyle = sx === 'F' ? 'background:#fce7f3;color:#be185d;' : 'background:#dbeafe;color:#1d4ed8;';
        return '<div class="student-item ' + (a.isSelected ? 'selected' : '') + '">'
          + '<input type="checkbox" class="student-check" value="' + a.nombre + '" ' + (a.isSelected ? 'checked' : '') + '>'
          + '<div class="student-avatar" style="' + avatarStyle + '">' + initials + '</div>'
          + '<div class="student-info"><span class="student-name">' + a.nombre + '</span>'
          + '<span class="student-group-badge ' + (a.grupo ? '' : 'manual') + '">' + (a.grupo || 'Manual') + '</span></div>'
          + '<button type="button" class="sexo-badge sexo-' + sx + '" data-sexo="' + sx + '" title="Clic para cambiar">' + sx + '</button></div>';
      }).join('');

      container.querySelectorAll('.student-item').forEach(function (item) {
        var check = item.querySelector('.student-check');
        var sexoBadge = item.querySelector('.sexo-badge');
        var avatar = item.querySelector('.student-avatar');

        check.addEventListener('change', function () {
          var idx = selectedStudentsState.findIndex(function (s) { return s.nombre === check.value; });
          if (check.checked) {
            if (idx === -1) {
              var found = searchResults.find(function (r) { return r.nombre === check.value; });
              selectedStudentsState.push(Object.assign({}, found, { isSelected: true, sexo: sexoBadge.dataset.sexo }));
            } else selectedStudentsState[idx].isSelected = true;
            item.classList.add('selected');
          } else {
            if (idx !== -1) selectedStudentsState[idx].isSelected = false;
            item.classList.remove('selected');
          }
          updateCountBadge();
        });

        sexoBadge.addEventListener('click', function (e) {
          e.stopPropagation();
          var newSexo = sexoBadge.dataset.sexo === 'H' ? 'F' : 'H';
          sexoBadge.dataset.sexo = newSexo;
          sexoBadge.textContent = newSexo;
          sexoBadge.className = 'sexo-badge sexo-' + newSexo;
          if (avatar) { avatar.style.background = newSexo === 'F' ? '#fce7f3' : '#dbeafe'; avatar.style.color = newSexo === 'F' ? '#be185d' : '#1d4ed8'; }
          var idx = selectedStudentsState.findIndex(function (s) { return s.nombre === check.value; });
          if (idx !== -1) selectedStudentsState[idx].sexo = newSexo;
        });
      });
    };

    var _lastGrupo = '';
    inputGrupo.addEventListener('input', function () {
      var val = inputGrupo.value.trim().toUpperCase();
      if (val.length < 2) { renderTotalList([]); return; }
      if (val === _lastGrupo) return;
      _lastGrupo = val;
      container.innerHTML = '<div class="students-empty"><div class="tut-loader-spinner" style="width:24px;height:24px;border-width:2px;margin:0 auto;"></div><p style="margin-top:0.5rem;">Buscando alumnos…</p></div>';
      if (typeof lucide !== 'undefined') lucide.createIcons();
      api.getAlumnos(val).then(function(alumnos) {
        if (inputGrupo.value.trim().toUpperCase() !== val) return; // input cambió
        renderTotalList(alumnos);
      }).catch(function(err) {
        container.innerHTML = '<div class="students-empty"><p style="color:#ef4444;">Error al cargar alumnos: ' + err.message + '</p></div>';
      });
    });

    var _searchTimer = null;
    inputSearchName.addEventListener('input', function () {
      var val = inputSearchName.value.trim().toLowerCase();
      if (val.length < 3) { renderTotalList([]); return; }
      clearTimeout(_searchTimer);
      _searchTimer = setTimeout(function() {
        container.innerHTML = '<div class="students-empty"><div class="tut-loader-spinner" style="width:24px;height:24px;border-width:2px;margin:0 auto;"></div><p style="margin-top:0.5rem;">Buscando…</p></div>';
        if (typeof lucide !== 'undefined') lucide.createIcons();
        api.getAlumnos('').then(function(todos) {
          if (inputSearchName.value.trim().toLowerCase() !== val) return;
          renderTotalList(todos.filter(function(a) { return a.nombre.toLowerCase().includes(val); }));
        }).catch(function(err) {
          container.innerHTML = '<div class="students-empty"><p style="color:#ef4444;">Error: ' + err.message + '</p></div>';
        });
      }, 350);
    });

    btnAddManual.addEventListener('click', function () {
      var name = manualNameInput.value.trim();
      if (name.length < 5) { alert('Por favor escribe el nombre completo del alumno.'); return; }
      var newStudent = { nombre: name, sexo: btnManualSex.dataset.sexo, grupo: inputGrupo.value.trim().toUpperCase() || '', isSelected: true };
      if (!selectedStudentsState.find(function (s) { return s.nombre === name; })) selectedStudentsState.unshift(newStudent);
      manualNameInput.value = '';
      renderTotalList();
      updateCountBadge();
    });

    btnSelectAll.addEventListener('click', function () {
      var checks = container.querySelectorAll('.student-check');
      var allChecked = Array.from(checks).every(function (c) { return c.checked; });
      checks.forEach(function (c) { c.checked = !allChecked; c.dispatchEvent(new Event('change')); });
      btnSelectAll.textContent = allChecked ? 'Seleccionar todos' : 'Deseleccionar todos';
    });
  }

  // ── Form submit ───────────────────────────────────────────
  var form = document.getElementById('form-tutoria');
  document.getElementById('report-parcial-filter').addEventListener('change', renderReporte);

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var finalSelection = selectedStudentsState.filter(function (s) { return s.isSelected; });
    if (!finalSelection.length) { alert('Por favor, selecciona o añade al menos un estudiante.'); return; }

    var formData = new FormData(form);
    var payload = {
      parcial:     formData.get('parcial'),
      grupo:       formData.get('grupo').toUpperCase(),
      alumnos:     finalSelection.map(function (s) { return { nombre: s.nombre, sexo: s.sexo }; }),
      asistencia:  document.getElementById('check-asistencia').checked ? 'SÍ' : 'NO',
      asignatura:  formData.get('asignatura'),
      regular:     formData.get('alumno_tipo') === 'regular',
      intra:       formData.get('alumno_tipo') === 'intra',
      tema:        formData.get('tema'),
      individual:  formData.get('tutoria_tipo') === 'individual',
      grupal:      formData.get('tutoria_tipo') === 'grupal',
      fecha:       formData.get('fecha_tutoria') || '',
      fecha_tutoria: formData.get('fecha_tutoria') || ''
    };

    var btn = form.querySelector('button[type="submit"]');
    try {
      btn.disabled = true; btn.textContent = 'Guardando...';
      var result = await api.guardarTutoria(payload);
      if (result.status === 'success') {
        alert('Tutoría registrada con éxito.');
        form.reset();
        var hoy = new Date();
        document.getElementById('input-fecha-tutoria').value = hoy.getFullYear() + '-'
          + String(hoy.getMonth() + 1).padStart(2, '0') + '-'
          + String(hoy.getDate()).padStart(2, '0');
        selectedStudentsState = [];
        document.getElementById('students-checkbox-list').innerHTML = '<div class="students-empty"><i data-lucide="user-search" style="width:36px;height:36px;color:#cbd5e1;"></i><p>Ingresa el número de grupo o busca por nombre</p></div>';
        if (typeof lucide !== 'undefined') lucide.createIcons();
        updateCountBadge();
        await loadInitialData();
      } else alert('Error: ' + result.message);
    } catch (err) { alert('Error al conectar.'); }
    finally {
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="save" style="width:16px;height:16px;"></i> Guardar Tutoría';
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  });

  // ── Carga de datos ────────────────────────────────────────
  async function loadInitialData() {
    var loader = document.getElementById('tut-global-loader');
    if (loader) loader.classList.remove('hidden');
    ['stat-total','stat-individual','stat-grupal','stat-hombres','stat-mujeres'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) { el.textContent = ''; el.classList.add('loading'); }
    });

    try {
      allData = await api.getDashboardData();
      var userEmail = sessionStorage.getItem('user_email');
      var isAdmin   = sessionStorage.getItem('user_role') === 'admin' || allData.isAdmin === true;

      if (userEmail && !isAdmin) {
        allData.tutorias = (allData.tutorias || []).filter(function (t) {
          return String(t.docenteEmail || '').toLowerCase().trim() === userEmail.toLowerCase().trim();
        });
      }

      var directorio = allData.directorio || [];
      allData.tutorias.forEach(function (t) {
        var docFound = directorio.find(function (d) { return normalizeName(d.correo) === normalizeName(t.docenteEmail); });
        t.docente = docFound ? docFound.docente : (t.docenteEmail || 'Desconocido');
      });

      allData.totalTutorias = allData.tutorias.length;
      allData.individual = allData.tutorias.filter(function (t) { return t.individual; }).length;
      allData.grupal     = allData.tutorias.filter(function (t) { return t.grupal; }).length;
      allData.hombres    = allData.tutorias.filter(function (t) { return t.sexo === 'H'; }).length;
      allData.mujeres    = allData.tutorias.filter(function (t) { return t.sexo === 'F'; }).length;

      if (isAdmin) {
        var adminControls = document.getElementById('admin-controls-historial');
        if (adminControls) adminControls.style.display = 'flex';
        document.querySelectorAll('.admin-only-col').forEach(function (el) { el.style.display = 'table-cell'; });
        var teachers = [...new Set(allData.tutorias.map(function (t) { return t.docente; }))].filter(Boolean).sort();

        var teacherSelect = document.getElementById('admin-teacher-select');
        if (teacherSelect && teacherSelect.options.length <= 1) {
          teachers.forEach(function (t) {
            var opt = document.createElement('option'); opt.value = t; opt.textContent = t;
            teacherSelect.appendChild(opt);
          });
          teacherSelect.addEventListener('change', renderHistorial);
        }
        var repTeacherSelect = document.getElementById('report-teacher-select');
        if (repTeacherSelect && repTeacherSelect.options.length === 0) {
          document.getElementById('admin-report-filter').style.display = 'flex';
          repTeacherSelect.innerHTML = '<option value="all">-- Reporte Global Institucional --</option>';
          teachers.forEach(function (t) {
            var opt = document.createElement('option'); opt.value = t; opt.textContent = t;
            repTeacherSelect.appendChild(opt);
          });
          repTeacherSelect.addEventListener('change', renderReporte);
        }
      }

      var userEmailForName = sessionStorage.getItem('user_email');
      var displayName = sessionStorage.getItem('user_name') || (allData.config && allData.config.docente);
      if (userEmailForName && allData.directorio && allData.directorio.length) {
        var dirEntry = allData.directorio.find(function (d) {
          return normalizeName(String(d.correo || '')) === normalizeName(userEmailForName);
        });
        if (dirEntry && dirEntry.docente) { displayName = dirEntry.docente; sessionStorage.setItem('user_name', dirEntry.docente); }
      }
      if (displayName) document.getElementById('report-teacher-name').textContent = displayName.toUpperCase();

      populateSubjects();
      renderAll();
      setupGroupSelection();
    } catch (err) {
      console.error('[tutorias]', err);
      if (loader) loader.innerHTML = '<div style="font-size:1.5rem">⚠️</div><div class="tut-loader-text" style="color:#ef4444">Error al conectar con el servidor</div>';
      return;
    } finally {
      if (loader) loader.classList.add('hidden');
      ['stat-total','stat-individual','stat-grupal','stat-hombres','stat-mujeres'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.classList.remove('loading');
      });
    }
  }

  await loadInitialData();
  if (typeof lucide !== 'undefined') lucide.createIcons();
};
