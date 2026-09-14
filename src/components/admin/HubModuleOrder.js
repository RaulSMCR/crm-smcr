"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reorderProfessionalHubModules } from "@/actions/professional-hub-actions";
import { motivoFueraDeGrilla } from "@/lib/hub-order";

/**
 * Orden de aparición de las piezas del hub y cuál va destacada.
 *
 * Existe porque el número «Posición» de cada formulario no alcanzaba: se guardaba
 * módulo por módulo, dos podían quedar con el mismo número —y ahí el orden lo
 * decidía la base, no el panel— y para meter algo al frente había que renumerar
 * el resto a mano. Acá el orden se ve completo, se mueve con las flechas y se
 * guarda contiguo en una sola escritura.
 *
 * Muestra también lo que el número nunca decía: **qué piezas no se ven**. La
 * grilla pública pinta solo temas visibles y publicados, así que un orden de
 * cinco tarjetas de las que en el sitio aparecen dos hacía parecer que el orden
 * no funcionaba.
 */
export default function HubModuleOrder({ hubId, hubSlug, modulos = [] }) {
  const router = useRouter();
  const [guardando, guardar] = useTransition();
  const [aviso, setAviso] = useState(null);

  // La firma es lo que hace que la lista se resincronice cuando el servidor
  // manda otro orden (una importación, otra pestaña). Es angosta a propósito:
  // cambia con el orden y el destaque, no con un título, así que un «Guardar
  // módulo» de al lado no borra un reordenamiento a medio hacer.
  const firma = modulos.map((modulo) => `${modulo.id}:${modulo.position}:${modulo.isFeatured ? 1 : 0}`).join("|");
  const [base, setBase] = useState(firma);
  const [lista, setLista] = useState(modulos);
  const [destacada, setDestacada] = useState(modulos.find((modulo) => modulo.isFeatured)?.id || "");
  if (base !== firma) {
    setBase(firma);
    setLista(modulos);
    setDestacada(modulos.find((modulo) => modulo.isFeatured)?.id || "");
    setAviso(null);
  }

  const sucio =
    lista.map((modulo) => modulo.id).join("|") !== modulos.map((modulo) => modulo.id).join("|") ||
    destacada !== (modulos.find((modulo) => modulo.isFeatured)?.id || "");

  function mover(indice, salto) {
    const destino = indice + salto;
    if (destino < 0 || destino >= lista.length) return;
    const copia = [...lista];
    [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
    setLista(copia);
    setAviso(null);
  }

  function restablecer() {
    setLista(modulos);
    setDestacada(modulos.find((modulo) => modulo.isFeatured)?.id || "");
    setAviso(null);
  }

  function aplicar() {
    setAviso(null);
    guardar(async () => {
      const salida = await reorderProfessionalHubModules(hubId, {
        orden: lista.map((modulo) => modulo.id),
        destacada: destacada || null,
      });
      if (salida?.error) {
        setAviso({ tipo: "error", texto: salida.error });
        return;
      }
      setAviso({
        tipo: "ok",
        texto: salida.cambios ? `Orden guardado: ${salida.cambios} ${salida.cambios === 1 ? "pieza cambió" : "piezas cambiaron"}.` : "No había nada que cambiar.",
      });
      router.refresh();
    });
  }

  if (!lista.length) {
    return null;
  }

  // El número que se muestra no es `position`: es el lugar que la pieza ocupa
  // **en la grilla**, contando solo las que se ven. Es lo que mira quien entra,
  // y se calcula antes de pintar para no ir sumando dentro del render.
  const filas = [];
  let enGrilla = 0;
  for (const modulo of lista) {
    const motivo = motivoFueraDeGrilla(modulo);
    if (!motivo) enGrilla += 1;
    filas.push({ modulo, motivo, numero: motivo ? null : enGrilla });
  }

  return (
    <section className="rounded-2xl border border-brand-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold text-slate-950">Orden de aparición y pieza destacada</h2>
      <p className="mt-1 text-sm text-slate-600">
        El orden en que se leen las tarjetas en <span className="font-mono">/{hubSlug}</span>, de arriba abajo. La destacada se
        pinta primera y a ancho completo: es una sola por hub, y sirve para decidir qué se ve antes de leer nada.
      </p>

      <ol className="mt-5 space-y-2">
        {filas.map(({ modulo, motivo, numero }, indice) => {
          return (
            <li
              key={modulo.id}
              className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 ${motivo ? "border-slate-200 bg-slate-50" : "border-brand-200 bg-white"}`}
            >
              <span className={`w-8 shrink-0 text-center text-sm font-bold ${motivo ? "text-slate-400" : "text-slate-900"}`}>
                {numero ?? "—"}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-slate-900">
                  {modulo.title}
                  {modulo.isFeatured ? <span className="ml-2 rounded bg-brand-100 px-2 py-0.5 text-xs font-bold text-brand-800">destacada</span> : null}
                </span>
                <span className="block truncate font-mono text-xs text-slate-500">/{hubSlug}/{modulo.slug}</span>
                {motivo ? <span className="mt-0.5 block text-xs text-amber-800">No se ve en la grilla: {motivo}.</span> : null}
              </span>

              <label className="flex shrink-0 items-center gap-2 text-xs text-slate-700">
                <input
                  type="radio"
                  name="hub-destacada"
                  checked={destacada === modulo.id}
                  disabled={modulo.type !== "TOPIC"}
                  onChange={() => { setDestacada(modulo.id); setAviso(null); }}
                />
                Destacar
              </label>

              <span className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => mover(indice, -1)}
                  disabled={indice === 0 || guardando}
                  aria-label={`Subir ${modulo.title}`}
                  className="rounded border border-slate-300 px-2 py-1 text-sm font-bold text-slate-700 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => mover(indice, 1)}
                  disabled={indice === lista.length - 1 || guardando}
                  aria-label={`Bajar ${modulo.title}`}
                  className="rounded border border-slate-300 px-2 py-1 text-sm font-bold text-slate-700 disabled:opacity-30"
                >
                  ↓
                </button>
              </span>
            </li>
          );
        })}
      </ol>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={aplicar}
          disabled={guardando || !sucio}
          className="rounded-lg bg-brand-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {guardando ? "Guardando…" : "Guardar orden"}
        </button>
        {destacada ? (
          <button type="button" onClick={() => { setDestacada(""); setAviso(null); }} className="text-sm font-semibold text-slate-600 hover:underline">
            Quitar el destaque
          </button>
        ) : null}
        {sucio ? (
          <button type="button" onClick={restablecer} className="text-sm font-semibold text-slate-600 hover:underline">
            Descartar los cambios
          </button>
        ) : (
          <span className="text-xs text-slate-500">Nada por guardar: el orden de la pantalla es el que está publicado.</span>
        )}
      </div>

      {aviso ? (
        <p className={`mt-3 text-sm ${aviso.tipo === "error" ? "text-red-700" : "text-emerald-700"}`} role="status">
          {aviso.texto}
        </p>
      ) : null}
    </section>
  );
}
