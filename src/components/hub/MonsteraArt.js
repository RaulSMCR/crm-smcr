"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";

export default function MonsteraArt() {
  const videoRef = useRef(null);
  const [motionAllowed, setMotionAllowed] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setMotionAllowed(!reduced);
  }, []);

  useEffect(() => {
    if (!motionAllowed) return;
    videoRef.current?.play().catch(() => {});
  }, [motionAllowed]);

  return (
    <div className="monstera-media" aria-label="Animación de la hoja de monstera de Salud Mental Costa Rica" role="img">
      <video
        ref={videoRef}
        autoPlay={motionAllowed}
        muted
        playsInline
        preload="metadata"
        poster="/images/hub-raul-poster.jpeg"
        className="h-full w-full object-contain"
      >
        <source src="/videos/hub-raul-monstera.mp4" type="video/mp4" />
        <img src="/images/hub-raul-monstera.gif" alt="Hoja de monstera desenvolviéndose" className="h-full w-full object-contain" />
      </video>
    </div>
  );
}
