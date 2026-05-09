// Sincronización con Google Drive (carpeta appDataFolder)
// =========================================================
// Usa Google Identity Services (GIS) para auth + Drive REST API para
// guardar un único archivo JSON oculto al usuario en su Drive.
//
// El usuario solo paga: nada. La carpeta appDataFolder es invisible
// (no aparece en su Drive normal), solo accesible por esta app.
//
// Setup:
//   1) Pegar el Client ID en CLIENT_ID_LS_KEY (lo configuramos por UI o env)
//   2) En Google Cloud Console: OAuth Client → Authorized origins:
//      https://ceb54.online y http://localhost:8095
//   3) Activar Google Drive API en el proyecto
//   4) Scope necesario: https://www.googleapis.com/auth/drive.appdata

const FILE_NAME = "consultor-director-data.json";
const SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const CLIENT_ID_LS_KEY = "dir-google-client-id";
const TOKEN_LS_KEY     = "dir-google-token";

// Client ID del proyecto "Consultor Director" (Google Cloud Console).
// NO es secreto — está protegido por dominios autorizados (ceb54.online +
// localhost:8095). El usuario puede sobreescribirlo desde el modal de
// configuración si quiere usar un proyecto propio.
const DEFAULT_CLIENT_ID = "1007502920131-h8e75nfn39p1b9vc7geambt6f6comrgs.apps.googleusercontent.com";

class DriveSync {
  constructor() {
    this.clientId = localStorage.getItem(CLIENT_ID_LS_KEY) || DEFAULT_CLIENT_ID;
    this.tokenClient = null;
    this.accessToken = null;
    this.tokenExpiresAt = 0;
    this.fileId = null; // ID del archivo en Drive (cache)
    this.gisLoaded = false;
    this._loadStored();
  }

  setClientId(id) {
    this.clientId = id;
    localStorage.setItem(CLIENT_ID_LS_KEY, id);
  }

  _loadStored() {
    try {
      const raw = localStorage.getItem(TOKEN_LS_KEY);
      if (raw) {
        const t = JSON.parse(raw);
        if (t.expiresAt > Date.now()) {
          this.accessToken = t.token;
          this.tokenExpiresAt = t.expiresAt;
          this.fileId = t.fileId || null;
        }
      }
    } catch {}
  }

  _saveStored() {
    localStorage.setItem(TOKEN_LS_KEY, JSON.stringify({
      token: this.accessToken,
      expiresAt: this.tokenExpiresAt,
      fileId: this.fileId,
    }));
  }

  isConfigured() { return !!this.clientId; }
  isSignedIn()    { return !!this.accessToken && this.tokenExpiresAt > Date.now() + 60000; }

  // === Cargar la librería de Google Identity Services ===
  async _loadGis() {
    if (this.gisLoaded) return;
    if (window.google?.accounts?.oauth2) { this.gisLoaded = true; return; }
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true; s.defer = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error("No se pudo cargar Google Identity Services"));
      document.head.appendChild(s);
    });
    this.gisLoaded = true;
  }

  // === Pedir consentimiento al usuario (popup) ===
  async signIn() {
    if (!this.clientId) throw new Error("Falta configurar el Client ID de Google.");
    await this._loadGis();
    return new Promise((resolve, reject) => {
      try {
        this.tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: this.clientId,
          scope: SCOPE,
          callback: (resp) => {
            if (resp.error) return reject(new Error(resp.error_description || resp.error));
            this.accessToken = resp.access_token;
            // GIS no entrega expiry exacto — asumimos 1 hora (estándar)
            this.tokenExpiresAt = Date.now() + (resp.expires_in || 3600) * 1000;
            this._saveStored();
            resolve(this.accessToken);
          },
        });
        this.tokenClient.requestAccessToken({ prompt: this.accessToken ? "" : "consent" });
      } catch (e) { reject(e); }
    });
  }

  // === Refrescar token silenciosamente si es posible ===
  async ensureSignedIn() {
    if (this.isSignedIn()) return;
    if (!this.tokenClient) await this.signIn();
    else {
      // Pedir token sin prompt (suele funcionar si el usuario ya autorizó antes)
      await new Promise((resolve, reject) => {
        this.tokenClient.callback = (resp) => {
          if (resp.error) return reject(new Error(resp.error_description || resp.error));
          this.accessToken = resp.access_token;
          this.tokenExpiresAt = Date.now() + (resp.expires_in || 3600) * 1000;
          this._saveStored();
          resolve();
        };
        this.tokenClient.requestAccessToken({ prompt: "" });
      });
    }
  }

  signOut() {
    if (this.accessToken && window.google?.accounts?.oauth2) {
      try { google.accounts.oauth2.revoke(this.accessToken, ()=>{}); } catch {}
    }
    this.accessToken = null;
    this.tokenExpiresAt = 0;
    this.fileId = null;
    localStorage.removeItem(TOKEN_LS_KEY);
  }

  // === Buscar el archivo en Drive (en appDataFolder) ===
  async _findFileId() {
    if (this.fileId) return this.fileId;
    const url = "https://www.googleapis.com/drive/v3/files?" + new URLSearchParams({
      spaces: "appDataFolder",
      q: `name='${FILE_NAME}'`,
      fields: "files(id,name,modifiedTime)",
      pageSize: "1",
    });
    const res = await this._fetch(url);
    const data = await res.json();
    this.fileId = data.files?.[0]?.id || null;
    if (this.fileId) this._saveStored();
    return this.fileId;
  }

  // === Cargar contenido (devuelve null si no existe el archivo) ===
  async loadData() {
    await this.ensureSignedIn();
    const id = await this._findFileId();
    if (!id) return null;
    const res = await this._fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`);
    if (!res.ok) {
      if (res.status === 404) { this.fileId = null; return null; }
      throw new Error(`Drive load: ${res.status}`);
    }
    return await res.json();
  }

  // === Guardar (crea archivo si no existe, o actualiza) ===
  async saveData(data) {
    await this.ensureSignedIn();
    const json = JSON.stringify(data);
    const id = await this._findFileId();

    if (!id) {
      // Crear: multipart upload (metadata + contenido)
      const boundary = "-------dir-boundary-" + Math.random().toString(36).slice(2);
      const metadata = {
        name: FILE_NAME,
        parents: ["appDataFolder"],
        mimeType: "application/json",
      };
      const body =
        `--${boundary}\r\n` +
        "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
        JSON.stringify(metadata) + "\r\n" +
        `--${boundary}\r\n` +
        "Content-Type: application/json\r\n\r\n" +
        json + "\r\n" +
        `--${boundary}--`;

      const res = await this._fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
        {
          method: "POST",
          headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
          body,
        }
      );
      if (!res.ok) throw new Error(`Drive create: ${res.status}`);
      const meta = await res.json();
      this.fileId = meta.id;
      this._saveStored();
    } else {
      // Actualizar contenido
      const res = await this._fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: json,
        }
      );
      if (!res.ok) throw new Error(`Drive update: ${res.status}`);
    }
  }

  // === fetch con auth header ===
  async _fetch(url, opts = {}) {
    return fetch(url, {
      ...opts,
      headers: {
        ...(opts.headers || {}),
        Authorization: `Bearer ${this.accessToken}`,
      },
    });
  }
}

const driveSync = new DriveSync();
export { driveSync, DriveSync };
