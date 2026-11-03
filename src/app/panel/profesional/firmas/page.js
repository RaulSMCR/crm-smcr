// src/app/panel/profesional/firmas/page.js
// Las firmas del profesional para los formularios de seguro (también en la app,
// /pro/firmas). La pantalla y las reglas son las de FirmasDelProfesional.
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import FirmasDelProfesional from "@/components/pro/FirmasDelProfesional";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mis firmas" };

export default async function FirmasPanelPage() {
  const session = await getSession();
  if (!session || session.role !== "PROFESSIONAL") redirect("/ingresar");

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-8">
      <div>
        <Link href="/panel/profesional" className="text-sm text-slate-500 hover:text-slate-700 hover:underline">
          ← Volver al panel
        </Link>
        <h1 className="mt-1 text-3xl font-bold text-slate-800">Mis firmas</h1>
      </div>
      <FirmasDelProfesional />
    </div>
  );
}
