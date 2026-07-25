import Link from "next/link";
import { EJES, NOMBRES_MES } from "@/lib/psychosocial-calendar";
import { resumirCobertura } from "@/lib/psychosocial-calendar-queries";

const TONO_VENTANA = {
  PREPARACION: "border-neutral-300 bg-white text-neutral-800",
  PREVENCION: "border-accent-300 bg-accent-50 text-accent-950",
  PICO: "border-accent-500 bg-accent-100 text-accent-950",
  INTEGRACION: "border-brand-300 bg-brand-50 text-brand-950",
};

const ESCALA_PUNTO = [
  "bg-neutral-200",
  "bg-accent-100",
  "bg-accent-300",
  "bg-accent-500",
  "bg-accent-700",
];

function formatearFecha(iso, diaSemana) {
  const [anio, mes, dia] = iso.split("-");
  return `${diaSemana} ${Number(dia)} de ${NOMBRES_MES[Number(mes) - 1]}, ${anio}`;
}

function Cobertura({ marca, cobertura }) {
  const resumen = resumirCobertura(marca, cobertura);
  if (resumen.sinTema) return null;

  const necesitaCuraduria = resumen.faltantes.length > 0;
  const sinNada = resumen.publicados === 0 && resumen.borradores === 0;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
      <span
        className={`rounded-full px-2 py-1 font-bold ${
          sinNada ? "bg-accent-100 text-accent-950" : "bg-neutral-100 text-neutral-700"
        }`}
      >
        {resumen.publicados} publicados · {resumen.borradores} borradores ·{" "}
        {resumen.carruseles} carruseles
      </span>
      {necesitaCuraduria ? (
        <Link
          href="/panel/admin/blog/taxonomia"
          className="rounded-full border border-neutral-300 px-2 py-1 font-semibold text-neutral-800 hover:border-brand-300"
        >
          Falta crear el tema: {resumen.faltantes.join(", ")}
        </Link>
      ) : null}
    </div>
  );
}

export default function PsychosocialBriefing({ momento, cobertura, compacto = false }) {
  const {
    fecha,
    diaSemana,
    etiquetaMes,
    ejes,
    ejesDominantes,
    estructura,
    fatiga,
    ruido,
    oportunidad,
    esVentanaSilenciosa,
    ventanasActivas,
    contexto,
    proximas,
  } = momento;

  return (
    <section className="rounded-lg border border-brand-200 bg-brand-50 p-5 shadow-card">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">
            Dónde estamos hoy
          </div>
          <h2 className="mt-1 text-lg font-bold text-brand-900">
            {formatearFecha(fecha, diaSemana)}
          </h2>
          <p className="mt-1 text-sm text-brand-950">
            {etiquetaMes.charAt(0).toUpperCase() + etiquetaMes.slice(1)} carga sobre todo el eje{" "}
            <strong>{ejesDominantes.map((id) => EJES.find((e) => e.id === id).label.toLowerCase()).join(" y ")}</strong>
            .{" "}
            {esVentanaSilenciosa
              ? "Es una ventana silenciosa: mucha fatiga acumulada y poco ruido institucional compitiendo por la atención."
              : "El ecosistema ya está hablando de salud mental este mes, así que la atención es más cara."}
          </p>
          {estructura.nota ? (
            <p className="mt-2 text-xs text-brand-800">{estructura.nota}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {EJES.map((eje) => {
            const valor = ejes[eje.id] ?? 0;
            return (
              <div
                key={eje.id}
                className="min-w-20 rounded-lg border border-brand-200 bg-white px-3 py-2 text-center"
                title={eje.descripcion}
              >
                <div className={`mx-auto h-2 w-8 rounded-full ${ESCALA_PUNTO[valor]}`} />
                <div className="mt-1 text-lg font-bold text-brand-900 tabular-nums">{valor}</div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-600">
                  {eje.label.split(" ")[0]}
                </div>
              </div>
            );
          })}
          <div className="min-w-20 rounded-lg border border-brand-300 bg-brand-900 px-3 py-2 text-center text-white">
            <div className="text-lg font-bold tabular-nums">{oportunidad.toFixed(1)}</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] opacity-80">
              Oportunidad
            </div>
            <div className="text-[9px] opacity-70">
              fatiga {fatiga} − ruido {ruido}
            </div>
          </div>
        </div>
      </div>

      {ventanasActivas.length ? (
        <div className="mt-5">
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">
            Ventanas abiertas ({ventanasActivas.length})
          </div>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {ventanasActivas.slice(0, compacto ? 4 : ventanasActivas.length).map(({ marca, ventana }) => (
              <div
                key={`${marca.id}-${ventana.id}`}
                className={`rounded-lg border px-3 py-3 ${TONO_VENTANA[ventana.id]}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-bold">{marca.titulo}</span>
                  <span className="shrink-0 rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em]">
                    {ventana.label}
                  </span>
                </div>
                <p className="mt-1 text-xs opacity-90">
                  {ventana.diasAlPico > 0
                    ? `Faltan ${ventana.diasAlPico} días`
                    : ventana.diasAlPico === 0
                      ? "Es hoy"
                      : `Hace ${-ventana.diasAlPico} días`}{" "}
                  · {ventana.accion}
                </p>
                {!compacto ? (
                  <>
                    <p className="mt-1 text-xs opacity-80">{marca.vector}</p>
                    <Cobertura marca={marca} cobertura={cobertura} />
                  </>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-5 text-sm text-brand-800">
          No hay ventanas abiertas hoy. Es un buen día para producir contenido de fondo.
        </p>
      )}

      {contexto.length ? (
        <div className="mt-5">
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">
            Contexto del mes
          </div>
          <ul className="mt-2 space-y-1">
            {contexto.map((marca) => (
              <li key={marca.id} className="text-xs text-brand-950">
                <strong>{marca.titulo}.</strong> {marca.vector}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {proximas.length ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {proximas.map(({ marca, faltan }) => (
            <span
              key={`${marca.id}-${marca.inicio}`}
              className="rounded-full border border-brand-200 bg-white px-3 py-1 text-xs text-neutral-800"
              title={marca.vector}
            >
              <strong className="text-brand-900">{faltan} d</strong> · {marca.titulo}
            </span>
          ))}
        </div>
      ) : null}

      {compacto ? (
        <Link
          href="/panel/admin/calendario"
          className="mt-5 inline-block rounded-lg border border-brand-300 bg-white px-3 py-2 text-sm font-semibold text-brand-900 hover:bg-brand-100"
        >
          Ver el calendario del año
        </Link>
      ) : null}
    </section>
  );
}
