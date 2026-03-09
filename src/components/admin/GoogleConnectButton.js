// src/components/admin/GoogleConnectButton.js
"use client";

import { generarUrlConexionGoogle, desconectarGoogle } from "@/actions/google-connect-actions";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function GoogleConnectButton({ isConnected = false }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleConnect = async () => {
    setLoading(true);
    try {
      const url = await generarUrlConexionGoogle();
      window.location.href = url;
    } catch (e) {
      console.error(e);
      alert("Error al iniciar conexión con Google");
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("¿Desconectar Google Calendar? Las citas ya existentes no se verán afectadas.")) return;
    setLoading(true);
    await desconectarGoogle();
    setLoading(false);
    router.refresh();
  };

  if (isConnected) {
    return (
      <button
        onClick={handleDisconnect}
        disabled={loading}
        className="px-4 py-2 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm hover:bg-red-100 disabled:opacity-60"
      >
        {loading ? "Desconectando..." : "Desconectar Google Calendar"}
      </button>
    );
  }

  return (
    <button
      onClick={handleConnect}
      disabled={loading}
      className="px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60"
    >
      {loading ? "Conectando..." : "Conectar Google Calendar"}
    </button>
  );
}
