export function validateSupplierFeClave(clave, identification) {
  const value = String(clave || "").trim();
  if (!/^\d{50}$/.test(value)) return { ok: false, error: "La clave numérica debe contener exactamente 50 dígitos." };
  const id = String(identification || "").replace(/\D/g, "");
  if (!id) return { ok: false, error: "Complete su identificación en el perfil antes de presentar la factura." };
  const expected = id.padStart(12, "0");
  // Estructura oficial: país(3) + fecha ddmmaa(6) + cédula(12) + consecutivo(20) + situación(1) + seguridad(8).
  // La cédula ocupa las posiciones 10–21 (índices 9–20), igual que en buildFeClave (src/lib/fe/xml.js).
  if (value.slice(9, 21) !== expected) return { ok: false, error: "La cédula de la clave no coincide con su identificación." };
  return { ok: true };
}
