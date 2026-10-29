// src/app/panel/palig/cobro/page.js
// App mínima de cobros PALIG para el celular: paciente + captura del
// comprobante SINPE → factura y formulario PALIG. Usa el mismo endpoint y las
// mismas reglas que el piloto completo (/panel/palig); acá solo está lo que se
// hace con cada pago. Las plantillas se siguen guardando en el piloto.
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePaligOperator } from "@/lib/palig-auth";
import { esPalig, fechaCostaRica, PALIG_PROFESSIONAL_SLUG } from "@/lib/palig-policy";
import { PALIG_CLAIM_SELECT, resumenPalig } from "@/lib/palig-service";
import CobroMovil from "@/components/palig/CobroMovil";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Cobros PALIG",
  robots: { index: false, follow: false },
  applicationName: "SMCR — Cobros PALIG",
  manifest: "/panel/palig/cobro/manifest.webmanifest",
};

export const viewport = { themeColor: "#2B7073", width: "device-width", initialScale: 1 };

export default async function CobroPage() {
  const auth = await requirePaligOperator();
  if (auth.error) redirect("/ingresar?next=/panel/palig/cobro");
  const professional = { slug: PALIG_PROFESSIONAL_SLUG };
  const profile = await prisma.professionalProfile.findUnique({ where: professional, select: { id: true } });
  const patients = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: [{ appointments: { some: { professional } } }, { casosComoPaciente: { some: { professional } } }],
    },
    select: { id: true, name: true, insuranceName: true, insuranceTemplateUrl: true, insuranceTemplateProId: true },
    orderBy: { name: "asc" },
  });
  // Trámites que todavía no le llegaron al paciente: sin esto, al salir de la
  // pantalla del resultado no había forma de volver a firmarlos y enviarlos.
  const pendientes = await prisma.insuranceClaim.findMany({
    where: { professional, invoiceId: { not: null }, emailSentAt: null, invoice: { status: { in: ["OPEN", "PAID"] } } },
    select: { ...PALIG_CLAIM_SELECT, patient: { select: { name: true } } },
    orderBy: { createdAt: "desc" }, take: 20,
  });
  return <>
    {/* Sin el header y el footer del sitio, como la PWA de /mi. */}
    <style dangerouslySetInnerHTML={{ __html: "body > header,body > footer{display:none!important}" }} />
    <CobroMovil
      today={fechaCostaRica(new Date())}
      // Todos los de PALIG, también los que no tienen plantilla: si no aparecen,
      // no se entiende por qué faltan. Esos se marcan y no se pueden facturar acá.
      patients={patients
        .filter((p) => esPalig(p.insuranceName))
        .map((p) => ({ id: p.id, name: p.name, templateReady: Boolean(p.insuranceTemplateUrl && profile && p.insuranceTemplateProId === profile.id) }))}
      pendientes={pendientes.map((c) => ({ ...resumenPalig(c), date: c.invoice.invoiceDate.toISOString(), patientId: c.patientId, patientName: c.patient.name }))}
    />
  </>;
}
