"use client";

// Opt-in de notificaciones push. NUNCA pide permiso al cargar: solo tras un tap
// explícito en "Activar recordatorios". Se muestra en /mi/agenda mientras el
// dispositivo no esté suscrito y el permiso no esté denegado.
import { useEffect, useState } from "react";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export default function PushOptIn() {
  // checking | ready | working | done | denied | unsupported
  const [state, setState] = useState("checking");
  const [error, setError] = useState("");

  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    if (!supported || !VAPID_PUBLIC_KEY) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }

    // Solo LEE el estado (no pide permiso): ¿ya hay suscripción en este dispositivo?
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? "done" : "ready"))
      .catch(() => setState("ready"));
  }, []);

  async function activar() {
    setError("");
    setState("working");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "ready");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const res = await fetch("/api/mi/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      setState("done");
    } catch (e) {
      console.error("[push] activar falló:", e);
      setError("No pudimos activar las notificaciones. Intentá de nuevo.");
      setState("ready");
    }
  }

  if (state === "checking" || state === "unsupported" || state === "done") return null;

  if (state === "denied") {
    return (
      <div className="mb-4 rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-600">
        Las notificaciones están bloqueadas en este navegador. Activalas desde la configuración
        del sitio para recibir recordatorios de tus citas.
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-2xl border border-brand-200 bg-brand-50 p-4">
      <p className="text-sm font-medium text-brand-900">
        Activá las notificaciones para recibir recordatorios de tus citas.
      </p>
      {error ? <p className="mt-1 text-xs text-accent-700">{error}</p> : null}
      <button
        type="button"
        onClick={activar}
        disabled={state === "working"}
        className="mt-3 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-500 disabled:opacity-60"
      >
        {state === "working" ? "Activando…" : "Activar recordatorios"}
      </button>
    </div>
  );
}
