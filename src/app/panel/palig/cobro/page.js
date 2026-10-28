// src/app/panel/palig/cobro/page.js
// App mínima de cobros PALIG para el celular: paciente + captura del
// comprobante SINPE → factura y formulario PALIG. Usa el mismo endpoint y las
// mismas reglas que el piloto completo (/panel/palig); acá solo está lo que se
// hace con cada pago. Las plantillas se siguen guardando en el piloto.
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePaligOperator } from "@/lib/palig-auth";
import { esPalig, fechaCostaRica, PALIG_PROFESSIONAL_SLUG } from "@/lib/palig-policy";
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
  return <>
    {/* Sin el header y el footer del sitio, como la PWA de /mi. */}
    <style dangerouslySetInnerHTML={{ __html: "body > header,body > footer{display:none!important}" }} />
    <CobroMovil
      today={fechaCostaRica(new Date())}
      patients={patients
        .filter((p) => esPalig(p.insuranceName) && p.insuranceTemplateUrl && profile && p.insuranceTemplateProId === profile.id)
        .map((p) => ({ id: p.id, name: p.name }))}
    />
  </>;
}
