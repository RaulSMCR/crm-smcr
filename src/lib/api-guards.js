import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Quién puede reportar un cobro a mano y con eso disparar la emisión de un
 * comprobante fiscal.
 *
 * No alcanza con el rol ADMIN. Reportar un pago que entró por SINPE Móvil o por
 * depósito es afirmar ante Hacienda que una venta ocurrió, y esa afirmación la
 * firma el certificado de la sociedad: es un acto atribuible a una persona
 * concreta, la que responde por la emisión. Hoy hay una sola cuenta ADMIN, así
 * que la distinción no cambia nada en la práctica; existe para que agregar un
 * segundo administrador —una asistente, un contador— no le entregue de paso la
 * facultad de emitir documentos fiscales.
 *
 * Se resuelve por correo y contra la base, no por el JWT: el token se emitió
 * antes y no refleja si la cuenta sigue activa.
 */
const EMISOR_RESPONSABLE = String(
  process.env.FE_EMISOR_RESPONSABLE_EMAIL || "contacto@saludmentalcostarica.com",
)
  .trim()
  .toLowerCase();

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

/** ¿Este correo es el de la persona responsable de la emisión fiscal? */
export function esEmisorResponsable(email) {
  return String(email || "").trim().toLowerCase() === EMISOR_RESPONSABLE;
}

/**
 * Guard de las rutas que emiten comprobantes a partir de un cobro reportado a
 * mano. Es `requireAdmin` más la comprobación de identidad descrita arriba.
 */
export async function requireEmisorResponsable() {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const userId = String(auth.session.sub || auth.session.userId || "");
  const user = userId
    ? await prisma.user.findUnique({ where: { id: userId }, select: { email: true, isActive: true } })
    : null;

  if (!user?.isActive || !esEmisorResponsable(user.email)) {
    // Sin decir quién sí puede: el mensaje lo lee cualquiera que llegue acá.
    return {
      error: NextResponse.json(
        { message: "Solo la persona responsable de la emisión fiscal puede reportar cobros." },
        { status: 403 },
      ),
    };
  }
  return { session: auth.session };
}
