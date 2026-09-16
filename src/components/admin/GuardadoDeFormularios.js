"use client";

// src/components/admin/GuardadoDeFormularios.js
//
// «Guardar todos los cambios» para una pantalla hecha de varios formularios.
//
// El editor de un hub profesional son, en la misma página, la configuración del
// hub, el orden de las piezas y un formulario por módulo. Cada uno tenía su
// propio botón, así que revisar un hub entero era acordarse de apretar seis
// botones repartidos por la pantalla: el que se olvidaba se perdía al salir, sin
// que nada lo dijera.
//
// Acá cada formulario dice qué tiene sin guardar, y al final de la página hay
// una sola barra que lo guarda todo y después informa qué se guardó y qué no.
// Los botones de cada formulario siguen estando —guardar solo lo que se está
// mirando es legítimo—, y crear y eliminar siguen siendo inmediatos: lo que se
// acumula son ediciones de campos.
//
// Es el mismo trato que da `TaxonomyManager` con `cambios-pendientes.js`; lo que
// cambia es cómo se entera de las ediciones, porque estos formularios no son
// controlados (ver `src/lib/cambios-de-formulario.js`).

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import { informeDeGuardado } from "@/lib/cambios-pendientes";
import { diferenciasDeFormulario, firmaDeLineas, leerFormulario } from "@/lib/cambios-de-formulario";

// Tres contextos y no uno, por una razón que se siente al escribir: lo que hay
// sin guardar cambia con cada tecla. Si de ese valor colgaran también los
// formularios, cada letra escrita en un cuerpo en Markdown re-renderizaría el
// editor entero. Así, escribir solo repinta la barra.
const AccionesContext = createContext(null);   // registrarse y avisar; nunca cambia
const EstadoContext = createContext(null);     // lo que cambia mientras se escribe
const GeneracionContext = createContext(0);    // cambia solo al descartar

// Fuera del proveedor los componentes siguen funcionando solos, con sus botones
// de siempre: registrarse no es obligatorio.
const SIN_ACCIONES = { registrar: () => () => {}, reportar: () => {} };

const SIN_ESTADO = {
  entidades: [],
  total: 0,
  guardando: false,
  guardarTodo: () => {},
  descartar: () => {},
  informe: null,
  cerrarInforme: () => {},
};

const useAcciones = () => useContext(AccionesContext) || SIN_ACCIONES;

/** Lo que hay sin guardar: lo miran la barra y el informe, nadie más. */
export const useGuardado = () => useContext(EstadoContext) || SIN_ESTADO;

/** Va en las `key` de los formularios para que «Descartar» los remonte. */
export const useGeneracion = () => useContext(GeneracionContext);

export function ProveedorDeGuardado({ children }) {
  const router = useRouter();
  const { avisar } = useToast();
  const [guardando, start] = useTransition();
  const [sucios, setSucios] = useState({});
  const [informe, setInforme] = useState(null);
  const [generacion, setGeneracion] = useState(0);
  // El orden de registro sí es estado, porque de él depende lo que se pinta: es
  // el orden en que están los bloques en la pantalla, y en ese orden se guardan
  // y se listan.
  const [orden, setOrden] = useState([]);

  // Los manejadores, en cambio, no: cambian en cada render de cada formulario y
  // re-renderizar la página entera por eso sería absurdo.
  const manejadores = useRef(new Map());

  const registrar = useCallback((id, manejador) => {
    manejadores.current.set(id, manejador);
    setOrden((actual) => (actual.includes(id) ? actual : [...actual, id]));
    return () => {
      manejadores.current.delete(id);
      setOrden((actual) => actual.filter((otro) => otro !== id));
      setSucios((actuales) => {
        if (!actuales[id]) return actuales;
        const copia = { ...actuales };
        delete copia[id];
        return copia;
      });
    };
  }, []);

  const reportar = useCallback((id, datos) => {
    setSucios((actuales) => {
      const previo = actuales[id];
      if (!datos?.lineas?.length) {
        if (!previo) return actuales;
        const copia = { ...actuales };
        delete copia[id];
        return copia;
      }
      // Sin esta comparación, cada tecla escrita produciría un objeto nuevo y un
      // render de toda la pantalla aunque el cambio ya estuviera registrado.
      if (previo && previo.nombre === datos.nombre && firmaDeLineas(previo.lineas) === firmaDeLineas(datos.lineas)) return actuales;
      return { ...actuales, [id]: { id, ...datos } };
    });
  }, []);

  // En el orden de la pantalla, no en el del objeto de estado.
  const entidades = useMemo(() => {
    const enPantalla = orden.filter((id) => sucios[id]).map((id) => sucios[id]);
    const huerfanos = Object.values(sucios).filter((entidad) => !orden.includes(entidad.id));
    return [...enPantalla, ...huerfanos];
  }, [orden, sucios]);

  const total = entidades.reduce((suma, entidad) => suma + entidad.lineas.length, 0);

  // Cerrar la pestaña con ediciones sin guardar las pierde. El navegador solo
  // deja avisar con su propio diálogo, pero es mejor que perderlas en silencio.
  useEffect(() => {
    if (!total) return undefined;
    const alSalir = (evento) => { evento.preventDefault(); evento.returnValue = ""; };
    window.addEventListener("beforeunload", alSalir);
    return () => window.removeEventListener("beforeunload", alSalir);
  }, [total]);

  const guardarTodo = useCallback(() => {
    const pendientes = entidades;
    if (!pendientes.length) return;
    setInforme(null);

    start(async () => {
      const resultados = [];
      // En serie y no en paralelo: el pool de la base es de una sola conexión.
      for (const entidad of pendientes) {
        const manejador = manejadores.current.get(entidad.id);
        if (!manejador) {
          resultados.push({ ...entidad, error: "Ese formulario ya no está en pantalla." });
          continue;
        }
        try {
          const salida = await manejador.guardar();
          const error = salida?.error || null;
          resultados.push({ ...entidad, error });
          // Solo lo que se guardó deja de estar pendiente: lo que falló sigue
          // marcado y con lo escrito en pantalla, para corregirlo sin
          // reescribirlo.
          if (!error) manejador.sincronizar();
        } catch (fallo) {
          // Acá caen `requireAdmin`, Prisma y las acciones que no se pudieron
          // entregar. Antes esto quedaba como promesa rechazada y no se veía.
          resultados.push({ ...entidad, error: String(fallo?.message || "").trim() || "No se pudo guardar." });
        }
      }

      const resumen = informeDeGuardado(resultados);
      setInforme(resumen);
      avisar(resumen.resumen, resumen.hayFallas ? "error" : "success");
      router.refresh();
    });
  }, [entidades, avisar, router]);

  const descartar = useCallback(() => {
    setSucios({});
    setInforme(null);
    // Remonta los formularios: es la única forma honesta de devolverlos a lo que
    // dice el servidor, porque hay campos controlados (el bloque de SEO) a los
    // que no alcanza con reescribirles el DOM.
    setGeneracion((numero) => numero + 1);
    avisar("Se descartaron las ediciones sin guardar.", "info");
    router.refresh();
  }, [avisar, router]);

  const acciones = useMemo(() => ({ registrar, reportar }), [registrar, reportar]);

  const estado = useMemo(() => ({
    entidades,
    total,
    guardando,
    guardarTodo,
    descartar,
    informe,
    cerrarInforme: () => setInforme(null),
  }), [entidades, total, guardando, guardarTodo, descartar, informe]);

  return (
    <AccionesContext.Provider value={acciones}>
      <GeneracionContext.Provider value={generacion}>
        <EstadoContext.Provider value={estado}>{children}</EstadoContext.Provider>
      </GeneracionContext.Provider>
    </AccionesContext.Provider>
  );
}

/**
 * Engancha un formulario no controlado a la barra de guardado.
 *
 * @param {object} opciones
 * @param {string} opciones.id        clave estable del formulario
 * @param {string} opciones.nombre    cómo se llama en la barra y en el informe
 * @param {object} opciones.campos    mapa `{ campo: { etiqueta, tipo } }` (constante de módulo)
 * @param {(form: HTMLFormElement) => Promise<any>} opciones.guardar
 * @param {boolean} [opciones.activo] false para los formularios de alta, que se guardan solos
 * @returns {{ ref: object, alEditar: () => void, sincronizar: () => void }}
 */
export function useFormularioGuardable({ id, nombre, campos, guardar, activo = true }) {
  const { registrar, reportar } = useAcciones();
  const ref = useRef(null);
  const base = useRef(null);

  const tomarFoto = useCallback(() => {
    base.current = leerFormulario(ref.current, campos);
  }, [campos]);

  const recalcular = useCallback(() => {
    if (!activo || !ref.current || !base.current) return;
    const lineas = diferenciasDeFormulario(base.current, leerFormulario(ref.current, campos), campos);
    reportar(id, lineas.length ? { nombre, lineas } : null);
  }, [activo, campos, id, nombre, reportar]);

  const sincronizar = useCallback(() => {
    tomarFoto();
    reportar(id, null);
  }, [id, reportar, tomarFoto]);

  // Al montar —y al remontar con datos nuevos del servidor— la foto es de lo
  // que hay en pantalla en ese momento. `useEffect` y no `useLayoutEffect`
  // porque esto también se renderiza en el servidor, donde el segundo solo
  // sirve para llenar la consola de advertencias.
  useEffect(() => { tomarFoto(); }, [tomarFoto]);

  // El manejador se lee de un ref porque `guardar` es una función nueva en cada
  // render; registrar la de este render dejaría guardada una versión vieja. El
  // ref se refresca en un efecto sin dependencias —después de cada render, y
  // antes de que el botón de la barra pueda llamarlo— y no durante el render.
  const ultimo = useRef(null);
  useEffect(() => { ultimo.current = { guardar, sincronizar }; });

  useEffect(() => {
    if (!activo) return undefined;
    return registrar(id, {
      guardar: () => ultimo.current.guardar(ref.current),
      sincronizar: () => ultimo.current.sincronizar(),
    });
  }, [activo, id, registrar]);

  return { ref, alEditar: recalcular, sincronizar };
}

/**
 * Lo mismo para lo que no es un formulario: un panel con su propio estado que
 * también tiene algo sin guardar (el orden de las piezas del hub).
 *
 * @param {object} opciones
 * @param {Array} opciones.lineas  qué cambiaría; vacío ⇒ no hay nada pendiente
 */
export function useParteGuardable({ id, nombre, lineas = [], guardar, sincronizar }) {
  const { registrar, reportar } = useAcciones();

  const ultimo = useRef(null);
  useEffect(() => { ultimo.current = { guardar, sincronizar, lineas }; });

  useEffect(() => registrar(id, {
    guardar: () => ultimo.current.guardar(),
    // Lo guardado deja de estar pendiente en el acto: el estado del panel solo
    // se entera de que el servidor ya lo tiene cuando termina el refresco, y
    // hasta entonces la barra estaría contando un cambio que ya se escribió.
    sincronizar: () => { ultimo.current.sincronizar?.(); reportar(id, null); },
  }), [id, registrar, reportar]);

  // La firma es la dependencia real: `lineas` es un array nuevo en cada render,
  // y avisar en cada uno sería un ciclo de renders sin final.
  const firma = firmaDeLineas(lineas);
  useEffect(() => {
    const actuales = ultimo.current?.lineas || [];
    reportar(id, actuales.length ? { nombre, lineas: actuales } : null);
  }, [id, nombre, firma, reportar]);
}

function ListaDeLineas({ lineas }) {
  return (
    <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
      {lineas.map((linea) => (
        <li key={linea.campo}>
          {linea.etiqueta}: <span className="line-through opacity-70">{linea.antes}</span> → <span className="font-semibold text-slate-900">{linea.despues}</span>
        </li>
      ))}
    </ul>
  );
}

/** Qué se guardó y qué no, después de apretar el botón. */
export function InformeDeGuardado() {
  const { informe, cerrarInforme } = useGuardado();
  if (!informe) return null;

  return (
    <section className={`rounded-2xl border p-5 ${informe.hayFallas ? "border-amber-300 bg-amber-50" : "border-emerald-300 bg-emerald-50"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Qué se guardó</h2>
          <p className="mt-1 text-sm text-slate-700">{informe.resumen}</p>
        </div>
        <button type="button" onClick={cerrarInforme} className="text-xs font-semibold text-slate-600 underline hover:text-slate-900">Cerrar</button>
      </div>

      {informe.guardados.length ? (
        <ul className="mt-3 space-y-2 text-sm">
          {informe.guardados.map((entidad) => (
            <li key={entidad.id} className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="font-semibold text-slate-900">{entidad.nombre}</p>
              <ListaDeLineas lineas={entidad.lineas} />
            </li>
          ))}
        </ul>
      ) : null}

      {informe.fallidos.length ? (
        <div className="mt-3">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-900">No se pudo guardar</p>
          <ul className="mt-1 space-y-2 text-sm">
            {informe.fallidos.map((entidad) => (
              <li key={entidad.id} className="rounded-lg border border-amber-300 bg-white p-3">
                <p className="font-semibold text-slate-900">{entidad.nombre}</p>
                <p className="mt-0.5 text-xs text-red-700">{entidad.error}</p>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-600">Esos cambios siguen sin guardar y con lo escrito en pantalla, para corregirlos sin volver a escribirlos.</p>
        </div>
      ) : null}
    </section>
  );
}

/** La barra del final: cuántos cambios hay, dónde, y el botón que los guarda. */
export function BarraDeGuardado() {
  const { total, entidades, guardando, guardarTodo, descartar } = useGuardado();
  if (!total) return null;

  return (
    <div className="sticky bottom-0 z-40 -mx-2 rounded-t-2xl border border-b-0 border-amber-300 bg-amber-50/95 p-4 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900">
            {total === 1 ? "1 cambio sin guardar" : `${total} cambios sin guardar`}
            {entidades.length > 1 ? ` en ${entidades.length} bloques` : ""}
          </p>
          <p className="mt-0.5 truncate text-xs text-slate-600">
            {entidades.map((entidad) => `${entidad.nombre} (${entidad.lineas.map((linea) => linea.etiqueta.toLowerCase()).join(", ")})`).join(" · ")}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={descartar} disabled={guardando} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60">Descartar</button>
          <button type="button" onClick={guardarTodo} disabled={guardando} className="rounded-lg bg-brand-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {guardando ? "Guardando…" : "Guardar todos los cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}
