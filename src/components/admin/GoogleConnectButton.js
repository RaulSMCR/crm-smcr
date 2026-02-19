// src/components/admin/GoogleConnectButton.js
"use client";

import { generarUrlConexionGoogle } from "@/actions/google-connect-actions";
import { useState } from "react";

export default function GoogleConnectButton() {
  const [loading, setLoading] = useState(false);

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
