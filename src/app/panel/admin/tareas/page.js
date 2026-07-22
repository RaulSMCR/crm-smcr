import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/actions/auth-actions";
import DailyAdminTasks from "@/components/admin/DailyAdminTasks";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const AREAS = [
  {
    id: "blog",
    title: "Contenido de blog",
    cadence: "Diario",
    description: "Revisar, aprobar y convertir articulos en piezas reutilizables.",
    tasks: [
      {
        id: "blog-review-drafts",
        label: "Revisar articulos en borrador",
        detail: "Validar calidad editorial, fuentes, tono clinico y pertinencia para publicar.",
      },
      {
        id: "blog-plan-derivatives",
        label: "Definir piezas derivadas",
        detail: "Elegir que articulos pasan a carrusel, reel, pauta, newsletter o SEO interno.",
      },
      {
        id: "blog-update-library",
        label: "Actualizar inventario editorial",
        detail: "Registrar tema, autor, estado, proxima accion y fecha objetivo.",
      },
    ],
    links: [
      { href: "/panel/admin/blog", label: "Gestion editorial" },
      { href: "/blog", label: "Blog publico" },
    ],
  },
  {
    id: "finance",
    title: "Finanzas y facturacion",
    cadence: "Diario",
    description: "Controlar ingresos, cuentas por cobrar, pagos y documentos pendientes.",
    tasks: [
      {
        id: "finance-check-income",
        label: "Revisar ingresos y citas pagadas",
        detail: "Comparar citas confirmadas, pagos recibidos y saldos pendientes.",
      },
      {
        id: "finance-review-invoices",
        label: "Validar facturas abiertas",
        detail: "Identificar facturas pendientes de pago, FE pendiente o documentos con error.",
      },
      {
        id: "finance-follow-up",
        label: "Programar seguimiento financiero",
        detail: "Definir cobros, notas de credito, pagos a profesionales y cierres diarios.",
      },
    ],
    links: [
      { href: "/panel/admin/contabilidad", label: "Contabilidad" },
      { href: "/panel/admin/citas", label: "Citas" },
    ],
  },
  {
    id: "ads",
    title: "Sistema publicitario",
    cadence: "Diario",
    description: "Coordinar articulos, carruseles, reels, pauta y aprendizajes de campanas.",
    tasks: [
      {
        id: "ads-new-articles",
        kind: "decision",
        label: "¿Hay articulos nuevos para crear?",
        detail: "Marca 'No hay' si hoy no toca, o 'Completado' cuando el o los articulos queden creados.",
      },
      {
        id: "ads-new-carousels",
        kind: "decision",
        label: "¿Hay carruseles para crear?",
        detail: "Marca 'No hay' si hoy no toca, o 'Completado' cuando el o los carruseles queden generados.",
      },
      {
        id: "ads-select-assets",
        label: "Seleccionar activos del dia",
        detail: "Elegir articulo, tema, imagen, enfoque emocional y llamada a la accion.",
      },
      {
        id: "ads-map-formats",
        label: "Mapear formatos",
        detail: "Asignar piezas para carrusel, reel, historia, post estatico y anuncio.",
      },
      {
        id: "ads-check-performance",
        label: "Revisar rendimiento",
        detail: "Registrar campanas activas, costo, consultas generadas y ajustes para la siguiente iteracion.",
      },
    ],
    links: [
      { href: "/panel/admin/marketing", label: "Marketing" },
      { href: "/panel/admin/carousels", label: "Carruseles" },
      { href: "/panel/admin/comunicaciones", label: "Comunicaciones" },
    ],
  },
  {
    id: "seo",
    title: "SEO y crecimiento organico",
    cadence: "Diario",
    description: "Asegurar que cada pieza publicada sume busqueda, autoridad y conversion.",
    tasks: [
      {
        id: "seo-review-indexable",
        label: "Revisar paginas clave",
        detail: "Comprobar titulos, descripciones, enlaces internos y consistencia de servicios.",
      },
      {
        id: "seo-link-content",
        label: "Agregar enlaces internos",
        detail: "Conectar articulos con servicios, perfiles profesionales y rutas de agendamiento.",
      },
      {
        id: "seo-maintain-map",
        label: "Actualizar mapa SEO",
        detail: "Registrar keywords, intención de busqueda, articulo asociado y siguiente mejora.",
      },
    ],
    links: [
      { href: "/panel/admin/servicios", label: "Servicios" },
      { href: "/sitemap.xml", label: "Sitemap" },
    ],
  },
  {
    id: "site",
    title: "Mantenimiento del site",
    cadence: "Diario",
    description: "Mantener estable la operacion publica y administrativa.",
    tasks: [
      {
        id: "site-check-critical",
        label: "Probar rutas criticas",
        detail: "Ingreso, registro, agendamiento, blog, servicios y paneles principales.",
      },
      {
        id: "site-review-professionals",
        label: "Revisar profesionales pendientes",
        detail: "Aprobar, solicitar correcciones o dar seguimiento a perfiles incompletos.",
      },
      {
        id: "site-log-issues",
        label: "Registrar mantenimiento",
        detail: "Anotar errores, mejoras pequenas, deuda tecnica y prioridad de resolucion.",
      },
    ],
    links: [
      { href: "/panel/admin/personal", label: "Personal" },
      { href: "/panel/admin", label: "Panel admin" },
    ],
  },
];

export default async function AdminTasksPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/ingresar");

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [draftPosts, publishedToday, openInvoices, activeAppointments, pendingProfessionals] = await Promise.all([
    prisma.post.count({ where: { status: "DRAFT" } }),
    prisma.post.count({ where: { status: "PUBLISHED", updatedAt: { gte: startOfToday } } }),
    prisma.invoice.count({ where: { status: { in: ["DRAFT", "OPEN"] } } }),
    prisma.appointment.count({ where: { status: { in: ["PENDING", "CONFIRMED"] } } }),
    prisma.user.count({
      where: {
        role: "PROFESSIONAL",
        professionalProfile: { is: { isApproved: false } },
      },
    }),
  ]);

  const metrics = [
    { label: "Borradores", value: draftPosts, help: "Articulos por revisar" },
    { label: "Publicados hoy", value: publishedToday, help: "Actualizados como publicados" },
    { label: "Facturas abiertas", value: openInvoices, help: "DRAFT u OPEN" },
    { label: "Citas activas", value: activeAppointments, help: "Pendientes o confirmadas" },
    { label: "Profesionales", value: pendingProfessionals, help: "Pendientes de aprobacion" },
  ];

  return (
    <div className="min-h-screen bg-surface p-6">
      <div className="mx-auto max-w-7xl space-y-8">
        <div>
          <Link href="/panel/admin" className="text-sm text-neutral-500 hover:text-neutral-700">
            Panel
          </Link>
          <h1 className="text-3xl font-bold text-brand-900">Inventario diario</h1>
          <p className="text-sm text-neutral-700">
            Rutina operativa para contenido, finanzas, publicidad, SEO y mantenimiento.
          </p>
        </div>

        <DailyAdminTasks areas={AREAS} metrics={metrics} />
      </div>
    </div>
  );
}
