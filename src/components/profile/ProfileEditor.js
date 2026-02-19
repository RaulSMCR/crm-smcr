///src/components/profile/ProfileEditor.js
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ChangePasswordCard from "@/components/auth/ChangePasswordCard";
import { updateProfile } from "@/actions/profile-actions";
import { supabase } from "@/lib/supabase-client";

export default function ProfileEditor({ profile, allServices = [] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  const [form, setForm] = useState({
    name: profile.user?.name || "",
    phone: profile.user?.phone || "",
    specialty: profile.specialty || "",
    licenseNumber: profile.licenseNumber || "",
    bio: profile.bio || "",
  });

  const [selectedServices, setSelectedServices] = useState(
    Array.isArray(profile.services) ? profile.services.map((s) => s.id) : []
  );

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
        setMsg({ type: "success", text: "✅ Perfil guardado correctamente" });
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
    <div className="space-y-8">
      {msg.text && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            msg.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-rose-50 border-rose-200 text-rose-900"
          }`}
        >
          {msg.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* FOTO */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800">Foto</h3>
          <p className="text-sm text-slate-500 mt-1">Recomendado 500×500px.</p>

          <div className="mt-4 flex items-center gap-4">
            <div className="relative">
              <div className="h-24 w-24 rounded-full overflow-hidden border border-slate-200 bg-slate-50">
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt="Avatar" className="h-full w-full object-cover" />
                ) : null}
              </div>
            </div>

            <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-medium text-blue-700">
              <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              Cambiar foto
            </label>
          </div>
        </div>

        {/* INFO PÚBLICA */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-slate-800">Información pública</h3>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Nombre y Apellido</label>
              <input
                name="name"
                value={form.name}
                onChange={handleInputChange}
                className="mt-1 w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2.5"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Teléfono</label>
              <input
                name="phone"
                value={form.phone}
                onChange={handleInputChange}
                className="mt-1 w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2.5"
                placeholder="+506 8888-8888"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Especialidad (Título)</label>
              <input
                name="specialty"
                value={form.specialty}
                onChange={handleInputChange}
                className="mt-1 w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2.5"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Matrícula / Licencia</label>
              <input
                name="licenseNumber"
                value={form.licenseNumber}
                onChange={handleInputChange}
                className="mt-1 w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2.5"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Biografía</label>
            <textarea
              name="bio"
              value={form.bio}
              onChange={handleInputChange}
              rows={5}
              className="mt-1 w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* SERVICIOS */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800">Mis servicios</h3>
          <p className="text-sm text-slate-500 mt-1">
            Selecciona los tipos de atención que brindas.
          </p>

          {allServices.length === 0 ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              ⚠️ No hay servicios disponibles. Contacta al administrador.
            </div>
          ) : (
            <div className="mt-4 grid md:grid-cols-2 gap-3">
              {allServices.map((service) => {
                const isSelected = selectedServices.includes(service.id);
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
                        <div className="font-semibold text-slate-800">{service.title}</div>
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
