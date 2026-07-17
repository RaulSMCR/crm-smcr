// src/app/panel/page.js
// Destino real para /panel: varias páginas hacían redirect("/panel") pero no
// existía page.js aquí, así que caía en 404 (ver AUDIT-PWA · RIESGOS-5).
// Resuelve el destino según el rol de la sesión.
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PanelIndexPage() {
  const session = await getSession();

  if (!session) redirect("/ingresar?next=/panel");

  switch (session.role) {
    case "ADMIN":
      redirect("/panel/admin");
    case "PROFESSIONAL":
      redirect("/panel/profesional");
    case "USER":
      redirect("/panel/paciente");
    default:
      redirect("/ingresar");
  }
}
