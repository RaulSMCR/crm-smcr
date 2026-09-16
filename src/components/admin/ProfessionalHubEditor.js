"use client";

import { useState, useTransition } from "react";
import { SEO_LIMITS } from "@/lib/seo";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import HubMarkdownIngest from "@/components/admin/HubMarkdownIngest";
import HubModuleOrder from "@/components/admin/HubModuleOrder";
import {
  BarraDeGuardado,
  InformeDeGuardado,
  ProveedorDeGuardado,
  useFormularioGuardable,
  useGeneracion,
} from "@/components/admin/GuardadoDeFormularios";
import { SLUG_COPY_HUB } from "@/lib/hub-markdown";
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

// ─── Qué campos vigila «guardar todos los cambios» ──────────────────────────
//
// El mapa es explícito y no se deduce del formulario: dentro del formulario de
// un módulo vive el bloque de ingesta de `.md`, con su selector y su input de
// archivo, y leer «todo lo que haya» contaría esos controles como ediciones del
// módulo. La etiqueta es la que se lee en la barra y en el informe, así que
// tiene que decir lo mismo que el rótulo del campo.

const CAMPOS_SEO = {
  metaTitle: { etiqueta: "Título SEO" },
  focusKeyword: { etiqueta: "Palabra clave objetivo" },
  metaDescription: { etiqueta: "Meta descripción" },
  ogImage: { etiqueta: "Imagen social" },
  noindex: { etiqueta: "No indexar", tipo: "casilla" },
};

const CAMPOS_HUB = {
  name: { etiqueta: "Nombre interno" },
  slug: { etiqueta: "Slug público" },
  title: { etiqueta: "Título visible" },
  profileSlug: { etiqueta: "Perfil profesional" },
  whatsapp: { etiqueta: "WhatsApp" },
  modality: { etiqueta: "Modalidad" },
  durationMin: { etiqueta: "Duración" },
  featuredSeriesSlug: { etiqueta: "Serie destacada" },
  heroVideoUrl: { etiqueta: "Video hero" },
  heroPosterUrl: { etiqueta: "Poster hero" },
  logoUrl: { etiqueta: "Logo" },
  status: { etiqueta: "Estado" },
  description: { etiqueta: "Descripción" },
  enabledFunctions: { etiqueta: "Funciones visibles", tipo: "lista" },
  ...CAMPOS_SEO,
};

const CAMPOS_MODULO = {
  slug: { etiqueta: "Slug" },
  title: { etiqueta: "Título" },
  type: { etiqueta: "Tipo" },
  summary: { etiqueta: "Resumen" },
  body: { etiqueta: "Contenido" },
  fecha: { etiqueta: "Fecha" },
  actualizado: { etiqueta: "Actualizado" },
  isVisible: { etiqueta: "Visible", tipo: "casilla" },
  isPublished: { etiqueta: "Publicado", tipo: "casilla" },
  ...CAMPOS_SEO,
};

/**
 * El payload de cada acción, leído del formulario.
 *
 * Vive aparte del `submit` porque ahora hay dos formas de guardar lo mismo: el
 * botón del formulario y la barra del final, que lo guarda sin que nadie envíe
 * el formulario.
 */
function payloadDelHub(form) {
  const datos = new FormData(form);
  const payload = Object.fromEntries(datos);
  payload.enabledFunctions = datos.getAll("enabledFunctions");
  return payload;
}

function payloadDelModulo(form, moduleId) {
  const datos = new FormData(form);
  const payload = Object.fromEntries(datos);
  payload.id = moduleId;
  payload.isVisible = datos.get("isVisible") === "on";
  payload.isPublished = datos.get("isPublished") === "on";
  return payload;
}

function useHubAction() {
  const router = useRouter();
  const { avisar } = useToast();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState(null);
  function run(action, success = "Cambios guardados.") {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await action();
        if (result?.error) {
          setMessage({ type: "error", text: result.error });
          avisar(result.error, "error");
        } else {
          setMessage({ type: "success", text: success });
          avisar(success, "success");
          router.refresh();
        }
        return result;
      } catch (error) {
        const texto = error?.message || "No se pudo completar la operación.";
        setMessage({ type: "error", text: texto });
        avisar(texto, "error");
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
  // El alta no se acumula: un hub que todavía no existe no puede esperar a que
  // alguien baje hasta la barra del final.
  const { ref, alEditar, sincronizar } = useFormularioGuardable({
    id: "hub",
    nombre: "Configuración del hub",
    campos: CAMPOS_HUB,
    guardar: (form) => updateProfessionalHub(hub.id, payloadDelHub(form)),
    activo: !isNew,
  });

  function submit(event) {
    event.preventDefault();
    const payload = payloadDelHub(event.currentTarget);
    run(async () => {
      const result = isNew ? await createProfessionalHub(payload) : await updateProfessionalHub(hub.id, payload);
      if (!result?.error && isNew && result.id) window.location.href = `/panel/admin/hubs/profesional/${result.id}`;
      // Lo guardado deja de contar como pendiente en la barra: este formulario
      // no se remonta con el refresco, así que hay que decírselo.
      if (!result?.error && !isNew) sincronizar();
      return result;
    }, isNew ? "Hub creado." : "Configuración del hub guardada.");
  }

  return <section className="rounded-2xl border border-brand-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-bold text-slate-950">Identidad, publicación y funciones</h2><p className="mt-1 text-sm text-slate-600">La tarifa y la disponibilidad siguen viniendo del servicio aprobado del perfil. Aquí se configura la experiencia pública.</p><form ref={ref} onChange={alEditar} className="mt-5 space-y-5" onSubmit={submit}><div className="grid gap-4 md:grid-cols-2"><Input label="Nombre interno" name="name" defaultValue={hub?.name} required /><Input label="Slug público" name="slug" defaultValue={hub?.slug} required pattern="[a-z0-9-]+" /><Input label="Título visible" name="title" defaultValue={hub?.title} required /><label className="block text-sm text-slate-700"><span className="mb-1 block font-medium">Perfil profesional</span><select name="profileSlug" defaultValue={hub?.profileSlug || ""} required className="w-full rounded-lg border border-slate-300 px-3 py-2"><option value="">Seleccionar perfil</option>{profiles.map((profile) => <option key={profile.id} value={profile.slug}>{profile.user?.name || profile.slug} · {profile.slug}</option>)}</select></label><Input label="WhatsApp" name="whatsapp" defaultValue={hub?.whatsapp} placeholder="506..." /><Input label="Modalidad" name="modality" defaultValue={hub?.modality} placeholder="en línea" /><Input label="Duración (minutos)" name="durationMin" type="number" min="1" defaultValue={hub?.durationMin} /><Input label="Serie destacada" name="featuredSeriesSlug" defaultValue={hub?.featuredSeriesSlug} /><Input label="Video hero" name="heroVideoUrl" defaultValue={hub?.heroVideoUrl} placeholder="/videos/... o https://..." /><Input label="Poster hero" name="heroPosterUrl" defaultValue={hub?.heroPosterUrl} placeholder="/images/..." /><Input label="Logo" name="logoUrl" defaultValue={hub?.logoUrl} placeholder="/brand/..." /><label className="block text-sm text-slate-700"><span className="mb-1 block font-medium">Estado</span><select name="status" defaultValue={hub?.status || "DRAFT"} className="w-full rounded-lg border border-slate-300 px-3 py-2"><option value="DRAFT">Borrador</option><option value="PUBLISHED">Publicado</option><option value="ARCHIVED">Archivado</option></select></label></div><label className="block text-sm text-slate-700"><span className="mb-1 block font-medium">Descripción</span><textarea name="description" rows={3} defaultValue={hub?.description || ""} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></label><fieldset><legend className="text-sm font-semibold text-slate-800">Funciones visibles del hub</legend><div className="mt-3 flex flex-wrap gap-4">{Object.entries(FUNCTION_LABELS).map(([key, label]) => <label key={key} className="flex items-center gap-2 text-sm text-slate-700"><input name="enabledFunctions" value={key} type="checkbox" defaultChecked={enabled.has(key)} />{label}</label>)}</div></fieldset><SeoFieldset defaults={hub} rutaPreview={`/${hub?.slug || ""}`} tituloFallback={hub?.title ? `${hub.title} · ${hub.name}` : hub?.name} descripcionFallback={hub?.description} /><button type="submit" disabled={pending} className="rounded-lg bg-brand-800 px-4 py-2 font-semibold text-white disabled:opacity-60">{pending ? "Guardando…" : isNew ? "Crear hub profesional" : "Guardar configuración"}</button></form><Feedback message={message} /></section>;
}

function ModuleForm({ hubId, hubSlug, module, isNew }) {
  const { pending, message, run } = useHubAction();
  const metadata = module?.metadata && typeof module.metadata === "object" ? module.metadata : {};
  // Añadir un módulo sigue siendo inmediato: lo que se acumula son ediciones de
  // lo que ya existe.
  const { ref, alEditar, sincronizar } = useFormularioGuardable({
    id: `modulo:${module?.id || "nuevo"}`,
    nombre: `Módulo · ${module?.title || module?.slug || ""}`,
    campos: CAMPOS_MODULO,
    guardar: (form) => saveProfessionalHubModule(hubId, payloadDelModulo(form, module?.id)),
    activo: !isNew,
  });

  function submit(event) {
    event.preventDefault();
    const payload = payloadDelModulo(event.currentTarget, module?.id);
    run(async () => {
      const result = await saveProfessionalHubModule(hubId, payload);
      if (!result?.error && !isNew) sincronizar();
      return result;
    }, isNew ? "Módulo creado." : "Módulo guardado.");
    if (isNew) event.currentTarget.reset();
  }

  return <form ref={ref} onChange={alEditar} onSubmit={submit} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="grid gap-3 md:grid-cols-3"><Input label="Slug" name="slug" defaultValue={module?.slug} required pattern="[a-z0-9-]+" /><Input label="Título" name="title" defaultValue={module?.title} required /><label className="block text-sm text-slate-700"><span className="mb-1 block font-medium">Tipo / función</span><select name="type" defaultValue={module?.type || "TOPIC"} className="w-full rounded-lg border border-slate-300 px-3 py-2"><option value="TOPIC">Tema</option><option value="TREATMENT">Tratamiento</option><option value="CUSTOM">Contenido personalizado</option></select></label></div><label className="mt-3 block text-sm text-slate-700"><span className="mb-1 block font-medium">Resumen</span><textarea name="summary" rows={2} defaultValue={module?.summary || ""} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></label><label className="mt-3 block text-sm text-slate-700"><span className="mb-1 block font-medium">Contenido Markdown seguro</span><textarea name="body" rows={8} defaultValue={module?.body || ""} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></label>{!isNew && module?.slug && module.slug !== SLUG_COPY_HUB ? <HubMarkdownIngest hubId={hubId} hubSlug={hubSlug} destino={module.slug} compacto /> : null}<div className="mt-3 grid gap-3 md:grid-cols-2"><Input label="Fecha" name="fecha" defaultValue={metadata.fecha} /><Input label="Actualizado" name="actualizado" defaultValue={metadata.actualizado} /></div><SeoFieldset defaults={module || {}} rutaPreview={`/${hubSlug || ""}/${module?.slug || ""}`} tituloFallback={module?.title} descripcionFallback={module?.summary} /><div className="mt-3 flex flex-wrap items-center gap-4"><label className="flex items-center gap-2 text-sm"><input name="isVisible" type="checkbox" defaultChecked={module?.isVisible !== false} /> Visible</label><label className="flex items-center gap-2 text-sm"><input name="isPublished" type="checkbox" defaultChecked={module?.isPublished === true} /> Publicado</label><button type="submit" disabled={pending} className="rounded-lg bg-brand-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">{pending ? "Guardando…" : isNew ? "Añadir módulo" : "Guardar módulo"}</button>{!isNew ? <DeleteModuleButton id={module.id} pending={pending} run={run} /> : null}</div><Feedback message={message} /></form>;
}

function DeleteModuleButton({ id, pending, run }) {
  return <button type="button" disabled={pending} onClick={() => { if (window.confirm("¿Eliminar este módulo?")) run(() => deleteProfessionalHubModule(id), "Módulo eliminado."); }} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700">Eliminar</button>;
}

/**
 * El editor completo.
 *
 * `generacion` va en las `key`: es lo que hace que «Descartar» devuelva de
 * verdad los formularios a lo que dice el servidor. Reescribirles el DOM no
 * alcanzaría, porque el bloque de SEO tiene campos controlados que volverían a
 * pintar su propio estado en el render siguiente.
 */
function CuerpoDelEditor({ hub, profiles, isNew }) {
  const generacion = useGeneracion();
  if (isNew) return <div className="space-y-6"><CoreForm hub={hub} profiles={profiles} isNew /></div>;

  const modulos = hub.modules.filter((module) => module.slug !== SLUG_COPY_HUB);

  return <div className="space-y-6"><CoreForm key={`hub:${generacion}`} hub={hub} profiles={profiles} isNew={false} /><HubMarkdownIngest hubId={hub.id} hubSlug={hub.slug} modulos={modulos.map((module) => ({ slug: module.slug, title: module.title }))} /><HubModuleOrder key={`orden:${generacion}`} hubId={hub.id} hubSlug={hub.slug} modulos={modulos} /><section className="rounded-2xl border border-brand-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-bold text-slate-950">Módulos y contenido</h2><p className="mt-1 text-sm text-slate-600">Cada módulo puede ser un tema, un tratamiento o contenido personalizado. El estado publicado controla si aparece en el hub público, y el orden se decide arriba.</p><div className="mt-5 space-y-4">{hub.modules.map((module) => <ModuleForm key={`${module.id}:${module.updatedAt || ""}:${generacion}`} hubId={hub.id} hubSlug={hub.slug} module={module} />)}</div><div className="mt-5 border-t border-dashed border-brand-300 pt-5"><h3 className="font-semibold text-slate-900">Añadir módulo</h3><div className="mt-3"><ModuleForm hubId={hub.id} hubSlug={hub.slug} isNew /></div></div></section><InformeDeGuardado /><BarraDeGuardado /></div>;
}

export default function ProfessionalHubEditor({ hub, profiles, isNew = false }) {
  return <ProveedorDeGuardado><CuerpoDelEditor hub={hub} profiles={profiles} isNew={isNew} /></ProveedorDeGuardado>;
}
