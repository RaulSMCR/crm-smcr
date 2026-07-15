import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

/**
 * Guard de rutas API. Devuelve `{ session }` o `{ error }` con la respuesta ya
 * construida, para usarse como:
 *   const auth = await requireAdmin();
 *   if (auth.error) return auth.error;
 */
export async function requireAdmin() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ message: "No autorizado." }, { status: 401 }) };
  if (session.role !== "ADMIN") {
    return { error: NextResponse.json({ message: "Acción no permitida." }, { status: 403 }) };
  }
  return { session };
}
