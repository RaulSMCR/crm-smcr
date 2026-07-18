// PATH: src/components/LogoutButton.js
'use client';

import { logout } from "@/actions/auth-actions";
import { useFormStatus } from "react-dom";
import { cleanupPushAndServiceWorker } from "@/lib/mi/logout-cleanup";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      // La limpieza va en onClick (no en onSubmit del form) para no interferir
      // con el server action `logout`. El click dispara la limpieza best-effort
      // ANTES de que logout borre la cookie (así el DELETE de la suscripción va
      // autenticado); luego el form envía el server action normalmente.
      onClick={() => cleanupPushAndServiceWorker()}
      className="text-red-600 font-bold hover:text-red-800 text-sm border border-red-200 bg-white px-4 py-2 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-2 disabled:opacity-50"
    >
      {pending ? "Saliendo..." : "🚪 Cerrar Sesión"}
    </button>
  );
}

export default function LogoutButton() {
  return (
    <form action={logout}>
      <SubmitButton />
    </form>
  );
}
