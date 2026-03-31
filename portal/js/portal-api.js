/**
 * PORTAL ESTUDIANTIL CEB 5/4 — Cliente API
 * Reemplaza PORTAL_API_URL con la URL de tu deployment de GAS
 */

const PORTAL_API_URL = "https://script.google.com/macros/s/AKfycbwqT7gO_vF_V20F0kFvQdIwQslBuLqc5_wVtiNU_lfsDN5l3kMp3AV1uN9423eG0TyLNw/exec";

const portalAPI = {
  async _get(params) {
    const url = PORTAL_API_URL + "?" + new URLSearchParams({ ...params, _t: Date.now() });
    const res = await fetch(url, { method: "GET", redirect: "follow" });
    return res.json();
  },
  async _post(body) {
    const res = await fetch(PORTAL_API_URL, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      redirect: "follow"
    });
    return res.json();
  },

  loginAlumno: (curp) => portalAPI._get({ action: "loginAlumno", curp }),
  loginPadre: (folio) => portalAPI._get({ action: "loginPadre", folio }),
  getCalAlumno: (curp) => portalAPI._get({ action: "getCalAlumno", curp }),
  getCalPadre: (folio) => portalAPI._get({ action: "getCalPadre", folio }),
  getConfig: () => portalAPI._get({ action: "getConfig" }),
  getEncuestaStatus: (id, tipo) => portalAPI._get({ action: "getEncuestaStatus", id, tipo }),

  saveEncAlumno: (curp, grupo, respuestas) =>
    portalAPI._post({ action: "encuestaAlumno", curp, grupo, respuestas }),
  saveEncPadre: (folio, respuestas) =>
    portalAPI._post({ action: "encuestaPadre", folio, respuestas }),
  adminToggle: (key, value) =>
    portalAPI._get({ action: "adminPortal", adminKey: "CEB54_ADMIN_PORTAL", [key]: value ? "si" : "no" }),
};

// ── Utilidades de sesión ────────────────────────────────────────────
const portalSession = {
  save(data) { sessionStorage.setItem("portal_user", JSON.stringify(data)); },
  load() { try { return JSON.parse(sessionStorage.getItem("portal_user")); } catch { return null; } },
  clear() { sessionStorage.removeItem("portal_user"); },
  requireAlumno() {
    const u = this.load();
    if (!u || u.tipo !== "alumno") { window.location.href = "index.html"; return null; }
    return u;
  },
  requirePadre() {
    const u = this.load();
    if (!u || u.tipo !== "padre") { window.location.href = "index.html"; return null; }
    return u;
  }
};
