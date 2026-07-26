import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/actions/auth-actions";
import MessageComposer from "@/components/admin/MessageComposer";
import MessageHistory from "@/components/admin/MessageHistory";
import { deserializarAudiencias, opcionesDeSegmentacion } from "@/lib/mensajes";
import { describirFiltro } from "@/lib/mensajes-filtro";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminMessagesPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/ingresar");

  // Secuencial: el pool es de una sola conexión (connection_limit=1).
  const mensajes = await prisma.adminMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: 25,
    select: {
      id: true,
      title: true,
      body: true,
      targetKind: true,
      targetAudiences: true,
      targetProfessionals: true,
      targetServices: true,
      targetWindow: true,
      targetWindowDays: true,
      targetIncludeCancelled: true,
      targetNegate: true,
      sentAt: true,
      recipientCount: true,
      pushSent: true,
    },
  });

  const leidos = await prisma.adminMessageRecipient.groupBy({
    by: ["messageId"],
    where: { messageId: { in: mensajes.map((m) => m.id) }, readAt: { not: null } },
    _count: { _all: true },
  });
  const leidosPorMensaje = new Map(leidos.map((l) => [l.messageId, l._count._all]));

  const usuariosActivos = await prisma.user.count({ where: { role: "USER", isActive: true } });
  const conPush = await prisma.pushSubscription.findMany({
    select: { userId: true },
    distinct: ["userId"],
  });

  const opciones = await opcionesDeSegmentacion();
  const nombres = {
    profesionales: Object.fromEntries(opciones.profesionales.map((p) => [p.id, p.nombre])),
    servicios: Object.fromEntries(opciones.servicios.map((s) => [s.id, s.nombre])),
  };

  const historial = mensajes.map((m) => ({
    id: m.id,
    titulo: m.title,
    cuerpo: m.body,
    destino:
      m.targetKind === "ALL"
        ? "Todos"
        : deserializarAudiencias(m.targetAudiences).join(", ") || "—",
    filtro: describirFiltro(
      {
        profesionales: m.targetProfessionals,
        servicios: m.targetServices,
        ventana: m.targetWindow,
        ventanaDias: m.targetWindowDays,
        incluirCanceladas: m.targetIncludeCancelled,
        negar: m.targetNegate,
      },
      nombres,
    ),
    enviadoEl: m.sentAt ? m.sentAt.toISOString() : null,
    destinatarios: m.recipientCount,
    pushSent: m.pushSent,
    leidos: leidosPorMensaje.get(m.id) || 0,
  }));

  const metricas = [
    { label: "Usuarios activos", value: usuariosActivos, help: "Alcance máximo de un comunicado" },
    { label: "Con push activo", value: conPush.length, help: "Instalaron la app y aceptaron" },
    { label: "Comunicados", value: mensajes.length, help: "Últimos 25 enviados" },
  ];

  return (
    <div className="min-h-screen bg-surface p-6">
      <div className="mx-auto max-w-5xl space-y-8">
        <div>
          <Link href="/panel/admin" className="text-sm text-neutral-500 hover:text-neutral-700">
            Panel
          </Link>
          <h1 className="text-3xl font-bold text-brand-900">Casilla de mensajes</h1>
          <p className="text-sm text-neutral-700">
            Comunicados del equipo hacia los usuarios, con acuse de lectura. Es de una sola vía: el
            usuario lee, no responde.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {metricas.map((m) => (
            <div
              key={m.label}
              className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 shadow-card"
            >
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-neutral-500">
                {m.label}
              </div>
              <div className="mt-2 text-2xl font-bold text-brand-900 tabular-nums">{m.value}</div>
              <div className="mt-1 text-xs text-neutral-600">{m.help}</div>
            </div>
          ))}
        </div>

        {conPush.length === 0 ? (
          <p className="rounded-lg border border-accent-300 bg-accent-50 px-4 py-3 text-xs text-accent-950">
            Todavía nadie instaló la app con notificaciones aceptadas, así que los comunicados
            llegarán solo al buzón dentro de la aplicación. El push empezará a funcionar solo, sin
            cambios de código, en cuanto alguien acepte.
          </p>
        ) : null}

        <MessageComposer opciones={opciones} />

        <MessageHistory mensajes={historial} />
      </div>
    </div>
  );
}
