// src/components/pro/CitaDelDia.js
// Una cita en la pantalla «Hoy» de la app de profesionales. Sin hooks: se pinta
// en el servidor. Meet y WhatsApp son enlaces comunes; cerrar la sesión y
// aceptar, reagendar o cancelar corren en el navegador.
import AccionesDeCita from "@/components/pro/AccionesDeCita";
import CerrarSesion from "@/components/pro/CerrarSesion";
import { detalleLugarCita } from "@/lib/lugar-cita";
import { enlaceMeetPorWhatsApp, numeroWhatsApp } from "@/lib/whatsapp";
import { formatDayTab, formatSlotTime } from "@/lib/appointment-slots";
import { Card, Pill } from "@/components/mi/ui";

const BOTON =
  "inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold transition-colors";

function Etiquetas({ cita, porCerrar }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {porCerrar ? <Pill tone="coral">Por cerrar</Pill> : null}
      {!porCerrar && cita.status === "PENDING" ? <Pill tone="coral">Solicitud</Pill> : null}
      {cita.acuerdoId ? <Pill tone="teal">Acuerdo</Pill> : null}
      {cita.paymentStatus === "PARTIALLY_PAID" ? <Pill tone="neutral">Adelanto pagado</Pill> : null}
      {cita.paymentStatus === "PAID" ? <Pill tone="teal">Pagada</Pill> : null}
    </div>
  );
}

function Acciones({ cita, porCerrar }) {
  const lugar = detalleLugarCita(cita);
  const enlaceMeet = lugar.esVirtual && cita.meetLink ? cita.meetLink : null;
  const mandarMeet = enlaceMeet
    ? enlaceMeetPorWhatsApp({ telefono: cita.patient?.phone, nombre: cita.patient?.name, meetLink: enlaceMeet })
    : null;
  const numero = numeroWhatsApp(cita.patient?.phone);
  const chat = !mandarMeet && numero ? `https://wa.me/${numero}` : null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {/* Lo primero que hay que hacer con una sesión que ya pasó. */}
      {porCerrar ? <CerrarSesion citaId={cita.id} paciente={cita.patient?.name || "el paciente"} /> : null}
      {enlaceMeet && !porCerrar ? (
        <a href={enlaceMeet} target="_blank" rel="noopener noreferrer" className={`${BOTON} bg-brand-600 text-white hover:bg-brand-500`}>
          Abrir Meet
        </a>
      ) : null}
      {mandarMeet && !porCerrar ? (
        <a href={mandarMeet} target="_blank" rel="noopener noreferrer" className={`${BOTON} bg-green-600 text-white hover:bg-green-700`}>
          Mandar enlace por WhatsApp
        </a>
      ) : null}
      {!porCerrar ? (
        <AccionesDeCita
          cita={{
            id: cita.id,
            date: new Date(cita.date).toISOString(),
            status: cita.status,
            paciente: cita.patient?.name || "el paciente",
            servicio: cita.service?.title,
          }}
        />
      ) : null}
      {chat ? (
        <a href={chat} target="_blank" rel="noopener noreferrer" className={`${BOTON} border border-neutral-300 text-neutral-800 hover:bg-neutral-100`}>
          WhatsApp
        </a>
      ) : null}
    </div>
  );
}

export default function CitaDelDia({ cita, porCerrar = false, mostrarDia = false }) {
  const lugar = detalleLugarCita(cita);
  const dondeYComo = [lugar.modalidad, lugar.titulo].filter(Boolean).join(" · ");

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-bold text-brand-800">
            {formatSlotTime(cita.date)}
            {mostrarDia ? (
              <span className="ml-2 text-sm font-medium text-neutral-500">{formatDayTab(new Date(cita.date))}</span>
            ) : null}
          </p>
          <p className="truncate font-semibold text-neutral-900">{cita.patient?.name || "Paciente"}</p>
          {cita.service?.title ? <p className="text-sm text-neutral-600">{cita.service.title}</p> : null}
          {dondeYComo ? <p className="mt-1 text-xs text-neutral-500">{dondeYComo}</p> : null}
          {lugar.direccion ? <p className="text-xs text-neutral-500">{lugar.direccion}</p> : null}
        </div>
        <Etiquetas cita={cita} porCerrar={porCerrar} />
      </div>
      <Acciones cita={cita} porCerrar={porCerrar} />
    </Card>
  );
}
