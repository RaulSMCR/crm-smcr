"use client";

// src/components/admin/TaxonomyManager.js
//
// Dos problemas distintos se arreglan acá.
//
// 1. Las acciones fallaban en silencio. `requireAdmin` **lanza** cuando la
//    sesión no es de admin, y el manejador solo miraba `res.error`: la promesa
//    quedaba rechazada dentro del `startTransition`, sin error en pantalla, sin
//    refresco y sin nada que indicara que no había pasado nada. Ahora toda
//    acción pasa por un try/catch y avisa por toast, salga bien o mal.
//
// 2. No había un momento de «listo». Cada campo se guardaba al salir del foco,
//    sin confirmación y sin registro. Para quien edita muchas filas de una
//    sentada eso es trabajar a ciegas. Ahora las ediciones se acumulan, una
//    barra fija abajo dice cuántas hay, y al guardarlas sale un informe de qué
//    cambió y de qué no se pudo.
//
// Crear y eliminar siguen siendo inmediatos, cada uno con su aviso: no tiene
// sentido dejar pendiente un borrado, y acumularlo con las ediciones haría que
// un «guardar todo» destruyera cosas.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createDiscipline, updateDiscipline, deleteDiscipline,
  createTopic, updateTopic, deleteTopic,
  createPhase, updatePhase, deletePhase,
  createSeries, updateSeries, deleteSeries,
  linkComplementaryTopics, unlinkComplementaryTopics,
} from "@/actions/taxonomy-actions";
import {
  TONO,
  avisoDeOrden,
  avisoDeRenombrado,
  estadoDeDisciplina,
  estadoDeEntrega,
  estadoDeFase,
  estadoDeSerie,
  estadoDeTema,
} from "@/lib/taxonomia-estado";
import {
  cambiosPorEntidad,
  claveDe,
  contarCambios,
  informeDeGuardado,
  registrarCambio,
  tieneCambios,
  valorDe,
} from "@/lib/cambios-pendientes";
import { useToast } from "@/components/ui/ToastProvider";
import { useAccionServidor } from "@/components/ui/useAccionServidor";

const COLOR_TONO = {
  [TONO.VISIBLE]: "border-emerald-300 bg-emerald-50 text-emerald-800",
  [TONO.PENDIENTE]: "border-amber-300 bg-amber-50 text-amber-900",
  [TONO.OCULTO]: "border-slate-300 bg-slate-100 text-slate-500",
  [TONO.NEUTRO]: "border-slate-300 bg-white text-slate-600",
};

/** Qué acción actualiza cada tipo, para que «guardar todo» sepa a quién llamar. */
const ACTUALIZAR = { serie: updateSeries, tema: updateTopic, disciplina: updateDiscipline, fase: updatePhase };

/** Qué tipos tienen una dirección pública que un renombrado rompería. */
const TIENE_PAGINA = { serie: true, tema: true, disciplina: false, fase: false };

const NOMBRE_TIPO = { serie: "serie", tema: "tema", disciplina: "disciplina", fase: "fase" };

// ─── Estado compartido de ediciones sin guardar ─────────────────────────────

const CambiosContext = createContext(null);
const useCambios = () => useContext(CambiosContext);

function ProveedorDeCambios({ children }) {
  const router = useRouter();
  const { avisar } = useToast();
  const [pendientes, setPendientes] = useState({});
  const [meta, setMeta] = useState({});
  const [informe, setInforme] = useState(null);
  const [guardando, start] = useTransition();

  const total = contarCambios(pendientes);

  // Cerrar la pestaña con ediciones sin guardar las pierde. El navegador solo
  // deja avisar con su propio diálogo, pero es mejor que perderlas en silencio.
  useEffect(() => {
    if (!total) return undefined;
    const alSalir = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", alSalir);
    return () => window.removeEventListener("beforeunload", alSalir);
  }, [total]);

  const registrar = useCallback((cambio, contexto = {}) => {
    setPendientes((actuales) => registrarCambio(actuales, cambio));
    if (contexto.esVisible !== undefined) {
      setMeta((actual) => ({ ...actual, [claveDe(cambio.tipo, cambio.id)]: contexto }));
    }
  }, []);

  const descartar = useCallback(() => {
    setPendientes({});
    setInforme(null);
    avisar("Se descartaron las ediciones sin guardar.", "info");
    router.refresh();
  }, [avisar, router]);

  const guardarTodo = useCallback(() => {
    const entidades = cambiosPorEntidad(pendientes);
    if (!entidades.length) return;

    // Los renombrados que cambian una dirección pública se confirman una sola
    // vez, juntos. Preguntar en cada campo, como antes, hacía que uno terminara
    // aceptando sin leer.
    const avisos = entidades
      .map((e) => {
        const nuevo = String(e.patch.name || "").trim();
        if (!nuevo || !TIENE_PAGINA[e.tipo]) return null;
        return avisoDeRenombrado(e.nombre, nuevo, {
          tienePaginaPublica: true,
          esVisible: meta[claveDe(e.tipo, e.id)]?.esVisible === true,
        });
      })
      .filter(Boolean);
    if (avisos.length && !confirm(avisos.join("\n\n──────────\n\n"))) return;

    start(async () => {
      const resultados = [];
      // En serie y no en paralelo: el pool de la base es de una sola conexión.
      for (const entidad of entidades) {
        const accion = ACTUALIZAR[entidad.tipo];
        if (!accion) {
          resultados.push({ ...entidad, error: "Tipo desconocido." });
          continue;
        }

        // El nombre vacío se rechaza acá y no se manda: las acciones lo ignoran
        // en silencio, así que el servidor respondería «guardado» sin haber
        // guardado nada, y el informe mentiría.
        const patch = { ...entidad.patch };
        if ("name" in patch) {
          patch.name = String(patch.name || "").trim();
          if (!patch.name) {
            resultados.push({ ...entidad, error: "El nombre no puede quedar vacío." });
            continue;
          }
        }

        try {
          const res = await accion(entidad.id, patch);
          resultados.push({ ...entidad, error: res?.error || null });
        } catch (error) {
          // Acá caía `requireAdmin`. Antes esto no se veía en ninguna parte.
          resultados.push({ ...entidad, error: error?.message || "No se pudo guardar." });
        }
      }

      const resumen = informeDeGuardado(resultados);
      setInforme(resumen);
      avisar(resumen.resumen, resumen.hayFallas ? "error" : "success");

      // Lo que falló sigue pendiente, para poder corregirlo sin reescribirlo.
      setPendientes((actuales) => {
        const quedan = {};
        for (const fallo of resumen.fallidos) {
          const clave = claveDe(fallo.tipo, fallo.id);
          if (actuales[clave]) quedan[clave] = actuales[clave];
        }
        return quedan;
      });
      router.refresh();
    });
  }, [pendientes, meta, avisar, router]);

  const valor = useMemo(() => ({
    registrar,
    valorDe: (tipo, id, campo, porDefecto) => valorDe(pendientes, tipo, id, campo, porDefecto),
    tiene: (tipo, id) => tieneCambios(pendientes, tipo, id),
    entidades: cambiosPorEntidad(pendientes),
    total,
    guardando,
    guardarTodo,
    descartar,
    informe,
    cerrarInforme: () => setInforme(null),
  }), [pendientes, total, guardando, guardarTodo, descartar, informe, registrar]);

  return <CambiosContext.Provider value={valor}>{children}</CambiosContext.Provider>;
}

// ─── Piezas de presentación ─────────────────────────────────────────────────

function Estado({ estado }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${COLOR_TONO[estado.tono]}`}>
      {estado.etiqueta}
    </span>
  );
}

function Encabezado({ titulo, queEs, ejemplo, dondeSeVe }) {
  return (
    <div className="border-b border-slate-100 pb-3">
      <h2 className="text-lg font-bold text-slate-900">{titulo}</h2>
      <p className="mt-1 text-sm text-slate-600">{queEs}</p>
      <dl className="mt-2 space-y-1 text-xs text-slate-500">
        {ejemplo ? (
          <div className="flex gap-2">
            <dt className="shrink-0 font-semibold text-slate-600">Por ejemplo:</dt>
            <dd>{ejemplo}</dd>
          </div>
        ) : null}
        <div className="flex gap-2">
          <dt className="shrink-0 font-semibold text-slate-600">En el sitio:</dt>
          <dd>{dondeSeVe}</dd>
        </div>
      </dl>
    </div>
  );
}

function Fila({ tipo, termino, estado, urlPublica, onDelete, textoEliminar, extra }) {
  const cambios = useCambios();
  const { pendiente, ejecutar } = useAccionServidor();

  const nombre = cambios.valorDe(tipo, termino.id, "name", termino.name);
  const activo = cambios.valorDe(tipo, termino.id, "isActive", termino.isActive !== false);
  const sinGuardar = cambios.tiene(tipo, termino.id);

  // Se guarda el texto tal cual se escribe, sin recortar ni sustituir: si acá
  // se cayera al nombre original cuando el campo queda vacío, borrarlo para
  // reescribirlo haría que el campo saltara solo hacia atrás en cada tecla. El
  // nombre vacío se rechaza al guardar, que es donde corresponde.
  const registrarNombre = (valor) => {
    cambios.registrar(
      { tipo, id: termino.id, nombre: termino.name, campo: "name", etiqueta: "Nombre", antes: termino.name, despues: valor },
      { esVisible: estado.tono === TONO.VISIBLE },
    );
  };

  const alternarVisibilidad = () => {
    cambios.registrar({
      tipo, id: termino.id, nombre: termino.name,
      campo: "isActive", etiqueta: "Visibilidad",
      antes: termino.isActive !== false, despues: !activo,
      antesTexto: termino.isActive !== false ? "Visible" : "Oculto",
      despuesTexto: !activo ? "Visible" : "Oculto",
    });
  };

  const eliminar = () => {
    const extraAviso = sinGuardar ? "\n\nOJO: este elemento tiene ediciones sin guardar; se pierden." : "";
    if (!confirm(textoEliminar + extraAviso)) return;
    ejecutar(() => onDelete(termino.id), { exito: `Se eliminó «${termino.name}».` });
  };

  return (
    <li className={`py-3 ${sinGuardar ? "-mx-2 rounded-lg bg-amber-50/60 px-2" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={nombre}
          onChange={(e) => registrarNombre(e.target.value)}
          aria-label={`Nombre de ${termino.name}`}
          className="min-w-0 flex-1 rounded border border-transparent px-2 py-1 text-sm font-semibold text-slate-900 hover:border-slate-300 focus:border-brand-400 focus:bg-white focus:outline-none"
        />
        {sinGuardar ? (
          <span className="shrink-0 rounded-full border border-amber-400 bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
            Sin guardar
          </span>
        ) : null}
        <Estado estado={estado} />
        <button
          type="button"
          onClick={alternarVisibilidad}
          className={`rounded-nv border px-2 py-1 text-xs font-semibold ${activo ? "border-slate-300 text-slate-700 hover:bg-slate-50" : "border-slate-300 bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
          title={activo ? "Deja de mostrarse en el sitio. No se borra nada y se puede revertir." : "Vuelve a mostrarse en el sitio."}
        >
          {activo ? "Ocultar" : "Mostrar"}
        </button>
        <button
          type="button"
          onClick={eliminar}
          disabled={pendiente}
          className="rounded-nv border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          Eliminar
        </button>
      </div>

      <p className="mt-1 pl-2 text-xs text-slate-500">{estado.explicacion}</p>

      {urlPublica ? (
        <p className="mt-1 pl-2 text-xs">
          <a href={urlPublica} target="_blank" rel="noopener noreferrer" className="font-mono text-slate-500 underline decoration-slate-300 hover:text-brand-700">
            {urlPublica}
          </a>
        </p>
      ) : null}

      {extra}
    </li>
  );
}

// ─── Disciplinas, temas y fases ─────────────────────────────────────────────

function SeccionTerminos({ titulo, queEs, ejemplo, dondeSeVe, placeholder, tipo, terminos, calcularEstado, urlDe, textoEliminar, notaExtra, onCreate, onDelete, vacio }) {
  const { pendiente, ejecutar } = useAccionServidor();
  const [name, setName] = useState("");

  const crear = (e) => {
    e.preventDefault();
    const limpio = name.trim();
    if (!limpio) return;
    ejecutar(() => onCreate(limpio), { exito: `Se creó ${NOMBRE_TIPO[tipo]} «${limpio}».` });
    setName("");
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <Encabezado titulo={titulo} queEs={queEs} ejemplo={ejemplo} dondeSeVe={dondeSeVe} />

      <form className="mt-3 flex gap-2" onSubmit={crear}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={placeholder} className="input flex-1" />
        <button type="submit" disabled={pendiente} className="btn btn-accent disabled:opacity-60">
          {pendiente ? "Creando…" : "Agregar"}
        </button>
      </form>

      <ul className="mt-2 divide-y divide-slate-100">
        {terminos.map((t) => (
          <Fila
            key={t.id}
            tipo={tipo}
            termino={t}
            estado={calcularEstado(t)}
            urlPublica={urlDe ? urlDe(t) : null}
            onDelete={onDelete}
            textoEliminar={textoEliminar(t)}
            extra={notaExtra ? notaExtra(t) : null}
          />
        ))}
        {terminos.length === 0 ? <li className="py-3 text-sm text-slate-500">{vacio}</li> : null}
      </ul>
    </section>
  );
}

// ─── Series ─────────────────────────────────────────────────────────────────

function Entregas({ serie }) {
  const entregas = serie.entregas || [];
  const aviso = avisoDeOrden(entregas);

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Artículos de esta serie</p>

      {entregas.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">
          Ninguno todavía. Se asignan desde el artículo:{" "}
          <Link href="/panel/admin/blog" className="font-semibold text-brand-700 underline">abrilo en Gestión editorial</Link>{" "}
          y buscá el recuadro «Orden de lectura por series».
        </p>
      ) : (
        <ol className="mt-2 space-y-1">
          {entregas.map((entrega) => {
            const estado = estadoDeEntrega(entrega);
            return (
              <li key={entrega.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="w-6 shrink-0 text-right font-mono text-xs text-slate-500">{entrega.seriesOrder ?? "—"}</span>
                <Link href={`/panel/admin/blog/${entrega.id}`} className="min-w-0 flex-1 truncate text-slate-800 underline decoration-slate-300 hover:text-brand-700">
                  {entrega.title}
                </Link>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${COLOR_TONO[estado.tono]}`} title={estado.explicacion}>
                  {estado.etiqueta}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {aviso ? <p className="mt-2 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">{aviso}</p> : null}

      {entregas.some((e) => e.status === "PUBLISHED" && e.seriesApproved !== true) ? (
        <p className="mt-2 text-xs text-slate-600">
          Para aprobar una entrega marcada «Serie sin aprobar»: abrí el artículo y volvé a guardar el
          recuadro «Orden de lectura por series». Guardarlo como administrador ya la aprueba.
        </p>
      ) : null}
    </div>
  );
}

function DetalleSerie({ serie, phases }) {
  const cambios = useCambios();
  const descripcion = cambios.valorDe("serie", serie.id, "description", serie.description || "");
  const fase = cambios.valorDe("serie", serie.id, "phaseId", serie.phaseId || "");
  const nombreFase = (id) => phases.find((p) => p.id === id)?.name || "Sin fase";

  return (
    <div className="mt-2 pl-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={descripcion}
          onChange={(e) => cambios.registrar({
            tipo: "serie", id: serie.id, nombre: serie.name,
            campo: "description", etiqueta: "Descripción",
            antes: serie.description || "", despues: e.target.value,
          })}
          placeholder="Sin descripción — se muestra bajo el título de la serie"
          aria-label={`Descripción de ${serie.name}`}
          className="min-w-0 flex-1 rounded border border-transparent px-2 py-1 text-sm text-slate-600 hover:border-slate-300 focus:border-brand-400 focus:bg-white focus:outline-none"
        />
        {phases.length ? (
          <select
            value={fase}
            onChange={(e) => cambios.registrar({
              tipo: "serie", id: serie.id, nombre: serie.name,
              campo: "phaseId", etiqueta: "Fase",
              antes: serie.phaseId || "", despues: e.target.value,
              antesTexto: nombreFase(serie.phaseId), despuesTexto: nombreFase(e.target.value),
            })}
            className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600"
            title="Agrupa esta serie bajo una fase. Es opcional y no se ve en el sitio."
          >
            <option value="">Sin fase</option>
            {phases.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        ) : null}
      </div>
      <Entregas serie={serie} />
    </div>
  );
}

function SeccionSeries({ series, phases }) {
  const { pendiente, ejecutar } = useAccionServidor();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const crear = (e) => {
    e.preventDefault();
    const limpio = name.trim();
    if (!limpio) return;
    ejecutar(() => createSeries(limpio, description.trim()), {
      exito: `Se creó la serie «${limpio}». Todavía no tiene artículos: se le asignan desde cada artículo.`,
    });
    setName("");
    setDescription("");
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2">
      <Encabezado
        titulo="Series"
        queEs="Varios artículos que se leen en orden, como capítulos. Cada serie tiene su propia página con las entregas numeradas."
        ejemplo="«La angustia y sus formas», con sus entregas 1, 2 y 3."
        dondeSeVe="Página propia en /blog/serie/…, filtro en la biblioteca y enlace al pie de cada artículo de la serie."
      />

      <form className="mt-3 space-y-2" onSubmit={crear}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre de la serie — por ejemplo: La angustia y sus formas" className="input w-full" />
        <div className="flex flex-wrap gap-2">
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Una línea que diga de qué trata (opcional, sale bajo el título)" className="input min-w-0 flex-1" />
          <button type="submit" disabled={pendiente} className="btn btn-accent disabled:opacity-60">
            {pendiente ? "Creando…" : "Agregar"}
          </button>
        </div>
        <p className="text-xs text-slate-500">
          El nombre define la dirección de la página, así que conviene dejarlo escrito como va a
          quedar: cambiarlo después rompe los enlaces que ya apunten a ella.
        </p>
      </form>

      <ul className="mt-2 divide-y divide-slate-100">
        {series.map((s) => (
          <Fila
            key={s.id}
            tipo="serie"
            termino={s}
            estado={estadoDeSerie(s)}
            urlPublica={`/blog/serie/${s.slug}`}
            onDelete={deleteSeries}
            textoEliminar={`¿Eliminar la serie «${s.name}»?\n\nLos artículos no se borran: quedan sueltos en la biblioteca, sin orden de lectura. La dirección /blog/serie/${s.slug} deja de existir.`}
            extra={<DetalleSerie serie={s} phases={phases} />}
          />
        ))}
        {series.length === 0 ? (
          <li className="py-3 text-sm text-slate-500">Todavía no hay series. Creá una arriba y después asignale artículos.</li>
        ) : null}
      </ul>
    </section>
  );
}

// ─── Temas que se acompañan ─────────────────────────────────────────────────

function SeccionComplementos({ topics, complements }) {
  const { pendiente, ejecutar } = useAccionServidor();
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const nombreDe = (id) => topics.find((t) => t.id === id)?.name || "tema";

  const vincular = (e) => {
    e.preventDefault();
    if (!fromId || !toId) return;
    ejecutar(() => linkComplementaryTopics(fromId, toId), {
      exito: `«${nombreDe(fromId)}» y «${nombreDe(toId)}» quedaron vinculados.`,
    });
    setFromId("");
    setToId("");
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2">
      <Encabezado
        titulo="Temas que se acompañan"
        queEs="Pares de temas que conviene leer juntos. Sirven para sugerir la lectura siguiente a quien terminó un artículo."
        ejemplo="«Duelo» ↔ «Ansiedad»: quien lee sobre uno probablemente busque el otro."
        dondeSeVe="Recomendaciones al final de los artículos. El vínculo vale en los dos sentidos: basta cargarlo una vez."
      />

      <form className="mt-3 flex flex-wrap items-center gap-2" onSubmit={vincular}>
        <select value={fromId} onChange={(e) => setFromId(e.target.value)} className="input">
          <option value="">Elegí un tema…</option>
          {topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <span className="text-slate-400">se acompaña con</span>
        <select value={toId} onChange={(e) => setToId(e.target.value)} className="input">
          <option value="">Elegí otro…</option>
          {topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <button type="submit" disabled={pendiente || !fromId || !toId || fromId === toId} className="btn btn-accent disabled:opacity-60">
          Vincular
        </button>
      </form>
      {topics.length < 2 ? (
        <p className="mt-2 text-sm text-slate-500">Hacen falta al menos dos temas cargados para poder vincularlos.</p>
      ) : null}

      <ul className="mt-4 flex flex-wrap gap-2">
        {complements.map((c) => (
          <li key={c.id} className="flex items-center gap-2 rounded-nv border border-slate-300 bg-white px-3 py-1 text-sm">
            <span>{c.from.name} ↔ {c.to.name}</span>
            <button
              type="button"
              onClick={() => ejecutar(() => unlinkComplementaryTopics(c.from.id, c.to.id), {
                exito: `Se quitó el vínculo entre «${c.from.name}» y «${c.to.name}».`,
              })}
              className="text-red-500 hover:text-red-700"
              aria-label={`Quitar el vínculo entre ${c.from.name} y ${c.to.name}`}
            >
              ✕
            </button>
          </li>
        ))}
        {complements.length === 0 ? <li className="py-1 text-sm text-slate-500">Sin vínculos todavía.</li> : null}
      </ul>
    </section>
  );
}

// ─── Fases ──────────────────────────────────────────────────────────────────

function SeccionFases({ phases }) {
  const [abierto, setAbierto] = useState(phases.length > 0);

  if (!abierto) {
    return (
      <section className="rounded-xl border border-dashed border-slate-300 bg-white p-4 lg:col-span-2">
        <button type="button" onClick={() => setAbierto(true)} className="text-left text-sm text-slate-600 hover:text-slate-900">
          <span className="font-bold">Fases</span> — agrupan series entre sí. No se ven en el sitio y
          no hacen falta salvo que las series lleguen a ser muchas.{" "}
          <span className="font-semibold text-brand-700 underline">Mostrar</span>
        </button>
      </section>
    );
  }

  return (
    <SeccionTerminos
      titulo="Fases"
      queEs="Agrupan series entre sí, un escalón por encima. Son opcionales: solo sirven para acortar el desplegable cuando hay muchas series."
      ejemplo="Una fase «Historia» que contenga varias series sobre el origen de la salud mental."
      dondeSeVe="En ninguna parte: no tienen página ni filtro público. Solo ordenan el panel."
      placeholder="Nueva fase"
      tipo="fase"
      terminos={phases}
      calcularEstado={(p) => estadoDeFase({ isActive: p.isActive, series: p._count.series })}
      textoEliminar={(p) => `¿Eliminar la fase «${p.name}»?\n\nLas series que estaban en ella no se borran: quedan sin fase.`}
      onCreate={createPhase}
      onDelete={deletePhase}
      vacio="No hay fases, y está bien: no hacen falta hasta que las series sean muchas."
    />
  );
}

// ─── Barra de guardado e informe ────────────────────────────────────────────

function InformeDeCambios() {
  const { informe, cerrarInforme } = useCambios();
  if (!informe) return null;

  return (
    <section className={`rounded-xl border p-5 lg:col-span-2 ${informe.hayFallas ? "border-amber-300 bg-amber-50" : "border-emerald-300 bg-emerald-50"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Qué se guardó</h2>
          <p className="mt-1 text-sm text-slate-700">{informe.resumen}</p>
        </div>
        <button type="button" onClick={cerrarInforme} className="text-xs font-semibold text-slate-600 underline hover:text-slate-900">
          Cerrar
        </button>
      </div>

      {informe.guardados.length ? (
        <ul className="mt-3 space-y-2 text-sm">
          {informe.guardados.map((e) => (
            <li key={`${e.tipo}-${e.id}`} className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="font-semibold text-slate-900">{e.nombre}</p>
              <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
                {e.lineas.map((l) => (
                  <li key={l.campo}>
                    {l.etiqueta}: <span className="line-through opacity-70">{l.antes}</span> → <span className="font-semibold text-slate-900">{l.despues}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : null}

      {informe.fallidos.length ? (
        <div className="mt-3">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-900">No se pudo guardar</p>
          <ul className="mt-1 space-y-2 text-sm">
            {informe.fallidos.map((e) => (
              <li key={`${e.tipo}-${e.id}`} className="rounded-lg border border-amber-300 bg-white p-3">
                <p className="font-semibold text-slate-900">{e.nombre}</p>
                <p className="mt-0.5 text-xs text-red-700">{e.error}</p>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-600">
            Esos cambios siguen sin guardar y se ven marcados en la lista, para corregirlos sin
            volver a escribirlos.
          </p>
        </div>
      ) : null}
    </section>
  );
}

function BarraDeGuardado() {
  const { total, entidades, guardando, guardarTodo, descartar } = useCambios();
  if (!total) return null;

  return (
    <div className="sticky bottom-0 z-40 -mx-2 mt-2 rounded-t-2xl border border-b-0 border-amber-300 bg-amber-50/95 p-4 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] backdrop-blur lg:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900">
            {total === 1 ? "1 cambio sin guardar" : `${total} cambios sin guardar`}
            {entidades.length > 1 ? ` en ${entidades.length} elementos` : ""}
          </p>
          <p className="mt-0.5 truncate text-xs text-slate-600">
            {entidades.map((e) => `${e.nombre} (${e.lineas.map((l) => l.etiqueta.toLowerCase()).join(", ")})`).join(" · ")}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={descartar} disabled={guardando} className="btn btn-outline text-sm disabled:opacity-60">
            Descartar
          </button>
          <button type="button" onClick={guardarTodo} disabled={guardando} className="btn btn-accent text-sm disabled:opacity-60">
            {guardando ? "Guardando…" : "Guardar todos los cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Composición ────────────────────────────────────────────────────────────

function Panel({ disciplines, topics, phases, series, complements }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <InformeDeCambios />

      <SeccionSeries series={series} phases={phases} />

      <SeccionTerminos
        titulo="Temas"
        queEs="El asunto del que trata un artículo, más allá de la serie a la que pertenezca. Un artículo puede tener varios."
        ejemplo="«Duelo», «Ansiedad», «Migración»."
        dondeSeVe="Página de archivo propia en /blog/tema/… y filtro en la biblioteca. Si además se le escribe contenido en «Temas» del panel, el mismo nombre pasa a tener una página propia en la raíz del sitio."
        placeholder="Nuevo tema — por ejemplo: Duelo"
        tipo="tema"
        terminos={topics}
        calcularEstado={estadoDeTema}
        urlDe={(t) => `/blog/tema/${t.slug}`}
        textoEliminar={(t) => `¿Eliminar el tema «${t.name}»?\n\nLos artículos no se borran: pierden esta etiqueta. La dirección /blog/tema/${t.slug} deja de existir.`}
        notaExtra={(t) => (t.status === "PUBLISHED" ? (
          <p className="mt-1 pl-2 text-xs text-slate-500">
            Este tema también tiene página propia publicada en{" "}
            <a href={`/${t.slug}`} target="_blank" rel="noopener noreferrer" className="font-mono underline decoration-slate-300 hover:text-brand-700">/{t.slug}</a>, que se edita en{" "}
            <Link href="/panel/admin/temas" className="font-semibold text-brand-700 underline">Temas</Link>. Es el mismo registro: renombrarlo acá también cambia esa dirección.
          </p>
        ) : null)}
        onCreate={createTopic}
        onDelete={deleteTopic}
        vacio="Todavía no hay temas."
      />

      <SeccionTerminos
        titulo="Disciplinas"
        queEs="Desde qué campo del saber está escrito el artículo. Responde «quién habla acá», no «de qué habla»."
        ejemplo="«Psicoanálisis», «Filosofía», «Salud pública»."
        dondeSeVe="Filtro en la biblioteca y etiqueta al pie de cada artículo. No tiene página propia."
        placeholder="Nueva disciplina — por ejemplo: Psicoanálisis"
        tipo="disciplina"
        terminos={disciplines}
        calcularEstado={estadoDeDisciplina}
        urlDe={(d) => `/blog?disciplina=${d.slug}`}
        textoEliminar={(d) => `¿Eliminar la disciplina «${d.name}»?\n\nLos artículos no se borran: pierden esta etiqueta.`}
        onCreate={createDiscipline}
        onDelete={deleteDiscipline}
        vacio="Todavía no hay disciplinas."
      />

      <SeccionComplementos topics={topics} complements={complements} />
      <SeccionFases phases={phases} />

      <BarraDeGuardado />
    </div>
  );
}

export default function TaxonomyManager(props) {
  return (
    <ProveedorDeCambios>
      <Panel {...props} />
    </ProveedorDeCambios>
  );
}
