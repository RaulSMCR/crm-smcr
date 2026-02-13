// src/components/admin/PendingProfessionalsList.js
"use client";

import { approveUser, rejectUser } from "@/actions/admin-actions";
import { useState } from "react";

export default function PendingProfessionalsList({ users }) {
  const safeUsers = Array.isArray(users) ? users : [];
  const [processing, setProcessing] = useState(null);
  const [msg, setMsg] = useState(null); // { type: "success"|"error", text: string }

  async function handleApprove(userId) {
    setMsg(null);
    if (!confirm("¿Confirmas la aprobación?")) return;

    setProcessing(userId);
    try {
      const res = await approveUser(userId);
      if (!res?.success) {
        setMsg({ type: "error", text: res?.error || "No se pudo aprobar." });
      } else {
        setMsg({ type: "success", text: "✅ Profesional aprobado." });
      }
    } catch (e) {
      setMsg({ type: "error", text: `❌ Error inesperado: ${String(e?.message ?? e)}` });
    } finally {
      setProcessing(null);
    }
  }

  async function handleReject(userId) {
    setMsg(null);
    if (!confirm("¿Rechazar solicitud?")) return;

    setProcessing(userId);
    try {
      const res = await rejectUser(userId);
      if (!res?.success) {
        setMsg({ type: "error", text: res?.error || "No se pudo rechazar." });
      } else {
        setMsg({ type: "success", text: "✅ Solicitud rechazada." });
      }
    } catch (e) {
      setMsg({ type: "error", text: `❌ Error inesperado: ${String(e?.message ?? e)}` });
    } finally {
      setProcessing(null);
    }
  }

  return (
    <div className="space-y-4">
      {msg && (
        <div
          className={`rounded-lg px-4 py-3 text-sm font-medium border ${
            msg.type === "success"
              ? "bg-green-50 text-green-800 border-green-200"
              : "bg-red-50 text-red-800 border-red-200"
          }`}
        >
          {msg.text}
        </div>
      )}

      {safeUsers.length === 0 ? (
        <div className="bg-white p-6 rounded-xl border border-slate-200 text-center">
          <p className="text-slate-500">✅ No hay solicitudes pendientes.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">
                    Profesional
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">
                    Datos
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase">
                    Acciones
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {safeUsers.map((user) => {
                  const isLoading = processing === user.id;

                  return (
                    <tr key={user.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs mr-3">
                            {user.name?.charAt(0) || "?"}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-slate-900">{user.name}</div>
                            <div className="text-xs text-slate-500">{user.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                          Pendiente
                        </span>
                        {user.professionalProfile?.licenseNumber && (
                          <div className="text-xs text-slate-400 mt-1">
                            Mat: {user.professionalProfile.licenseNumber}
                          </div>
                        )}
                        {user.professionalProfile?.specialty && (
                          <div className="text-xs text-slate-400 mt-1">
                            Área: {user.professionalProfile.specialty}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleReject(user.id)}
                            disabled={isLoading}
                            className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 px-3 py-1 rounded transition disabled:opacity-50 text-xs font-bold"
                          >
                            {isLoading ? "..." : "Rechazar"}
                          </button>

                          <button
                            onClick={() => handleApprove(user.id)}
                            disabled={isLoading}
                            className="text-white bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded shadow-sm transition disabled:opacity-50 text-xs font-bold flex items-center gap-1"
                          >
                            {isLoading ? "..." : "Aprobar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

            </table>
          </div>
        </div>
      )}
    </div>
  );
}
