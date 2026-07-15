import { redirect } from "next/navigation";
import { getSession } from "@/actions/auth-actions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function startOfMonth(value) { const date = new Date(value); date.setDate(1); date.setHours(0, 0, 0, 0); return date; }
function endOfMonth(value) { const date = new Date(value); date.setMonth(date.getMonth() + 1, 0); date.setHours(23, 59, 59, 999); return date; }
function money(value) { return Number(value || 0).toLocaleString("es-CR"); }
function Bars({ rows, label }) { const max = Math.max(...rows.map((row) => row.count), 1); return <div className="space-y-3">{rows.length ? rows.map((row) => <div key={`${label}-${row.name}`}><div className="flex justify-between text-sm"><span>{row.name}</span><strong>{row.count}</strong></div><div className="mt-1 h-2 rounded bg-slate-100"><div className="h-2 rounded bg-brand-600" style={{ width: `${Math.max(3, row.count / max * 100)}%` }} /></div></div>) : <p className="text-sm text-slate-500">Sin datos para este período.</p>}</div>; }

export default async function AcquisitionDashboard({ searchParams }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/ingresar");
  const anchor = searchParams?.month ? new Date(`${searchParams.month}-01T00:00:00`) : new Date();
  const from = startOfMonth(anchor); const to = endOfMonth(anchor);
  const [users, views, completed, posts] = await Promise.all([
    prisma.user.findMany({ where: { createdAt: { gte: from, lte: to } }, select: { id: true, acquisitionChannel: true, campaignName: true } }),
    prisma.postViewEvent.findMany({ where: { createdAt: { gte: from, lte: to } }, select: { anonId: true, postId: true, userId: true, post: { select: { title: true } } } }),
    prisma.appointment.findMany({ where: { status: "COMPLETED", date: { gte: from, lte: to } }, select: { patientId: true } }),
    prisma.post.findMany({ where: { status: "PUBLISHED" }, select: { id: true, title: true, viewEvents: { where: { createdAt: { gte: from, lte: to } }, select: { userId: true } } }, take: 100 }),
  ]);
  const group = (items, getName) => { const map = new Map(); for (const item of items) { const name = getName(item) || "Sin especificar"; map.set(name, (map.get(name) || 0) + 1); } return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count); };
  const channels = group(users, (user) => user.acquisitionChannel);
  const campaigns = group(users, (user) => user.campaignName);
  const uniqueVisitors = new Set(views.map((view) => view.anonId)).size;
  const completedPatients = new Set(completed.map((row) => row.patientId));
  const patientCounts = await prisma.appointment.groupBy({ by: ["patientId"], where: { status: "COMPLETED" }, _count: { patientId: true } });
  const recurrent = patientCounts.filter((row) => row._count.patientId >= 2).length;
  const topPosts = posts.map((post) => ({ name: post.title, count: post.viewEvents.length, conversion: new Set(post.viewEvents.filter((event) => event.userId).map((event) => event.userId)).size })).sort((a, b) => b.count - a.count).slice(0, 10);
  const topConversions = [...topPosts].sort((a, b) => b.conversion - a.conversion);
  return <main className="mx-auto max-w-7xl space-y-6 p-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><a href="/panel/admin/marketing" className="text-sm text-slate-500">Volver a marketing</a><h1 className="mt-2 text-3xl font-bold text-slate-900">Adquisición</h1><p className="text-sm text-slate-600">Resumen de {from.toLocaleDateString("es-CR", { month: "long", year: "numeric" })}.</p></div><form><input type="month" name="month" defaultValue={`${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}`} className="rounded-lg border px-3 py-2" /><button className="ml-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Aplicar</button></form></div>
    <section className="grid gap-4 md:grid-cols-4">{[["Visitantes", uniqueVisitors], ["Registros", users.length], ["Primera cita completada", completedPatients.size], ["Pacientes recurrentes", recurrent]].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs uppercase text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-slate-900">{value}</p></div>)}</section>
    <section className="grid gap-6 lg:grid-cols-2"><div className="rounded-xl border bg-white p-5"><h2 className="mb-4 font-bold">Registros por canal</h2><Bars rows={channels} label="canal" /></div><div className="rounded-xl border bg-white p-5"><h2 className="mb-4 font-bold">Registros por campaña</h2><Bars rows={campaigns} label="campaña" /></div></section>
    <section className="grid gap-6 lg:grid-cols-2"><div className="rounded-xl border bg-white p-5"><h2 className="font-bold">Top 10 artículos por lecturas</h2><div className="mt-4"><Bars rows={topPosts.map(({ name, count }) => ({ name, count }))} label="lecturas" /></div></div><div className="rounded-xl border bg-white p-5"><h2 className="font-bold">Conversión a registro</h2><div className="mt-4 space-y-2">{topConversions.map((post) => <div key={post.name} className="flex justify-between border-b py-2 text-sm"><span>{post.name}</span><strong>{post.conversion} registros</strong></div>)}</div></div></section>
  </main>;
}
