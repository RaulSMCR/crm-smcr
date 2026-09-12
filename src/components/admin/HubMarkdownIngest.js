"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { publishProfessionalHubModules } from "@/actions/professional-hub-actions";
// Los límites salen del parser y no se copian acá: si el servidor acepta doce
// archivos y esta pantalla deja soltar veinte, el rechazo llega después de leer
// todo. `hub-markdown` es puro, así que viaja al navegador sin arrastrar Prisma
// ni node:crypto (eso vive en `hub-ingest`, que esta pantalla no importa).
import { EXTENSIONES, MAX_ARCHIVOS_LOTE, MAX_ARCHIVO_BYTES } from "@/lib/hub-markdown";

/**
 * Ingesta de documentos `.md` en un hub profesional.
 *
 * Tres estados y una regla: **entre soltar y escribir hay un informe**. Se leen
 * los archivos, se muestra qué cambiaría en cada módulo, y solo entonces
 * aparece el botón de aplicar. Nada se escribe mientras el informe está a la
 * vista.
 *
 * El texto de cada archivo se lee en el navegador y viaja como JSON; el `sha256`
 * que devuelve el informe se reenvía al confirmar, y el servidor lo recalcula.
 * Así lo que se escribe es exactamente lo que se mostró.
 */
export default function HubMarkdownIngest({ hubId, hubSlug }) {
  const router = useRouter();
  const inputRef = useRef(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);
  const [archivos, setArchivos] = useState([]);
  const [informe, setInforme] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [publicando, publicar] = useTransition();
  const [avisoPublicacion, setAvisoPublicacion] = useState(null);

  function limpiar() {
    setArchivos([]);
    setInforme(null);
    setResultado(null);
    setError(null);
    setAvisoPublicacion(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function leerArchivos(listaCruda) {
    const lista = Array.from(listaCruda || []);
    if (!lista.length) return;

    setError(null);
    setResultado(null);
    setAvisoPublicacion(null);

    if (lista.length > MAX_ARCHIVOS_LOTE) {
      setError(`Máximo ${MAX_ARCHIVOS_LOTE} archivos por lote. Llegaron ${lista.length}.`);
      return;
    }
    for (const archivo of lista) {
      if (!EXTENSIONES.some((extension) => archivo.name.toLowerCase().endsWith(extension))) {
        setError(`«${archivo.name}» no es .md, .markdown ni .txt.`);
        return;
      }
      if (archivo.size > MAX_ARCHIVO_BYTES) {
        setError(`«${archivo.name}» pesa más de 2 MB.`);
        return;
      }
    }

    setOcupado(true);
    try {
      const leidos = await Promise.all(
        lista.map(async (archivo) => ({ nombre: archivo.name, texto: await archivo.text() })),
      );
      const respuesta = await fetch(`/api/admin/hubs/${hubId}/ingesta/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archivos: leidos }),
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) {
        setError(datos?.error || "No se pudo leer el lote.");
        setInforme(null);
        return;
      }
      // El texto se guarda para el confirm: el servidor no lo conserva entre
      // las dos llamadas, así que el navegador lo vuelve a mandar con su hash.
      setArchivos(leidos.map((archivo) => ({ ...archivo, sha256: datos.lote.find((fila) => fila.archivo === archivo.nombre)?.sha256 })));
      setInforme(datos);
    } catch (errorLectura) {
      console.error("ingesta de hub · lectura falló:", errorLectura);
      setError("No se pudieron leer los archivos.");
    } finally {
      setOcupado(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function aplicar() {
    if (!informe) return;
    const escribibles = new Set(informe.lote.filter((fila) => fila.escribible).map((fila) => fila.archivo));
    const carga = archivos.filter((archivo) => escribibles.has(archivo.nombre));
    if (!carga.length) return;

    setOcupado(true);
    setError(null);
    try {
      const respuesta = await fetch(`/api/admin/hubs/${hubId}/ingesta/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archivos: carga }),
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) {
        setError(datos?.error || "No se pudo aplicar el lote.");
        return;
      }
      setResultado(datos);
      setInforme(null);
      setArchivos([]);
      router.refresh();
    } catch (errorEscritura) {
      console.error("ingesta de hub · confirm falló:", errorEscritura);
      setError("No se pudo aplicar el lote.");
    } finally {
      setOcupado(false);
    }
  }

  const borradores = (resultado?.aplicados || []).filter((fila) => fila.clase === "tema" && !fila.publicado);

  function publicarBorradores() {
    const slugs = borradores.map((fila) => fila.slug).filter(Boolean);
    if (!slugs.length) return;
    setAvisoPublicacion(null);
    publicar(async () => {
      const salida = await publishProfessionalHubModules(hubId, slugs);
      if (salida?.error) {
        setAvisoPublicacion({ tipo: "error", texto: salida.error });
        return;
      }
      const partes = [];
      if (salida.publicados?.length) partes.push(`Publicado: ${salida.publicados.join(", ")}.`);
      if (salida.omitidos?.length) partes.push(`Sin publicar por no tener cuerpo: ${salida.omitidos.join(", ")}.`);
      setAvisoPublicacion({ tipo: "ok", texto: partes.join(" ") || "Nada que publicar." });
      setResultado(null);
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-brand-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold text-slate-950">Importar contenido desde archivos .md</h2>
      <p className="mt-1 text-sm text-slate-600">
        Un archivo por tema, con el nombre del archivo como slug. <span className="font-mono">_hub.md</span> configura el hub.
        Se lee, se muestra qué cambiaría y recién entonces se escribe. Lo nuevo entra como borrador.
      </p>

      {informe || resultado ? null : (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragEnter={(event) => { event.preventDefault(); setArrastrando(true); }}
            onDragOver={(event) => { event.preventDefault(); setArrastrando(true); }}
            onDragLeave={(event) => { event.preventDefault(); setArrastrando(false); }}
            onDrop={(event) => { event.preventDefault(); setArrastrando(false); leerArchivos(event.dataTransfer?.files); }}
            disabled={ocupado}
            className={[
              "mt-5 flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition",
              arrastrando ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/40",
              ocupado ? "cursor-wait opacity-70" : "cursor-pointer",
            ].join(" ")}
          >
            <span className="text-sm font-semibold text-slate-800">
              {ocupado ? "Leyendo los archivos…" : "Arrastrá uno o varios archivos .md aquí"}
            </span>
            <span className="text-xs text-slate-500">
              o hacé clic para buscarlos en tu equipo · hasta {MAX_ARCHIVOS_LOTE} archivos, 2 MB cada uno
            </span>
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".md,.markdown,.mdown,.txt,text/markdown,text/plain"
            className="hidden"
            onChange={(event) => leerArchivos(event.target.files)}
          />
        </>
      )}

      {error ? <p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}

      {informe ? <Informe informe={informe} hubSlug={hubSlug} ocupado={ocupado} onAplicar={aplicar} onCancelar={limpiar} /> : null}

      {resultado ? (
        <div className="mt-5 space-y-3">
          <p className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">
            Se escribieron {resultado.aplicados.length} {resultado.aplicados.length === 1 ? "pieza" : "piezas"}.
          </p>
          <ul className="space-y-2 text-sm">
            {resultado.aplicados.map((fila) => (
              <li key={fila.archivo} className="rounded border border-slate-200 bg-slate-50 p-3">
                <span className="font-mono text-xs text-slate-500">{fila.archivo}</span>
                <p className="font-semibold text-slate-900">
                  {fila.accion === "crear" ? "Creado" : "Actualizado"} · {fila.ruta}
                  <span className={fila.publicado ? "ml-2 text-emerald-700" : "ml-2 text-amber-700"}>
                    {fila.publicado ? "publicado" : "borrador"}
                  </span>
                </p>
              </li>
            ))}
          </ul>

          {borradores.length ? (
            <div className="rounded border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm text-amber-900">
                Quedaron en borrador: {borradores.map((fila) => fila.slug).join(", ")}. Una importación no publica.
              </p>
              <button
                type="button"
                onClick={publicarBorradores}
                disabled={publicando}
                className="mt-3 rounded-lg bg-brand-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {publicando ? "Publicando…" : `Publicar ${borradores.length === 1 ? "el módulo importado" : `los ${borradores.length} módulos importados`}`}
              </button>
            </div>
          ) : null}

          {avisoPublicacion ? (
            <p className={`rounded border p-3 text-sm ${avisoPublicacion.tipo === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
              {avisoPublicacion.texto}
            </p>
          ) : null}

          <button type="button" onClick={limpiar} className="text-sm font-semibold text-slate-600 hover:underline">
            Importar otros archivos
          </button>
        </div>
      ) : null}
    </section>
  );
}

function Informe({ informe, hubSlug, ocupado, onAplicar, onCancelar }) {
  const { lote, resumen } = informe;
  const escribibles = lote.filter((fila) => fila.escribible).length;

  return (
    <div className="mt-5 space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
        <span className="font-semibold">Nada se ha escrito todavía.</span>
        <span>{resumen.crear} por crear · {resumen.actualizar} por actualizar · {resumen.bloqueados} bloqueados · {resumen.avisos} avisos</span>
      </div>

      {informe.hub && !informe.hub.rutaExiste ? (
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Este hub no tiene página pública todavía: <span className="font-mono">/{hubSlug}</span> devuelve 404 porque las páginas
          de hub son carpetas del proyecto. El contenido se guarda bien y se verá cuando exista la ruta.
        </p>
      ) : null}

      <ul className="space-y-3">
        {lote.map((fila) => (
          <li
            key={fila.archivo}
            className={`rounded-xl border p-4 ${fila.escribible ? "border-slate-200 bg-white" : "border-red-200 bg-red-50/40"}`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-mono text-xs text-slate-500">{fila.archivo}</span>
              <span className={`text-xs font-bold uppercase tracking-wide ${fila.escribible ? "text-slate-600" : "text-red-700"}`}>
                {fila.escribible ? (fila.accion === "crear" ? "crear" : "actualizar") : "bloqueado"}
              </span>
            </div>
            <p className="mt-1 font-semibold text-slate-900">
              {fila.clase === "hub" ? "Configuración del hub" : fila.ruta || fila.slug}
              {fila.clase === "tema" && fila.accion === "actualizar" ? (
                <span className={fila.publicadoActual ? "ml-2 text-xs font-semibold text-emerald-700" : "ml-2 text-xs font-semibold text-amber-700"}>
                  {fila.publicadoActual ? "publicado" : "borrador"}
                </span>
              ) : null}
            </p>

            {fila.diff?.length ? (
              <table className="mt-3 w-full table-fixed text-xs">
                <tbody>
                  {fila.diff.map((cambio, indice) => (
                    <tr key={`${fila.archivo}-${cambio.campo}-${indice}`} className="border-t border-slate-100 align-top">
                      <th scope="row" className="w-32 py-1 pr-2 text-left font-semibold text-slate-600">{cambio.campo}</th>
                      <td className="w-1/2 py-1 pr-2 text-slate-500 line-through decoration-slate-300">{cambio.antes || "—"}</td>
                      <td className="py-1 text-slate-900">{cambio.despues || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="mt-2 text-xs text-slate-500">Sin cambios respecto de lo que ya está guardado.</p>
            )}

            {fila.bloqueos?.length ? (
              <ul className="mt-3 space-y-1 text-xs text-red-800">
                {fila.bloqueos.map((bloqueo, indice) => (
                  <li key={`${fila.archivo}-b-${indice}`}>· {bloqueo}</li>
                ))}
              </ul>
            ) : null}

            {fila.avisos?.length ? (
              <ul className="mt-3 space-y-1 text-xs text-amber-800">
                {fila.avisos.map((aviso, indice) => (
                  <li key={`${fila.archivo}-a-${indice}`}>· {aviso}</li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onAplicar}
          disabled={ocupado || !escribibles}
          className="rounded-lg bg-brand-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {ocupado ? "Escribiendo…" : escribibles ? `Aplicar ${escribibles} ${escribibles === 1 ? "archivo" : "archivos"}` : "Nada que aplicar"}
        </button>
        <button type="button" onClick={onCancelar} className="text-sm font-semibold text-slate-600 hover:underline">
          Cancelar
        </button>
        {resumen.bloqueados ? (
          <span className="text-xs text-red-700">
            {resumen.bloqueados} {resumen.bloqueados === 1 ? "archivo queda" : "archivos quedan"} fuera del lote.
          </span>
        ) : null}
      </div>
    </div>
  );
}
