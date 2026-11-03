// src/app/pro/seguros/[patientId]/page.js — completar la parte del profesional
// en el formulario PALIG de un paciente.
import Link from "next/link";
import ParteProfesionalPalig from "@/components/pro/ParteProfesionalPalig";
import { SectionHeader } from "@/components/mi/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Formulario PALIG" };

export default async function ProSeguroPacientePage({ params }) {
  const { patientId } = await params; // Next 16: params es una promesa.
  return (
    <>
      <Link href="/pro/seguros" className="text-sm text-neutral-500 underline">
        ← Seguros
      </Link>
      <SectionHeader title="Formulario PALIG" />
      <ParteProfesionalPalig patientId={patientId} />
    </>
  );
}
