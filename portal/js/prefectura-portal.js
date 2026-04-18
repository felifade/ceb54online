/**
 * PREFECTURA — Módulo de consulta y render para Portal Alumno y Portal Padre
 *
 * Módulo completamente independiente:
 * - No modifica calificaciones, calendario ni cuestionarios
 * - Usa el mismo PORTAL_API_URL ya cargado por portal-api.js
 * - Filtra incidencias por nombre del alumno autenticado
 *
 * Campos que devuelve el GAS (hoja Prefectura_Incidencias):
 *   fecha_registro, tipo_incidencia, descripcion, observaciones,
 *   requiere_labor_social, labor_social_realizada
 */

const prefecturaPortal = {

  // ── CONSULTA ─────────────────────────────────────────────────────────
  async getReportes(nombreAlumno) {
    const url = PORTAL_API_URL + "?" + new URLSearchParams({
      action: "getIncidencias",
      alumno: nombreAlumno,
      _t:     Date.now()
    });
    const res  = await fetch(url, { redirect: "follow" });
    const data = await res.json();
    if (data.status === "error") throw new Error(data.message);
    return data.incidencias || [];
  },

  // ── RENDER ────────────────────────────────────────────────────────────
  render(containerId, incidencias, accentColor) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Colores por tipo de incidencia
    const TIPO_STYLE = {
      falta:     { bg: '#fee2e2', color: '#dc2626', icon: 'x-circle'      },
      tardanza:  { bg: '#fef3c7', color: '#d97706', icon: 'clock'         },
      retraso:   { bg: '#fef3c7', color: '#d97706', icon: 'clock'         },
      reporte:   { bg: '#dbeafe', color: '#1d4ed8', icon: 'file-text'     },
      uniforme:  { bg: '#ede9fe', color: '#7c3aed', icon: 'shirt'         },
    };
    const getStyle = (tipo = '') => {
      const t = tipo.toLowerCase();
      for (const [k, v] of Object.entries(TIPO_STYLE)) if (t.includes(k)) return v;
      return { bg: '#f1f5f9', color: '#475569', icon: 'alert-circle' };
    };

    let bodyHTML;

    if (!incidencias || incidencias.length === 0) {
      bodyHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; gap:0.5rem; padding:1rem 0; text-align:center;">
          <div style="width:44px; height:44px; border-radius:50%; background:#d1fae5; display:flex; align-items:center; justify-content:center; margin-bottom:0.25rem;">
            <i data-lucide="shield-check" style="width:22px; height:22px; color:#059669;"></i>
          </div>
          <div style="font-weight:800; color:#1e293b; font-size:0.92rem;">Sin reportes registrados</div>
          <div style="font-size:0.78rem; color:#94a3b8; font-weight:500;">Todo en orden 👋</div>
        </div>`;
    } else {
      const rows = incidencias.map(r => {
        const fecha = r.fecha_registro || '—';
        const tipo  = r.tipo_incidencia || 'Reporte';
        const texto = r.descripcion || r.observaciones || '';
        const st    = getStyle(tipo);

        const laborHTML = r.requiere_labor_social
          ? `<span style="font-size:0.65rem; background:${r.labor_social_realizada ? '#d1fae5' : '#fef3c7'}; color:${r.labor_social_realizada ? '#065f46' : '#b45309'}; padding:2px 8px; border-radius:20px; font-weight:700; white-space:nowrap; margin-left:auto; flex-shrink:0;">
               ${r.labor_social_realizada ? '✔ Labor cumplida' : '⏳ Labor pendiente'}
             </span>`
          : '';

        return `
          <div style="display:flex; align-items:flex-start; gap:0.75rem; padding:0.75rem 0; border-bottom:1px solid #f1f5f9;">
            <div style="width:32px; height:32px; border-radius:9px; background:${st.bg}; display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:1px;">
              <i data-lucide="${st.icon}" style="width:15px; height:15px; color:${st.color};"></i>
            </div>
            <div style="flex:1; min-width:0;">
              <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                <span style="font-size:0.82rem; font-weight:800; color:#1e293b;">${tipo}</span>
                ${laborHTML}
              </div>
              ${texto ? `<div style="font-size:0.75rem; color:#64748b; margin-top:0.2rem; line-height:1.45;">${texto}</div>` : ''}
              <div style="font-size:0.68rem; color:#94a3b8; font-weight:600; margin-top:0.2rem;">${fecha}</div>
            </div>
          </div>`;
      }).join('');

      const conteo = incidencias.length;
      bodyHTML = `
        <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.75rem; padding-bottom:0.65rem; border-bottom:1.5px solid #f1f5f9;">
          <span style="font-size:0.75rem; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.05em;">Historial de incidencias</span>
          <span style="margin-left:auto; background:#fee2e2; color:#dc2626; font-size:0.65rem; font-weight:800; padding:2px 8px; border-radius:20px;">${conteo} registro${conteo !== 1 ? 's' : ''}</span>
        </div>
        ${rows}`;
    }

    container.innerHTML = `
      <div class="app-card">
        <div class="card-header">
          <div class="card-icon" style="background:#fee2e2; color:#dc2626;">
            <i data-lucide="shield-alert"></i>
          </div>
          <span class="card-title">Prefectura</span>
        </div>
        ${bodyHTML}
      </div>`;

    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  // ── PUNTO DE ENTRADA ─────────────────────────────────────────────────
  async init(containerId, nombreAlumno, accentColor) {
    try {
      const incidencias = await this.getReportes(nombreAlumno);
      this.render(containerId, incidencias, accentColor);
    } catch (e) {
      console.warn("Prefectura Portal: no se pudieron cargar reportes.", e);
      // Fallo silencioso — no interrumpe el resto del portal
      this.render(containerId, [], accentColor);
    }
  }
};
