import { redirect } from "next/navigation";
import { getSession } from "@/actions/auth-actions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function startOfMonth(value) { const date = new Date(value); date.setDate(1); date.setHours(0, 0, 0, 0); return date; }
function endOfMonth(value) { const date = new Date(value); date.setMonth(date.getMonth() + 1, 0); date.setHours(23, 59, 59, 999); return date; }
function Bars({ rows, label }) { const max = Math.max(...rows.map((row) => row.count), 1); return <div className="space-y-3">{rows.length ? rows.map((row) => <div key={`${label}-${row.name}`}><div className="flex justify-between text-sm"><span>{row.name}</span><strong>{row.count}</strong></div><div className="mt-1 h-2 rounded bg-slate-100"><div className="h-2 rounded bg-brand-600" style={{ width: `${Math.max(3, row.count / max * 100)}%` }} /></div></div>) : <p className="text-sm text-slate-500">Sin datos para este período.</p>}</div>; }

export default async function AcquisitionDashboard({ searchParams }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/ingresar");
  const sp = (await searchParams) || {};
  const anchor = sp.month ? new Date(`${sp.month}-01T00:00:00`) : new Date();
  const from = startOfMonth(anchor); const to = endOfMonth(anchor);
  const [users, views, completed, leads] = await Promise.all([
    prisma.user.findMany({ where: { createdAt: { gte: from, lte: to } }, select: { id: true, acquisitionChannel: true, campaignName: true, utmSource: true, utmMedium: true, utmCampaign: true } }),
    prisma.postViewEvent.findMany({ where: { createdAt: { gte: from, lte: to } }, select: { anonId: true, postId: true, userId: true, post: { select: { title: true } } } }),
    prisma.appointment.findMany({ where: { status: "COMPLETED", date: { gte: from, lte: to } }, select: { patientId: true } }),
    prisma.lead.findMany({ where: { createdAt: { gte: from, lte: to } }, select: { status: true, channel: true, utmSource: true } }),
  ]);
  const group = (items, getName) => { const map = new Map(); for (const item of items) { const name = getName(item) || "Sin especificar"; map.set(name, (map.get(name) || 0) + 1); } return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count); };
  const channels = group(users, (user) => user.acquisitionChannel);
  const campaigns = group(users, (user) => user.campaignName);
  const bySource = group(users, (user) => user.utmSource);
  const byMedium = group(users, (user) => user.utmMedium);
  const byUtmCampaign = group(users, (user) => user.utmCampaign);
  const uniqueVisitors = new Set(views.map((view) => view.anonId)).size;

  // Leads del período (contactos de formularios públicos)
  const leadsByChannel = group(leads, (lead) => (lead.channel === "FAQ_FORM" ? "FAQ" : "Contacto"));
  const leadsConverted = leads.filter((lead) => lead.status === "CONVERTED").length;

  // Todo el embudo se mide dentro del período: recurrente = 2+ citas completadas en el mes.
  const completedPerPatient = new Map();
  for (const row of completed) completedPerPatient.set(row.patientId, (completedPerPatient.get(row.patientId) || 0) + 1);
  const completedPatients = new Set(completedPerPatient.keys());
  const recurrent = [...completedPerPatient.values()].filter((count) => count >= 2).length;

  // Las lecturas salen de los propios eventos del período, no de un muestreo de posts.
  const byPost = new Map();
  for (const view of views) {
    const entry = byPost.get(view.postId) || { name: view.post?.title || "Sin título", count: 0, registered: new Set() };
    entry.count += 1;
    if (view.userId) entry.registered.add(view.userId);
    byPost.set(view.postId, entry);
  }
  // Los dos rankings se calculan sobre todos los artículos leídos, no uno sobre el recorte del otro.
  const postStats = [...byPost.values()].map(({ name, count, registered }) => ({ name, count, conversion: registered.size }));
  const topPosts = [...postStats].sort((a, b) => b.count - a.count).slice(0, 10);
  const topConversions = [...postStats].sort((a, b) => b.conversion - a.conversion).slice(0, 10);
  return <main className="mx-auto max-w-7xl space-y-6 p-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><a href="/panel/admin/marketing" className="text-sm text-slate-500">Volver a marketing</a><h1 className="mt-2 text-3xl font-bold text-slate-900">Adquisición</h1><p className="text-sm text-slate-600">Resumen de {from.toLocaleDateString("es-CR", { month: "long", year: "numeric" })}.</p></div><form><input type="month" name="month" defaultValue={`${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}`} className="rounded-lg border px-3 py-2" /><button className="ml-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Aplicar</button></form></div>
    <section className="grid gap-4 md:grid-cols-5">{[["Visitantes", uniqueVisitors], ["Leads", leads.length], ["Registros", users.length], ["Primera cita completada", completedPatients.size], ["Pacientes recurrentes", recurrent]].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs uppercase text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-slate-900">{value}</p></div>)}</section>
    <section className="grid gap-6 lg:grid-cols-2"><div className="rounded-xl border bg-white p-5"><h2 className="font-bold">Registros por canal</h2><p className="mb-4 mt-1 text-xs text-slate-500">Resumen legible del origen (source / medium). Se llena solo con la URL de llegada.</p><Bars rows={channels} label="canal" /></div><div className="rounded-xl border bg-white p-5"><h2 className="font-bold">Registros por campaña</h2><p className="mb-4 mt-1 text-xs text-slate-500">Nombre de campaña resumido. Para separarlo por utm_campaign, mirá el bloque de abajo.</p><Bars rows={campaigns} label="campaña" /></div></section>
    <section><h2 className="mb-1 text-lg font-bold text-slate-900">Atribución detallada (UTM)</h2><p className="mb-4 text-sm text-slate-600">Desglose exacto de la URL con la que llegó cada persona que se registró. Se completa solo si usás los enlaces con UTM del <a href="/panel/admin/marketing" className="font-semibold text-brand-700 hover:underline">constructor de campañas</a> (ej.: <code className="rounded bg-slate-100 px-1">?utm_source=meta&utm_medium=paid_social&utm_campaign=julio</code>).</p><div className="grid gap-6 lg:grid-cols-3"><div className="rounded-xl border bg-white p-5"><h3 className="mb-4 font-bold">Por utm_source</h3><Bars rows={bySource} label="source" /></div><div className="rounded-xl border bg-white p-5"><h3 className="mb-4 font-bold">Por utm_medium</h3><Bars rows={byMedium} label="medium" /></div><div className="rounded-xl border bg-white p-5"><h3 className="mb-4 font-bold">Por utm_campaign</h3><Bars rows={byUtmCampaign} label="utmcampaign" /></div></div></section>
    <section className="grid gap-6 lg:grid-cols-2"><div className="rounded-xl border bg-white p-5"><div className="flex items-center justify-between"><h2 className="font-bold">Leads del mes</h2><a href="/panel/admin/leads" className="text-xs font-semibold text-brand-700 hover:underline">Ver todos →</a></div><p className="mb-4 mt-1 text-xs text-slate-500">Consultas por formulario de contacto/FAQ. «Convertidos» = luego se registraron con el mismo correo.</p><div className="grid grid-cols-2 gap-3"><div className="rounded-lg bg-slate-50 p-3"><p className="text-xs uppercase text-slate-500">Total</p><p className="mt-1 text-xl font-bold text-slate-900">{leads.length}</p></div><div className="rounded-lg bg-slate-50 p-3"><p className="text-xs uppercase text-slate-500">Convertidos</p><p className="mt-1 text-xl font-bold text-slate-900">{leadsConverted}</p></div></div><div className="mt-4"><Bars rows={leadsByChannel} label="leadcanal" /></div></div></section>
    <section className="grid gap-6 lg:grid-cols-2"><div className="rounded-xl border bg-white p-5"><h2 className="font-bold">Top 10 artículos por lecturas</h2><div className="mt-4"><Bars rows={topPosts.map(({ name, count }) => ({ name, count }))} label="lecturas" /></div></div><div className="rounded-xl border bg-white p-5"><h2 className="font-bold">Conversión a registro</h2><div className="mt-4 space-y-2">{topConversions.map((post) => <div key={post.name} className="flex justify-between border-b py-2 text-sm"><span>{post.name}</span><strong>{post.conversion} registros</strong></div>)}</div></div></section>
  </main>;
}
