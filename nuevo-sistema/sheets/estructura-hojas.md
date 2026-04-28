# Estructura de Hojas — Nueva Arquitectura CEB 5/4

## 1. Spreadsheet: MASTER_CEB54

Hoja de control global. Solo se edita manualmente.
**No contiene datos académicos — solo configuración.**

### Hoja: CONFIG

| Clave               | Valor ejemplo          | Descripción                              |
|---------------------|------------------------|------------------------------------------|
| CICLO_ACTIVO        | 2025_2026              | Identificador del ciclo en producción    |
| MODO                | PRODUCCION             | PRODUCCION o PRUEBAS                     |
| URL_CICLO_ACTIVO    | https://docs.google... | URL del Spreadsheet del ciclo activo     |
| URL_SANDBOX         | https://docs.google... | URL del Spreadsheet de pruebas           |
| VERSION_SISTEMA     | 1.0                    | Número de versión                        |
| MANTENIMIENTO       | false                  | true bloquea todas las peticiones API    |

### Hoja: CICLOS

| Ciclo     | URL Spreadsheet        | Estado      | Fecha cierre |
|-----------|------------------------|-------------|--------------|
| 2024_2025 | https://docs.google... | historico   | 2025-07-15   |
| 2025_2026 | https://docs.google... | activo      |              |
| 2026_2027 | https://docs.google... | preparacion |              |

---

## 2. Spreadsheet: CEB54_CICLO_2025_2026

Un archivo por ciclo escolar. Todos los ciclos tienen EXACTAMENTE
las mismas hojas con los mismos nombres de columna.

### Hoja: ESTRUCTURA

| semestre | grupo | materia           | docente          | horas_semana | turno     |
|----------|-------|-------------------|------------------|--------------|-----------|
| 1        | 1A    | Cultura Digital I | Dr. Felipe López | 2            | matutino  |
| 1        | 1A    | Matemáticas       | Lic. García      | 5            | matutino  |
| 2        | 2A    | Cultura Digital II| Dr. Felipe López | 2            | matutino  |

### Hoja: DOCENTES

| nombre          | materias                    | semestres | turno    | updated_at |
|-----------------|-----------------------------|-----------|----------|------------|
| Dr. Felipe López| Cultura Digital II, CD III  | 2, 3      | matutino | 2025-08-15 |

*Generado automáticamente desde ESTRUCTURA al importar.*

### Hoja: ALUMNOS

| matricula | nombre              | semestre | grupo | turno    | email            | status | equipo |
|-----------|---------------------|----------|-------|----------|------------------|--------|--------|
| 5401001   | García Martínez Ana | 2        | 2A    | matutino | ana@dgb.edu.mx   | activo | 2m     |

### Hoja: MATERIAS

| clave  | nombre             | semestre | horas | docente          |
|--------|--------------------|----------|-------|------------------|
| CD2    | Cultura Digital II | 2        | 2     | Dr. Felipe López |
| CD3    | Cultura Digital III| 3        | 1     | Dr. Felipe López |

### Hoja: CALIFICACIONES

| matricula | nombre | grupo | materia | parcial | calificacion | tipo         | docente | updated_at |
|-----------|--------|-------|---------|---------|--------------|--------------|---------|------------|
| 5401001   | Ana G. | 2A    | CD2     | 1       | 8.5          | ordinario    | Dr.F.L. | 2025-10-15 |

### Hoja: PEC_EQUIPOS

| clave | semestre | turno      | nombre_proyecto        | objetivo                  | url_minuta | url_presentacion | updated_at |
|-------|----------|------------|------------------------|---------------------------|------------|------------------|------------|
| 2m    | 2        | matutino   | App de Control Escolar | Digitalizar procesos CEB  | https://.. | https://..       | 2025-09-01 |
| 2v    | 2        | vespertino | Sistema de Biblioteca  | Automatizar préstamos     | https://.. |                  | 2025-09-01 |
| 4m    | 4        | matutino   | Portal de Tutorías     | Seguimiento académico     | https://.. |                  | 2025-09-01 |
| 4v    | 4        | vespertino | Red Escolar Digital    | Conectividad académica    | https://.. |                  | 2025-09-01 |
| 6     | 6        | uni        | Sistema de Egresados   | Seguimiento post-escolar  | https://.. |                  | 2025-09-01 |

### Hoja: PEC_MINUTAS

| equipo | grupo | docente | parcial | fecha | acuerdos | compromisos | responsable | proxima_sesion | updated_at |
|--------|-------|---------|---------|-------|----------|-------------|-------------|----------------|------------|

### Hoja: PEC_CALIF

| alumno | matricula | equipo | grupo | parcial | p_proceso | p_producto | p_impacto | total | docente | updated_at |
|--------|-----------|--------|-------|---------|-----------|------------|-----------|-------|---------|------------|

### Hoja: PEC_CIERRE

| semestre | turno | nombre_proyecto | fecha_presentacion | calificacion_final | observaciones |
|----------|-------|-----------------|--------------------|--------------------|---------------|

### Hoja: TUTORIAS

| matricula | nombre | grupo | docente | parcial | fecha | tipo | observaciones | created_at |
|-----------|--------|-------|---------|---------|-------|------|---------------|------------|

### Hoja: EVALUACIONES

| matricula | nombre | grupo | materia | parcial | tipo          | calificacion | docente | updated_at |
|-----------|--------|-------|---------|---------|---------------|--------------|---------|------------|
| 5401001   | Ana G. | 2A    | CD2     | 1       | intrasemestral| 8.5          | Dr.F.L. | 2025-10-15 |
| 5401001   | Ana G. | 2A    | CD2     | 1       | ordinario     | 9.0          | Dr.F.L. | 2025-11-01 |

### Hoja: SEMANAS_CD

| materia | activas_json      | updated_at | updated_by    |
|---------|-------------------|------------|---------------|
| cd2     | [1,2,3,4,5,6,7]   | 2025-10-15 | felifade@...  |
| cd3     | [1,2,3,4,5,6,7]   | 2025-10-15 | felifade@...  |

*Solo si el módulo 01-semanas-cd.gs usa Spreadsheet en lugar de PropertiesService.*

### Hoja: LOG

| timestamp           | usuario       | modulo    | accion              | datos_anteriores | datos_nuevos |
|---------------------|---------------|-----------|---------------------|------------------|--------------|
| 2025-10-15 10:30:00 | felifade@...  | pec       | guardarMinuta       | {}               | {...}        |

---

## 3. Spreadsheet: CEB54_SANDBOX

Copia exacta de CEB54_CICLO_2025_2026 con datos de prueba.
Mismas hojas, mismas columnas.
Se usa cuando MASTER_CEB54 → CONFIG → MODO = PRUEBAS.

**Nunca contiene datos reales de alumnos.**

---

## Reglas de nomenclatura

- Nombres de hojas: MAYÚSCULAS_CON_GUION_BAJO
- Nombres de columnas: minúsculas_con_guion_bajo
- Claves de materias: cd2, cd3 (minúsculas, sin espacios)
- Claves de semestres: número entero (1, 2, 3, 4, 5, 6)
- Claves de turnos: matutino, vespertino (minúsculas)
- Claves PEC: {semestre}{turno_inicial} → 2m, 2v, 4m, 4v, 6
