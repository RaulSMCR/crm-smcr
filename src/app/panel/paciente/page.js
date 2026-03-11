import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/actions/auth-actions";
import PatientProfileEditorCard from "@/components/paciente/PatientProfileEditorCard";
import UserAppointmentsPanel from "@/components/UserAppointmentsPanel";
import Link from "next/link";

export const dynamic = "force-dynamic";

function birthDateForInput(birthDate) {
  if (!birthDate) return "";
  if (birthDate instanceof Date) return birthDate.toISOString().slice(0, 10);
  const s = String(birthDate);
  return s.includes("T") ? s.slice(0, 10) : s;
}

export default async function PacientePanelPage({ searchParams }) {
  const session = await getSession();
  if (!session) redirect("/ingresar");
  if (session.role !== "USER") redirect("/panel");

  const userId = String(session.userId || session.sub);

  const [user, appointments] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        identification: true,
        birthDate: true,
        gender: true,
        interests: true,
      },
    }),
    prisma.appointment.findMany({
      where: { patientId: userId },
      orderBy: { date: "asc" },
      include: {
        professional: {
          include: {
            user: {
              select: { name: true, image: true },
            },
          },
        },
        service: {
          select: { title: true },
        },
        paymentTransactions: {
          where: { status: { in: ["PENDING", "PROCESSING"] } },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { p2pProcessUrl: true, amount: true, type: true },
        },
      },
    }),
  ]);

  if (!user) redirect("/ingresar");

  const userForClient = { ...user, birthDate: birthDateForInput(user.birthDate) };
  const created = String(searchParams?.created || "") === "1";
  const appointmentAction = String(searchParams?.appointmentAction || "");
  const appointmentId = String(searchParams?.appointmentId || "");
  const unpaidAppointmentsCount = appointments.filter((appointment) => {
    const appointmentDate = new Date(appointment.date).getTime();
    const isPastOrCompleted =
      appointment.status === "COMPLETED" || appointmentDate <= Date.now();
    return appointment.paymentStatus !== "PAID" && isPastOrCompleted;
  }).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 md:p-10">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Panel del paciente</h1>
          <p className="mt-2 text-slate-600">Citas e informacion personal.</p>
        </div>

        <Link
          href="/servicios"
          className="rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
        >
          Agendar nueva cita
        </Link>
      </div>

      {created ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Cita creada con exito. El proceso de atencion continua.
        </div>
      ) : null}

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
          Citas sin pagar
        </p>
        <p className="mt-2 text-3xl font-bold text-amber-900">{unpaidAppointmentsCount}</p>
        <p className="mt-1 text-sm text-amber-800">
          Citas finalizadas o vencidas que siguen con saldo pendiente.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-xl font-bold text-slate-900">Mis citas</h2>

            <UserAppointmentsPanel
              initialAppointments={appointments}
              initialAction={appointmentAction}
              initialActionAppointmentId={appointmentId}
            />
          </div>
        </div>

        <PatientProfileEditorCard user={userForClient} />
      </div>
    </div>
  );
}
