// src/app/pro/ayuda/page.js — guía de la app para profesionales.
// Recorre la app en el orden en que se usa en un día de consulta, y cierra con
// los seguros PALIG. Cada sección enlaza a la pantalla de la que habla.
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { puedeCobrarFueraDeOnvo } from "@/lib/acuerdos-de-atencion";
import { Card, SectionHeader } from "@/components/mi/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Guía" };

function Seccion({ id, titulo, enlace, children }) {
  return (
    <Card className="space-y-2">
      <h2 id={id} className="text-lg font-semibold text-brand-800">
        {titulo}
      </h2>
      <div className="space-y-2 text-sm leading-6 text-neutral-700">{children}</div>
      {enlace ? (
        <Link href={enlace[0]} className="inline-block text-sm font-semibold text-brand-700 underline">
          {enlace[1]} →
        </Link>
      ) : null}
    </Card>
  );
}

export default async function ProAyudaPage() {
  const session = await getSession();
  if (!session) redirect("/ingresar?next=/pro/ayuda");
  const perfil = await prisma.professionalProfile.findUnique({
    where: { id: String(session.professionalProfileId || "") },
    select: { slug: true },
  });
  // Lo que solo puede Raúl se explica solo a Raúl: a los demás los confundiría.
  const esGestionado = puedeCobrarFueraDeOnvo(perfil?.slug);

  return (
    <>
      <SectionHeader title="Guía de la app" subtitle="Cómo se usa, pantalla por pantalla" />
      <div className="space-y-4">
        <Seccion id="instalar" titulo="Instalar la app">
          <p>
            Abra esta página en el celular y toque <strong>Llevar la app conmigo</strong> (Android) o, en Safari,{" "}
            <strong>Compartir → Agregar a inicio</strong> (iPhone). Queda un ícono «Consultorio».
          </p>
        </Seccion>

        <Seccion id="hoy" titulo="Hoy" enlace={["/pro", "Ir a Hoy"]}>
          <p>
            Arriba aparecen las sesiones <strong>por cerrar</strong>: las que ya empezaron y nadie completó. Debajo, lo que
            queda del día y las próximas citas.
          </p>
          <p>
            En las virtuales tiene <strong>Abrir Meet</strong> y <strong>Mandar enlace por WhatsApp</strong>, con el
            mensaje ya escrito para el paciente.
          </p>
        </Seccion>

        <Seccion id="cerrar" titulo="Cerrar una sesión y agendar la próxima" enlace={["/pro", "Ir a Hoy"]}>
          <p>
            <strong>Completar</strong>: si queda saldo, el paciente recibe el enlace de pago. En seguida se abre la{" "}
            <strong>próxima sesión</strong>, con el mismo día y hora de la semana siguiente ya sugeridos. Puede elegir
            otro horario o armar una serie: cada semana, cada dos semanas o cada cuatro semanas.
          </p>
          <p>
            <strong>Ausente</strong>: se cobra el 50 % de la sesión (salvo que el adelanto ya lo cubra) y la agenda del
            paciente queda en pausa hasta que la administración lo contacte.
          </p>
        </Seccion>

        <Seccion id="semana" titulo="Semana: mover, cancelar, aceptar" enlace={["/pro/semana", "Ir a Semana"]}>
          <p>Siete días con todas sus citas, los libres incluidos, para ver qué hueco ofrecer.</p>
          <p>
            <strong>Reagendar</strong> mueve solo esa cita: si el paciente pide otro día para una semana puntual, las
            demás de la serie quedan como estaban. <strong>Cancelar</strong> pide un motivo, que le llega al paciente.{" "}
            <strong>Aceptar</strong> confirma una solicitud y permite armar la serie.
          </p>
        </Seccion>

        <Seccion id="acuerdos" titulo="Acuerdos de atención" enlace={["/pro/acuerdos", "Ir a Acuerdos"]}>
          <p>
            Para pacientes en tratamiento con una periodicidad fija y sin fecha de fin. Las sesiones se generan solas,
            ocho semanas hacia adelante, y el paciente recibe una sola invitación de Google con el enlace de Meet.
          </p>
          <p>
            {esGestionado
              ? "Fija el precio acordado y elige si se cobra por ONVO o fuera de ONVO (SINPE, PALIG)."
              : "Cada sesión se cobra a su tarifa aprobada, por ONVO, al completarla."}
          </p>
        </Seccion>

        <Seccion id="cobros" titulo="Cobros" enlace={["/pro/cobros", "Ir a Cobros"]}>
          <p>
            Las sesiones completadas que falta pagar, con el monto y si ya salió el enlace.{" "}
            <strong>Reenviar enlace ONVO</strong> le vuelve a mandar al paciente el mismo enlace.
          </p>
          {esGestionado ? (
            <p>
              <strong>Registrar pago</strong> (solo usted): para lo que entró por SINPE, efectivo o transferencia. Emite la
              factura y la manda a Hacienda. A los pacientes PALIG se les registra por el cobro PALIG.
            </p>
          ) : (
            <p>Los pagos se reciben únicamente por ONVO.</p>
          )}
        </Seccion>

        <Seccion id="firmas" titulo="Sus firmas" enlace={["/pro/firmas", "Ir a Mis firmas"]}>
          <p>
            Se estampan en los formularios de seguro, para que no tenga que imprimir ni escanear. Firme en una hoja blanca
            y sáquele una foto (el fondo se quita solo), o firme con el dedo. Guarde entre 3 y 6: cada formulario lleva una
            distinta.
          </p>
        </Seccion>

        <Seccion id="palig" titulo="Pacientes con seguro PALIG" enlace={["/pro/seguros", "Ir a Seguros PALIG"]}>
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              <strong>El paciente entrega su parte, una vez</strong>, en su cuenta (Seguro PALIG): en línea con firma con
              el dedo, o la foto del papel. Puede mandarle esta guía:{" "}
              <Link href="/ayuda/seguros" className="underline">
                saludmentalcostarica.com/ayuda/seguros
              </Link>
              .
            </li>
            <li>
              <strong>Usted completa la suya, una vez</strong>: le llega un correo. Motivo y diagnóstico son obligatorios;
              su nombre, especialidad, colegiado y el teléfono de la empresa se ponen solos. Revise la vista previa.
            </li>
            <li>
              <strong>En cada pago</strong> el formulario se arma con la fecha del pago y la factura. Le llega un correo;
              en Seguros PALIG → <strong>Por firmar y enviar</strong>: Firmar, revisar y Enviar al paciente.
            </li>
          </ol>
          <p>
            Para que se arme solo hacen falta las tres cosas: la parte del paciente, la suya y sus firmas guardadas.
          </p>
        </Seccion>
      </div>
    </>
  );
}
