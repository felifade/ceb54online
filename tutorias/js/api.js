// tutorias/js/api.js — adaptado al nuevo GAS de Tutorías

const GOOGLE_SHEETS_API_URL = "https://script.google.com/macros/s/AKfycbxZnJv1IVpcGAw0fhxKHpB7R7TpV80KgQ2-mbnC-WrRlgG6A8LCA6zSRjpMTeg9Z7BU/exec";

const api = {
  _tutCache:     null,
  _alumnosCache: {},

  // ── Lectura principal de tutorías ─────────────────────────────
  async fetchAllData() {
    try {
      if (this._tutCache) return this._tutCache;
      const userEmail = sessionStorage.getItem('user_email') || '';
      const url = `${GOOGLE_SHEETS_API_URL}?action=getTutorias&userEmail=${encodeURIComponent(userEmail)}&_t=${Date.now()}`;
      const response = await fetch(url, { method: 'GET', redirect: 'follow' });
      if (!response.ok) throw new Error('Respuesta de red no válida');
      const data = await response.json();
      if (data.status === 'error') throw new Error(data.message);
      this._tutCache = data;
      return data;
    } catch (error) {
      console.error('[TUT] fetchAllData error:', error);
      throw error;
    }
  },

  // ── Dashboard ─────────────────────────────────────────────────
  async getDashboardData() {
    const db = await this.fetchAllData();
    const tutorias = (db.tutorias || []).map(function(t) {
      // Normalizar campos booleanos que pueden venir como string 'TRUE'/'FALSE'
      return Object.assign({}, t, {
        individual: t.individual === true || t.individual === 'TRUE' || t.individual === 'true',
        grupal:     t.grupal     === true || t.grupal     === 'TRUE' || t.grupal     === 'true',
        regular:    t.regular    === true || t.regular    === 'TRUE' || t.regular    === 'true',
        intra:      t.intra      === true || t.intra      === 'TRUE' || t.intra      === 'true',
        sexo:       String(t.sexo || 'H').toUpperCase().startsWith('F') ? 'F' : 'H',
        docenteEmail: t.docente_email || t.docenteEmail || t.docente || ''
      });
    });

    return {
      totalTutorias: tutorias.length,
      individual:    tutorias.filter(function(t) { return t.individual; }).length,
      grupal:        tutorias.filter(function(t) { return t.grupal; }).length,
      hombres:       tutorias.filter(function(t) { return t.sexo === 'H'; }).length,
      mujeres:       tutorias.filter(function(t) { return t.sexo === 'F'; }).length,
      tutorias:      tutorias,
      grupos:        [],
      feedbackHistory: [],
      isAdmin:       db.isAdmin || false,
      groupsDelDocente: [],
      config:        db.config  || {},
      alumnosFull:   [],          // se carga on-demand con getAlumnos()
      directorio:    db.directorio    || [],
      programacion:  db.programacion  || [],
      materias:      db.materias      || []
    };
  },

  // ── Alumnos por grupo (on-demand) ────────────────────────────
  async getAlumnos(grupo) {
    var key = (grupo || '').toString().trim().toUpperCase();
    if (this._alumnosCache[key]) return this._alumnosCache[key];

    var params = key ? '&grupo=' + encodeURIComponent(key) : '';
    var url = GOOGLE_SHEETS_API_URL + '?action=getAlumnos' + params + '&_t=' + Date.now();
    var response = await fetch(url, { method: 'GET', redirect: 'follow' });
    var data = await response.json();
    if (data.status === 'error') throw new Error(data.message);

    // Normalizar nombres de campo (el sheet puede tener variantes)
    var alumnos = (data.alumnos || []).map(function(a) {
      var nombre = a.nombre || a.nombre_completo || a.nombre_alumno || a.NOMBRE || '';
      var sexo   = String(a.sexo || a.genero || a['género'] || 'H').toUpperCase();
      sexo = sexo.startsWith('F') || sexo.startsWith('M') ? 'F' : 'H';
      return {
        nombre:    nombre,
        grupo:     a.grupo || key,
        sexo:      sexo,
        matricula: a.matricula || a.MATRICULA || ''
      };
    }).filter(function(a) { return a.nombre.trim().length > 0; });

    if (key) this._alumnosCache[key] = alumnos;
    return alumnos;
  },

  // ── Guardar tutoría — usa marcarAsistencia (multi-alumno) ─────
  async guardarTutoria(datos) {
    var alumnos = datos.alumnos || [];
    var base = {
      parcial:    datos.parcial,
      grupo:      datos.grupo,
      asignatura: datos.asignatura,
      asistencia: datos.asistencia,
      tema:       datos.tema,
      individual: datos.individual,
      grupal:     datos.grupal,
      regular:    datos.regular,
      intra:      datos.intra,
      fecha:      datos.fecha || datos.fecha_tutoria,
      fecha_tutoria: datos.fecha_tutoria || datos.fecha,
      docente:    sessionStorage.getItem('user_name')  || '',
      docente_email: sessionStorage.getItem('user_email') || ''
    };

    var payload = {
      action: 'marcarAsistencia',
      tutorias: alumnos.map(function(a) {
        return Object.assign({}, base, {
          nombre:    a.nombre,
          sexo:      a.sexo,
          matricula: a.matricula || ''
        });
      })
    };

    var response = await fetch(GOOGLE_SHEETS_API_URL, {
      method: 'POST',
      mode: 'cors',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      redirect: 'follow'
    });
    var result = await response.json();
    this._tutCache = null;
    return result;
  },

  // ── Eliminar / actualizar campo — no implementados en nuevo GAS
  async eliminarTutoria() {
    return { status: 'error', message: 'Eliminar no disponible en este módulo.' };
  },
  async actualizarCampo() {
    return { status: 'error', message: 'Edición en línea no disponible en este módulo.' };
  }
};

window.api = api;
