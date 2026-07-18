"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import { IMAGE_FALLBACKS, normalizeImageSrc } from "@/lib/images";

function initialsFor(name) {
  return String(name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase() || "?";
}

export default function SafeImage({
  src,
  fallbackSrc = IMAGE_FALLBACKS.default,
  alt = "",
  className = "",
  onError,
  ...props
}) {
  const normalizedSrc = useMemo(() => normalizeImageSrc(src), [src]);
  const normalizedFallback = useMemo(() => normalizeImageSrc(fallbackSrc), [fallbackSrc]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [normalizedSrc, normalizedFallback]);

  const activeSrc = failed || !normalizedSrc ? normalizedFallback : normalizedSrc;
  if (!activeSrc) return null;

  return (
    <img
      {...props}
      src={activeSrc}
      alt={alt}
      className={className}
      onError={(event) => {
        if (!failed && normalizedFallback && activeSrc !== normalizedFallback) {
          setFailed(true);
        } else {
          event.currentTarget.style.visibility = "hidden";
        }
        onError?.(event);
      }}
    />
  );
}

export function SafeAvatar({
  src,
  name,
  alt,
  className = "",
  fallbackClassName = "",
}) {
  const normalizedSrc = useMemo(() => normalizeImageSrc(src), [src]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [normalizedSrc]);

  if (!normalizedSrc || failed) {
    return (
      <div
        className={`grid place-items-center bg-slate-200 text-sm font-bold text-slate-700 ${className} ${fallbackClassName}`}
        aria-label={alt || name || "Avatar"}
      >
        {initialsFor(name)}
      </div>
    );
  }

  return (
    <img
      src={normalizedSrc}
      alt={alt || name || ""}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
