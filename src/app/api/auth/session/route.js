// src/app/api/auth/session/route.js
// Estado de sesión LIVIANO para el header: verifica el JWT sin tocar la DB, así
// que responde en ~ms (a diferencia de /api/auth/me, que corre getSession() con
// su query y puede tardar segundos). Devuelve 200 siempre (ok:true/false) para
// no ensuciar la consola con 401 en usuarios deslogueados.
import { NextResponse } from "next/server";
import { getSessionLite } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSessionLite();
  if (!session) return NextResponse.json({ ok: false });

  return NextResponse.json({
    ok: true,
    role: session.role,
    actualRole: session.actualRole || session.role,
    isPreview: !!session.isPreview,
    name: session.name || null,
  });
}
