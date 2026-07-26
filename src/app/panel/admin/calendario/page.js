import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/actions/auth-actions";
import PsychosocialBriefing from "@/components/admin/PsychosocialBriefing";
import PsychosocialHeatmap from "@/components/admin/PsychosocialHeatmap";
import PsychosocialHeatCurve from "@/components/admin/PsychosocialHeatCurve";
import { calorDelMes, fechaHoy } from "@/lib/frases";
import {
  momentoActual,
  matrizAnual,
  marcasEnRango,
  sumarDias,
  diferenciaDias,
  NOMBRES_MES,
  VENTANAS,
} from "@/lib/psychosocial-calendar";
import { coberturaDeTemas, resumirCobertura } from "@/lib/psychosocial-calendar-queries";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TIPOS = {
  EFEMERIDE: "Efeméride",
  FERIADO: "Feriado",
  ACADEMICO: "Académico",
  LABORAL: "Laboral",
  COMERCIAL: "Comercial",
  SOCIAL: "Social",
  ESTRUCTURAL: "Estructural",
};

function etiquetaFecha(marca) {
  const [, mes, dia] = marca.inicio.split("-");
  const inicio = `${Number(dia)} ${NOMBRES_MES[Number(mes) - 1].slice(0, 3)}`;
  if (marca.fin === marca.inicio) return inicio;
  const [, mesFin, diaFin] = marca.fin.split("-");
  return `${inicio} – ${Number(diaFin)} ${NOMBRES_MES[Number(mesFin) - 1].slice(0, 3)}`;
}

export default async function AdminCalendarPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/ingresar");

  const momento = momentoActual();

  // Horizonte de doce meses a partir del mes en curso: el calendario acompaña al
  // año que se está viviendo, no al ciclo cerrado del documento.
  const columnas = matrizAnual(momento.anio, momento.mes, 13);
  const marcas = marcasEnRango(momento.fecha, sumarDias(momento.fecha, 365));

  const slugs = [
    ...momento.ventanasActivas.flatMap(({ marca }) => marca.temas || []),
    ...marcas.flatMap((m) => m.temas || []),
  ];
  const cobertura = await coberturaDeTemas(slugs);

  // Curva diaria de calor del corpus de frases, en los meses del horizonte que
  // el corpus alcanza a cubrir. Es la resolución fina bajo la matriz de ejes.
  const curva = columnas
    .map((c) => calorDelMes(c.anio, c.mes))
    .filter(Boolean);

  const porMes = new Map();
  for (const marca of marcas) {
    const clave = marca.inicio.slice(0, 7);
    if (!porMes.has(clave)) porMes.set(clave, []);
    porMes.get(clave).push(marca);
  }

  return (
    <div className="min-h-screen bg-surface p-6">
      <div className="mx-auto max-w-7xl space-y-8">
        <div>
          <Link href="/panel/admin/tareas" className="text-sm text-neutral-500 hover:text-neutral-700">
            Inventario diario
          </Link>
          <h1 className="text-3xl font-bold text-brand-900">Calendario psicosocial</h1>
          <p className="text-sm text-neutral-700">
            Los hitos del año costarricense mapeados contra picos de estrés, liquidez y agotamiento
            académico o laboral. Fuente: matriz estratégica de salud mental Costa Rica.
          </p>
        </div>

        <PsychosocialBriefing momento={momento} cobertura={cobertura} />

        <PsychosocialHeatmap
          columnas={columnas}
          mesActual={momento.mes}
          anioActual={momento.anio}
        />

        <PsychosocialHeatCurve meses={curva} hoy={fechaHoy()} />

        <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-5 shadow-card">
          <h2 className="text-lg font-bold text-brand-900">Las ventanas de pauta</h2>
          <p className="mt-1 text-sm text-neutral-650">
            La gente no colapsa durante el pico, sino cuando la exigencia cede y el recurso
            defensivo se agota. Por eso la campaña se pauta antes o después, no encima.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            {VENTANAS.map((ventana) => (
              <div key={ventana.id} className="rounded-lg border border-neutral-200 bg-white p-4">
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">
                  T{ventana.desde} a T{ventana.hasta > 0 ? `+${ventana.hasta}` : ventana.hasta}
                </div>
                <div className="mt-1 text-sm font-bold text-brand-900">{ventana.label}</div>
                <p className="mt-1 text-xs text-neutral-700">{ventana.accion}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-bold text-brand-900">Los próximos doce meses</h2>
          {[...porMes.entries()].map(([clave, delMes]) => {
            const [anio, mes] = clave.split("-").map(Number);
            const columna = columnas.find((c) => c.anio === anio && c.mes === mes);
            return (
              <div
                key={clave}
                className="rounded-lg border border-neutral-200 bg-neutral-50 p-5 shadow-card"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-base font-bold text-brand-900">
                    {NOMBRES_MES[mes - 1].charAt(0).toUpperCase() + NOMBRES_MES[mes - 1].slice(1)}{" "}
                    {anio}
                  </h3>
                  {columna ? (
                    <span className="text-xs font-semibold text-neutral-600">
                      Fatiga {columna.fatiga} · ruido {columna.ruido} · oportunidad{" "}
                      <strong className="text-brand-900">{columna.oportunidad.toFixed(1)}</strong>
                      {columna.estructura.nota ? ` · ${columna.estructura.nota}` : ""}
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 space-y-2">
                  {delMes.map((marca) => {
                    const resumen = resumirCobertura(marca, cobertura);
                    const faltan = diferenciaDias(momento.fecha, marca.pico);
                    return (
                      <article
                        key={`${marca.id}-${marca.inicio}`}
                        className="rounded-lg border border-neutral-200 bg-white px-4 py-3"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md bg-neutral-100 px-2 py-1 text-xs font-bold tabular-nums text-neutral-800">
                            {etiquetaFecha(marca)}
                          </span>
                          <span className="text-sm font-bold text-neutral-950">{marca.titulo}</span>
                          <span className="rounded-full border border-neutral-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-600">
                            {TIPOS[marca.tipo] || marca.tipo}
                          </span>
                          {marca.prioridad === "ALTA" ? (
                            <span className="rounded-full bg-accent-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-accent-950">
                              Prioridad alta
                            </span>
                          ) : null}
                          {marca.estimado || marca.nota ? (
                            <span
                              className="rounded-full border border-neutral-300 px-2 py-0.5 text-[10px] font-semibold text-neutral-600"
                              title={marca.nota}
                            >
                              fecha por confirmar
                            </span>
                          ) : null}
                          {faltan >= 0 ? (
                            <span className="ml-auto text-xs font-semibold tabular-nums text-neutral-600">
                              en {faltan} d
                            </span>
                          ) : null}
                        </div>

                        <p className="mt-2 text-xs text-neutral-700">{marca.vector}</p>
                        <p className="mt-1 text-xs text-neutral-800">
                          <strong>Foco:</strong> {marca.foco}
                        </p>

                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                          {(marca.publico || []).map((p) => (
                            <span
                              key={p}
                              className="rounded-full bg-neutral-100 px-2 py-1 font-semibold text-neutral-700"
                            >
                              {p}
                            </span>
                          ))}
                          {!resumen.sinTema ? (
                            <span className="rounded-full bg-neutral-100 px-2 py-1 font-semibold text-neutral-700">
                              {resumen.publicados} publicados · {resumen.carruseles} carruseles
                            </span>
                          ) : null}
                          {resumen.faltantes.length ? (
                            <Link
                              href="/panel/admin/blog/taxonomia"
                              className="rounded-full border border-neutral-300 px-2 py-1 font-semibold text-neutral-800 hover:border-brand-300"
                            >
                              crear tema: {resumen.faltantes.join(", ")}
                            </Link>
                          ) : null}
                          <span className="ml-auto text-neutral-500">{marca.fuente}</span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}
