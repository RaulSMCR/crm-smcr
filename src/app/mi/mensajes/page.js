import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { buzonDe } from "@/lib/mensajes";
import MessageInbox from "@/components/mi/MessageInbox";

export const dynamic = "force-dynamic";

export const metadata = { title: "Mensajes" };

export default async function MiMensajesPage() {
  const session = await getSession();
  if (!session) redirect("/ingresar?next=/mi/mensajes");
  if (session.role !== "USER") redirect("/panel");

  const mensajes = await buzonDe(session.sub);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-brand-800">Mensajes</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Comunicados del equipo de Salud Mental Costa Rica.
        </p>
      </header>

      <MessageInbox
        mensajes={mensajes.map((m) => ({
          ...m,
          enviadoEl: m.enviadoEl ? m.enviadoEl.toISOString() : null,
        }))}
      />
    </div>
  );
}
