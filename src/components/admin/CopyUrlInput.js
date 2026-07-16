"use client";

import { useState } from "react";

export default function CopyUrlInput({ label = "URL", value }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <label className="block space-y-1">
      {label ? (
        <span className="text-xs font-bold uppercase tracking-[0.12em] text-neutral-500">{label}</span>
      ) : null}
      <span className="flex gap-2">
        <input
          readOnly
          value={value}
          onFocus={(event) => event.currentTarget.select()}
          className="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-800"
        />
        <button
          type="button"
          onClick={copy}
          className="rounded-lg border border-brand-300 bg-white px-3 py-2 text-xs font-bold text-brand-900 transition hover:bg-brand-100"
        >
          {copied ? "Copiado" : "Copiar"}
        </button>
      </span>
    </label>
  );
}
