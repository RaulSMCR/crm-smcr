"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SafeAvatar } from "@/components/SafeImage";

/**
 * Foto de profesional que se amplía en una ventana con su reseña y artículos.
 *
 * Usa el `<dialog>` nativo con `showModal()`: eso trae gratis el atrapado de
 * foco, el cierre con Escape y el resto de la página inerte, que es justo lo
 * que una ventana modal hecha a mano suele hacer mal.
 *
 * Los datos NO viajan con la página. Se piden a /api/profesionales/[slug]/ficha
 * la primera vez que alguien abre la ventana, y quedan en memoria: la home
 * muestra cinco profesionales y casi nadie abre ninguno, así que cargar cinco
 * reseñas completas con sus artículos en cada visita sería pagar por adelantado
 * algo que casi nunca se usa.
 */

const formatoFecha = new Intl.DateTimeFormat("es-CR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function inicialDe(nombre) {
  return String(nombre || "S").trim().charAt(0).toUpperCase() || "S";
}

function Avatar({ image, name, className, textClassName }) {
  if (image) {
    return (
      <SafeAvatar
        src={image}
        name={name}
        alt={"Foto de " + name}
        className={className + " object-cover"}
      />
    );
  }

  return (
    <div className={"flex items-center justify-center " + className + " " + textClassName}>
      {inicialDe(name)}
    </div>
  );
}

export default function FichaProfesionalDialog({
  professional,
  children,
  triggerClassName = "",
  triggerLabel,
}) {
  const dialogRef = useRef(null);
  const [ficha, setFicha] = useState(null);
  const [estado, setEstado] = useState("inactivo");

  const nombre = professional?.name || "Profesional";
  const slug = professional?.slug || "";

  const cargar = useCallback(async () => {
    if (!slug || ficha) return;
    setEstado("cargando");
    try {
      const respuesta = await fetch("/api/profesionales/" + encodeURIComponent(slug) + "/ficha");
      if (!respuesta.ok) throw new Error("respuesta no ok");
      setFicha(await respuesta.json());
      setEstado("listo");
    } catch (error) {
      console.error("No se pudo cargar la ficha:", error);
      setEstado("error");
    }
  }, [slug, ficha]);

  const abrir = useCallback(() => {
    dialogRef.current?.showModal();
    // Mientras la ventana está abierta el fondo no debe desplazarse: en móvil,
    // sin esto, el scroll se lleva la página de atrás y la ventana queda
    // flotando sobre un contenido que se movió.
    document.body.style.overflow = "hidden";
    cargar();
  }, [cargar]);

  const cerrar = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  // El evento `close` cubre las tres salidas: el botón, Escape y el clic en el
  // fondo. Restaurar el scroll solo en el handler del botón dejaría la página
  // trabada si alguien cierra con Escape.
  useEffect(() => {
    const dialogo = dialogRef.current;
    if (!dialogo) return undefined;

    const alCerrar = () => {
      document.body.style.overflow = "";
    };

    dialogo.addEventListener("close", alCerrar);
    return () => {
      dialogo.removeEventListener("close", alCerrar);
      alCerrar();
    };
  }, []);

  const datos = ficha || professional || {};
  const publicaciones = ficha?.posts || [];
  const servicios = ficha?.services || [];

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        aria-label={triggerLabel || "Ver la ficha ampliada de " + nombre}
        className={triggerClassName}
      >
        {children}
      </button>

      <dialog
        ref={dialogRef}
        onClick={(event) => {
          // El `<dialog>` ocupa toda la pantalla, así que un clic cuyo target es
          // el diálogo mismo —y no algo de adentro— cayó fuera de la tarjeta.
          if (event.target === dialogRef.current) cerrar();
        }}
        className="w-[min(56rem,92vw)] max-w-none rounded-2xl border border-neutral-300 bg-neutral-50 p-0 text-neutral-900 shadow-xl backdrop:bg-neutral-950/60"
      >
        <div className="max-h-[85vh] overflow-y-auto">
          <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-6 py-4">
            <h2 className="text-2xl font-bold text-brand-900">{datos.name || nombre}</h2>
            <button
              type="button"
              onClick={cerrar}
              className="shrink-0 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-800 hover:bg-neutral-100"
            >
              Cerrar
            </button>
          </div>

          <div className="grid gap-6 px-6 py-6 md:grid-cols-[15rem_1fr]">
            <div>
              <div className="relative mx-auto h-56 w-56 overflow-hidden rounded-2xl border-4 border-white bg-brand-100 shadow-card md:mx-0 md:h-60 md:w-60">
                <Avatar
                  image={datos.image}
                  name={datos.name || nombre}
                  className="h-full w-full"
                  textClassName="text-7xl font-bold text-brand-800"
                />
              </div>

              {datos.specialty ? (
                <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-900">
                  {datos.specialty}
                </p>
              ) : null}

              {datos.licenseNumber ? (
                <p className="mt-1 text-xs text-neutral-600">Colegiatura {datos.licenseNumber}</p>
              ) : null}

              {servicios.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {servicios.map((servicio) => (
                    <span
                      key={servicio.id}
                      className="rounded-full bg-neutral-200 px-2.5 py-1 text-xs text-neutral-800"
                    >
                      {servicio.title}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="mt-5 flex flex-col gap-2">
                {datos.id ? (
                  <Link
                    href={"/agendar/" + datos.id}
                    className="inline-flex items-center justify-center rounded-lg bg-accent-700 px-4 py-2 text-sm font-semibold text-white no-underline transition hover:bg-accent-800 hover:no-underline"
                  >
                    Agendar cita
                  </Link>
                ) : null}
                {slug ? (
                  <Link
                    href={"/profesionales/" + slug}
                    className="inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 no-underline transition hover:bg-neutral-100 hover:no-underline"
                  >
                    Ver perfil completo
                  </Link>
                ) : null}
              </div>
            </div>

            <div>
              {estado === "cargando" ? (
                <p className="text-sm text-neutral-600">Cargando la ficha...</p>
              ) : null}

              {estado === "error" ? (
                <p className="text-sm text-accent-900">
                  No se pudo cargar la ficha. Podés abrir el perfil completo desde el botón de la izquierda.
                </p>
              ) : null}

              {ficha?.review ? (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">
                    Reseña
                  </h3>
                  <p className="mt-2 whitespace-pre-line text-sm leading-6 text-neutral-800">
                    {ficha.review}
                  </p>
                </div>
              ) : null}

              {estado === "listo" && !ficha?.review ? (
                <p className="text-sm text-neutral-600">
                  Este perfil todavía no tiene una reseña pública aprobada.
                </p>
              ) : null}

              {/* El bloque se omite entero si no hay artículos, en vez de decir
                  "todavía no publicó nada": cuatro de los cinco perfiles no
                  tienen ninguno, y anunciar esa ausencia en cada ficha no le
                  aporta nada a quien está eligiendo con quién atenderse. */}
              {publicaciones.length ? (
                <div className="mt-6 border-t border-neutral-200 pt-5">
                  <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">
                    Publicaciones
                  </h3>
                  <ul className="mt-3 space-y-3">
                    {publicaciones.map((post) => (
                      <li key={post.slug}>
                        <Link
                          href={"/blog/" + post.slug}
                          className="group block no-underline hover:no-underline"
                        >
                          <span className="block text-sm font-semibold leading-snug text-neutral-950 group-hover:underline">
                            {post.title}
                          </span>
                          {post.createdAt ? (
                            <time
                              dateTime={post.createdAt}
                              className="mt-0.5 block text-xs text-neutral-600"
                            >
                              {formatoFecha.format(new Date(post.createdAt))}
                            </time>
                          ) : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}
