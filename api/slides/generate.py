#!/usr/bin/env python3
"""
Vercel Python Function: genera un carrusel y sube los PNG a Supabase Storage.

POST /api/slides/generate
  Headers: x-internal-secret: <SLIDES_INTERNAL_SECRET>
  Body JSON: { "slug": str, "spec": { "slides": [...] } }

Respuestas:
  200 { "assets": [{ "index", "filename", "storagePath", "width", "height" }] }
  400 JSON invalido
  401 secret ausente o incorrecto
  422 spec / slug invalido (con detalle)
  500 error interno / fallo de upload

Solo verifica el secret interno; la autenticacion de usuario la hace el orquestador
Node (route admin). Esta funcion no toca Prisma ni sesiones.
"""
import os
import sys
import json
from http.server import BaseHTTPRequestHandler

# Hacer importable _lib/renderer.py (prefijo "_" => Vercel no lo enruta).
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "_lib"))
from renderer import render_carousel, supabase_config, SLIDE_TYPES  # noqa: E402

# Patron de slug seguro para usar como prefijo de path en Storage (evita traversal).
import re  # noqa: E402
_SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,79}$")


def validate_payload(payload):
    """Devuelve (slug, spec, selection, render_key, errores)."""
    errors = []
    if not isinstance(payload, dict):
        return None, None, None, None, ["el body debe ser un objeto JSON"]

    slug = payload.get("slug")
    if not isinstance(slug, str) or not _SLUG_RE.match(slug or ""):
        errors.append(
            "slug requerido: minusculas, digitos, '-' o '_', 1-80 chars, "
            "sin empezar con separador"
        )

    spec = payload.get("spec")
    errors.extend(validate_spec(spec))

    selection = payload.get("selection")
    if selection is not None:
        if not isinstance(selection, list) or any(not isinstance(i, int) or i < 0 for i in selection):
            errors.append("selection debe ser una lista de índices enteros no negativos")
        elif isinstance(spec, dict) and isinstance(spec.get("slides"), list):
            max_index = len(spec["slides"]) - 1
            if any(i > max_index for i in selection):
                errors.append("selection contiene un índice fuera de rango")

    render_key = payload.get("renderKey") or "legacy"
    if not isinstance(render_key, str) or not re.match(r"^[a-zA-Z0-9_-]{1,80}$", render_key):
        errors.append("renderKey inválido")

    return slug, spec, selection, render_key, errors


def validate_spec(spec):
    """Validacion minima de la spec. Devuelve lista de errores."""
    errors = []
    if not isinstance(spec, dict):
        return ["spec debe ser un objeto"]

    slides = spec.get("slides")
    if not isinstance(slides, list) or len(slides) == 0:
        return ["spec.slides debe ser una lista no vacia"]

    for i, sd in enumerate(slides):
        if not isinstance(sd, dict):
            errors.append(f"slides[{i}] debe ser un objeto")
            continue
        stype = sd.get("type", "narrative")
        if stype not in SLIDE_TYPES:
            errors.append(
                f"slides[{i}].type '{stype}' desconocido "
                f"(validos: {', '.join(SLIDE_TYPES)})"
            )
    return errors


def upload_asset(slug, filename, png_bytes, render_key="legacy"):
    """
    Sube un PNG al bucket privado 'carousels' en path '{slug}/{render_key}/{filename}'.
    Devuelve el storagePath. Lanza en caso de fallo.
    """
    import requests

    base, key = supabase_config()
    if not base or not key:
        raise RuntimeError("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no configurados")

    path = f"{slug}/{render_key}/{filename}"
    url = f"{base}/storage/v1/object/carousels/{path}"
    resp = requests.post(
        url,
        data=png_bytes,
        headers={
            "Authorization": f"Bearer {key}",
            "apikey": key,
            "Content-Type": "image/png",
            "x-upsert": "true",
            # Sin cache: al regenerar se reescribe la misma ruta; evita servir el PNG viejo.
            "Cache-Control": "no-cache, max-age=0",
        },
        timeout=60,
    )
    if resp.status_code >= 300:
        raise RuntimeError(
            f"upload fallo ({resp.status_code}) para {path}: {resp.text[:300]}"
        )
    return path


def process(payload, secret_header):
    """
    Nucleo testeable del handler. Devuelve (status_code, body_dict).
    No depende de la capa HTTP; los tests lo invocan directo.
    """
    expected = os.environ.get("SLIDES_INTERNAL_SECRET", "")
    if not expected or secret_header != expected:
        return 401, {"error": "unauthorized"}

    slug, spec, selection, render_key, errors = validate_payload(payload)
    if errors:
        return 422, {"error": "invalid_request", "detail": errors}

    rendered = render_carousel(spec)
    selected = set(range(len(rendered))) if selection is None else set(selection)
    assets = []
    for idx, (filename, png_bytes) in enumerate(rendered):
        if idx not in selected:
            continue
        storage_path = upload_asset(slug, filename, png_bytes, render_key)
        assets.append({
            "index": idx,
            "filename": filename,
            "storagePath": storage_path,
            "width": 1080,
            "height": 1080,
        })
    return 200, {"assets": assets}


def _send_json(handler, status, payload):
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


class handler(BaseHTTPRequestHandler):
    def do_POST(self):  # noqa: N802 (interfaz de BaseHTTPRequestHandler)
        try:
            length = int(self.headers.get("Content-Length", 0) or 0)
            raw = self.rfile.read(length) if length else b""
            try:
                payload = json.loads(raw.decode("utf-8")) if raw else {}
            except (json.JSONDecodeError, UnicodeDecodeError):
                _send_json(self, 400, {"error": "invalid_json"})
                return

            secret = self.headers.get("x-internal-secret", "")
            status, body = process(payload, secret)
            _send_json(self, status, body)
        except Exception as exc:  # noqa: BLE001
            _send_json(self, 500, {"error": "internal_error", "detail": str(exc)})

    def do_GET(self):  # noqa: N802
        _send_json(self, 405, {"error": "method_not_allowed"})
