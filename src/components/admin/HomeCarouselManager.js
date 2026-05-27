"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createHomeCarouselItem,
  deleteHomeCarouselItem,
  toggleHomeCarouselItem,
  updateHomeCarouselItem,
} from "@/actions/home-carousel-actions";
import Toast from "@/components/ui/Toast";

const KIND_OPTIONS = [
  { value: "ARTICLE_NEW", label: "Articulo nuevo", target: "article" },
  { value: "PROFESSIONAL_NEW", label: "Profesional nuevo", target: "professional" },
  { value: "ARTICLE_FEATURED", label: "Articulo destacado", target: "article" },
  { value: "PROFESSIONAL_FEATURED", label: "Profesional destacado", target: "professional" },
];

const KIND_LABELS = Object.fromEntries(KIND_OPTIONS.map((option) => [option.value, option.label]));
const KIND_TARGETS = Object.fromEntries(KIND_OPTIONS.map((option) => [option.value, option.target]));

function isArticleKind(kind) {
  return KIND_TARGETS[kind] === "article";
}

function StatusBadge({ active }) {
  return active ? (
    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
      Activa
    </span>
  ) : (
    <span className="rounded-full border border-neutral-200 bg-neutral-100 px-2.5 py-0.5 text-xs font-bold text-neutral-700">
      Inactiva
    </span>
  );
}

function TargetSelects({ kind, posts, professionals, defaultPostId = "", defaultProfessionalId = "" }) {
  const article = isArticleKind(kind);

  if (article) {
    return (
      <>
        <input type="hidden" name="professionalId" defaultValue="" />
        <select
          name="postId"
          defaultValue={defaultPostId || ""}
          required
          className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950"
        >
          <option value="">Seleccione articulo</option>
          {posts.map((post) => (
            <option key={post.id} value={post.id}>
              {post.title} - {post.authorName}
            </option>
          ))}
        </select>
      </>
    );
  }

  return (
    <>
      <input type="hidden" name="postId" defaultValue="" />
      <select
        name="professionalId"
        defaultValue={defaultProfessionalId || ""}
        required
        className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950"
      >
        <option value="">Seleccione profesional</option>
        {professionals.map((professional) => (
          <option key={professional.id} value={professional.id}>
            {professional.name} - {professional.specialty}
          </option>
        ))}
      </select>
    </>
  );
}

export default function HomeCarouselManager({ initialItems = [], posts = [], professionals = [] }) {
  const router = useRouter();
  const [createKind, setCreateKind] = useState("ARTICLE_NEW");
  const [rowKinds, setRowKinds] = useState(() =>
    Object.fromEntries(initialItems.map((item) => [item.id, item.kind]))
  );
  const [toast, setToast] = useState(null);
  const [isPending, startTransition] = useTransition();
  const dismissToast = useCallback(() => setToast(null), []);

  const counts = useMemo(() => {
    const next = Object.fromEntries(KIND_OPTIONS.map((option) => [option.value, { total: 0, active: 0 }]));
    for (const item of initialItems) {
      if (!next[item.kind]) continue;
      next[item.kind].total += 1;
      if (item.isActive) next[item.kind].active += 1;
    }
    return next;
  }, [initialItems]);

  function runAction(action) {
    setToast(null);
    startTransition(async () => {
      const result = await action();
      if (result?.error) {
        setToast({ message: result.error, type: "error" });
        return;
      }
      setToast({ message: "Carrusel actualizado correctamente.", type: "success" });
      router.refresh();
    });
  }

  function handleCreate(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    runAction(async () => {
      const result = await createHomeCarouselItem(formData);
      if (result?.success) {
        form.reset();
        setCreateKind("ARTICLE_NEW");
      }
      return result;
    });
  }

  function handleUpdate(event, itemId) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    runAction(() => updateHomeCarouselItem(itemId, formData));
  }

  function handleToggle(item) {
    runAction(() => toggleHomeCarouselItem(item.id, !item.isActive));
  }

  function handleDelete(item) {
    if (!window.confirm("Eliminar esta pieza del carrusel?")) return;
    runAction(() => deleteHomeCarouselItem(item.id));
  }

  const canCreateArticle = posts.length > 0;
  const canCreateProfessional = professionals.length > 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-4">
        {KIND_OPTIONS.map((option) => {
          const count = counts[option.value] || { total: 0, active: 0 };
          return (
            <div key={option.value} className="rounded-xl border border-neutral-200 bg-white p-4">
              <p className="text-xs font-bold uppercase text-neutral-500">{option.label}</p>
              <p className="mt-2 text-2xl font-bold text-neutral-950">{count.active}</p>
              <p className="text-xs text-neutral-600">{count.total} cargadas</p>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleCreate} className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-neutral-950">Agregar pieza al carrusel</h2>
          <p className="text-sm text-neutral-600">
            Las piezas activas aparecen debajo del video de guia en la pagina principal.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.1fr_1.5fr_1fr_0.7fr_auto]">
          <label className="space-y-1">
            <span className="text-xs font-bold uppercase text-neutral-600">Categoria</span>
            <select
              name="kind"
              value={createKind}
              onChange={(event) => setCreateKind(event.target.value)}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950"
            >
              {KIND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-bold uppercase text-neutral-600">
              {isArticleKind(createKind) ? "Articulo" : "Profesional"}
            </span>
            <TargetSelects kind={createKind} posts={posts} professionals={professionals} />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-bold uppercase text-neutral-600">Etiqueta opcional</span>
            <input
              name="label"
              type="text"
              placeholder={KIND_LABELS[createKind]}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-950"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-bold uppercase text-neutral-600">Orden</span>
            <input
              name="displayOrder"
              type="number"
              min="0"
              step="1"
              defaultValue="10"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-950"
            />
          </label>

          <div className="flex items-end gap-3">
            <label className="flex min-h-10 items-center gap-2 rounded-lg border border-neutral-300 bg-neutral-50 px-3 text-sm font-semibold text-neutral-800">
              <input name="isActive" type="checkbox" defaultChecked className="rounded border-neutral-300" />
              Activa
            </label>
            <button
              type="submit"
              disabled={isPending || (isArticleKind(createKind) ? !canCreateArticle : !canCreateProfessional)}
              className="min-h-10 rounded-lg bg-brand-800 px-4 text-sm font-semibold text-white transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Agregar
            </button>
          </div>
        </div>

        {!canCreateArticle || !canCreateProfessional ? (
          <p className="mt-3 text-xs text-neutral-600">
            {[
              !canCreateArticle ? "No hay articulos publicados para seleccionar." : null,
              !canCreateProfessional ? "No hay profesionales aprobados para seleccionar." : null,
            ]
              .filter(Boolean)
              .join(" ")}
          </p>
        ) : null}
      </form>

      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-200 p-5">
          <h2 className="text-lg font-bold text-neutral-950">Piezas cargadas</h2>
          <p className="text-sm text-neutral-600">
            Si una categoria no tiene piezas activas, el carrusel salta a las demas automaticamente.
          </p>
        </div>

        <div className="divide-y divide-neutral-100">
          {initialItems.map((item) => {
            const kind = rowKinds[item.id] || item.kind;
            return (
              <form
                key={item.id}
                onSubmit={(event) => handleUpdate(event, item.id)}
                className="grid gap-4 p-5 lg:grid-cols-[1.1fr_1.5fr_1fr_0.55fr_auto]"
              >
                <label className="space-y-1">
                  <span className="text-xs font-bold uppercase text-neutral-600">Categoria</span>
                  <select
                    name="kind"
                    value={kind}
                    onChange={(event) =>
                      setRowKinds((current) => ({
                        ...current,
                        [item.id]: event.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950"
                  >
                    {KIND_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <div className="pt-1">
                    <StatusBadge active={item.isActive} />
                  </div>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-bold uppercase text-neutral-600">
                    {isArticleKind(kind) ? "Articulo visible" : "Profesional visible"}
                  </span>
                  <TargetSelects
                    kind={kind}
                    posts={posts}
                    professionals={professionals}
                    defaultPostId={item.postId || ""}
                    defaultProfessionalId={item.professionalId || ""}
                  />
                  <p className="text-xs text-neutral-500">Actual: {item.targetName}</p>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-bold uppercase text-neutral-600">Etiqueta</span>
                  <input
                    name="label"
                    type="text"
                    defaultValue={item.label || ""}
                    placeholder={KIND_LABELS[kind]}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-950"
                  />
                  <label className="flex items-center gap-2 pt-1 text-xs font-semibold text-neutral-700">
                    <input name="isActive" type="checkbox" defaultChecked={item.isActive} className="rounded border-neutral-300" />
                    Mostrar en home
                  </label>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-bold uppercase text-neutral-600">Orden</span>
                  <input
                    name="displayOrder"
                    type="number"
                    min="0"
                    step="1"
                    defaultValue={item.displayOrder}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-950"
                  />
                </label>

                <div className="flex flex-wrap items-end gap-2">
                  <button
                    type="submit"
                    disabled={isPending}
                    className="min-h-10 rounded-lg bg-neutral-950 px-3 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-60"
                  >
                    Guardar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggle(item)}
                    disabled={isPending}
                    className="min-h-10 rounded-lg border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-100 disabled:opacity-60"
                  >
                    {item.isActive ? "Inactivar" : "Activar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item)}
                    disabled={isPending}
                    className="min-h-10 rounded-lg border border-red-200 bg-red-50 px-3 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
                  >
                    Eliminar
                  </button>
                </div>
              </form>
            );
          })}

          {initialItems.length === 0 ? (
            <div className="p-8 text-center text-sm text-neutral-600">
              Todavia no hay piezas cargadas para la pagina principal.
            </div>
          ) : null}
        </div>
      </div>

      <Toast message={toast?.message} type={toast?.type} onDismiss={dismissToast} />
    </div>
  );
}
