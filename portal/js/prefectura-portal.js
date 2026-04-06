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

    let itemsHTML;

    if (!incidencias || incidencias.length === 0) {
      itemsHTML = `
        <div style="display:flex;align-items:center;gap:0.5rem;color:#94a3b8;font-size:0.88rem;padding:0.4rem 0;">
          <i data-lucide="check-circle-2" style="width:16px;height:16px;color:#86efac;flex-shrink:0;"></i>
          Sin reportes
        </div>`;
    } else {
      itemsHTML = incidencias.map(r => {
        const fecha = r.fecha_registro || "—";
        const tipo  = r.tipo_incidencia || "—";
        const desc  = r.descripcion     || "";
        const obs   = r.observaciones   || "";
        const texto = desc || obs;       // mostrar descripción si existe, si no observaciones

        const laborBadge = r.requiere_labor_social
          ? `<span style="font-size:0.68rem;background:#fef3c7;color:#b45309;padding:1px 8px;border-radius:20px;font-weight:700;white-space:nowrap;">
               ${r.labor_social_realizada ? "Labor social: cumplida" : "Labor social pendiente"}
             </span>`
          : "";

        return `
          <div style="padding:0.65rem 0;border-bottom:1px solid #f1f5f9;">
            <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-bottom:${texto ? "0.2rem" : "0"};">
              <span style="font-size:0.75rem;color:#94a3b8;font-weight:600;">${fecha}</span>
              <span style="font-size:0.82rem;color:#1e293b;font-weight:700;">· ${tipo}</span>
              ${laborBadge}
            </div>
            ${texto ? `<div style="font-size:0.78rem;color:#64748b;line-height:1.45;padding-left:0.1rem;">${texto}</div>` : ""}
          </div>`;
      }).join("");
    }

    container.innerHTML = `
      <div style="background:white;border-radius:20px;padding:1.2rem 1.5rem;margin-bottom:1.75rem;box-shadow:0 2px 8px rgba(0,0,0,.06);border:1px solid #f1f5f9;">
        ${itemsHTML}
      </div>`;

    if (typeof lucide !== "undefined") lucide.createIcons();
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
