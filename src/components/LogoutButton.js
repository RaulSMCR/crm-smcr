//src/components/LogoutButton.js
'use client'; 

// 1. IMPORTAMOS LA ACCIÓN (No usamos fetch ni APIs)
import { logout } from "@/actions/auth-actions"; 
import { useState } from "react";

export default function LogoutButton() {
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    // 2. EJECUTAMOS LA ACCIÓN DIRECTAMENTE
    // Esto borra la cookie y redirige a /ingresar desde el servidor
    await logout(); 
  };

  return (
    <button 
      onClick={handleLogout} 
      disabled={loading}
      className="text-red-600 font-bold hover:text-red-800 text-sm border border-red-200 bg-white px-4 py-2 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-2 disabled:opacity-50"
    >
      {loading ? "Saliendo..." : "🚪 Cerrar Sesión"}
    </button>
  );
}