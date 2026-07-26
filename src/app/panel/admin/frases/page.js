import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/actions/auth-actions";
import DailyPhraseReview from "@/components/admin/DailyPhraseReview";
import PhraseSubstitute from "@/components/admin/PhraseSubstitute";
import PhraseSourceChecklist from "@/components/admin/PhraseSourceChecklist";
import {
  PRIMER_DIA,
  ULTIMO_DIA,
  VERSION_CORPUS,
  diaDeFrases,
  diasDeAltaExposicion,
  existeDia,
  facetasDelCorpus,
  fechaHoy,
  fechaVigente,
  resumenRango,
  sesionDe,
  totalFrases,
  totalFuentes,
} from "@/lib/frases";
import {
  historialDeSelecciones,
  listaDeVerificacion,
  seleccionDe,
  seleccionesEnRango,
  verificacionDeFuentes,
} from "@/lib/frases-queries";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NOMBRES_MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre",
];

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

  const dia = diaDeFrases(fecha);
  const seleccion = await seleccionDe(fecha);

  // Rejilla del mes de la fecha en foco.
  const mes = fecha.slice(0, 7);
  const desdeMes = `${mes}-01`;
  const hastaMes = `${mes}-31`;
  const diasDelMes = resumenRango(desdeMes, hastaMes);
  const seleccionesMes = await seleccionesEnRango(desdeMes, hastaMes);

  const verificadasDelDia = await verificacionDeFuentes(
    dia ? dia.candidatas.map((c) => c.claveFuente) : [],
  );
  const verificaciones = Object.fromEntries(
    [...verificadasDelDia.entries()].map(([k, v]) => [k, v.verified]),
  );

  const { lista, total, verificadas } = await listaDeVerificacion({ limite: 60 });
  const historial = await historialDeSelecciones(12);
  const facetas = facetasDelCorpus();

  const todos = resumenRango(PRIMER_DIA, ULTIMO_DIA);
  const decididas = await seleccionesEnRango(PRIMER_DIA, ULTIMO_DIA);
  const altaExposicion = diasDeAltaExposicion(hoy, ULTIMO_DIA);
  const altaSinDecidir = altaExposicion.filter((d) => !decididas.has(d.fecha));

  // Se reusa el componente de la revisión diaria dándole una sesión de un solo
  // día: así la elección, la omisión y la reapertura se comportan igual aquí que
  // en las acciones diarias.
  const sesionDeUnDia = {
    fecha: hoy,
    objetivoDeHoy: [],
    atrasadas: 0,
    pendientes: dia
      ? [
          {
            fecha,
            sesion: sesionDe(fecha),
            atrasada: sesionDe(fecha) < hoy && !seleccion,
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
            seleccion: seleccion
              ? {
                  phraseIndex: seleccion.phraseIndex,
                  status: seleccion.status,
                  author: seleccion.author,
                }
              : null,
          },
        ]
      : [],
  };

  const metricas = [
    { label: "Días decididos", value: `${decididas.size}/${todos.length}`, help: "En toda la ventana del corpus" },
    { label: "Frases del corpus", value: totalFrases(), help: `${totalFuentes()} pares autor–obra` },
    { label: "Fuentes verificadas", value: `${verificadas}/${total}`, help: "Candado de la placa de redes" },
    { label: "Alta exposición", value: altaSinDecidir.length, help: "Días de calor 9-10 sin decidir" },
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

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

        {altaSinDecidir.length ? (
          <section className="rounded-lg border border-accent-300 bg-accent-50 p-5">
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-accent-950">
              Días de máxima exposición sin decidir
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
                  {d.fecha} · {d.evento || "sin evento"} · {d.calor}/10
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
              const decidida = seleccionesMes.get(d.fecha);
              const esActual = d.fecha === fecha;
              return (
                <Link
                  key={d.fecha}
                  href={`/panel/admin/frases?fecha=${d.fecha}`}
                  title={`${d.fecha} · calor ${d.calor}/10${d.evento ? ` · ${d.evento}` : ""}${
                    decidida ? " · decidida" : " · sin decidir"
                  }`}
                  className={`flex w-14 flex-col items-center rounded-md px-1 py-1.5 text-center ${claseCalor(
                    d.calor,
                  )} ${esActual ? "ring-2 ring-brand-900 ring-offset-1" : ""}`}
                >
                  <span className="text-sm font-bold tabular-nums">{Number(d.fecha.slice(8))}</span>
                  <span className="text-[9px] font-semibold uppercase opacity-80">
                    {d.calor}/10
                  </span>
                  <span className="mt-0.5 text-[10px] font-bold">
                    {decidida ? (decidida.status === "SKIPPED" ? "—" : "✓") : "·"}
                  </span>
                </Link>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] text-neutral-600">
            ✓ decidida · — sin publicación · · pendiente. El color es el calor psicosocial del día.
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
          <PhraseSubstitute
            fecha={fecha}
            facetas={facetas}
            elegida={seleccion?.phraseIndex ?? null}
          />
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
                    <span className="rounded-full border border-neutral-300 px-2 py-0.5 font-semibold">
                      {h.status === "SKIPPED"
                        ? "sin publicación"
                        : h.status === "SUBSTITUTED"
                          ? "sustituida"
                          : "elegida"}
                    </span>
                    {h.audience ? <span>{h.audience}</span> : null}
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
