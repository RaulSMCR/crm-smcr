import { beforeEach, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
const mocks = vi.hoisted(() => ({ session: vi.fn(), leer: vi.fn(), aplicar: vi.fn(), revalidar: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getSession: mocks.session }));
vi.mock("@/lib/hub-ingest", () => ({ leerLote: mocks.leer, aplicarLote: mocks.aplicar, hashDocumento: (texto) => createHash("sha256").update(texto).digest("hex") }));
vi.mock("@/lib/hub-revalidate", () => ({ revalidarHub: mocks.revalidar }));
import { POST as preview } from "@/app/api/admin/hubs/[id]/ingesta/preview/route";
import { POST as confirm } from "@/app/api/admin/hubs/[id]/ingesta/confirm/route";

const revision = "a".repeat(64);
const archivo = { nombre: "carpeta/tema.md", texto: "documento", sha256: createHash("sha256").update("documento").digest("hex") };
const contexto = { params: Promise.resolve({ id: "hub" }) };
const request = (body) => new Request("https://example.invalid/api", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ role: "ADMIN", sub: "admin" });
  mocks.leer.mockResolvedValue({ revision, lote: [], resumen: {} });
  mocks.aplicar.mockResolvedValue({ hub: { slug: "raul-olmedo-evans" }, lote: [], aplicados: [], writesPerformed: false });
});
it.each([null, "USER", "PROFESSIONAL"])("no lee ni confirma sin rol ADMIN: %s", async (role) => {
  mocks.session.mockResolvedValue(role ? { role } : null);
  expect((await preview(request({ archivos: [archivo] }), contexto)).status).toBe(403);
  expect((await confirm(request({ archivos: [archivo], revision }), contexto)).status).toBe(403);
  expect(mocks.leer).not.toHaveBeenCalled();
  expect(mocks.aplicar).not.toHaveBeenCalled();
});
it("el feed admite más de doce archivos sin ampliar el límite del arrastre", async () => {
  const archivos = Array.from({ length: 13 }, (_, i) => ({ ...archivo, nombre: `${i}.md` }));
  expect((await preview(request({ archivos }), contexto)).status).toBe(422);
  const respuesta = await preview(request({ archivos, feed: true }), contexto);
  expect(respuesta.status).toBe(200);
  expect(await respuesta.json()).toMatchObject({ writesPerformed: false, confirmationRequired: true, revision });
  expect(mocks.leer).toHaveBeenCalledWith(expect.objectContaining({ feed: true }));
  expect(mocks.aplicar).not.toHaveBeenCalled();
});
it("no confirma sin revisión ni cuando cambió el texto del archivo", async () => {
  expect((await confirm(request({ archivos: [archivo] }), contexto)).status).toBe(409);
  expect((await confirm(request({ archivos: [{ ...archivo, texto: "modificado" }], revision }), contexto)).status).toBe(409);
  expect(mocks.aplicar).not.toHaveBeenCalled();
});
it("propaga la revisión y el modo de feed, sin revalidar si no hubo escrituras", async () => {
  expect((await confirm(request({ archivos: [archivo], revision, feed: true }), contexto)).status).toBe(200);
  expect(mocks.aplicar).toHaveBeenCalledWith(expect.objectContaining({ revision, feed: true, actor: "admin" }));
  expect(mocks.revalidar).not.toHaveBeenCalled();
});
it("devuelve 409 si la revisión quedó desactualizada", async () => {
  mocks.aplicar.mockResolvedValue({ error: "Cambió el hub", motivo: "revision" });
  expect((await confirm(request({ archivos: [archivo], revision }), contexto)).status).toBe(409);
  expect(mocks.revalidar).not.toHaveBeenCalled();
});
it("rechaza lotes mayores de 3 MB en el servidor", async () => {
  const archivos = [{ ...archivo, texto: "x".repeat(1600000) }, { ...archivo, texto: "y".repeat(1600000) }];
  expect((await preview(request({ archivos, feed: true }), contexto)).status).toBe(413);
  expect(mocks.leer).not.toHaveBeenCalled();
});
