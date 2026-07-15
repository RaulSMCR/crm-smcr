// PATH: src/app/api/auth/me/route.js
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ ok: false, message: "No autenticado" }, { status: 401 });
    }
    return NextResponse.json(
      {
        ok: true,
        role: session.role,
        actualRole: session.actualRole || session.role,
        isPreview: !!session.isPreview,
        id: session.sub,
        name: session.name,
        email: session.email,
        professionalProfile: session.professionalProfile || null,
      },
      { status: 200 }
    );
  } catch (e) {
    console.error("Auth Me Error:", e);

    // Si el token está roto/expirado, devolvemos 401 consistente.
    // (Opcional) podríamos limpiar cookie aquí, pero middleware ya se encarga al no validar.
    return NextResponse.json({ ok: false, message: "Sesión expirada" }, { status: 401 });
  }
}
