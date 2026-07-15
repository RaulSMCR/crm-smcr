export function validateSupplierFeClave(clave, identification) {
  const value = String(clave || "").trim();
  if (!/^\d{50}$/.test(value)) return { ok: false, error: "La clave numérica debe contener exactamente 50 dígitos." };
  const id = String(identification || "").replace(/\D/g, "");
  if (!id) return { ok: false, error: "Complete su identificación en el perfil antes de presentar la factura." };
  const expected = id.padStart(12, "0");
  if (value.slice(3, 15) !== expected) return { ok: false, error: "La cédula de la clave no coincide con su identificación." };
  return { ok: true };
}
