# Nueva Arquitectura CEB 5/4 — Guía de Implementación

## Qué hay en esta carpeta

Archivos listos para copiar-pegar. El sistema actual no se toca.
Todo vive en paralelo hasta que decidas hacer el switch.

```
nuevo-sistema/
├── gas/
│   ├── 00-config.gs        ← Librería de configuración (va en cada módulo)
│   ├── 01-semanas-cd.gs    ← ⚡ URGENTE: Semanas CD independiente de PEC
│   ├── 02-academico.gs     ← Estructura, alumnos, docentes, calificaciones
│   ├── 03-pec.gs           ← PEC: equipos, minutas, calificaciones PEC
│   ├── 04-tutorias.gs      ← Sesiones de tutoría, riesgo académico
│   └── 05-evaluacion.gs    ← Evaluaciones, intrasemestrales, sábanas
└── sheets/
    └── estructura-hojas.md ← Qué hojas crear en cada Spreadsheet
```

---

## FASE 1 — Hacer YA (sin crear nada de Sheets todavía)

### Desplegar 01-semanas-cd.gs

Este es el único módulo que NO necesita MASTER ni hojas nuevas.
Resuelve el error "equipo capturado" en los portales CD II y CD III.

**Pasos:**

1. Ir a [script.google.com](https://script.google.com)
2. Crear nuevo proyecto → nombrar: `CEB54_API_SemanasCD`
3. Borrar el código que aparece por defecto
4. Copiar y pegar el contenido completo de `gas/01-semanas-cd.gs`
5. Desplegar:
   - Implementar > Nueva implementación
   - Tipo: Aplicación web
   - Ejecutar como: **Yo (felifade@icloud.com)**
   - Acceso: **Cualquiera**
   - Clic en "Implementar"
6. Copiar la URL que aparece (termina en `/exec`)
7. En el repositorio, cambiar `_CD_GAS` en dos archivos:
   - `cultura-digital/index.html` → línea con `_CD_GAS`
   - `cultura-digital-iii/index.html` → línea con `_CD_GAS`
8. Commit y push

**Resultado:** Los portales CD guardan semanas en el nuevo GAS independiente.
El PEC sigue igual, sin ningún cambio.

---

## FASE 2 — Crear los Spreadsheets

### 2a. Crear MASTER_CEB54

1. Google Drive > Nuevo > Google Sheets
2. Nombrar: `MASTER_CEB54`
3. Crear dos hojas: `CONFIG` y `CICLOS`
4. Llenar según `sheets/estructura-hojas.md` → sección "MASTER_CEB54"
5. Copiar el ID del Spreadsheet (está en la URL entre /d/ y /edit)

### 2b. Crear CEB54_CICLO_2025_2026

1. Google Drive > Nuevo > Google Sheets
2. Nombrar: `CEB54_CICLO_2025_2026`
3. Crear todas las hojas según `sheets/estructura-hojas.md`
4. Por ahora pueden estar vacías (solo la fila de cabecera)
5. Copiar la URL completa del Spreadsheet

### 2c. Crear CEB54_SANDBOX

1. Abrir `CEB54_CICLO_2025_2026`
2. Archivo > Hacer una copia
3. Nombrar: `CEB54_SANDBOX`
4. Agregar datos de prueba (alumnos ficticios)

### 2d. Llenar MASTER con las URLs

En `MASTER_CEB54` → hoja `CONFIG`:
- `URL_CICLO_ACTIVO` = URL del Spreadsheet 2025_2026
- `URL_SANDBOX` = URL del Spreadsheet SANDBOX
- `MODO` = `PRODUCCION`

---

## FASE 3 — Desplegar módulos académico, PEC, tutorías y evaluación

Para cada módulo (`02-academico.gs`, `03-pec.gs`, etc.):

1. Nuevo proyecto GAS → nombre: `CEB54_API_Academico` (o el módulo correspondiente)
2. Crear DOS archivos en el proyecto:
   - `config.gs` → contenido de `00-config.gs`
   - `main.gs` → contenido del módulo correspondiente
3. En `config.gs`, reemplazar `MASTER_ID` con el ID real de MASTER_CEB54
4. Desplegar como aplicación web (mismo proceso que la Fase 1)
5. Guardar la URL resultante

---

## FASE 4 — Migrar datos actuales

Una vez que los módulos nuevos estén desplegados:

1. Exportar datos del Spreadsheet actual (PEC actual) a CSV
2. Adaptar columnas al nuevo formato (ver `sheets/estructura-hojas.md`)
3. Importar en `CEB54_CICLO_2025_2026`
4. Probar en SANDBOX primero (cambiar MODO a PRUEBAS en MASTER)
5. Cuando todo funcione, actualizar URLs en los portales

---

## FASE 5 — Switch final

Cuando estés listo para cada portal:

1. Cambiar la URL de la API en el portal (de la vieja a la nueva)
2. Probar exhaustivamente
3. El sistema viejo queda intacto como respaldo

El switch se hace portal por portal, no todo de golpe.

---

## Cómo activar/desactivar modo sandbox

En `MASTER_CEB54` → hoja `CONFIG`:
- Cambiar `MODO` de `PRODUCCION` a `PRUEBAS`
- El sistema automáticamente lee del Spreadsheet SANDBOX
- Cambiar de vuelta a `PRODUCCION` para volver a datos reales
- No se toca código, solo una celda

---

## Referencias del sistema (IDs y URLs reales)

### Spreadsheets

| Nombre                  | ID / URL                                                                                          | Estado      |
|-------------------------|---------------------------------------------------------------------------------------------------|-------------|
| MASTER_CEB54            | `19CtLAZajk-0Sj5wOlBGiXzViqyc_7A9U_iS001mSng8`                                                  | ✅ Creado   |
| CEB54_CICLO_2025_2026   | `https://docs.google.com/spreadsheets/d/1zzYEW_Sh6EQ8VhwoUPN52wXH9hcW97ArMbFEWfi3VbA/edit`      | ✅ Creado   |
| CEB54_SANDBOX           | (pendiente — Fase 2)                                                                               | ⏳ Pendiente|

### Deployments GAS

| Módulo            | URL del Deployment                                                                                                           | Estado      |
|-------------------|------------------------------------------------------------------------------------------------------------------------------|-------------|
| Semanas CD        | `https://script.google.com/macros/s/AKfycbw9nLpWu79uDdEz4uPvewB7V5b_T79LzBlKr2i4mPRQ6Fna3Y9E8yvqvnebkZV9nbfQ_Q/exec`     | ✅ Activo   |
| Académico         | `https://script.google.com/macros/s/AKfycbyeex2Txz_EdUyj9qvsi_DPet3KweejaP4KBOUEdj8GQg_HIK3aCkxsMWxzxhTuknh6/exec`     | ✅ Activo   |
| PEC               | `https://script.google.com/macros/s/AKfycbw8tIW035KH4TczR57btpZVpzToDu4uxQXjUUV4uziQhhixLqjE-iMkVGnXV7Qsm2O1/exec`     | ✅ Activo   |
| Tutorías          | `https://script.google.com/macros/s/AKfycbxZnJv1IVpcGAw0fhxKHpB7R7TpV80KgQ2-mbnC-WrRlgG6A8LCA6zSRjpMTeg9Z7BU/exec`     | ✅ Activo   |
| Evaluación        | `https://script.google.com/macros/s/AKfycbyjanx82N_W6AdbHlsyA-SjtFHNhcMUabKcigFtdZFwGPFx-C4m0T4Z5ZIlvyJ6XdgyQQ/exec`    | ✅ Activo   |

---

## Estado actual del sistema (para no confundirse)

| Sistema | GAS actual                              | Módulo nuevo          |
|---------|-----------------------------------------|-----------------------|
| PEC     | backend-codigo-gas.js (activo)          | 03-pec.gs (listo)     |
| Semanas | mismo GAS de PEC (con error)            | 01-semanas-cd.gs ⚡    |
| Académico | gas-backend.js (activo)               | 02-academico.gs (listo)|
| Tutorías | backend-gas-v3.5.js (activo)          | 04-tutorias.gs (listo)|
| Evalua.  | backend-intrasemestral.gs (activo)    | 05-evaluacion.gs (listo)|

**Nada del sistema actual se modifica hasta que tú hagas el switch.**
