"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTopicHub } from "@/actions/topic-actions";

export default function TopicHubCreateForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(null);

  function submit(event) {
    event.preventDefault();
    setError(null);
    const data = Object.fromEntries(new FormData(event.currentTarget));
    startTransition(async () => {
      const result = await createTopicHub({ ...data, order: Number(data.order || 0), featured: data.featured === "on" });
      if (result?.error) setError(result.error);
      else router.push(`/panel/admin/temas/${result.id}`);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm text-slate-700"><span className="mb-1 block font-medium">Nombre interno</span><input name="name" required className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Ej. Ansiedad" /></label>
        <label className="text-sm text-slate-700"><span className="mb-1 block font-medium">Slug raíz</span><input name="slug" required pattern="[a-z0-9-]+" className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="ansiedad" /></label>
      </div>
      <p className="text-sm text-slate-600">El resto del contenido se completa en el editor. El hub se crea como borrador y no se indexa.</p>
      {error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}
      <button disabled={pending} className="rounded-lg bg-brand-800 px-4 py-2 font-semibold text-white disabled:opacity-60">{pending ? "Creando…" : "Crear hub borrador"}</button>
    </form>
  );
}
