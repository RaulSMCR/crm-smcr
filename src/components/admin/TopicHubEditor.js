"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  archiveTopic,
  deleteTopicFaq,
  deleteTopicPerspective,
  deleteTopicSection,
  linkTopicRelation,
  publishTopic,
  removeTopicPost,
  removeTopicService,
  saveTopicFaq,
  saveTopicPerspective,
  saveTopicPost,
  saveTopicSection,
  saveTopicService,
  unlinkTopicRelation,
  updateTopicHub,
  updateTopicPerspective,
} from "@/actions/topic-actions";
import { topicSectionLabel } from "@/lib/topic";

function useTopicAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState(null);
  function run(action) {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (result?.error) setMessage({ type: "error", text: result.error });
      else {
        setMessage({ type: "success", text: "Cambios guardados." });
        router.refresh();
      }
    });
  }
  return { pending, message, run };
}

function Feedback({ message }) {
  if (!message) return null;
  return <p className={`mt-3 text-sm ${message.type === "error" ? "text-red-700" : "text-emerald-700"}`} role="status">{message.text}</p>;
}

function Field({ label, name, defaultValue, type = "text", ...props }) {
  return (
    <label className="block text-sm text-slate-700">
      <span className="mb-1 block font-medium">{label}</span>
      <input name={name} type={type} defaultValue={defaultValue || ""} className="w-full rounded-lg border border-slate-300 px-3 py-2" {...props} />
    </label>
  );
}

function CoreForm({ topic }) {
  const { pending, message, run } = useTopicAction();
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold text-slate-950">Identidad y SEO</h2>
      <p className="mt-1 text-sm text-slate-600">El estado publicado se valida con los contenidos relacionados antes de hacerse visible.</p>
      <form className="mt-5 space-y-4" onSubmit={(event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); run(() => updateTopicHub(topic.id, { ...data, featured: data.featured === "on", order: Number(data.order || 0) })); }}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nombre interno" name="name" defaultValue={topic.name} required />
          <Field label="Slug raíz" name="slug" defaultValue={topic.slug} required pattern="[a-z0-9-]+" />
          <Field label="Título visible (H1)" name="title" defaultValue={topic.title} required />
          <Field label="Subtítulo" name="subtitle" defaultValue={topic.subtitle} />
          <Field label="Imagen hero" name="heroImage" defaultValue={topic.heroImage} placeholder="URL o ruta pública" />
          <Field label="Texto alternativo de la imagen" name="heroImageAlt" defaultValue={topic.heroImageAlt} />
          <Field label="Video de introducción" name="introVideoUrl" defaultValue={topic.introVideoUrl} placeholder="https://..." />
          <Field label="Podcast / audio" name="podcastUrl" defaultValue={topic.podcastUrl} placeholder="https://..." />
          <Field label="Título SEO" name="metaTitle" defaultValue={topic.metaTitle} required />
          <Field label="Orden del hub" name="order" type="number" min="0" defaultValue={topic.order} />
        </div>
        <label className="block text-sm text-slate-700"><span className="mb-1 block font-medium">Extracto</span><textarea name="excerpt" rows={3} defaultValue={topic.excerpt || ""} className="w-full rounded-lg border border-slate-300 px-3 py-2" required /></label>
        <label className="block text-sm text-slate-700"><span className="mb-1 block font-medium">Meta description</span><textarea name="metaDescription" rows={3} defaultValue={topic.metaDescription || ""} className="w-full rounded-lg border border-slate-300 px-3 py-2" required /></label>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-700"><input name="featured" type="checkbox" defaultChecked={topic.featured} /> Hub destacado</label>
          <label className="flex items-center gap-2 text-sm text-slate-700">Estado <select name="status" defaultValue={topic.status} className="rounded-lg border border-slate-300 px-3 py-2"><option value="DRAFT">Borrador</option><option value="ARCHIVED">Archivado</option><option value="PUBLISHED">Publicado</option></select></label>
          <button type="submit" disabled={pending} className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-60">{pending ? "Guardando…" : "Guardar identidad"}</button>
        </div>
      </form>
      <Feedback message={message} />
    </section>
  );
}

function SectionsEditor({ topic }) {
  const { pending, message, run } = useTopicAction();
  const [newType, setNewType] = useState("EDITORIAL_INTRO");
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold text-slate-950">Secciones del hub</h2>
      <p className="mt-1 text-sm text-slate-600">El orden es editorial. El cuerpo admite Markdown seguro; no se interpreta HTML ni código.</p>
      <div className="mt-5 space-y-4">
        {topic.sections.map((section) => (
          <form key={section.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4" onSubmit={(event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); run(() => saveTopicSection(topic.id, { ...data, id: section.id, position: Number(data.position || 0), isVisible: data.isVisible === "on" })); }}>
            <div className="grid gap-3 md:grid-cols-[1.3fr_2fr_100px_auto] md:items-end">
              <label className="text-sm text-slate-700"><span className="mb-1 block font-medium">Tipo</span><select name="type" defaultValue={section.type} className="w-full rounded-lg border border-slate-300 px-3 py-2">{["HERO","USER_SITUATIONS","EDITORIAL_INTRO","FEATURED_ARTICLES","EXPLORE_TOPIC","PERSPECTIVES","VIDEO","PODCAST","FAQ","PROFESSIONALS","SERVICES","RELATED_TOPICS","CTA","CUSTOM_RICH_TEXT"].map((type) => <option key={type} value={type}>{topicSectionLabel(type)}</option>)}</select></label>
              <Field label="Título de sección" name="title" defaultValue={section.title} />
              <Field label="Posición" name="position" type="number" min="0" defaultValue={section.position} />
              <label className="flex items-center gap-2 pb-2 text-sm text-slate-700"><input name="isVisible" type="checkbox" defaultChecked={section.isVisible} /> Visible</label>
            </div>
            <textarea name="body" rows={4} defaultValue={section.body || ""} className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Contenido Markdown de la sección (si corresponde)" />
            <div className="mt-3 flex gap-3"><button type="submit" disabled={pending} className="rounded-lg bg-brand-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">Guardar sección</button><button type="button" disabled={pending} onClick={() => run(() => deleteTopicSection(section.id))} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700">Eliminar</button></div>
          </form>
        ))}
      </div>
      <form className="mt-5 rounded-xl border border-dashed border-brand-300 p-4" onSubmit={(event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); run(() => saveTopicSection(topic.id, { ...data, type: newType, position: Number(data.position || 0), isVisible: true })); event.currentTarget.reset(); }}>
        <p className="text-sm font-semibold text-slate-800">Añadir sección</p>
        <div className="mt-3 grid gap-3 md:grid-cols-[1.3fr_2fr_100px_auto] md:items-end">
          <label className="text-sm text-slate-700"><span className="mb-1 block font-medium">Tipo</span><select value={newType} onChange={(event) => setNewType(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2">{["USER_SITUATIONS","EDITORIAL_INTRO","FEATURED_ARTICLES","EXPLORE_TOPIC","PERSPECTIVES","VIDEO","PODCAST","FAQ","PROFESSIONALS","SERVICES","RELATED_TOPICS","CTA","CUSTOM_RICH_TEXT"].map((type) => <option key={type} value={type}>{topicSectionLabel(type)}</option>)}</select></label>
          <Field label="Título" name="title" />
          <Field label="Posición" name="position" type="number" min="0" defaultValue="0" />
          <button type="submit" disabled={pending} className="rounded-lg bg-accent-500 px-3 py-2 text-sm font-bold text-accent-950">Añadir</button>
        </div>
        <textarea name="body" rows={3} className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Contenido Markdown" />
      </form>
      <Feedback message={message} />
    </section>
  );
}

function RelationsEditor({ topic, options }) {
  const { pending, message, run } = useTopicAction();
  const [postId, setPostId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [targetId, setTargetId] = useState("");
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold text-slate-950">Contenido relacionado</h2>
      <div className="mt-5 grid gap-6 lg:grid-cols-3">
        <div>
          <h3 className="font-semibold text-slate-900">Artículos</h3>
          <form className="mt-3 space-y-2" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); run(() => saveTopicPost(topic.id, postId, { role: data.get("role"), featured: data.get("featured") === "on", position: Number(data.get("position") || 0) })); }}>
            <select value={postId} onChange={(event) => setPostId(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2"><option value="">Seleccionar artículo</option>{options.posts.map((post) => <option key={post.id} value={post.id}>{post.title} ({post.status})</option>)}</select>
            <select name="role" defaultValue="SUPPORTING" className="w-full rounded-lg border border-slate-300 px-3 py-2"><option value="PRIMARY">Principal</option><option value="SUPPORTING">Apoyo</option></select>
            <div className="flex gap-2"><input name="position" type="number" min="0" defaultValue="0" className="w-24 rounded-lg border border-slate-300 px-3 py-2" /><label className="flex items-center gap-2 text-sm"><input name="featured" type="checkbox" /> Destacado</label><button disabled={pending} className="ml-auto rounded-lg bg-brand-800 px-3 py-2 text-sm font-semibold text-white">Asignar</button></div>
          </form>
          <ul className="mt-4 space-y-2 text-sm">{topic.posts.map((item) => <li key={`${item.postId}-${item.topicId}`} className="flex items-start justify-between gap-2 rounded-lg bg-slate-50 p-2"><span>{item.post.title}<br /><small className="text-slate-500">{item.role}{item.featured ? " · destacado" : ""}</small></span><button type="button" onClick={() => run(() => removeTopicPost(topic.id, item.postId))} className="text-red-700">×</button></li>)}</ul>
        </div>
        <div>
          <h3 className="font-semibold text-slate-900">Servicios</h3>
          <form className="mt-3 space-y-2" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); run(() => saveTopicService(topic.id, serviceId, { featured: data.get("featured") === "on", position: Number(data.get("position") || 0) })); }}>
            <select value={serviceId} onChange={(event) => setServiceId(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2"><option value="">Seleccionar servicio</option>{options.services.map((service) => <option key={service.id} value={service.id}>{service.title}{service.isActive ? "" : " (inactivo)"}</option>)}</select>
            <div className="flex gap-2"><input name="position" type="number" min="0" defaultValue="0" className="w-24 rounded-lg border border-slate-300 px-3 py-2" /><label className="flex items-center gap-2 text-sm"><input name="featured" type="checkbox" /> Destacado</label><button disabled={pending} className="ml-auto rounded-lg bg-brand-800 px-3 py-2 text-sm font-semibold text-white">Asignar</button></div>
          </form>
          <ul className="mt-4 space-y-2 text-sm">{topic.services.map((item) => <li key={`${item.topicId}-${item.serviceId}`} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 p-2"><span>{item.service.title}</span><button type="button" onClick={() => run(() => removeTopicService(topic.id, item.serviceId))} className="text-red-700">×</button></li>)}</ul>
        </div>
        <div>
          <h3 className="font-semibold text-slate-900">Temas relacionados</h3>
          <form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); run(() => linkTopicRelation(topic.id, targetId)); }}>
            <select value={targetId} onChange={(event) => setTargetId(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2"><option value="">Seleccionar tema</option>{options.topics.filter((item) => item.id !== topic.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
            <button disabled={pending} className="rounded-lg bg-brand-800 px-3 py-2 text-sm font-semibold text-white">Vincular</button>
          </form>
          <ul className="mt-4 space-y-2 text-sm">{[...topic.relationsFrom.map((item) => ({ ...item.targetTopic, relationId: item.id })), ...topic.relationsTo.map((item) => ({ ...item.sourceTopic, relationId: item.id }))].map((item) => <li key={item.relationId} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 p-2"><span>{item.name}</span><button type="button" onClick={() => run(() => unlinkTopicRelation(topic.id, item.id))} className="text-red-700">×</button></li>)}</ul>
        </div>
      </div>
      <Feedback message={message} />
    </section>
  );
}

function PerspectivesEditor({ topic, options }) {
  const { pending, message, run } = useTopicAction();
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold text-slate-950">Perspectivas por disciplina</h2>
      <p className="mt-1 text-sm text-slate-600">La disciplina se muestra explícitamente para no presentar aportes diferenciados como una sola voz clínica.</p>
      <div className="mt-5 space-y-4">{topic.perspectives.map((perspective) => <form key={perspective.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4" onSubmit={(event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); run(() => updateTopicPerspective(perspective.id, { ...data, position: Number(data.position || 0) })); }}><div className="grid gap-3 md:grid-cols-[1fr_2fr_120px]"><Field label="Disciplina" name="discipline" defaultValue={perspective.discipline.name} disabled /><Field label="Título" name="title" defaultValue={perspective.title} required /><label className="text-sm">Estado<select name="status" defaultValue={perspective.status} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"><option value="DRAFT">Borrador</option><option value="PUBLISHED">Publicado</option><option value="ARCHIVED">Archivado</option></select></label></div><textarea name="content" rows={4} defaultValue={perspective.content} className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2" required /><div className="mt-3 flex gap-3"><input name="position" type="number" min="0" defaultValue={perspective.position} className="w-24 rounded-lg border border-slate-300 px-3 py-2" /><button disabled={pending} className="rounded-lg bg-brand-800 px-3 py-2 text-sm font-semibold text-white">Guardar</button><button type="button" onClick={() => run(() => deleteTopicPerspective(perspective.id))} className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700">Eliminar</button></div></form>)}</div>
      <form className="mt-5 rounded-xl border border-dashed border-brand-300 p-4" onSubmit={(event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); run(() => saveTopicPerspective(topic.id, { ...data, position: Number(data.position || 0) })); event.currentTarget.reset(); }}><div className="grid gap-3 md:grid-cols-[1fr_2fr_120px]"><label className="text-sm">Disciplina<select name="disciplineId" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" required><option value="">Seleccionar</option>{options.disciplines.map((discipline) => <option key={discipline.id} value={discipline.id}>{discipline.name}</option>)}</select></label><Field label="Título" name="title" required /><label className="text-sm">Estado<select name="status" defaultValue="DRAFT" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"><option value="DRAFT">Borrador</option><option value="PUBLISHED">Publicado</option></select></label></div><textarea name="content" rows={4} className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Aporte propio de esta disciplina" required /><div className="mt-3 flex gap-3"><input name="position" type="number" min="0" defaultValue="0" className="w-24 rounded-lg border border-slate-300 px-3 py-2" /><button disabled={pending} className="rounded-lg bg-accent-500 px-3 py-2 text-sm font-bold text-accent-950">Añadir perspectiva</button></div></form>
      <Feedback message={message} />
    </section>
  );
}

function FaqEditor({ topic }) {
  const { pending, message, run } = useTopicAction();
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold text-slate-950">Preguntas frecuentes</h2>
      <div className="mt-5 space-y-4">{topic.faqs.map((faq) => <form key={faq.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4" onSubmit={(event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); run(() => saveTopicFaq(topic.id, { ...data, id: faq.id, position: Number(data.position || 0), isVisible: data.isVisible === "on" })); }}><Field label="Pregunta" name="question" defaultValue={faq.question} required /><textarea name="answer" rows={3} defaultValue={faq.answer} className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2" required /><div className="mt-3 flex flex-wrap items-center gap-3"><input name="position" type="number" min="0" defaultValue={faq.position} className="w-24 rounded-lg border border-slate-300 px-3 py-2" /><label className="flex items-center gap-2 text-sm"><input name="isVisible" type="checkbox" defaultChecked={faq.isVisible} /> Visible</label><button disabled={pending} className="rounded-lg bg-brand-800 px-3 py-2 text-sm font-semibold text-white">Guardar</button><button type="button" onClick={() => run(() => deleteTopicFaq(faq.id))} className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700">Eliminar</button></div></form>)}</div>
      <form className="mt-5 rounded-xl border border-dashed border-brand-300 p-4" onSubmit={(event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); run(() => saveTopicFaq(topic.id, { ...data, position: Number(data.position || 0) })); event.currentTarget.reset(); }}><Field label="Pregunta" name="question" required /><textarea name="answer" rows={3} className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Respuesta visible" required /><div className="mt-3 flex items-center gap-3"><input name="position" type="number" min="0" defaultValue="0" className="w-24 rounded-lg border border-slate-300 px-3 py-2" /><button disabled={pending} className="rounded-lg bg-accent-500 px-3 py-2 text-sm font-bold text-accent-950">Añadir pregunta</button></div></form>
      <Feedback message={message} />
    </section>
  );
}

export default function TopicHubEditor({ topic, options }) {
  const { pending, message, run } = useTopicAction();
  return (
    <div className="space-y-6">
      <CoreForm topic={topic} />
      <SectionsEditor topic={topic} />
      <RelationsEditor topic={topic} options={options} />
      <PerspectivesEditor topic={topic} options={options} />
      <FaqEditor topic={topic} />
      <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-6">
        <div className="mr-auto"><h2 className="font-bold text-brand-950">Estado de publicación</h2><p className="text-sm text-brand-800">Publicar comprueba identidad, SEO, introducción editorial y al menos una relación aprobada.</p></div>
        <button type="button" disabled={pending} onClick={() => run(() => publishTopic(topic.id))} className="rounded-lg bg-brand-800 px-4 py-2 font-semibold text-white disabled:opacity-60">Publicar hub</button>
        <button type="button" disabled={pending} onClick={() => run(() => archiveTopic(topic.id))} className="rounded-lg border border-red-300 bg-white px-4 py-2 font-semibold text-red-700 disabled:opacity-60">Archivar</button>
        <Feedback message={message} />
      </section>
    </div>
  );
}
