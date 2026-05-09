#!/usr/bin/env python3
"""
Conecta los IDs de Google Drive al catalog.json.

Uso:
  1. Edita drive-ids.txt con un par "id_pdf=drive_id" por línea, ej:
       1=1aBcD3FgHiJkLmNoPqRsTuVwXyZ_EXAMPLE
       2=2zYxW9VuTsRqPoNmLkJiHgFeDcBaABCDEF
       ...
  2. Ejecuta: python3 scripts/connect-drive.py
  3. catalog.json queda actualizado.

También acepta URLs completas:
  3=https://drive.google.com/file/d/1aBcD3FgHiJkLmNoPqRsTuVwXyZ_EXAMPLE/view?usp=sharing
"""
import json, re, sys, os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CATALOG = ROOT / "data" / "catalog.json"
IDS_FILE = ROOT / "scripts" / "drive-ids.txt"

DRIVE_RE = re.compile(r"/d/([a-zA-Z0-9_-]{20,})")

def parse_drive_id(value: str) -> str:
    value = value.strip()
    if not value:
        return ""
    # Si parece URL, extraer el ID
    m = DRIVE_RE.search(value)
    if m:
        return m.group(1)
    # Si parece ID directo (20+ caracteres alfanuméricos)
    if re.fullmatch(r"[a-zA-Z0-9_-]{20,}", value):
        return value
    raise ValueError(f"No se pudo extraer ID de: {value}")

def main():
    if not IDS_FILE.exists():
        print(f"❌ Falta {IDS_FILE}")
        print("   Crea el archivo con líneas como:  1=DRIVE_ID_O_URL")
        sys.exit(1)

    mapping = {}
    for line_no, raw in enumerate(IDS_FILE.read_text(encoding="utf-8").splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            print(f"⚠️  línea {line_no} ignorada (sin '='): {line}")
            continue
        pdf_id, value = line.split("=", 1)
        # Permitir comentarios inline: "1=ID  # nota"
        value = value.split("#", 1)[0].strip()
        try:
            pdf_id = int(pdf_id.strip())
            drive_id = parse_drive_id(value)
            if drive_id:
                mapping[pdf_id] = drive_id
        except (ValueError, AssertionError) as e:
            print(f"⚠️  línea {line_no} ignorada: {e}")

    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    updated = 0
    for d in catalog["documents"]:
        if d["id"] in mapping:
            new_id = mapping[d["id"]]
            if d.get("drive_id") != new_id:
                d["drive_id"] = new_id
                updated += 1

    CATALOG.write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8"
    )
    print(f"✅ {updated} documentos actualizados ({len(mapping)} IDs en el archivo)")
    # Resumen
    with_drive = sum(1 for d in catalog["documents"] if d.get("drive_id"))
    total = len(catalog["documents"])
    print(f"   {with_drive}/{total} documentos enlazados a Drive")
    if with_drive < total:
        missing = [str(d["id"]) for d in catalog["documents"] if not d.get("drive_id")]
        print(f"   Pendientes: {', '.join(missing)}")

if __name__ == "__main__":
    main()
