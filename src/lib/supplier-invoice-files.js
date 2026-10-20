import { parseStorageReference } from "@/lib/storage";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { MAX_SUPPLIER_XML_BYTES, parseSupplierInvoiceXml, SupplierXmlError } from "@/lib/supplier-invoice-xml";

export function professionalInvoiceFile(value, professionalId, extension) {
  let raw = typeof value === "string" ? value : "";
  if (raw.startsWith("/api/files?")) raw = new URLSearchParams(raw.slice(raw.indexOf("?") + 1)).get("path");
  const ref = parseStorageReference(raw);
  if (!ref || ref.bucket !== "professional-invoices" || !ref.path.startsWith(`${professionalId}/`) ||
      ref.path.split("/").length !== 2 || !ref.path.endsWith(`.${extension}`)) {
    throw new SupplierXmlError(`Seleccione un archivo ${extension.toUpperCase()} subido por este profesional.`);
  }
  return ref;
}

export async function readProfessionalInvoiceXml(url, profile) {
  const ref = professionalInvoiceFile(url, profile.id, "xml");
  const { data, error } = await getSupabaseAdmin().storage.from(ref.bucket).download(ref.path);
  if (error || !data) throw new SupplierXmlError("No se pudo leer el XML adjunto. Vuelva a seleccionarlo.");
  if (data.size > MAX_SUPPLIER_XML_BYTES) throw new SupplierXmlError("El XML supera el máximo de 5MB.");
  return parseSupplierInvoiceXml(await data.text(), profile.user?.identification);
}
