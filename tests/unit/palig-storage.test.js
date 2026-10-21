import { describe, it, expect, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
const storage = vi.hoisted(() => ({ download: vi.fn(), upload: vi.fn() }));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => ({ storage: { from: () => storage } }) }));
import { leerArchivoPalig, descargarPlantillaPalig, guardarPalig, PALIG_FILE_LIMIT } from "@/lib/palig-storage";

describe("validación de archivos PALIG en servidor", () => {
  it("acepta el PDF real y comprueba contenido, MIME y límite", async () => {
    const pdf = await PDFDocument.create(); pdf.addPage();
    const bytes = await pdf.save();
    const file = new File([bytes], "comprobante.pdf", { type: "application/pdf" });
    expect((await leerArchivoPalig(file, { proof: true })).mime).toBe("application/pdf");
    await expect(leerArchivoPalig(new File([bytes], "falso.png", { type: "image/png" }), { proof: true })).rejects.toThrow("válido");
    await expect(leerArchivoPalig({ size: PALIG_FILE_LIMIT + 1, arrayBuffer() {} })).rejects.toThrow("4 MB");
    await expect(leerArchivoPalig(new File(["%PDF-daño"], "dañado.pdf", { type: "application/pdf" }))).rejects.toThrow("dañado");
    await expect(leerArchivoPalig(null)).rejects.toThrow("Seleccione");
  });
  it("acepta PNG verificable como respaldo pero no como plantilla", async () => {
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1sAAAAASUVORK5CYII=", "base64");
    const file = new File([png], "proof.png", { type: "image/png" });
    expect((await leerArchivoPalig(file, { proof: true })).extension).toBe("png");
    await expect(leerArchivoPalig(file)).rejects.toThrow("PDF válido");
  });
  it("no descarga plantillas ajenas ni rutas externas", async () => {
    for (const ref of ["insurance-templates/other/a.pdf", "https://example.com/a.pdf", "insurance-templates/u1/../a.pdf"]) await expect(descargarPlantillaPalig(ref, "u1")).rejects.toMatchObject({ status: 409 });
    expect(storage.download).not.toHaveBeenCalled();
  });
  it("sube archivos sin sobrescribir ni hacerlos públicos", async () => {
    storage.upload.mockResolvedValue({ error: null });
    expect(await guardarPalig("insurance-signed-forms", "claim/palig/form.pdf", Buffer.from("pdf"))).toBe("insurance-signed-forms/claim/palig/form.pdf");
    expect(storage.upload).toHaveBeenCalledWith("claim/palig/form.pdf", expect.any(Buffer), { contentType: "application/pdf", upsert: false, cacheControl: "0" });
  });
});
