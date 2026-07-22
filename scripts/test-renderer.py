#!/usr/bin/env python3
"""
Humo del renderer de carruseles (CC-1).

Renderiza una spec minima de 3 slides (cover, narrative, cta) y verifica que
render_carousel devuelve 3 PNGs de 1080x1080. No escribe nada a disco.

Uso:
    python scripts/test-renderer.py
"""
import os
import sys
from io import BytesIO

# Hacer importable api/slides/_lib/renderer.py
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "api", "slides", "_lib"))

from renderer import render_carousel  # noqa: E402
from PIL import Image  # noqa: E402

SPEC = {
    "title": "Prueba de humo",
    "slides": [
        {
            "type": "cover",
            "tag": "PRUEBA",
            "title": "Titulo de portada",
            "subtitle": "Subtitulo que valida el render y el fondo generativo",
        },
        {
            "type": "narrative",
            "hook": "Un hook breve pero con peso",
            "body": (
                "Parrafo articulado que valida el wrap por medicion real de pixeles, "
                "el fondo abstracto generativo y la caja de legibilidad detras del texto."
            ),
        },
        {
            "type": "cta",
            "cta": "Sigue el link en bio",
            "subcta": "Accion concreta con valor",
            "handle": "@saludmentalcostarica",
        },
    ],
}


def main() -> int:
    result = render_carousel(SPEC)

    assert isinstance(result, list), "render_carousel debe devolver una lista"
    assert len(result) == 3, f"esperaba 3 slides, obtuve {len(result)}"

    for filename, data in result:
        assert isinstance(filename, str) and filename.endswith(".png"), \
            f"filename invalido: {filename!r}"
        assert isinstance(data, (bytes, bytearray)) and len(data) > 0, \
            f"{filename}: bytes vacios"
        im = Image.open(BytesIO(data))
        assert im.format == "PNG", f"{filename}: formato {im.format}, esperaba PNG"
        assert im.size == (1080, 1080), f"{filename}: dimensiones {im.size}, esperaba (1080, 1080)"
        print(f"OK  {filename}: {im.size} PNG, {len(data):,} bytes")

    print("\nPASS: 3 PNGs 1080x1080 generados en memoria.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
