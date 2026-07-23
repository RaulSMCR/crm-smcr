#!/usr/bin/env python3
"""
Humo del handler de generación (CC-2), invocando process() directo.

Mockea el upload a Storage para no depender de los buckets reales. Verifica:
  - 200 con 9 assets bien formados (spec de ejemplo), en < 60s
  - 401 sin secret / con secret incorrecto
  - 422 con spec inválida (slides vacío, type desconocido) y slug inválido

Uso:
    python scripts/test-generate.py
"""
import os
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "api", "slides"))

os.environ["SLIDES_INTERNAL_SECRET"] = "test-secret-123"

import generate  # noqa: E402

# --- Mock del upload: no toca red, registra las llamadas -----------------------
uploaded = []
def _fake_upload(slug, filename, png_bytes, render_key="legacy"):
    assert isinstance(png_bytes, (bytes, bytearray)) and len(png_bytes) > 0
    path = f"{slug}/{render_key}/{filename}"
    uploaded.append(path)
    return path
generate.upload_asset = _fake_upload

SECRET = "test-secret-123"

SPEC_9 = {
    "title": "Ejemplo 9 slides",
    "slides": [
        {"type": "cover", "tag": "SERIE", "title": "El giro de la salud mental",
         "subtitle": "Una historia de siglos"},
        {"type": "highlight", "stat": "70%", "label": "no consulta a tiempo"},
        {"type": "narrative", "hook": "El inconsciente no es un sotano",
         "body": "Hablando puedes encontrarte con la potencia de tus deseos."},
        {"type": "map", "title": "El campo", "items": [
            {"name": "Psicoanalisis", "desc": "Freud"}, {"name": "Cognitivo", "desc": "Beck"},
            {"name": "Humanista", "desc": "Rogers"}, {"name": "Biologico", "desc": "Farmaco"}]},
        {"type": "directory", "title": "Puertas", "items": [
            {"name": "Escucha", "desc": "El inicio"}, {"name": "Palabra", "desc": "Nombrar"}]},
        {"type": "content", "title": "Enumerable", "points": ["Uno", "Dos", "Tres"]},
        {"type": "quote", "quote": "No hay salud sin salud mental.", "author": "OMS", "accent": True},
        {"type": "narrative", "hook": "La sociedad tambien enferma",
         "body": "El vinculo social sostiene o desgarra."},
        {"type": "cta", "cta": "Sigue el link en bio", "subcta": "Empezamos una serie",
         "handle": "@saludmentalcostarica"},
    ],
}


def check(name, cond):
    mark = "OK " if cond else "FAIL"
    print(f"{mark} {name}")
    if not cond:
        raise AssertionError(name)


def main() -> int:
    # 1) Camino feliz: 200 + 9 assets
    t0 = time.time()
    status, body = generate.process({"slug": "ejemplo-9", "spec": SPEC_9}, SECRET)
    dt = time.time() - t0
    check("200 en camino feliz", status == 200)
    check("9 assets devueltos", len(body.get("assets", [])) == 9)
    check("9 uploads invocados", len(uploaded) == 9)
    first = body["assets"][0]
    check("asset bien formado", all(k in first for k in ("index", "filename", "storagePath", "width", "height")))
    check("dimensiones 1080x1080", first["width"] == 1080 and first["height"] == 1080)
    check(f"tiempo < 60s ({dt:.2f}s)", dt < 60)

    # 1b) Renderizado selectivo: solo sube el índice solicitado.
    uploaded.clear()
    status, body = generate.process({"slug": "ejemplo-9", "spec": SPEC_9, "selection": [2], "renderKey": "selective-test"}, SECRET)
    check("200 en renderizado selectivo", status == 200)
    check("1 asset selectivo devuelto", len(body.get("assets", [])) == 1)
    check("solo se sube el índice solicitado", body["assets"][0]["index"] == 2 and len(uploaded) == 1)

    # 2) Auth
    status, _ = generate.process({"slug": "x", "spec": SPEC_9}, "")
    check("401 sin secret", status == 401)
    status, _ = generate.process({"slug": "x", "spec": SPEC_9}, "wrong")
    check("401 con secret incorrecto", status == 401)

    # 3) Validación
    status, body = generate.process({"slug": "x", "spec": {"slides": []}}, SECRET)
    check("422 con slides vacío", status == 422 and "detail" in body)
    status, _ = generate.process({"slug": "x", "spec": {"slides": [{"type": "banana"}]}}, SECRET)
    check("422 con type desconocido", status == 422)
    status, _ = generate.process({"slug": "MAL SLUG!", "spec": SPEC_9}, SECRET)
    check("422 con slug inválido", status == 422)

    print("\nPASS: handler de generación validado (upload mockeado).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
