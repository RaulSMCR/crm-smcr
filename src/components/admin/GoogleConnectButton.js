'use client';

import { generarUrlConexionGoogle } from "@/actions/google-connect-actions";
import { useState } from "react";

export default function GoogleConnectButton() {
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    setLoading(true);
    try {
      // Pedimos la URL segura al servidor
      const url = await generarUrlConexionGoogle();
      // Redirigimos al usuario a Google
      window.location.href = url; 
    } catch (error) {
      alert("Error al iniciar conexión");
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleConnect}
      disabled={loading}
      className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-all shadow-sm"
    >
      {loading ? 'Conectando...' : (
        <>
          <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="G" />
          <span>Conectar Google Calendar</span>
        </>
      )}
    </button>
  );
}