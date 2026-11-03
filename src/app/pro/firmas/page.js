// src/app/pro/firmas/page.js — las firmas del profesional, desde el celular:
// es donde más fácil resulta sacarle una foto a la firma o hacerla con el dedo.
import FirmasDelProfesional from "@/components/pro/FirmasDelProfesional";
import { SectionHeader } from "@/components/mi/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mis firmas" };

export default function ProFirmasPage() {
  return (
    <>
      <SectionHeader title="Mis firmas" subtitle="Para los formularios de seguro de sus pacientes" />
      <FirmasDelProfesional />
    </>
  );
}
