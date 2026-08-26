import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isPrismaConnectionError, fallarSiEsBuild } from "@/lib/prisma-safe";
import JsonLd from "@/components/JsonLd";
import { grafo, nodoListado, idServicio } from "@/lib/jsonld";
import { siteUrl } from "@/lib/site-url";
import { buildMetadata } from "@/lib/seo";
import SafeImage, { SafeAvatar } from "@/components/SafeImage";
import { IMAGE_FALLBACKS } from "@/lib/images";
import { TARIFA_VIGENTE, rangosPorServicio, etiquetaDeRango } from "@/lib/service-pricing";

// Preguntas frecuentes de la página de servicios.
//
// Antes esto era solo un `FAQ_SCHEMA`: cinco pares pregunta/respuesta declarados
// en JSON-LD que **no aparecían en la página**. Google penaliza esa discordancia,
// y además el contenido escondido se pudre sin que nadie lo note: tres de las
// cinco respuestas afirmaban cosas falsas —"coaching de vida y ejecutivo" entre
// las disciplinas, cuando ninguno de los servicios lo es, y "consultas 100%
// virtuales", cuando la plataforma atiende en ambas modalidades—.
//
// Ahora hay una sola fuente: este arreglo alimenta el marcado Y lo que se ve.
// No pueden desincronizarse porque son lo mismo. Es el patrón que ya usa /faq.
const PREGUNTAS = [
  {
    pregunta: '¿La atención es virtual o presencial?',
    respuesta:
      'Las dos. Cada profesional define en qué modalidades atiende, y podés elegir la que te sirva al agendar. El precio puede ser distinto entre una y otra: lo define cada profesional y lo ves antes de confirmar.',
  },
  {
    pregunta: '¿Cómo funciona la consulta virtual?',
    respuesta:
      'Una vez agendada tu cita recibís un enlace de videollamada por correo. La sesión se hace por Google Meet, sin instalar nada: solo necesitás conexión a internet y un dispositivo con cámara.',
  },
  {
    pregunta: '¿Los profesionales están verificados?',
    respuesta:
      'Sí. Antes de la entrevista revisamos la matrícula de cada profesional en el registro público de su colegio y guardamos el enlace a esa consulta. En cada perfil vas a ver el colegio que emite la credencial, el número de matrícula y un enlace para comprobarlo por tu cuenta.',
  },
  {
    pregunta: '¿Cuánto cuesta una consulta?',
    respuesta:
      'Depende del profesional, del servicio y de la modalidad. El precio se muestra en el perfil de cada profesional antes de agendar, en colones costarricenses.',
  },
  {
    pregunta: '¿Qué disciplinas están disponibles?',
    respuesta:
      'Psicología clínica, psicodiagnóstico, psiquiatría, nutrición, terapia física y deporte, musicoterapia, terapia de lenguaje, pedagogía y acompañamiento terapéutico. Estamos incorporando profesionales en varias de estas áreas: los servicios que todavía no tienen a nadie asignado aparecen marcados como tales.',
  },
];

const FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: PREGUNTAS.map(({ pregunta, respuesta }) => ({
    '@type': 'Question',
    name: pregunta,
    acceptedAnswer: { '@type': 'Answer', text: respuesta },
  })),
};


export const metadata = buildMetadata({
  title: 'Servicios de bienestar y salud mental',
  description:
    'Psicología clínica, psiquiatría, nutrición, terapia física, musicoterapia, terapia de lenguaje y más, con profesionales de colegiatura verificada en Costa Rica.',
  path: 'servicios',
});

export const revalidate = 300;

export default async function ServiciosPage() {
  let services = [];
  let rangos = new Map();
  let dbUnavailable = false;

  try {
    services = await prisma.service.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: "asc" }, { title: "asc" }],
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        bannerImage: true,
        bannerFocusX: true,
        bannerFocusY: true,
        bannerScale: true,
        bannerArtworkTitle: true,
        bannerArtworkAuthor: true,
        bannerArtworkNote: true,
        durationMin: true,
        professionalAssignments: {
          where: {
            status: "APPROVED",
            rates: { some: TARIFA_VIGENTE },
            professional: {
              is: {
                isApproved: true,
                user: { is: { isActive: true } },
              },
            },
          },
          take: 5,
          select: {
            professional: {
              select: {
                id: true,
                slug: true,
                specialty: true,
                user: { select: { name: true, image: true } },
              },
            },
          },
        },
      },
    });

    rangos = await rangosPorServicio(prisma, services.map((s) => s.id));
  } catch (error) {
    if (!isPrismaConnectionError(error)) throw error;
    // El aviso de «temporalmente no disponible» es correcto para un visitante y
    // es un soft-404 servido como 200 si queda horneado en el build.
    fallarSiEsBuild(error, "/servicios");
    dbUnavailable = true;
    console.error("No se pudo cargar /servicios por falla de conexion a la base:", error);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6 md:p-10">
      <JsonLd data={FAQ_SCHEMA} />
      {/* El listado deja de ser una página sin nodo propio: declara qué contiene
          y apunta al `@id` de cada servicio, que está descrito en su ficha. */}
      {services.length ? (
        <JsonLd
          data={grafo(
            nodoListado({
              id: `${siteUrl("servicios")}#lista`,
              nombre: "Servicios de Salud Mental Costa Rica",
              items: services.map((s) => ({
                url: siteUrl(`servicios/${s.slug}`),
                nombre: s.title,
                id: idServicio(s.slug),
              })),
            }),
          )}
        />
      ) : null}
      <div>
        <h1 className="text-4xl font-light text-slate-900">Nuestros Servicios</h1>
        <p className="mt-2 text-slate-600">Encuentra el apoyo profesional que necesitas hoy.</p>
      </div>

      {dbUnavailable ? (
        <div className="rounded-2xl border border-accent-300 bg-accent-50 p-6">
          <h2 className="text-2xl font-semibold text-brand-950">Servicios temporalmente no disponibles</h2>
          <p className="mt-2 text-neutral-900">
            No pudimos conectarnos a la base de datos en este momento. Intenta nuevamente en unos minutos.
          </p>
        </div>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        {services.map((service) => {
          const professionals = (service.professionalAssignments || []).map(
            (assignment) => assignment.professional
          );
          const priceLabel = etiquetaDeRango(rangos.get(service.id));

          return (
            <div key={service.id} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="relative h-56 overflow-hidden bg-gradient-to-br from-brand-800 to-brand-950">
                {service.bannerImage ? (
                  <SafeImage
                    src={service.bannerImage}
                    alt={service.title}
                    fallbackSrc={IMAGE_FALLBACKS.service}
                    className="service-img h-full w-full object-cover"
                    style={{
                      "--img-scale": (service.bannerScale ?? 100) / 100,
                      objectPosition: `${service.bannerFocusX ?? 50}% ${service.bannerFocusY ?? 50}%`,
                    }}
                  />
                ) : (
                  <div className="flex h-full items-start bg-gradient-to-br from-brand-800 to-brand-950 p-6">
                    <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white/80">
                      Servicio destacado
                    </span>
                  </div>
                )}

                {service.bannerArtworkTitle || service.bannerArtworkAuthor || service.bannerArtworkNote ? (
                  <div className="absolute left-4 top-4 max-w-sm rounded-2xl border border-white/10 bg-brand-950/92 p-4 text-white opacity-0 shadow-xl backdrop-blur-md transition-opacity duration-300 group-hover:opacity-100">
                    <div className="mb-2 inline-flex rounded-full bg-accent-600 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-50">
                      Obra destacada
                    </div>
                    {service.bannerArtworkTitle ? (
                      <div className="text-sm font-semibold text-neutral-50">{service.bannerArtworkTitle}</div>
                    ) : null}
                    {service.bannerArtworkAuthor ? (
                      <div className="text-xs text-neutral-100/90">{service.bannerArtworkAuthor}</div>
                    ) : null}
                    {service.bannerArtworkNote ? (
                      <p className="mt-2 line-clamp-3 max-w-xl text-xs leading-relaxed text-neutral-100/90">
                        {service.bannerArtworkNote}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className="image-overlay-strong absolute inset-x-0 bottom-0 p-6 transition-opacity duration-300 group-hover:opacity-0">
                  <h2 className="contrast-on-image text-2xl font-semibold">{service.title}</h2>
                  <div className="contrast-on-image-muted mt-2 text-sm">
                    {priceLabel} · {service.durationMin} min
                  </div>
                </div>
              </div>

              <div className="flex flex-1 flex-col gap-4 p-6">
                <div className="min-w-0 flex-1">
                  <p className="text-justify text-slate-600">
                    {service.description || "Sin descripción disponible."}
                  </p>
                </div>

                <Link
                  href={`/servicios/${service.slug}`}
                  className="btn btn-accent w-full whitespace-nowrap sm:w-auto"
                >
                  Ver detalles
                </Link>
              </div>

              {professionals.length === 0 ? (
                <div className="border-t border-slate-100 px-6 pb-6 pt-5">
                  <div className="text-sm font-medium text-accent-800">Estamos incorporando profesionales</div>
                </div>
              ) : null}

              {professionals.length > 0 ? (
                <div className="border-t border-slate-100 px-6 pb-6 pt-5">
                  <div className="text-sm font-semibold text-slate-800">Disponible con:</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {professionals.map((professional) => (
                      <Link
                        key={professional.id}
                        href={professional.slug ? `/profesionales/${professional.slug}?serviceId=${service.id}` : `/agendar/${professional.id}?serviceId=${service.id}`}
                        className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 transition hover:border-brand-300 hover:bg-brand-50"
                      >
                        {professional.user?.image ? (
                          <SafeAvatar
                            src={professional.user.image}
                            name={professional.user.name || "Profesional"}
                            className="h-6 w-6 rounded-full object-cover"
                          />
                        ) : (
                          <div className="grid h-6 w-6 place-items-center rounded-full bg-slate-200 text-xs font-bold text-slate-700">
                            {(professional.user?.name || "P").charAt(0)}
                          </div>
                        )}
                        <span className="text-sm text-slate-700">{professional.user?.name}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {!dbUnavailable && services.length === 0 ? (
        <div className="rounded-2xl border border-brand-200 bg-brand-50 p-6">
          <p className="text-neutral-900">Todavia no hay servicios publicados.</p>
        </div>
      ) : null}

      {/* Las preguntas, visibles. El marcado de arriba sale de este mismo
          arreglo: antes se declaraban en JSON-LD sin aparecer en ningún lado. */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8">
        <h2 className="text-2xl font-light text-slate-900">Preguntas frecuentes</h2>
        <dl className="mt-6 divide-y divide-slate-100">
          {PREGUNTAS.map(({ pregunta, respuesta }) => (
            <div key={pregunta} className="py-4 first:pt-0 last:pb-0">
              <dt className="font-semibold text-slate-900">{pregunta}</dt>
              <dd className="mt-1.5 leading-relaxed text-slate-700">{respuesta}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-6 text-sm text-slate-600">
          ¿Otra duda? Mirá{" "}
          <Link href="/faq" className="font-semibold text-brand-700 underline">
            todas las preguntas frecuentes
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
