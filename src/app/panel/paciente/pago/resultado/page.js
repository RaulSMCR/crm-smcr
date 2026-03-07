// src/app/panel/paciente/pago/resultado/page.js
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/actions/auth-actions";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PagoResultadoPage({ searchParams }) {
  const session = await getSession();
  if (!session) redirect("/ingresar");
  if (session.role !== "USER") redirect("/panel");

  const ref = String(searchParams?.ref || "").trim();

  let transaction = null;
  if (ref) {
    transaction = await prisma.paymentTransaction.findFirst({
      where: { p2pReference: ref },
      include: {
        appointment: {
          select: {
            date: true,
            service: { select: { title: true } },
            professional: { select: { user: { select: { name: true } } } },
          },
        },
      },
    });
  }

  const status = transaction?.status;

  const isApproved = status === "APPROVED";
  const isPending = !status || status === "PENDING" || status === "PROCESSING";
  const isRejected = status === "REJECTED";

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm text-center">
        {isApproved && (
          <>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <svg className="h-8 w-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Pago exitoso</h1>
            <p className="mt-2 text-slate-600">
              El pago fue procesado correctamente. Se enviará un correo de confirmación para continuar con el proceso.
            </p>
          </>
        )}

        {isPending && (
          <>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
              <svg className="h-8 w-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Pago en proceso</h1>
            <p className="mt-2 text-slate-600">
              El pago está siendo verificado. Se enviará una notificación cuando sea confirmado.
            </p>
          </>
        )}

        {isRejected && (
          <>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Pago rechazado</h1>
            <p className="mt-2 text-slate-600">
              El pago no pudo procesarse. Puede intentarlo nuevamente desde el panel para continuar.
            </p>
          </>
        )}

        {transaction?.appointment && (
          <div className="mt-6 rounded-xl bg-slate-50 p-4 text-left text-sm text-slate-700">
            <p className="font-semibold">{transaction.appointment.service?.title || "Consulta"}</p>
            <p className="text-slate-500">
              con {transaction.appointment.professional?.user?.name}
            </p>
            <p className="mt-1 text-slate-500">
              Monto: â‚¡{Number(transaction.amount).toLocaleString("es-CR")}
            </p>
          </div>
        )}

        <div className="mt-6">
          <Link
            href="/panel/paciente"
            className="inline-block rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Volver a mis citas
          </Link>
        </div>
      </div>
    </div>
  );
}

