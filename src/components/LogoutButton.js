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
      className="text-red-600 font-bold hover:text-red-800 text-sm border border-red-200 bg-white px-4 py-2 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-2 disabled:opacity-50"
    >
      {pending ? "Saliendo..." : "🚪 Cerrar Sesión"}
    </button>
  );
}

export default function LogoutButton() {
  return (
    <form
      action={logout}
      onSubmit={() => {
        // Best-effort, no bloquea ni pospone el submit (sin preventDefault):
        // no-op fuera de /mi (ver cleanupPushAndServiceWorker).
        cleanupPushAndServiceWorker();
      }}
    >
      <SubmitButton />
    </form>
  );
}
