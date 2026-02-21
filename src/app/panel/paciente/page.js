// src/app/panel/paciente/page.js
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/actions/auth-actions";
import PatientProfileEditorCard from "@/components/paciente/PatientProfileEditorCard";
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
      include: {
        service: true,
        professional: { include: { user: true } },
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

            {appointments.length === 0 ? (
              <p className="mt-3 text-slate-700">
                Aún no tienes citas. Ve a{" "}
                <Link href="/servicios" className="text-blue-600 hover:underline">
                  Servicios
                </Link>{" "}
                para agendar.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {appointments.map((a) => (
                  <div key={a.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-semibold text-slate-900">{a.service?.title || "Cita"}</div>
                        <div className="text-sm text-slate-600">
                          Con <b>{a.professional?.user?.name}</b> · {a.professional?.specialty}
                        </div>
                        <div className="text-sm text-slate-700 mt-2">
                          {new Date(a.date).toLocaleString()} –{" "}
                          {new Date(a.endDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>

                      <div className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                        {String(a.status)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <PatientProfileEditorCard user={userForClient} />
      </div>
    </div>
  );
}
