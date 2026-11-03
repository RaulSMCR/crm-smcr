// src/app/mi/seguro/page.js — la parte del paciente del formulario de PALIG.
import FormularioPaligPaciente from "@/components/mi/FormularioPaligPaciente";
import { SectionHeader } from "@/components/mi/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Seguro PALIG" };

export default function MiSeguroPage() {
  return (
    <>
      <SectionHeader title="Seguro PALIG" subtitle="Su parte del formulario de reclamo" />
      <FormularioPaligPaciente />
    </>
  );
}
