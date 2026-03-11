"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ChangePasswordCard from "@/components/auth/ChangePasswordCard";
import { updateProfile } from "@/actions/profile-actions";
import Toast from "@/components/ui/Toast";

function formatCRC(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "No definido";
  return new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: "CRC",
    maximumFractionDigits: 0,
  }).format(amount);
}

function badgeFor(status) {
  if (!status) return null;

  if (status === "APPROVED") {
    return (
      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
        Aprobado
      </span>
    );
  }

  if (status === "PENDING") {
    return (
      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
        En revisión
      </span>
    );
  }

  if (status === "REJECTED") {
    return (
      <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700">
        Rechazado
      </span>
    );
  }

  return null;
}

export default function ProfileEditor({ profile, allServices = [] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const dismissToast = useCallback(() => setToast(null), []);

  const assignmentsByServiceId = useMemo(() => {
    const map = new Map();
    (profile.serviceAssignments || []).forEach((assignment) => map.set(assignment.serviceId, assignment));
    return map;
  }, [profile.serviceAssignments]);

  const [form, setForm] = useState({
    name: profile.user?.name || "",
    phone: profile.user?.phone || "",
    specialty: profile.specialty || "",
    licenseNumber: profile.licenseNumber || "",
    bio: profile.bio || "",
  });

  const [selectedServices, setSelectedServices] = useState(() => {
    const base = (profile.serviceAssignments || [])
      .filter((assignment) => assignment.status !== "REJECTED")
      .map((assignment) => assignment.serviceId);
    return Array.from(new Set(base));
  });

  const [proposedPrices, setProposedPrices] = useState(() => {
    const base = {};
    (profile.serviceAssignments || []).forEach((assignment) => {
      base[assignment.serviceId] = assignment.proposedSessionPrice ?? "";
    });
    return base;
  });

  const [avatarFile, setAvatarFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(profile.user?.image || null);

  const handleInputChange = (event) => {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const handleServiceToggle = (serviceId) => {
    setSelectedServices((prev) =>
      prev.includes(serviceId) ? prev.filter((id) => id !== serviceId) : [...prev, serviceId]
    );
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
    setAvatarFile(file);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMsg({ type: "", text: "" });

    try {
      let publicUrl = null;

      if (avatarFile) {
        const uploadData = new FormData();
        uploadData.append("file", avatarFile);

        const uploadResponse = await fetch("/api/upload/avatar", {
          method: "POST",
          body: uploadData,
        });

        const uploadResult = await uploadResponse.json();
        if (!uploadResponse.ok) throw new Error(uploadResult.error || "Error subiendo imagen.");
        publicUrl = uploadResult.url;
      }

      const formData = new FormData();
      formData.append("name", form.name);
      formData.append("phone", form.phone);
      formData.append("specialty", form.specialty);
      formData.append("licenseNumber", form.licenseNumber);
      formData.append("bio", form.bio);
      if (publicUrl) formData.append("imageUrl", publicUrl);

      selectedServices.forEach((id) => {
        formData.append("serviceIds", id);
        formData.append("proposedPrice", `${id}:${proposedPrices[id] ?? ""}`);
      });

      const result = await updateProfile(formData);

      if (result?.success) {
        setToast({ message: "Perfil guardado correctamente.", type: "success" });
        router.refresh();
      } else {
        setToast({ message: result?.error || "No se pudo guardar.", type: "error" });
      }
    } catch (error) {
      console.error(error);
      setToast({ message: "Ocurrió un error inesperado.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="text-lg font-semibold text-slate-800">Foto</h3>
          <p className="mt-1 text-sm text-slate-500">Recomendado: 500 x 500 px.</p>

          <div className="mt-4 flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-50">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <span className="font-bold text-slate-600">
                  {(profile.user?.name || "P").charAt(0)}
                </span>
              )}
            </div>

            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Cambiar foto
              <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            </label>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="text-lg font-semibold text-slate-800">Información pública</h3>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-slate-700">Nombre y apellido</label>
              <input
                name="name"
                value={form.name}
                onChange={handleInputChange}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">Teléfono</label>
              <input
                name="phone"
                value={form.phone}
                onChange={handleInputChange}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">Especialidad (Título)</label>
              <input
                name="specialty"
                value={form.specialty}
                onChange={handleInputChange}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">Matrícula / Licencia</label>
              <input
                name="licenseNumber"
                value={form.licenseNumber}
                onChange={handleInputChange}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-slate-700">Biografía</label>
              <textarea
                name="bio"
                value={form.bio}
                onChange={handleInputChange}
                rows={5}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="text-lg font-semibold text-slate-800">Mis servicios</h3>
          <p className="mt-1 text-sm text-slate-500">
            Si seleccionas un servicio nuevo, quedará <span className="font-semibold">en revisión</span> hasta aprobación del administrador.
          </p>

          {allServices.length === 0 ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              No hay servicios disponibles. Contacta al administrador.
            </div>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {allServices.map((service) => {
                const isSelected = selectedServices.includes(service.id);
                const assignment = assignmentsByServiceId.get(service.id);
                const status = assignment?.status || null;

                return (
                  <button
                    type="button"
                    key={service.id}
                    onClick={() => handleServiceToggle(service.id)}
                    className={`rounded-xl border p-4 text-left transition-all ${
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

                        <div className="mt-1 text-sm text-slate-500">
                          {service.description || "Sin descripción"}
                        </div>
                      </div>

                      <div className="whitespace-nowrap text-xs text-slate-600">
                        {service.durationMin} min · Referencia sugerida: {formatCRC(service.price)}
                      </div>
                    </div>

                    {isSelected && (
                      <div className="mt-3">
                        <label className="text-xs font-semibold text-slate-700">
                          Costo propuesto por sesión (CRC)
                        </label>
                        <input
                          onClick={(event) => event.stopPropagation()}
                          type="number"
                          min="0"
                          step="0.01"
                          value={proposedPrices[service.id] ?? ""}
                          onChange={(event) =>
                            setProposedPrices((prev) => ({ ...prev, [service.id]: event.target.value }))
                          }
                          className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                        />
                        <p className="mt-1 text-[11px] text-slate-500">
                          Este valor define tu tarifa solicitada. El monto real cobrado al paciente y usado para pago y factura será el aprobado por administración.
                        </p>
                      </div>
                    )}

                    {assignment?.approvedSessionPrice != null ? (
                      <div className="mt-2 text-xs text-emerald-700">
                        Costo aprobado: {formatCRC(assignment.approvedSessionPrice)}
                      </div>
                    ) : null}

                    {assignment?.adminReviewNote ? (
                      <div className="mt-1 text-xs text-slate-600">Nota admin: {assignment.adminReviewNote}</div>
                    ) : null}

                    {status === "REJECTED" && !isSelected && (
                      <div className="mt-3 text-xs text-rose-700">
                        Este servicio fue rechazado. Si lo seleccionas y guardas, se enviará una nueva solicitud.
                      </div>
                    )}
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
            className="rounded-xl bg-blue-600 px-5 py-2.5 font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>

      <ChangePasswordCard />

      <Toast message={toast?.message} type={toast?.type} onDismiss={dismissToast} />
    </div>
  );
}
