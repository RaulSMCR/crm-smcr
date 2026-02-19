//src/components/admin/DeleteServiceButton.js
"use client";

export default function DeleteServiceButton({ action }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        const ok = window.confirm("¿Borrar servicio? Esta acción no se puede deshacer.");
        if (!ok) e.preventDefault();
      }}
    >
      <button
        type="submit"
        className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 px-3 py-2 text-sm font-semibold hover:bg-rose-100"
      >
        Eliminar servicio
      </button>
    </form>
  );
}
