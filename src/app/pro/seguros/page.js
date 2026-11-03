// src/app/pro/seguros/page.js — los pacientes con PALIG del profesional y en
// qué punto está el formulario de cada uno.
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { wherePacientesDelProfesional } from "@/lib/casos";
import { esPalig } from "@/lib/palig-policy";
import { etapaDelFormulario } from "@/lib/palig-plantillas";
import { Card, EmptyState, Pill, SectionHeader } from "@/components/mi/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Seguros" };

const ETIQUETA = {
  SIN_FORMULARIO: ["Falta la parte del paciente", "neutral"],
  FALTA_PROFESIONAL: ["Falta su parte", "coral"],
  LISTO: ["Plantilla lista", "teal"],
};

export default async function ProSegurosPage() {
  const session = await getSession();
  if (!session) redirect("/ingresar?next=/pro/seguros");
  const professionalId = String(session.professionalProfileId || "");

  const pacientes = (
    await prisma.user.findMany({
      where: wherePacientesDelProfesional(professionalId),
      select: { id: true, name: true, insuranceName: true, insurancePatientFormUrl: true, insuranceTemplateUrl: true },
      orderBy: { name: "asc" },
    })
  ).filter((p) => esPalig(p.insuranceName));

  return (
    <>
      <SectionHeader title="Seguros PALIG" subtitle="El formulario de reclamo de cada paciente" />
      <p className="mb-4 text-sm text-neutral-600">
        El paciente entrega su parte una vez; usted completa la suya una vez. Después, en cada pago, el formulario se arma
        solo con la fecha y su firma, y usted lo revisa antes de enviarlo.{" "}
        <Link href="/pro/firmas" className="font-semibold text-brand-700 underline">
          Mis firmas
        </Link>
      </p>
      {pacientes.length === 0 ? (
        <EmptyState
          title="Sin pacientes con PALIG"
          message="Aparecen acá cuando un paciente suyo declara PALIG o entrega el formulario."
        />
      ) : (
        <div className="space-y-3">
          {pacientes.map((p) => {
            const [texto, tono] = ETIQUETA[etapaDelFormulario(p)];
            return (
              <Link key={p.id} href={`/pro/seguros/${p.id}`} className="block">
                <Card className="flex items-center justify-between gap-3 hover:bg-neutral-50">
                  <span className="font-semibold text-neutral-900">{p.name}</span>
                  <Pill tone={tono}>{texto}</Pill>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
