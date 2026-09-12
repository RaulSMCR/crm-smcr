"use client";

import { useState, useTransition } from "react";
import { SEO_LIMITS } from "@/lib/seo";
import { useRouter } from "next/navigation";
import {
  createProfessionalHub,
  deleteProfessionalHubModule,
  saveProfessionalHubModule,
  updateProfessionalHub,
} from "@/actions/professional-hub-actions";

const FUNCTION_LABELS = {
  agenda: "Agenda",
  whatsapp: "WhatsApp",
  topics: "Temas",
  treatment: "Tratamiento destacado",
  writing: "Escritos",
  tools: "Herramientas",
  help: "Ayuda inmediata",
};

function useHubAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState(null);
  function run(action, success = "Cambios guardados.") {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await action();
        if (result?.error) setMessage({ type: "error", text: result.error });
        else {
          setMessage({ type: "success", text: success });
          router.refresh();
        }
        return result;
      } catch (error) {
        setMessage({ type: "error", text: error?.message || "No se pudo completar la operación." });
        return null;
      }
    });
  }
  return { pending, message, run };
}

function Feedback({ message }) {
  if (!message) return null;
  return <p className={`mt-3 text-sm ${message.type === "error" ? "text-red-700" : "text-emerald-700"}`} role="status">{message.text}</p>;
}

function Input({ label, name, defaultValue, type = "text", ...props }) {
  return <label className="block text-sm text-slate-700"><span className="mb-1 block font-medium">{label}</span><input name={name} type={type} defaultValue={defaultValue ?? ""} className="w-full rounded-lg border border-slate-300 px-3 py-2" {...props} /></label>;
}

/**
 * Contador de longitud contra los rangos recomendados.
 *
 * El largo importa por una razón concreta: pasado el límite, Google corta la
 * frase donde le conviene y el resultado aparece a medias. El aviso es una
 * recomendación y no un tope — quien escribe decide, pero decide informado.
 */
function Contador({ valor, limites }) {
  const largo = String(valor || "").trim().length;
  const estado = largo === 0 ? "vacío" : largo < limites.min ? "corto" : largo > limites.max ? "largo" : "ok";
  const color = estado === "ok" ? "text-emerald-700" : estado === "vacío" ? "text-slate-500" : "text-amber-700";
  return <span className={`text-xs font-semibold ${color}`}>{largo}/{limites.max}{estado === "ok" ? " ✓" : estado === "vacío" ? "" : ` · ${estado}`}</span>;
}

/**
 * Campos de control editorial de SEO, iguales para el hub y para cada módulo.
 *
 * Van vacíos a propósito: si no se escriben, el metadata se deriva del contenido
 * (`resolveSeo` en src/lib/seo.js). Lo que se escribe acá es un override, y la
 * vista previa muestra lo que se va a ver en el buscador con lo que haya.
 */
function SeoFieldset({ defaults = {}, rutaPreview, tituloFallback, descripcionFallback }) {
  const [titulo, setTitulo] = useState(defaults.metaTitle || "");
  const [descripcion, setDescripcion] = useState(defaults.metaDescription || "");
  const tituloEfectivo = titulo.trim() || tituloFallback || "";
  const descripcionEfectiva = descripcion.trim() || descripcionFallback || "";

  return (
    <fieldset className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
      <legend className="px-2 text-sm font-bold text-slate-800">SEO y buscadores</legend>
      <p className="text-xs text-slate-600">Si dejás un campo vacío, se usa el contenido de la página. Lo que escribas acá manda.</p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="block text-sm text-slate-700">
          <span className="mb-1 flex items-center justify-between gap-2"><span className="font-medium">Título SEO</span><Contador valor={tituloEfectivo} limites={SEO_LIMITS.title} /></span>
          <input name="metaTitle" value={titulo} onChange={(event) => setTitulo(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder={tituloFallback || ""} />
        </label>
        <label className="block text-sm text-slate-700">
          <span className="mb-1 block font-medium">Palabra clave objetivo</span>
          <input name="focusKeyword" defaultValue={defaults.focusKeyword || ""} className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="ataque de pánico" />
        </label>
      </div>

      <label className="mt-4 block text-sm text-slate-700">
        <span className="mb-1 flex items-center justify-between gap-2"><span className="font-medium">Meta descripción</span><Contador valor={descripcionEfectiva} limites={SEO_LIMITS.description} /></span>
        <textarea name="metaDescription" rows={2} value={descripcion} onChange={(event) => setDescripcion(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder={descripcionFallback || ""} />
      </label>

      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
        <label className="block text-sm text-slate-700">
          <span className="mb-1 block font-medium">Imagen social</span>
          <input name="ogImage" defaultValue={defaults.ogImage || ""} className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="/images/… o https://… (si va vacío se genera una)" />
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
          <input name="noindex" type="checkbox" defaultChecked={defaults.noindex === true} />
          <span>No indexar esta página</span>
        </label>
      </div>

      <div className="mt-4 rounded-lg bg-slate-50 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Así se vería en Google</p>
        <p className="mt-2 truncate text-xs text-slate-600">saludmentalcostarica.com{rutaPreview}</p>
        <p className="truncate text-base font-medium text-blue-800">{tituloEfectivo || "Sin título"}</p>
        <p className="mt-1 line-clamp-2 text-sm text-slate-700">{descripcionEfectiva || "Sin descripción: Google va a inventar una con texto de la página."}</p>
      </div>
    </fieldset>
  );
}

function CoreForm({ hub, profiles, isNew }) {
  const { pending, message, run } = useHubAction();
  const enabled = new Set(Array.isArray(hub?.enabledFunctions) ? hub.enabledFunctions : []);
  function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form);
    payload.enabledFunctions = form.getAll("enabledFunctions");
    run(async () => {
      const result = isNew ? await createProfessionalHub(payload) : await updateProfessionalHub(hub.id, payload);
      if (!result?.error && isNew && result.id) window.location.href = `/panel/admin/hubs/profesional/${result.id}`;
      return result;
    }, isNew ? "Hub creado." : "Configuración del hub guardada.");
  }

  return <section className="rounded-2xl border border-brand-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-bold text-slate-950">Identidad, publicación y funciones</h2><p className="mt-1 text-sm text-slate-600">La tarifa y la disponibilidad siguen viniendo del servicio aprobado del perfil. Aquí se configura la experiencia pública.</p><form className="mt-5 space-y-5" onSubmit={submit}><div className="grid gap-4 md:grid-cols-2"><Input label="Nombre interno" name="name" defaultValue={hub?.name} required /><Input label="Slug público" name="slug" defaultValue={hub?.slug} required pattern="[a-z0-9-]+" /><Input label="Título visible" name="title" defaultValue={hub?.title} required /><label className="block text-sm text-slate-700"><span className="mb-1 block font-medium">Perfil profesional</span><select name="profileSlug" defaultValue={hub?.profileSlug || ""} required className="w-full rounded-lg border border-slate-300 px-3 py-2"><option value="">Seleccionar perfil</option>{profiles.map((profile) => <option key={profile.id} value={profile.slug}>{profile.user?.name || profile.slug} · {profile.slug}</option>)}</select></label><Input label="WhatsApp" name="whatsapp" defaultValue={hub?.whatsapp} placeholder="506..." /><Input label="Modalidad" name="modality" defaultValue={hub?.modality} placeholder="en línea" /><Input label="Duración (minutos)" name="durationMin" type="number" min="1" defaultValue={hub?.durationMin} /><Input label="Serie destacada" name="featuredSeriesSlug" defaultValue={hub?.featuredSeriesSlug} /><Input label="Video hero" name="heroVideoUrl" defaultValue={hub?.heroVideoUrl} placeholder="/videos/... o https://..." /><Input label="Poster hero" name="heroPosterUrl" defaultValue={hub?.heroPosterUrl} placeholder="/images/..." /><Input label="Logo" name="logoUrl" defaultValue={hub?.logoUrl} placeholder="/brand/..." /><label className="block text-sm text-slate-700"><span className="mb-1 block font-medium">Estado</span><select name="status" defaultValue={hub?.status || "DRAFT"} className="w-full rounded-lg border border-slate-300 px-3 py-2"><option value="DRAFT">Borrador</option><option value="PUBLISHED">Publicado</option><option value="ARCHIVED">Archivado</option></select></label></div><label className="block text-sm text-slate-700"><span className="mb-1 block font-medium">Descripción</span><textarea name="description" rows={3} defaultValue={hub?.description || ""} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></label><fieldset><legend className="text-sm font-semibold text-slate-800">Funciones visibles del hub</legend><div className="mt-3 flex flex-wrap gap-4">{Object.entries(FUNCTION_LABELS).map(([key, label]) => <label key={key} className="flex items-center gap-2 text-sm text-slate-700"><input name="enabledFunctions" value={key} type="checkbox" defaultChecked={enabled.has(key)} />{label}</label>)}</div></fieldset><SeoFieldset defaults={hub} rutaPreview={`/${hub?.slug || ""}`} tituloFallback={hub?.title ? `${hub.title} · ${hub.name}` : hub?.name} descripcionFallback={hub?.description} /><button type="submit" disabled={pending} className="rounded-lg bg-brand-800 px-4 py-2 font-semibold text-white disabled:opacity-60">{pending ? "Guardando…" : isNew ? "Crear hub profesional" : "Guardar configuración"}</button></form><Feedback message={message} /></section>;
}

function ModuleForm({ hubId, hubSlug, module, isNew }) {
  const { pending, message, run } = useHubAction();
  const metadata = module?.metadata && typeof module.metadata === "object" ? module.metadata : {};
  function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form);
    payload.id = module?.id;
    payload.isVisible = form.get("isVisible") === "on";
    payload.isPublished = form.get("isPublished") === "on";
    run(() => saveProfessionalHubModule(hubId, payload), isNew ? "Módulo creado." : "Módulo guardado.");
    if (isNew) event.currentTarget.reset();
  }

  return <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_100px]"><Input label="Slug" name="slug" defaultValue={module?.slug} required pattern="[a-z0-9-]+" /><Input label="Título" name="title" defaultValue={module?.title} required /><label className="block text-sm text-slate-700"><span className="mb-1 block font-medium">Tipo / función</span><select name="type" defaultValue={module?.type || "TOPIC"} className="w-full rounded-lg border border-slate-300 px-3 py-2"><option value="TOPIC">Tema</option><option value="TREATMENT">Tratamiento</option><option value="CUSTOM">Contenido personalizado</option></select></label><Input label="Posición" name="position" type="number" min="0" defaultValue={module?.position || 0} /></div><label className="mt-3 block text-sm text-slate-700"><span className="mb-1 block font-medium">Resumen</span><textarea name="summary" rows={2} defaultValue={module?.summary || ""} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></label><label className="mt-3 block text-sm text-slate-700"><span className="mb-1 block font-medium">Contenido Markdown seguro</span><textarea name="body" rows={8} defaultValue={module?.body || ""} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></label><div className="mt-3 grid gap-3 md:grid-cols-2"><Input label="Fecha" name="fecha" defaultValue={metadata.fecha} /><Input label="Actualizado" name="actualizado" defaultValue={metadata.actualizado} /></div><SeoFieldset defaults={module || {}} rutaPreview={`/${hubSlug || ""}/${module?.slug || ""}`} tituloFallback={module?.title} descripcionFallback={module?.summary} /><div className="mt-3 flex flex-wrap items-center gap-4"><label className="flex items-center gap-2 text-sm"><input name="isVisible" type="checkbox" defaultChecked={module?.isVisible !== false} /> Visible</label><label className="flex items-center gap-2 text-sm"><input name="isPublished" type="checkbox" defaultChecked={module?.isPublished === true} /> Publicado</label><button type="submit" disabled={pending} className="rounded-lg bg-brand-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">{pending ? "Guardando…" : isNew ? "Añadir módulo" : "Guardar módulo"}</button>{!isNew ? <DeleteModuleButton id={module.id} pending={pending} run={run} /> : null}</div><Feedback message={message} /></form>;
}

function DeleteModuleButton({ id, pending, run }) {
  return <button type="button" disabled={pending} onClick={() => { if (window.confirm("¿Eliminar este módulo?")) run(() => deleteProfessionalHubModule(id), "Módulo eliminado."); }} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700">Eliminar</button>;
}

export default function ProfessionalHubEditor({ hub, profiles, isNew = false }) {
  return <div className="space-y-6"><CoreForm hub={hub} profiles={profiles} isNew={isNew} />{!isNew ? <section className="rounded-2xl border border-brand-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-bold text-slate-950">Módulos y contenido</h2><p className="mt-1 text-sm text-slate-600">Cada módulo puede ser un tema, un tratamiento o contenido personalizado. El estado publicado controla si aparece en el hub público.</p><div className="mt-5 space-y-4">{hub.modules.map((module) => <ModuleForm key={module.id} hubId={hub.id} hubSlug={hub.slug} module={module} />)}</div><div className="mt-5 border-t border-dashed border-brand-300 pt-5"><h3 className="font-semibold text-slate-900">Añadir módulo</h3><div className="mt-3"><ModuleForm hubId={hub.id} hubSlug={hub.slug} isNew /></div></div></section> : null}</div>;
}
