import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/actions/auth-actions";
import DailyPhraseReview from "@/components/admin/DailyPhraseReview";
import PhraseSubstitute from "@/components/admin/PhraseSubstitute";
import PhraseSourceChecklist from "@/components/admin/PhraseSourceChecklist";
import {
  AUDIENCIAS,
  PRIMER_DIA,
  ULTIMO_DIA,
  VERSION_CORPUS,
  diaDeFrases,
  diasDeAltaExposicion,
  estadoDeStock,
  estadoDeVigencia,
  existeDia,
  facetasDelCorpus,
  fechaHoy,
  fechaVigente,
  resumenRango,
  sesionDe,
  totalFuentes,
} from "@/lib/frases";
import {
  conteoPorFecha,
  frasesUsadas,
  historialDeSelecciones,
  listaDeVerificacion,
  seleccionesDelDia,
  verificacionDeFuentes,
} from "@/lib/frases-queries";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NOMBRES_MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre",
];

const TOTAL_AUDIENCIAS = AUDIENCIAS.length;

function claseCalor(calor) {
  if (calor >= 9) return "bg-accent-700 text-white";
  if (calor >= 8) return "bg-accent-500 text-white";
  if (calor >= 7) return "bg-accent-300 text-accent-950";
  if (calor >= 6) return "bg-accent-100 text-accent-950";
  return "bg-neutral-100 text-neutral-700";
}

function acotarFecha(fecha) {
  if (!fecha) return null;
  if (fecha < PRIMER_DIA) return PRIMER_DIA;
  if (fecha > ULTIMO_DIA) return ULTIMO_DIA;
  return existeDia(fecha) ? fecha : null;
}

export default async function AdminPhrasesPage({ searchParams }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/ingresar");

  // Next 16: searchParams es una Promise. Leerlo síncrono devuelve undefined.
  const params = await searchParams;

  const hoy = fechaHoy();
  const enVivo = fechaVigente();
  const solicitada = acotarFecha(params?.fecha ? String(params.fecha) : null);
  const fecha = solicitada || acotarFecha(hoy) || PRIMER_DIA;
  const audienciaFoco =
    params?.audiencia && AUDIENCIAS.some((a) => a.id === params.audiencia)
      ? String(params.audiencia)
      : null;

  const vigencia = estadoDeVigencia(hoy);
  const seleccionesPorAudiencia = await seleccionesDelDia(fecha);
  const decididasDelDia = seleccionesPorAudiencia.size;

  // Con la prohibición de repetir, las candidatas del día no salen fijas del
  // corpus: las que ya se publicaron alguna vez se reemplazan al vuelo por la
  // mejor viva para esa audiencia. Por eso el stock se consulta antes de armar
  // el día.
  const { usadas } = await frasesUsadas();
  const elegidasDelDia = Object.fromEntries(
    [...seleccionesPorAudiencia.entries()]
      .filter(([, pick]) => pick.status !== "SKIPPED" && pick.phraseIndex >= 0)
      .map(([aud, pick]) => [aud, pick.phraseIndex]),
  );
  const dia = diaDeFrases(fecha, { usadas, elegidas: elegidasDelDia });
  const stock = estadoDeStock({ usadas: usadas.size, fecha: hoy });

  // Rejilla del mes de la fecha en foco.
  const mes = fecha.slice(0, 7);
  const desdeMes = `${mes}-01`;
  const hastaMes = `${mes}-31`;
  const diasDelMes = resumenRango(desdeMes, hastaMes);
  const conteoMes = await conteoPorFecha(desdeMes, hastaMes);

  const verificadasDelDia = await verificacionDeFuentes(
    dia ? dia.candidatas.map((c) => c.claveFuente) : [],
  );
  const verificaciones = Object.fromEntries(
    [...verificadasDelDia.entries()].map(([k, v]) => [k, v.verified]),
  );

  const { lista, total, verificadas } = await listaDeVerificacion({ limite: 60 });
  const historial = await historialDeSelecciones(24);
  const facetas = facetasDelCorpus();

  const todos = resumenRango(PRIMER_DIA, ULTIMO_DIA);
  const conteoTotal = await conteoPorFecha(PRIMER_DIA, ULTIMO_DIA);
  const diasCompletos = [...conteoTotal.entries()].filter(([, n]) => n >= TOTAL_AUDIENCIAS).length;
  const altaExposicion = diasDeAltaExposicion(hoy, ULTIMO_DIA);
  const altaSinDecidir = altaExposicion.filter((d) => (conteoTotal.get(d.fecha) || 0) < TOTAL_AUDIENCIAS);

  // Objeto plano (no Map): tiene que cruzar al componente cliente.
  // Datos planos y serializables para el componente cliente, con la fecha de
  // guardado ya formateada en hora de Costa Rica.
  const formatoGuardado = new Intl.DateTimeFormat("es-CR", {
    timeZone: "America/Costa_Rica",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
  const selecciones = Object.fromEntries(
    [...seleccionesPorAudiencia.entries()].map(([aud, pick]) => [
      aud,
      {
        phraseIndex: pick.phraseIndex,
        status: pick.status,
        author: pick.author,
        fraseHuerfana: pick.fraseHuerfana,
        guardadaEl: pick.updatedAt ? formatoGuardado.format(pick.updatedAt) : null,
      },
    ]),
  );

  // Se reusa el componente de la revisión diaria dándole una sesión de un solo
  // día: así la elección, la omisión y la reapertura se comportan igual aquí
  // que en las acciones diarias.
  const sesionDeUnDia = {
    fecha: hoy,
    objetivoDeHoy: [],
    atrasadas: 0,
    pendientes: dia
      ? [
          {
            fecha,
            sesion: sesionDe(fecha),
            atrasada: sesionDe(fecha) < hoy && decididasDelDia < TOTAL_AUDIENCIAS,
            enVivo: fecha <= enVivo,
            resumen: {
              fecha: dia.fecha,
              diaSemana: dia.diaSemana,
              evento: dia.evento,
              calor: dia.calor,
              ventanaSensible: dia.ventanaSensible,
              temasDominantes: dia.temasDominantes,
              vector: dia.vector,
            },
            candidatas: dia.candidatas,
            selecciones,
            decididas: decididasDelDia,
            totalAudiencias: TOTAL_AUDIENCIAS,
          },
        ]
      : [],
  };

  const metricas = [
    { label: "Días completos", value: `${diasCompletos}/${todos.length}`, help: "Las 8 audiencias decididas" },
    {
      label: "Stock vivo",
      value: `${stock.disponibles}/${stock.total}`,
      help: `${stock.usadas} quemadas · ${totalFuentes()} pares autor–obra`,
    },
    {
      label: "Alcanza para",
      value: `${stock.diasQueAlcanza} días`,
      help: `A ${stock.porDia} audiencias por día, hasta el ${stock.alcanzaHasta}`,
    },
    { label: "Fuentes verificadas", value: `${verificadas}/${total}`, help: "Candado de la placa de redes" },
    { label: "Alta exposición", value: altaSinDecidir.length, help: "Días de calor 9-10 sin completar" },
  ];

  return (
    <div className="min-h-screen bg-surface p-6">
      <div className="mx-auto max-w-7xl space-y-8">
        <div>
          <Link href="/panel/admin/tareas" className="text-sm text-neutral-500 hover:text-neutral-700">
            Inventario diario
          </Link>
          <h1 className="text-3xl font-bold text-brand-900">Control de frases</h1>
          <p className="text-sm text-neutral-700">
            Corpus {VERSION_CORPUS}. La frase entra en vivo a las 6:00 de Costa Rica; ahora mismo
            está publicada la del {enVivo}.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {metricas.map((m) => (
            <div key={m.label} className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 shadow-card">
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-neutral-500">
                {m.label}
              </div>
              <div className="mt-2 text-2xl font-bold text-brand-900 tabular-nums">{m.value}</div>
              <div className="mt-1 text-xs text-neutral-600">{m.help}</div>
            </div>
          ))}
        </div>

        {!stock.suficiente ? (
          <section className="rounded-lg border border-accent-500 bg-accent-50 p-5">
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-accent-950">
              El stock no llega al final de la ventana
            </h2>
            <p className="mt-1 text-sm text-accent-950">
              Ninguna frase se repite: cada elección quema una para siempre. Quedan{" "}
              <strong>{stock.disponibles}</strong> vivas de {stock.total} y se gastan{" "}
              {stock.porDia} por día —una por audiencia—, así que alcanzan para{" "}
              <strong>{stock.diasQueAlcanza} días</strong> de publicación: hasta el{" "}
              {stock.alcanzaHasta}, no hasta el {ULTIMO_DIA}. Para cubrir
              la ventana completa harían falta <strong>{stock.faltan}</strong> frases más.
            </p>
            <p className="mt-2 text-xs text-accent-950">
              Las salidas son dos, y las dos son decisión tuya: producir más corpus, o publicar a
              menos audiencias por día. Con 4 audiencias diarias el mismo stock rinde el doble.
            </p>
          </section>
        ) : null}

        {vigencia.requiereRenovacion ? (
          <section className="rounded-lg border border-accent-500 bg-accent-50 p-5">
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-accent-950">
              {vigencia.vencido ? "El corpus se agotó" : "Toca renovar el corpus"}
            </h2>
            <p className="mt-1 text-sm text-accent-950">
              {vigencia.vencido
                ? `El corpus terminó el ${vigencia.ultimoDia}. Desde entonces la app cae a las frases placeholder heredadas.`
                : `Quedan ${vigencia.diasRestantes} días de material: el corpus termina el ${vigencia.ultimoDia}. Hay que producir el ciclo siguiente antes de esa fecha.`}
            </p>
            <p className="mt-2 text-xs text-accent-950">
              Con la base de conocimiento nueva en su carpeta, se regenera con{" "}
              <code className="rounded bg-white/70 px-1 py-0.5 font-mono">
                node scripts/generar-dataset-frases.mjs &quot;ruta/a/la/carpeta&quot;
              </code>{" "}
              y se despliega. El script verifica los 365 días y las 8 audiencias antes de escribir
              nada.
            </p>
          </section>
        ) : null}

        {altaSinDecidir.length ? (
          <section className="rounded-lg border border-accent-300 bg-accent-50 p-5">
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-accent-950">
              Días de máxima exposición sin completar
            </h2>
            <p className="mt-1 text-xs text-accent-950">
              El corpus recomienda una pasada humana sobre los días de calor 9–10: son los de mayor
              riesgo reputacional.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {altaSinDecidir.slice(0, 12).map((d) => (
                <Link
                  key={d.fecha}
                  href={`/panel/admin/frases?fecha=${d.fecha}`}
                  className="rounded-full border border-accent-500 bg-white px-3 py-1 text-xs font-semibold text-accent-950 hover:bg-accent-100"
                >
                  {d.fecha} · {d.evento || "sin evento"} · {conteoTotal.get(d.fecha) || 0}/
                  {TOTAL_AUDIENCIAS} · {d.calor}/10
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-5 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-brand-900">
              {NOMBRES_MES[Number(mes.slice(5, 7)) - 1]} {mes.slice(0, 4)}
            </h2>
            <div className="flex gap-2">
              {diasDelMes.length ? (
                <>
                  <Link
                    href={`/panel/admin/frases?fecha=${acotarFecha(`${desdeMes.slice(0, 8)}01`) || PRIMER_DIA}`}
                    className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:border-brand-300"
                  >
                    Inicio de mes
                  </Link>
                  <Link
                    href={`/panel/admin/frases?fecha=${hoy}`}
                    className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:border-brand-300"
                  >
                    Hoy
                  </Link>
                </>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {diasDelMes.map((d) => {
              const decididas = conteoMes.get(d.fecha) || 0;
              const completo = decididas >= TOTAL_AUDIENCIAS;
              const esActual = d.fecha === fecha;
              return (
                <Link
                  key={d.fecha}
                  href={`/panel/admin/frases?fecha=${d.fecha}`}
                  title={`${d.fecha} · calor ${d.calor}/10${d.evento ? ` · ${d.evento}` : ""} · ${decididas}/${TOTAL_AUDIENCIAS} audiencias`}
                  className={`flex w-14 flex-col items-center rounded-md px-1 py-1.5 text-center ${claseCalor(
                    d.calor,
                  )} ${esActual ? "ring-2 ring-brand-900 ring-offset-1" : ""}`}
                >
                  <span className="text-sm font-bold tabular-nums">{Number(d.fecha.slice(8))}</span>
                  <span className="text-[9px] font-semibold uppercase opacity-80">
                    {d.calor}/10
                  </span>
                  <span className="mt-0.5 text-[10px] font-bold">
                    {completo ? "✓" : decididas > 0 ? `${decididas}/${TOTAL_AUDIENCIAS}` : "·"}
                  </span>
                </Link>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] text-neutral-600">
            ✓ las 8 audiencias decididas · n/8 a medio decidir · · sin empezar. El color es el
            calor psicosocial del día.
          </p>
        </section>

        {dia ? (
          <DailyPhraseReview sesion={sesionDeUnDia} verificaciones={verificaciones} />
        ) : (
          <p className="rounded-lg border border-neutral-200 bg-neutral-50 p-5 text-sm text-neutral-700">
            Esa fecha está fuera de la ventana del corpus ({PRIMER_DIA} → {ULTIMO_DIA}).
          </p>
        )}

        {dia ? (
          // La `key` fuerza el remontaje al cambiar de día o de audiencia en la
          // URL: sin ella el componente sobrevive a la navegación suave y se
          // queda con la audiencia del render anterior, así que el enlace
          // «buscar a mano» parecía no hacer nada.
          <div id="sustituir" className="scroll-mt-6">
            <PhraseSubstitute
              key={`${fecha}:${audienciaFoco || ""}`}
              fecha={fecha}
              facetas={facetas}
              selecciones={selecciones}
              audienciaInicial={audienciaFoco}
            />
          </div>
        ) : null}

        <PhraseSourceChecklist lista={lista} total={total} verificadas={verificadas} />

        {historial.length ? (
          <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-5 shadow-card">
            <h2 className="text-lg font-bold text-brand-900">Últimas decisiones</h2>
            <div className="mt-3 space-y-2">
              {historial.map((h) => (
                <div key={h.id} className="rounded-lg border border-neutral-200 bg-white px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-600">
                    <Link
                      href={`/panel/admin/frases?fecha=${h.date}`}
                      className="rounded-md bg-neutral-100 px-2 py-1 font-bold tabular-nums text-neutral-800"
                    >
                      {h.date}
                    </Link>
                    <span className="rounded-full bg-neutral-200 px-2 py-0.5 font-bold text-neutral-800">
                      {h.audience}
                    </span>
                    <span className="rounded-full border border-neutral-300 px-2 py-0.5 font-semibold">
                      {h.status === "SKIPPED"
                        ? "sin publicación"
                        : h.status === "SUBSTITUTED"
                          ? "sustituida"
                          : "elegida"}
                    </span>
                  </div>
                  {h.status !== "SKIPPED" ? (
                    <>
                      <p className="mt-2 text-sm text-neutral-900">«{h.phraseText}»</p>
                      <p className="mt-1 text-[11px] text-neutral-600">
                        <span className="font-semibold text-neutral-800">{h.author}</span>{" "}
                        <span className="italic">{h.work}</span>
                      </p>
                    </>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
