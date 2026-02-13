// src/components/admin/PendingProfessionalsList.js
"use client";

import { approveUser, rejectUser } from "@/actions/admin-actions";
import { useState } from "react";

function safeText(v) {
  return typeof v === "string" ? v.trim() : "";
}

function truncate(text, n = 160) {
  const t = safeText(text);
  if (!t) return "";
  return t.length > n ? t.slice(0, n).trimEnd() + "…" : t;
}

function digitsOnly(phone) {
  // WhatsApp wa.me espera solo dígitos (incluye código país sin +)
  const raw = safeText(phone);
  return raw.replace(/\D/g, ""); // solo 0-9
}

function telHref(phone) {
  const raw = safeText(phone);
  const cleaned = raw.replace(/[^\d+]/g, ""); // deja + y dígitos
  if (!cleaned) return "";
  return `tel:${cleaned}`;
}

function waHref(phone) {
  // wa.me/<countrycode+number> sin "+"
  const d = digitsOnly(phone);
  // mínimo razonable para evitar basura
  if (!d || d.length < 8) return "";
  return `https://wa.me/${d}`;
}

export default function PendingProfessionalsList({ users }) {
  const safeUsers = Array.isArray(users) ? users : [];
  const [processing, setProcessing] = useState(null);

  async function handleApprove(id) {
    if (!confirm("¿Confirmas la aprobación?")) return;
    setProcessing(id);
    await approveUser(id);
    setProcessing(null);
  }

  async function handleReject(id) {
    if (!confirm("¿Rechazar solicitud?")) return;
    setProcessing(id);
    await rejectUser(id);
    setProcessing(null);
  }

  if (safeUsers.length === 0) {
    return (
      <div className="bg-white p-6 rounded-xl border border-slate-200 text-center">
        <p className="text-slate-500">✅ No hay solicitudes pendientes.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">
                Profesional
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">
                Contacto
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">
                Perfil
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">
                Documentación
              </th>
              <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase">
                Acciones
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 bg-white">
            {safeUsers.map((user) => {
              const isLoading = processing === user.id;

              const prof = user.professionalProfile || null;
              const license = safeText(prof?.licenseNumber);
              const specialty = safeText(prof?.specialty);
              const bio = safeText(prof?.bio);
              const cvUrl = safeText(prof?.cvUrl);

              const phone = safeText(user.phone);
              const tel = telHref(phone);
              const wa = waHref(phone);

              return (
                <tr key={user.id} className="hover:bg-slate-50 transition align-top">
                  {/* Profesional */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs mr-3">
                        {user.name?.charAt(0) || "?"}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-900">
                          {user.name || "(Sin nombre)"}
                        </div>
                        <div className="text-xs text-slate-500">{user.email}</div>
                      </div>
                    </div>
                  </td>

                  {/* Contacto */}
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-2">
                      <div className="text-xs text-slate-500 font-semibold uppercase">Teléfono</div>

                      {phone ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm text-slate-800 font-medium">{phone}</span>

                          {tel && (
                            <a
                              href={tel}
                              className="inline-flex items-center gap-1 text-xs font-bold bg-green-50 text-green-700 px-2 py-1 rounded hover:bg-green-100 transition"
                              title="Llamar"
                            >
                              📞 Llamar
                            </a>
                          )}

                          {wa && (
                            <a
                              href={wa}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-bold bg-emerald-50 text-emerald-700 px-2 py-1 rounded hover:bg-emerald-100 transition"
                              title="WhatsApp"
                            >
                              💬 WhatsApp
                            </a>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 italic">Sin teléfono.</div>
                      )}

                      <div className="text-xs text-slate-500 font-semibold uppercase mt-2">Estado</div>
                      <span className="inline-flex w-fit px-2 py-1 text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                        Pendiente
                      </span>
                    </div>
                  </td>

                  {/* Perfil */}
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-2">
                      {(specialty || license) ? (
                        <div className="text-xs text-slate-600 space-y-1">
                          {specialty && (
                            <div>
                              <span className="font-semibold text-slate-700">Especialidad:</span>{" "}
                              {specialty}
                            </div>
                          )}
                          {license && (
                            <div>
                              <span className="font-semibold text-slate-700">Mat:</span> {license}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 italic">Sin datos profesionales.</div>
                      )}

                      {bio ? (
                        <div className="mt-1">
                          <div className="text-[11px] font-bold text-slate-500 uppercase">
                            Bio pública
                          </div>
                          <p className="text-sm text-slate-700 leading-snug">
                            {truncate(bio, 190)}
                          </p>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 italic">Sin bio pública.</div>
                      )}
                    </div>
                  </td>

                  {/* Documentación */}
                  <td className="px-4 py-4">
                    {cvUrl ? (
                      <div className="flex flex-col gap-2">
                        <a
                          href={cvUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex w-fit items-center gap-2 bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-black transition"
                        >
                          📄 Ver CV (PDF)
                        </a>
                        <div className="text-[11px] text-slate-400 break-all">{cvUrl}</div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 italic">Sin CV adjunto.</div>
                    )}
                  </td>

                  {/* Acciones */}
                  <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleReject(user.id)}
                        disabled={isLoading}
                        className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 px-3 py-1 rounded transition disabled:opacity-50 text-xs font-bold"
                      >
                        Rechazar
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
  );
}
