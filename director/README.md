# Consultor Director · CEB 5/4

Base de consulta para examen de promoción a director. 16 fuentes oficiales (CPEUM, leyes generales, MCCEMS, protocolos, código de conducta) con búsqueda full-text local.

**Live**: https://ceb54.online/director/

## Cómo añadir los PDFs (Drive)

1. Sube los 16 PDFs a una carpeta de Drive y compártela como **"cualquiera con el enlace puede ver"**.
2. Para cada PDF, copia su URL (botón **Compartir → Copiar enlace**).
3. Edita `scripts/drive-ids.txt` — descomenta cada línea y pega el ID o la URL completa.
4. Ejecuta:
   ```bash
   python3 scripts/connect-drive.py
   ```
5. Commit + push. El sitio empieza a abrir los PDFs en el visor de Drive embebido.

## Fuentes catalogadas

| # | Abrev. | Documento | Cat. | Pp |
|---|--------|-----------|------|---:|
| 1 | LGRA | Ley General de Responsabilidades Administrativas | Legal | 79 |
| 2 | CPEUM | Constitución Política de los EUM | Legal | 403 |
| 3 | LGE | Ley General de Educación | Legal | 82 |
| 4 | LGDNNA | Ley Gral. de Derechos de NNA | Legal | 97 |
| 5 | LGAMVLV | Ley Gral. Acceso Mujeres Vida Libre de Violencias | Legal | 88 |
| 6 | CT-1 | Curso-Taller 1: Acceso al conocimiento | Modelo | 97 |
| 7 | PCAE | Protocolo Convivencia Armónica ⚠ OCR | Protocolos | 32 |
| 8 | LPMC-24 | Lineamientos Mejora Continua 2024 | Ética | 19 |
| 9 | AC-21/08/25 | Acuerdo MCCEMS (DOF) | Modelo | 17 |
| 10 | PRUE | Protocolo Revisión de Útiles | Protocolos | 51 |
| 11 | PSP | Protocolos de Seguridad de Plantel | Protocolos | 56 |
| 12 | CT-2 | Curso-Taller 2: Recursos sociocognitivos | Modelo | 86 |
| 13 | AC-04/07/23 | Código de Conducta SEP | Ética | 16 |
| 14 | MCCEMS-25 | Modelo Educativo 2025 (MCCEMS) | Modelo | 68 |
| 15 | PAEC | Programa Aula, Escuela y Comunidad | Modelo | 32 |
| 16 | DCT | Declaratoria Cero Tolerancia | Ética | 11 |

**Total**: 1,234 páginas · 1,187 páginas indexadas para búsqueda

## Estructura

```
director/
├── index.html         portada (catálogo + filtros)
├── buscar.html        búsqueda full-text
├── lector.html        visor de PDF (Drive embed)
├── manifest.json      PWA
├── sw.js              service worker
├── css/director.css
├── js/
│   ├── app.js         portada
│   ├── search.js      búsqueda con MiniSearch
│   └── reader.js      lector
├── data/
│   ├── catalog.json   metadatos de 16 docs (con drive_id)
│   ├── search-index.json   1,187 páginas indexadas (≈3 MB)
│   └── pages/         texto extraído por documento
└── scripts/
    ├── drive-ids.txt        mapeo PDF → ID de Drive
    └── connect-drive.py     sincroniza IDs al catálogo
```

## Re-generar el índice de búsqueda

Si cambias los PDFs o añades uno nuevo, vuelve a extraer texto y reconstruye el índice:

```bash
# 1. Extraer texto (requiere pdftotext de poppler)
brew install poppler
# (script en historial — ver commit que generó data/pages/)

# 2. Reconstruir search-index.json
python3 -c "
import json, os, re, glob
catalog = json.load(open('data/catalog.json'))
docs_meta = {d['id']: d for d in catalog['documents']}
records = []
for path in sorted(glob.glob('data/pages/*.json')):
    doc_id = int(os.path.basename(path).split('.')[0])
    meta = docs_meta.get(doc_id)
    if not meta: continue
    data = json.load(open(path))
    for p in data['pages']:
        text = re.sub(r'\s+', ' ', p['text']).strip()
        if not text: continue
        records.append({'id': f\"{doc_id}-{p['page']}\", 'doc': doc_id,
            'abbr': meta['abbr'], 'category': meta['category'],
            'title': meta['short'] or meta['title'], 'page': p['page'], 'text': text})
json.dump({'version': catalog['version'], 'updated': catalog['updated'], 'records': records},
          open('data/search-index.json','w'), ensure_ascii=False, separators=(',',':'))
print(f'OK: {len(records)} páginas')
"
```

## Probar en local

```bash
python3 -m http.server 8095 --directory ../
# abrir http://localhost:8095/director/
```

## Atajos

- `/` enfoca el buscador
- `Esc` lo desenfoca
- En el lector: `?id=N&page=P` salta a la página

## Roadmap

- **Fase 1 ✅** — Sitio navegable, búsqueda full-text, lector PDF embebido, PWA
- **Fase 2** — Chat con IA (RAG sobre las 16 fuentes, citas con artículo y página)
- **Fase 3** — Notas personales, marcadores, modo "consultor formal"
