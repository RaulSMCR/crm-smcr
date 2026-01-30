"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import CategorySelector from "@/components/admin/CategorySelector"; // Asegúrate que la ruta sea correcta

// --- Componentes UI Pequeños ---
function Badge({ ok, text }) {
  return (
    <span
      className={
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium " +
        (ok ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800")
      }
    >
      {text}
    </span>
  );
}

function Row({ label, children }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[200px_1fr] sm:items-start">
      <div className="text-sm font-medium text-neutral-700">{label}</div>
      <div className="text-sm text-neutral-900 break-words">{children}</div>
    </div>
  );
}

export default function AdminProfessionalDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  // Estado del profesional
  const [prof, setProf] = useState(null);
  
  // Estado de Categorías
  const [categoryTree, setCategoryTree] = useState([]); // El árbol completo
  const [selectedCatIds, setSelectedCatIds] = useState([]); // Los IDs seleccionados (checkboxes)

  // Estados de UI
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  // 1. Cargar Datos Iniciales
  async function loadData() {
    setLoading(true);
    setErr("");

    try {
      // A) Cargar Profesional
      const resProf = await fetch(`/api/admin/professionals/${id}`);
      const dataProf = await resProf.json();
      if (!resProf.ok) throw new Error(dataProf.error || "Error cargando profesional");

      setProf(dataProf);
      
      // Inicializar los checkboxes con lo que ya tiene en DB
      if (dataProf.categories) {
        setSelectedCatIds(dataProf.categories.map(c => c.id));
      }

      // B) Cargar Árbol de Categorías (solo si no lo tenemos aún)
      if (categoryTree.length === 0) {
        const resCats = await fetch('/api/categories/tree');
        const dataCats = await resCats.json();
        if (resCats.ok) setCategoryTree(dataCats);
      }

    } catch (e) {
      setErr(e.message || "Error inesperado.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // 2. Función Unificada: Guardar cambios (con o sin aprobar)
  async function handleSave(approve = false) {
    if (approve && !confirm("¿Confirmas aprobar a este profesional y asignar las categorías seleccionadas?")) return;

    setSaving(true);
    try {
      const payload = {
        categoryIds: selectedCatIds, // Enviamos el array de IDs
        ...(approve && { isApproved: true }), // Solo enviamos true si estamos aprobando
        adminNotes: approve ? "Aprobado manualmente desde panel." : "Categorías actualizadas."
      };

      const res = await fetch(`/api/admin/professionals/${id}`, { // Usamos PATCH a la ruta base
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar.");

      await loadData(); // Recargar datos frescos
      alert(approve ? "¡Profesional Aprobado y Categorizado!" : "Cambios guardados correctamente.");
      
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mx-auto max-w-4xl p-6 space-y-6">
      {/* --- Header --- */}
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-brand-800">Gestión de Profesional</h1>
          <Link href="/admin/professionals" className="text-sm text-brand-700 underline">
            ← Volver a pendientes
          </Link>
        </div>
        <p className="text-sm text-neutral-600">
          Revisá la información, asigná las categorías correspondientes y aprobá el perfil.
        </p>
      </header>

      {/* --- Estados de Carga/Error --- */}
      {loading && <div className="p-10 text-center text-gray-500">Cargando datos...</div>}
      
      {err && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      )}

      {/* --- Contenido Principal --- */}
      {!loading && prof && (
        <div className="grid gap-6 lg:grid-cols-3">
          
          {/* COLUMNA IZQUIERDA: Datos del Profesional (2/3 ancho) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border bg-white p-6 space-y-5 shadow-sm">
              
              {/* Encabezado del Perfil */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b pb-4 mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{prof.name}</h2>
                  {/* CAMBIO: Usamos declaredJobTitle */}
                  <p className="text-brand-600 font-medium">{prof.declaredJobTitle || "Sin título declarado"}</p>
                  <p className="text-sm text-gray-500">{prof.email}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge ok={!!prof.emailVerified} text={prof.emailVerified ? "Email Verificado" : "Email NO Verificado"} />
                  <Badge ok={!!prof.isApproved} text={prof.isApproved ? "Publicado (Aprobado)" : "Pendiente de Revisión"} />
                </div>
              </div>

              {/* Avatar y Datos */}
              <div className="flex gap-4 items-start">
                {prof.avatarUrl ? (
                  <img src={prof.avatarUrl} alt="Avatar" className="h-20 w-20 rounded-full object-cover border shadow-sm" />
                ) : (
                  <div className="h-20 w-20 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">Sin foto</div>
                )}
                <div className="space-y-2 flex-1">
                   <Row label="Bio">{prof.bio || "—"}</Row>
                   <Row label="Teléfono">{prof.phone || "—"}</Row>
                   <Row label="Zona Horaria">{prof.timeZone || "—"}</Row>
                </div>
              </div>

              {/* Links Externos */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                 <div className="p-3 bg-gray-50 rounded text-sm">
                    <span className="block text-xs font-bold text-gray-500 uppercase">CV / Resume</span>
                    {prof.resumeUrl ? <a href={prof.resumeUrl} target="_blank" className="text-brand-600 hover:underline break-all">Ver Documento</a> : "—"}
                 </div>
                 <div className="p-3 bg-gray-50 rounded text-sm">
                    <span className="block text-xs font-bold text-gray-500 uppercase">Video Intro</span>
                    {prof.introVideoUrl ? <a href={prof.introVideoUrl} target="_blank" className="text-brand-600 hover:underline break-all">Ver Video</a> : "—"}
                 </div>
                 <div className="p-3 bg-gray-50 rounded text-sm">
                    <span className="block text-xs font-bold text-gray-500 uppercase">Calendario</span>
                    {prof.calendarUrl ? <a href={prof.calendarUrl} target="_blank" className="text-brand-600 hover:underline break-all">Link Reserva</a> : "—"}
                 </div>
              </div>

              {/* Auditoría */}
              <div className="text-xs text-gray-400 pt-4 border-t mt-4 flex justify-between">
                <span>Registrado: {new Date(prof.createdAt).toLocaleDateString()}</span>
                <span>Última mod: {new Date(prof.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {/* COLUMNA DERECHA: Categorización y Acciones (1/3 ancho) */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Panel de Categorías */}
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-2">Asignar Categorías</h3>
              <p className="text-xs text-gray-500 mb-4">Selecciona las especialidades oficiales para este profesional.</p>
              
              {/* Aquí va nuestro componente mágico */}
              <CategorySelector 
                categories={categoryTree}
                selectedIds={selectedCatIds}
                onChange={setSelectedCatIds}
              />
              
              <div className="text-right mt-2">
                <span className="text-xs text-gray-400">{selectedCatIds.length} seleccionadas</span>
              </div>
            </div>

            {/* Panel de Acciones */}
            <div className="rounded-2xl border bg-gray-50 p-5 space-y-3">
              <h3 className="font-bold text-gray-800">Acciones</h3>
              
              {/* Botón Solo Guardar (Sin Aprobar) */}
              <button
                onClick={() => handleSave(false)}
                disabled={saving}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                {saving ? "Guardando..." : "Guardar Categorías"}
              </button>

              {/* Botón Aprobar (Y Guardar) */}
              <button
                onClick={() => handleSave(true)}
                disabled={saving || prof.isApproved || !prof.emailVerified}
                className="
                  w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white shadow-sm
                  hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed
                "
              >
                {prof.isApproved ? "✓ Perfil Ya Aprobado" : "Aprobar y Publicar"}
              </button>

              {!prof.emailVerified && (
                <div className="text-xs text-yellow-700 bg-yellow-100 p-2 rounded text-center">
                  ⚠️ Falta verificar email
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </section>
  );
}