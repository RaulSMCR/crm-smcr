//src/components/profile/AvatarUploader.js
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { updateMyAvatar } from "@/actions/profile-actions";

export default function AvatarUploader({ userId, currentUrl }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");

    // Validaciones básicas
    if (!file.type.startsWith("image/")) {
      setError("El archivo debe ser una imagen.");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setError("La imagen no puede pesar más de 3MB.");
      return;
    }

    setLoading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${userId}/avatar.${ext}`; // upsert reemplaza

      const { error: upErr } = await supabase
        .storage
        .from("avatars")
        .upload(path, file, {
          upsert: true,
          contentType: file.type,
          cacheControl: "3600",
        });

      if (upErr) throw upErr;

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = data.publicUrl;

      // Persistir en DB
      await updateMyAvatar(publicUrl);

      router.refresh(); // refresca server components
    } catch (err) {
      setError(err?.message || "Error inesperado al subir la imagen.");
    } finally {
      setLoading(false);
      e.target.value = ""; // reset input
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <img
          src={currentUrl || "/default-avatar.png"}
          alt="Avatar"
          className="h-16 w-16 rounded-full object-cover border"
        />
        <label className="inline-flex items-center px-3 py-2 rounded-lg border cursor-pointer">
          <input type="file" accept="image/*" className="hidden" onChange={onFileChange} />
          {loading ? "Subiendo..." : "Cambiar foto"}
        </label>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}