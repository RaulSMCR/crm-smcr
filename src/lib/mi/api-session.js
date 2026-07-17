// src/lib/mi/api-session.js
// Sesión para route handlers de la PWA de pacientes (/api/mi/*).
//
// El middleware ya protege /api/mi/* (401 sin sesión, 403 con rol ≠ USER), pero
// los handlers deben validar por su cuenta (defensa en profundidad y para tener
// la sesión tipada disponible). Ver AUDIT-PWA · RIESGOS-2.
//
// Uso:
//   import { requirePatientSession } from "@/lib/mi/api-session";
//   export async function GET(request) {
//     const auth = await requirePatientSession(request);
//     if (auth instanceof NextResponse) return auth; // 401/403 ya listo
//     const { session } = auth;
//     ...
//   }
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

/**
 * Resuelve la sesión del paciente para un endpoint JSON.
 *
 * @param {Request} [_request] Reservado para uso futuro; `getSession()` lee las
 *        cookies vía next/headers, así que hoy no se necesita el request.
 * @returns {Promise<{ session: object } | NextResponse>} `{ session }` si es un
 *          paciente autenticado; si no, una `NextResponse` JSON 401/403 lista
 *          para retornar tal cual desde el handler.
 */
export async function requirePatientSession(_request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { error: "No autorizado: sesión requerida." },
      { status: 401 }
    );
  }

  if (session.role !== "USER") {
    return NextResponse.json(
      { error: "Prohibido: esta área es solo para pacientes." },
      { status: 403 }
    );
  }

  return { session };
}
