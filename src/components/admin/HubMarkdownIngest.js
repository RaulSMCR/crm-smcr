"use client";

import { useRef, useState, useTransition } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { useRouter } from "next/navigation";
import { publishProfessionalHubModules } from "@/actions/professional-hub-actions";
// Los límites salen del parser y no se copian acá: si el servidor acepta doce
// archivos y esta pantalla deja soltar veinte, el rechazo llega después de leer
// todo. `hub-markdown` es puro, así que viaja al navegador sin arrastrar Prisma
// ni node:crypto (eso vive en `hub-ingest`, que esta pantalla no importa).
import { EXTENSIONES, MAX_ARCHIVOS_LOTE, MAX_ARCHIVOS_FEED, MAX_ARCHIVO_BYTES, MAX_LOTE_BYTES } from "@/lib/hub-markdown";

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
 *
 * El destino tiene dos formas y un solo mecanismo (`destino` en el cuerpo de las
 * dos llamadas), así que el mismo componente sirve para las dos:
 *
 *   - **zona del hub** (`modulos`): el nombre del archivo decide el módulo —que
 *     es lo que permite importar un lote de una vez— y un selector manda un
 *     archivo suelto a un módulo concreto sin tener que renombrarlo;
 *   - **zona de un módulo** (`destino` fijo + `compacto`): el módulo ya lo
 *     decidió el formulario donde vive el bloque, y el nombre no cuenta.
 *
 * @param {object} props
 * @param {string} props.hubId
 * @param {string} props.hubSlug
 * @param {Array<{slug: string, title: string}>} [props.modulos] módulos que ofrece
 *   el selector; vacío ⇒ sin selector.
 * @param {string|null} [props.destino] slug fijo: sin selector y un archivo por vez.
 * @param {boolean} [props.compacto] chrome reducido, para vivir dentro de un formulario.
 */
export default function HubMarkdownIngest({ hubId, hubSlug, modulos = [], destino = null, compacto = false, tipoHub = "profesional" }) {
  const router = useRouter();
  const inputRef = useRef(null);
  const carpetaRef = useRef(null);
  const [feedUsado, setFeedUsado] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);
  const [archivos, setArchivos] = useState([]);
  const [informe, setInforme] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [publicando, publicar] = useTransition();
  const { avisar } = useToast();
  const [avisoPublicacion, setAvisoPublicacion] = useState(null);
  const [eleccion, setEleccion] = useState("");
  // El destino que produjo el informe, congelado: el confirm vuelve a leer el
  // lote con él, así que tiene que ser el que se mostró y no el que el selector
  // tenga encima cuando se aprieta «Aplicar».
  const [destinoUsado, setDestinoUsado] = useState(null);

  const destinoFijo = String(destino || "").trim() || null;
  const destinoEfectivo = destinoFijo || eleccion || null;
  const unSoloArchivo = Boolean(destinoEfectivo);

  function limpiar() {
    setArchivos([]);
    setInforme(null);
    setResultado(null);
    setError(null);
    setAvisoPublicacion(null);
    setDestinoUsado(null);
    if (inputRef.current) inputRef.current.value = "";
    if (carpetaRef.current) carpetaRef.current.value = "";
  }

  async function leerArchivos(listaCruda, feed = false) {
    const lista = Array.from(listaCruda || []).filter((archivo) => !feed || /\.md$/i.test(archivo.name));
    if (inputRef.current) inputRef.current.value = "";
    if (carpetaRef.current) carpetaRef.current.value = "";
    if (!lista.length) {
      if (feed) setError("La carpeta seleccionada no contiene archivos .md.");
      return;
    }

    setError(null);
    setResultado(null);
    setAvisoPublicacion(null);

    const tope = feed ? MAX_ARCHIVOS_FEED : unSoloArchivo ? 1 : MAX_ARCHIVOS_LOTE;
    if (lista.length > tope) {
      setError(
        unSoloArchivo
          ? `Con un módulo elegido se importa un archivo por vez. Llegaron ${lista.length}.`
          : `Máximo ${tope} archivos por lote. Llegaron ${lista.length}.`,
      );
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
    // Se congela acá y no se vuelve a leer del estado: entre el `await` de la
    // lectura y el informe, el selector podría haber cambiado.
    const destinoDelLote = feed ? null : destinoEfectivo;
    if (feed) setEleccion("");
    try {
      const leidos = await Promise.all(
        lista.map(async (archivo) => ({ nombre: feed ? archivo.webkitRelativePath || archivo.name : archivo.name, texto: await archivo.text() })),
      );
      const carga = JSON.stringify({ archivos: leidos, destino: destinoDelLote, feed, tipoHub });
      if (new TextEncoder().encode(carga).length > MAX_LOTE_BYTES - 16000) {
        setError("El lote supera el tamaño permitido (3 MB incluyendo el informe de confirmación). Dividí la carpeta antes de continuar.");
        return;
      }
      const respuesta = await fetch(`/api/admin/hubs/${hubId}/ingesta/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: carga,
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) {
        setError(datos?.error || "No se pudo leer el lote.");
        setInforme(null);
        return;
      }
      // El texto se guarda para el confirm: el servidor no lo conserva entre
      // las dos llamadas, así que el navegador lo vuelve a mandar con su hash.
      setArchivos(leidos.map((archivo, index) => ({ ...archivo, sha256: datos.lote[index]?.sha256 })));
      setInforme(datos);
      setDestinoUsado(destinoDelLote);
      setFeedUsado(feed);
    } catch (errorLectura) {
      console.error("ingesta de hub · lectura falló", { name: errorLectura?.name });
      setError("No se pudieron leer los archivos.");
    } finally {
      setOcupado(false);
      if (inputRef.current) inputRef.current.value = "";
      if (carpetaRef.current) carpetaRef.current.value = "";
    }
  }

  async function aplicar() {
    if (!informe) return;
    if (!informe.lote.some((fila) => fila.escribible)) return;

    setOcupado(true);
    setError(null);
    try {
      const respuesta = await fetch(`/api/admin/hubs/${hubId}/ingesta/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archivos, destino: destinoUsado, feed: feedUsado, tipoHub, revision: informe.revision }),
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
      console.error("ingesta de hub · confirm falló", { name: errorEscritura?.name });
      setError("No se pudo aplicar el lote.");
    } finally {
      setOcupado(false);
    }
  }

  const borradores = tipoHub === "profesional" ? (resultado?.aplicados || []).filter((fila) => fila.clase === "tema" && !fila.publicado) : [];

  function publicarBorradores() {
    const slugs = borradores.map((fila) => fila.slug).filter(Boolean);
    if (!slugs.length) return;
    setAvisoPublicacion(null);
    publicar(async () => {
      try {
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
      } catch (fallo) {
        // Antes esto se perdía como promesa rechazada: ni mensaje ni cambio.
        const mensaje = String(fallo?.message || "").trim() || "No se pudo completar la acción.";
        setAvisoPublicacion({ tipo: "error", texto: mensaje });
        avisar(mensaje, "error");
      }
    });
  }

  return (
    <Marco compacto={compacto} hubSlug={hubSlug} destinoFijo={destinoFijo} tipoHub={tipoHub}>
      {informe || resultado ? null : (
        <>
          {!destinoFijo && !compacto ? (
            <div className="mt-5">
              <button type="button" disabled={ocupado} onClick={() => carpetaRef.current?.click()} className="rounded-lg bg-brand-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                Cargar feed desde una carpeta
              </button>
              <p className="mt-2 text-xs text-slate-600">Seleccioná la carpeta con los .md del hub. Hasta {MAX_ARCHIVOS_FEED} archivos y 3 MB por lote. Primero se muestran las diferencias.</p>
              <input ref={carpetaRef} type="file" multiple webkitdirectory="" directory="" className="hidden" aria-label="Carpeta del feed del hub" onChange={(event) => leerArchivos(event.target.files, true)} />
            </div>
          ) : null}
          {destinoFijo || !modulos.length ? null : (
            <label className="mt-5 block text-sm text-slate-700">
              <span className="mb-1 block font-medium">Módulo de destino</span>
              <select
                value={eleccion}
                onChange={(event) => { setEleccion(event.target.value); setError(null); }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 md:w-auto"
              >
                <option value="">Por el nombre del archivo · varios a la vez</option>
                {modulos.map((modulo) => (
                  <option key={modulo.slug} value={modulo.slug}>
                    Escribir en «{modulo.title}»
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-slate-500">
                {eleccion
                  ? "Se actualiza el destino elegido, un archivo por vez."
                  : "Cada archivo va al módulo que lleva su nombre; si no existe, se crea como borrador."}
              </span>
            </label>
          )}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragEnter={(event) => { event.preventDefault(); setArrastrando(true); }}
            onDragOver={(event) => { event.preventDefault(); setArrastrando(true); }}
            onDragLeave={(event) => { event.preventDefault(); setArrastrando(false); }}
            onDrop={(event) => { event.preventDefault(); setArrastrando(false); leerArchivos(event.dataTransfer?.files); }}
            disabled={ocupado}
            className={[
              "flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed text-center transition",
              compacto ? "mt-2 gap-1 px-3 py-4" : "mt-5 gap-2 px-4 py-8",
              arrastrando ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/40",
              ocupado ? "cursor-wait opacity-70" : "cursor-pointer",
            ].join(" ")}
          >
            <span className={`font-semibold text-slate-800 ${compacto ? "text-xs" : "text-sm"}`}>
              {ocupado
                ? unSoloArchivo ? "Leyendo el archivo…" : "Leyendo los archivos…"
                : unSoloArchivo ? "Arrastrá acá el archivo .md de este módulo" : "Arrastrá uno o varios archivos .md aquí"}
            </span>
            <span className="text-xs text-slate-500">
              {unSoloArchivo
                ? "o hacé clic para buscarlo · hasta 2 MB · primero se muestra el diff"
                : `o hacé clic para buscarlos en tu equipo · hasta ${MAX_ARCHIVOS_LOTE} archivos, 2 MB cada uno`}
            </span>
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple={!unSoloArchivo}
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
            {resultado.lote.map((fila, index) => (
              <li key={`${fila.archivo}-${index}`} className="rounded border border-slate-200 bg-slate-50 p-3">
                <span className="font-mono text-xs text-slate-500">{fila.archivo}</span>
                <p className="font-semibold text-slate-900">
                  {fila.bloqueos.length ? "Bloqueado" : fila.accion === "sin_cambios" ? "Sin cambios" : fila.accion === "crear" ? "Creado" : "Actualizado"} · {fila.ruta}
                  {!fila.bloqueos.length && fila.clase === "tema" ? <span className="ml-2 text-xs text-slate-600">{fila.publicadoActual || resultado.aplicados.find((a) => a.archivo === fila.archivo)?.publicado ? "publicado" : "borrador"}</span> : null}
                </p>
                {fila.bloqueos.map((motivo, i) => <p key={i} className="mt-1 text-xs text-red-800">{motivo}</p>)}
              </li>
            ))}
          </ul>
          {tipoHub === "contenido" ? <p className="text-sm text-slate-600">Revisá las secciones importadas y su visibilidad en el editor. El botón «Publicar hub» comprueba los requisitos de publicación.</p> : null}

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
            {unSoloArchivo ? "Importar otro archivo" : "Importar otros archivos"}
          </button>
        </div>
      ) : null}
    </Marco>
  );
}

/**
 * El envoltorio, que es lo único que cambia entre las dos ubicaciones.
 *
 * Dentro del formulario de un módulo el bloque no puede parecer otra sección de
 * la pantalla —de ahí el borde punteado y el `h3` en vez del `h2`—, y tiene que
 * decir lo que ahí se vuelve peligroso: escribe en la base directamente, así que
 * lo que esté a medio escribir en ese formulario se pierde al recargar.
 */
function Marco({ compacto, hubSlug, destinoFijo, tipoHub, children }) {
  if (compacto) {
    return (
      <div className="mt-3 rounded-lg border border-dashed border-brand-300 bg-white p-3">
        <h3 className="text-sm font-bold text-slate-800">Reemplazar este módulo desde un archivo .md</h3>
        <p className="mt-1 text-xs text-slate-600">
          Se escribe en <span className="font-mono">/{hubSlug}/{destinoFijo}</span> aunque el archivo se llame de otra forma.
          Primero se muestra el diff. Guardá antes lo que tengas a medias acá arriba: al aplicar, el formulario se recarga con
          lo que quedó en la base.
        </p>
        {children}
      </div>
    );
  }

  return (
    <section id="cargar-feed" className="scroll-mt-6 rounded-2xl border border-brand-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold text-slate-950">Cargar feed y archivos .md</h2>
      {tipoHub === "contenido" ? <p className="mt-1 text-sm text-slate-600">Un archivo por sección. Usá «tipo_seccion» para indicar su función y «_hub.md» para la portada. Primero se muestran las diferencias. La publicación se cambia manualmente.</p> : <p className="mt-1 text-sm text-slate-600">
        Un archivo por tema, con el nombre del archivo como slug. <span className="font-mono">_hub.md</span> configura el hub.
        Se lee, se muestra qué cambiaría y recién entonces se escribe. Lo nuevo entra como borrador. Si el archivo no se llama
        como el módulo, elegí el destino acá abajo o usá la zona de subida del propio módulo.
        El campo «publicado» se ignora: importar conserva el estado existente. La publicación y despublicación son manuales.
      </p>}
      {children}
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
        <span>{resumen.crear} por crear · {resumen.actualizar} por actualizar · {resumen.sinCambios} sin cambios · {resumen.bloqueados} bloqueados · {resumen.avisos} avisos</span>
      </div>

      {informe.hub && !informe.hub.rutaExiste ? (
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Este hub no tiene página pública todavía: <span className="font-mono">/{hubSlug}</span> devuelve 404 porque las páginas
          de hub son carpetas del proyecto. El contenido se guarda bien y se verá cuando exista la ruta.
        </p>
      ) : null}

      <ul className="space-y-3">
        {lote.map((fila, index) => (
          <li
            key={`${fila.archivo}-${index}`}
            className={`rounded-xl border p-4 ${!fila.bloqueos.length ? "border-slate-200 bg-white" : "border-red-200 bg-red-50/40"}`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-mono text-xs text-slate-500">{fila.archivo}</span>
              <span className={`text-xs font-bold uppercase tracking-wide ${!fila.bloqueos.length ? "text-slate-600" : "text-red-700"}`}>
                {fila.bloqueos.length ? "bloqueado" : fila.accion === "sin_cambios" ? "sin cambios" : fila.accion === "crear" ? "crear" : "actualizar"}
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
                <caption className="pb-2 text-left font-semibold text-slate-700">Cambios propuestos al confirmar</caption>
                <thead>
                  <tr>
                    <th scope="col" className="w-32 text-left text-slate-600">Campo</th>
                    <th scope="col" className="w-1/2 text-left text-slate-600">Guardado actualmente</th>
                    <th scope="col" className="text-left text-slate-600">Contenido del archivo</th>
                  </tr>
                </thead>
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
              <div className="mt-3 text-xs text-red-800">
                <p className="font-semibold">Motivos que impiden cargar este archivo</p>
                <ul className="mt-1 space-y-1">
                  {fila.bloqueos.map((bloqueo, indice) => (
                    <li key={`${fila.archivo}-b-${indice}`}>· {bloqueo}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {fila.avisos?.length ? (
              <div className="mt-3 text-xs text-amber-800">
                <p className="font-semibold">Información sobre la importación</p>
                <ul className="mt-1 space-y-1">
                  {fila.avisos.map((aviso, indice) => (
                    <li key={`${fila.archivo}-a-${indice}`}>· {aviso}</li>
                  ))}
                </ul>
              </div>
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
