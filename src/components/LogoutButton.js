// PATH: src/components/LogoutButton.js
'use client';

import { logout } from "@/actions/auth-actions";
import { useFormStatus } from "react-dom";
import { cleanupPushAndServiceWorker } from "@/lib/mi/logout-cleanup";

function SubmitButton({ variant }) {
  const { pending } = useFormStatus();
  const isHeader = variant === "header";

  return (
    <button
      type="submit"
      disabled={pending}
      // La limpieza va en onClick (no en onSubmit del form) para no interferir
      // con el server action `logout`. El click dispara la limpieza best-effort
      // ANTES de que logout borre la cookie (así el DELETE de la suscripción va
      // autenticado); luego el form envía el server action normalmente.
      onClick={() => cleanupPushAndServiceWorker()}
      className={isHeader
        ? "inline-flex min-h-9 items-center justify-center rounded-lg border border-accent-300 bg-accent-50 px-3 py-2 text-xs font-semibold text-accent-950 transition-colors hover:bg-accent-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 disabled:opacity-50 sm:text-sm"
        : "flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-600 transition-colors hover:bg-red-50 hover:text-red-800 disabled:opacity-50"}
    >
      {pending ? "Saliendo..." : isHeader ? "Cerrar sesión" : "🚪 Cerrar Sesión"}
    </button>
  );
}

export default function LogoutButton({ variant = "default" }) {
  return (
    <form action={logout}>
      <SubmitButton variant={variant} />
    </form>
  );
}
