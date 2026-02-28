// src/components/profile/AvatarUploader.js
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateMyAvatar } from "@/actions/profile-actions";

export default function AvatarUploader({ userId, currentUrl }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");

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
      // Enviar a nuestra API Route
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload/avatar", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error inesperado.");

      // Persistir URL en DB
      await updateMyAvatar(data.url);
      router.refresh();
    } catch (err) {
      setError(err?.message || "Error inesperado al subir la imagen.");
    } finally {
      setLoading(false);
      e.target.value = "";
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