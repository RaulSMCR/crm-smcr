///src/components/profile/ProfileEditor.js
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ChangePasswordCard from "@/components/auth/ChangePasswordCard";
import { updateProfile } from "@/actions/profile-actions";
import { supabase } from "@/lib/supabase-client";

export default function ProfileEditor({ profile, allServices = [] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  const assignmentByServiceId = useMemo(() => {
    const map = new Map();
    (profile.serviceAssignments || []).forEach((a) => {
      map.set(a.serviceId, a.status);
    });
    return map;
  }, [profile.serviceAssignments]);

  const initialSelected = useMemo(() => {
    // seleccionados = APPROVED + PENDING (los REJECTED se dejan fuera para que puedan re-solicitarse)
    const ids = [];
    for (const [serviceId, status] of assignmentByServiceId.entries()) {
      if (status === "APPROVED" || status === "PENDING") ids.push(serviceId);
    }
    return ids;
  }, [assignmentByServiceId]);

  const [form, setForm] = useState({
    name: profile.user?.name || "",
    phone: profile.user?.phone || "",
    specialty: profile.specialty || "",
    licenseNumber: profile.licenseNumber || "",
    bio: profile.bio || "",
  });

  const [selectedServices, setSelectedServices] = useState(initialSelected);
  const [avatarFile, setAvatarFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(profile.user?.image || null);

  const handleInputChange = (e) => {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  };

  const handleServiceToggle = (serviceId) => {
    setSelectedServices((prev) =>
      prev.includes(serviceId) ? prev.filter((id) => id !== serviceId) : [...prev, serviceId]
    );
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
    setAvatarFile(file);
  };

  const badgeFor = (status) => {
    if (status === "APPROVED")
      return <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800 border border-green-200">Aprobado</span>;
    if (status === "PENDING")
      return <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200">En revisión</span>;
    if (status === "REJECTED")
      return <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-800 border border-red-200">Rechazado</span>;
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg({ type: "", text: "" });

    try {
      let publicUrl = null;

      if (avatarFile) {
        const fileExt = avatarFile.name.split(".").pop();
        const fileName = `${profile.userId}-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(fileName, avatarFile, { upsert: true });

        if (uploadError) throw new Error("Error subiendo imagen: " + uploadError.message);

        const { data } = supabase.storage.from("avatars").getPublicUrl(fileName);
        publicUrl = data.publicUrl;
      }

      const fd = new FormData();
      fd.append("name", form.name);
      fd.append("phone", form.phone);
      fd.append("specialty", form.specialty);
      fd.append("licenseNumber", form.licenseNumber);
      fd.append("bio", form.bio);
      if (publicUrl) fd.append("imageUrl", publicUrl);
      selectedServices.forEach((id) => fd.append("serviceIds", id));

      const res = await updateProfile(fd);

      if (res?.success) {
        if ((res.pendingRequested || 0) > 0) {
          setMsg({
            type: "success",
            text: `✅ Perfil guardado. ${res.pendingRequested} servicio(s) quedaron en revisión del administrador.`,
          });
        } else {
          setMsg({ type: "success", text: "✅ Perfil guardado correctamente" });
        }
        router.refresh();
      } else {
        setMsg({ type: "error", text: "❌ " + (res?.error || "No se pudo guardar") });
      }
    } catch (error) {
      console.error(error);
      setMsg({ type: "error", text: "Ocurrió un error inesperado." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {msg.text && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            msg.type === "success"
              ? "border-green-200 bg-green-50 text-green-900"
              : "border-red-200 bg-red-50 text-red-900"
          }`}
        >
          {msg.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* FOTO */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800">Foto</h3>
          <p className="text-sm text-slate-500 mt-1">Recomendado 500×500px.</p>

          <div className="mt-4 flex items-center gap-4">
            <div className="h-16 w-16 rounded-full overflow-hidden bg-slate-100 border border-slate-200">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt="Preview" className="h-full w-full object-cover" />
              ) : null}
            </div>

            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Cambiar foto
              <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            </label>
          </div>
        </div>

        {/* INFO PÚBLICA */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800">Información pública</h3>

          <div className="mt-4 grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Nombre y Apellido</label>
              <input
                name="name"
                value={form.name}
                onChange={handleInputChange}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Teléfono</label>
              <input
                name="phone"
                value={form.phone}
                onChange={handleInputChange}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Especialidad (Título)</label>
              <input
                name="specialty"
                value={form.specialty}
                onChange={handleInputChange}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Matrícula / Licencia</label>
              <input
                name="licenseNumber"
                value={form.licenseNumber}
                onChange={handleInputChange}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-700">Biografía</label>
              <textarea
                name="bio"
                value={form.bio}
                onChange={handleInputChange}
                rows={5}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </div>
          </div>
        </div>

        {/* SERVICIOS */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800">Mis servicios</h3>
          <p className="text-sm text-slate-500 mt-1">
            Los servicios nuevos quedan <b>en revisión</b> hasta aprobación del admin.
          </p>

          {allServices.length === 0 ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              ⚠️ No hay servicios disponibles. Contacta al administrador.
            </div>
          ) : (
            <div className="mt-4 grid md:grid-cols-2 gap-3">
              {allServices.map((service) => {
                const isSelected = selectedServices.includes(service.id);
                const status = assignmentByServiceId.get(service.id) || null;

                return (
                  <button
                    type="button"
                    key={service.id}
                    onClick={() => handleServiceToggle(service.id)}
                    className={`text-left border rounded-xl p-4 transition-all ${
                      isSelected
                        ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600"
                        : "border-slate-200 hover:border-blue-400 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="font-semibold text-slate-800">{service.title}</div>
                          {badgeFor(status)}
                        </div>
                        <div className="text-sm text-slate-500">
                          {service.description || "Sin descripción"}
                        </div>
                      </div>
                      <div className="text-xs text-slate-600 whitespace-nowrap">
                        {service.durationMin} min · ${String(service.price)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-blue-600 text-white px-5 py-2.5 font-semibold shadow-sm hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>

      <ChangePasswordCard />
    </div>
  );
}
