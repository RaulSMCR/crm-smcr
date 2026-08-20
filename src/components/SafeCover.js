"use client";

// Portada de artículo o de servicio, sobre `next/image`.
//
// `SafeImage` sigue existiendo y sigue usándose en los otros veintitantos
// lugares: avatares, miniaturas de editor, previsualizaciones. Este componente
// es solo para las imágenes GRANDES que ocupan el primer pantallazo, que son las
// que pesan en Core Web Vitals y las únicas donde `next/image` cambia algo real
// —formato moderno, tamaño según el dispositivo, y espacio reservado para que la
// página no salte al cargar—.
//
// Se hizo así y no migrando los treinta y un usos de una vez porque `next/image`
// exige `fill` o medidas explícitas, y aplicarlo a ciegas sobre avatares y
// miniaturas rompe el layout de formas que solo se ven mirando cada pantalla.

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { normalizeImageSrc } from "@/lib/images";

export default function SafeCover({
  src,
  alt,
  fallbackSrc = "",
  /** El LCP de la página. Solo uno por pantalla. */
  priority = false,
  focusX = 50,
  focusY = 50,
  scale = 100,
  className = "",
  sizes = "100vw",
}) {
  const normalizado = useMemo(() => normalizeImageSrc(src), [src]);
  const respaldo = useMemo(() => normalizeImageSrc(fallbackSrc), [fallbackSrc]);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    setFallo(false);
  }, [normalizado, respaldo]);

  const actual = fallo || !normalizado ? respaldo : normalizado;
  if (!actual) return null;

  return (
    <Image
      src={actual}
      // `alt` nunca es opcional acá: una portada sin texto alternativo es una
      // imagen que no existe para quien usa lector de pantalla.
      alt={alt || ""}
      fill
      priority={priority}
      sizes={sizes}
      className={className}
      style={{
        objectFit: "cover",
        objectPosition: `${focusX ?? 50}% ${focusY ?? 50}%`,
        transform: `scale(${(scale ?? 100) / 100})`,
      }}
      onError={() => {
        if (!fallo && respaldo && actual !== respaldo) setFallo(true);
      }}
    />
  );
}
