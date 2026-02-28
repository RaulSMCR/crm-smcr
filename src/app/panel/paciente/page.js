// src/app/panel/paciente/page.js
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
      select: {
        id: true,
        date: true,
        endDate: true,
        status: true,
        pricePaid: true,
        service: {
          select: {
            title: true,
          },
        },
        professional: {
          include: {
            user: true,
          },
        },
      },
      orderBy: { date: "desc" },
    }),
  ]);

  if (!user) redirect("/ingresar");

  const userForClient = { ...user, birthDate: birthDateForInput(user.birthDate) };
  const created = String(searchParams?.created || "") === "1";

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-10 space-y-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Panel del paciente</h1>
          <p className="text-slate-600 mt-2">Tus citas y tu información.</p>
        </div>

        <Link
          href="/servicios"
          className="rounded-xl bg-blue-600 text-white px-4 py-2 font-semibold hover:bg-blue-700"
        >
          Agendar nueva cita
        </Link>
      </div>

      {created && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          ✅ Tu cita fue creada correctamente.
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-xl font-bold text-slate-900">Mis citas</h2>

            <UserAppointmentsPanel initialAppointments={appointments} />
          </div>
        </div>

        <PatientProfileEditorCard user={userForClient} />
      </div>
    </div>
  );
}
