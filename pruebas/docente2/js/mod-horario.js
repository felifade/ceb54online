/* ═══════════════════════════════════════════════════════════
   Docente 2.0 — mod-horario.js
   Módulo: Horario Definitivo
   Carga horario-doc.js dinámicamente (sin duplicar código)
   y llama hdRender() que renderiza en #hd-container
   ═══════════════════════════════════════════════════════════ */

var _hdScriptLoaded = false;

function d2RenderHorario() {
  var mod = document.getElementById('d2-mod-horario');
  if (!mod) return;

  /* Asegurar que #hd-container exista dentro del módulo */
  if (!document.getElementById('hd-container')) {
    var inner = document.createElement('div');
    inner.className = 'd2-horario-inner';
    var cont = document.createElement('div');
    cont.id = 'hd-container';
    inner.appendChild(cont);
    mod.appendChild(inner);
  }

  if (typeof hdRender === 'function') {
    /* Script ya cargado — solo re-renderizar */
    hdRender();
    return;
  }

  if (_hdScriptLoaded) return; /* ya se está cargando */
  _hdScriptLoaded = true;

  var script = document.createElement('script');
  script.src = '../tutorias/js/horario-doc.js?v=20260420';
  script.onload = function() {
    if (typeof hdRender === 'function') hdRender();
  };
  script.onerror = function() {
    var cont = document.getElementById('hd-container');
    if (cont) {
      cont.innerHTML =
        '<div class="hd-empty">' +
          '<div class="hd-empty-icon">⚠️</div>' +
          '<p>No se pudo cargar el módulo de horario.</p>' +
          '<p class="hd-empty-sub">Verifica tu conexión e intenta de nuevo.</p>' +
        '</div>';
    }
  };
  document.head.appendChild(script);
}
