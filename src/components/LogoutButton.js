//src/components/LogoutButton.js
'use client'; 

import { logout } from "@/actions/auth-actions";

export default function LogoutButton() {
  return (
    <button 
      onClick={() => logout()} 
      className="text-red-600 font-bold hover:text-red-800 text-sm border border-red-200 bg-white px-4 py-2 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-2"
    >
      🚪 Cerrar Sesión
    </button>
  );
}