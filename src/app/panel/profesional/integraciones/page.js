import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import GoogleConnectButton from "@/components/admin/GoogleConnectButton";

export const dynamic = "force-dynamic";

export default async function IntegracionesPage({ searchParams }) {
  const session = await getSession();
  if (!session?.sub || session.role !== "PROFESSIONAL") redirect("/ingresar");

  const profile = await prisma.professionalProfile.findUnique({
    where: { userId: String(session.sub) },
    select: { id: true, googleRefreshToken: true },
  });

  if (!profile) redirect("/panel/profesional");

  const isConnected = !!profile.googleRefreshToken;
  const successParam = searchParams?.success;
  const errorParam = searchParams?.error;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Calendario e integraciones</h1>
        <p className="text-slate-500 mt-2">
          Conecte Google Calendar para sincronizar citas automáticamente y mantener un seguimiento ordenado del paciente.
        </p>
      </div>

      {/* Feedback del callback OAuth */}
      {successParam === "google_connected" && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Google Calendar conectado exitosamente. Las citas se sincronizarán automáticamente a partir de ahora.
        </div>
      )}
      {errorParam && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorParam === "google_denied"
            ? "Conexión cancelada. Puede intentarlo nuevamente cuando lo desee."
            : `Error al conectar: ${decodeURIComponent(errorParam)}`}
        </div>
      )}

      {/* Card de Google Calendar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-center gap-3">
          {/* Ícono Google */}
          <svg className="h-8 w-8" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          <div>
            <h2 className="font-semibold text-slate-800">Google Calendar</h2>
            <p className="text-xs text-slate-500">Sincronización bidireccional de citas</p>
          </div>
          <div className="ml-auto">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
              isConnected
                ? "bg-green-100 text-green-700"
                : "bg-slate-100 text-slate-500"
            }`}>
              {isConnected ? "Conectado" : "Sin conectar"}
            </span>
          </div>
        </div>

        <p className="text-sm text-slate-600">
          Al conectar su cuenta de Google, las citas creadas, modificadas o canceladas desde el sistema
          se reflejarán automáticamente en su Google Calendar. También se enviarán invitaciones a los pacientes.
        </p>

        <GoogleConnectButton isConnected={isConnected} />
      </div>
    </div>
  );
}
