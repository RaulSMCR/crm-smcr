// src/components/blog/PostMarketingTracker.jsx
"use client";

import { useEffect, useRef } from "react";

function parseUtm(searchParams) {
  const keys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
  const utm = {};
  for (const k of keys) {
    const v = searchParams.get(k);
    if (v) utm[k] = v;
  }
  return utm;
}

export default function PostMarketingTracker({ slug }) {
  const eventIdRef = useRef(null);
  const startMsRef = useRef(Date.now());
  const maxScrollRef = useRef(0);
  const readMarkedRef = useRef(false);

  // Ajustables (marketing)
  const MIN_SECONDS_FOR_READ = 20;
  const MIN_SCROLL_FOR_READ = 60; // %

  useEffect(() => {
    if (!slug) return;

    startMsRef.current = Date.now();
    maxScrollRef.current = 0;
    readMarkedRef.current = false;

    const url = new URL(window.location.href);
    const utm = parseUtm(url.searchParams);

    // 1) Crear evento "view"
    fetch(`/api/blog/${encodeURIComponent(slug)}/track`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      cache: "no-store",
      body: JSON.stringify({
        landingUrl: window.location.href,
        referrer: document.referrer || null,
        utm,
      }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (j?.eventId) eventIdRef.current = j.eventId;
      })
      .catch(() => {});

    // 2) Scroll tracking
    const onScroll = () => {
      const doc = document.documentElement;
      const scrollTop = doc.scrollTop || document.body.scrollTop || 0;
      const scrollHeight = doc.scrollHeight || 1;
      const clientHeight = doc.clientHeight || window.innerHeight || 1;

      const maxScrollable = Math.max(1, scrollHeight - clientHeight);
      const pct = Math.round((scrollTop / maxScrollable) * 100);

      maxScrollRef.current = Math.max(
        maxScrollRef.current,
        Math.min(100, Math.max(0, pct))
      );
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    // 3) Evaluación de "read"
    const interval = setInterval(() => {
      const seconds = Math.round((Date.now() - startMsRef.current) / 1000);
      const scroll = maxScrollRef.current;

      if (!readMarkedRef.current && seconds >= MIN_SECONDS_FOR_READ && scroll >= MIN_SCROLL_FOR_READ) {
        readMarkedRef.current = true;

        const id = eventIdRef.current;
        if (!id) return;

        fetch(`/api/blog/events/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          credentials: "include",
          cache: "no-store",
          body: JSON.stringify({
            isRead: true,
            timeOnPageSeconds: seconds,
            scrollDepth: scroll,
          }),
        }).catch(() => {});
      }
    }, 2000);

    // 4) Flush al salir (guardar time/scroll aunque no llegue a read)
    const flush = () => {
      const id = eventIdRef.current;
      if (!id) return;

      const seconds = Math.round((Date.now() - startMsRef.current) / 1000);
      const scroll = maxScrollRef.current;

      const payload = JSON.stringify({
        timeOnPageSeconds: seconds,
        scrollDepth: scroll,
      });

      try {
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon(`/api/blog/events/${id}`, blob);
      } catch {
        fetch(`/api/blog/events/${id}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    };

    window.addEventListener("beforeunload", flush);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("beforeunload", flush);
      clearInterval(interval);
      flush();
    };
  }, [slug]);

  return null;
}
