import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ generate: vi.fn(), sign: vi.fn(), token: vi.fn(), invalidate: vi.fn() }));
vi.mock("@/lib/fe/xml.js", () => ({ generateFeXml: mocks.generate }));
vi.mock("@/lib/fe/signer.js", () => ({ signXml: mocks.sign }));
vi.mock("@/lib/fe/auth.js", () => ({ getFeToken: mocks.token, invalidateFeToken: mocks.invalidate }));
vi.mock("@/lib/fe/config.js", () => ({ FE_API: { recepcionUrl: "https://hacienda.example.invalid", p12Base64: "fixture", p12Pin: "fixture" } }));
import { submitToHacienda, feResult } from "@/lib/fe/client";
import { receptionPayload } from "@/lib/fe/document";

const xml = '<FacturaElectronica><Clave>local-key</Clave><NumeroConsecutivo>123</NumeroConsecutivo><FechaEmision>2026-09-11T12:00:00-06:00</FechaEmision><Emisor><Identificacion><Tipo>02</Tipo><Numero>3000000000</Numero></Identificacion></Emisor><Receptor><Identificacion><Tipo>04</Tipo><Numero>1000000000</Numero></Identificacion></Receptor></FacturaElectronica>';
const document = { feClave: "local-key", feNumber: "123", feXml: xml };
const response = (status, data = {}) => new Response(JSON.stringify(data), { status });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.generate.mockReturnValue({ xml, feClave: document.feClave, feNumber: document.feNumber });
  mocks.sign.mockResolvedValue(xml);
  mocks.token.mockResolvedValue("local-only-token");
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => vi.unstubAllGlobals());

describe("recuperación fiscal", () => {
  it.each(["recibido", "procesando", "", "estado-nuevo"])("%s permanece pendiente", (state) => {
    expect(feResult({ "ind-estado": state }).feStatus).toBe("PENDING");
  });
  it.each([["aceptado", "ACCEPTED"], ["rechazado", "REJECTED"]])("interpreta %s con guion y guion bajo", (state, expected) => {
    expect(feResult({ "ind-estado": state }).feStatus).toBe(expected);
    expect(feResult({ ind_estado: state }).feStatus).toBe(expected);
  });
  it("un error de Hacienda requiere revisión y no se presenta como rechazo", () => {
    expect(feResult({ "ind-estado": "error" })).toMatchObject({ feStatus: "PENDING", reviewRequired: true });
  });
  it("el JSON conserva fecha y tipo de identificación del XML firmado", () => {
    const payload = receptionPayload(document);
    expect(payload.fecha).toBe("2026-09-11T12:00:00-06:00");
    expect(payload.receptor.tipoIdentificacion).toBe("04");
    expect(Buffer.from(payload.comprobanteXml, "base64").toString()).toBe(xml);
  });
  it("persiste el documento antes del token o la primera petición y deja procesando como pendiente", async () => {
    let saved = false;
    mocks.token.mockImplementation(async () => { expect(saved).toBe(true); return "local-token"; });
    fetch.mockResolvedValueOnce(response(404)).mockResolvedValueOnce(response(202)).mockResolvedValueOnce(response(200, { "ind-estado": "procesando" }));
    const result = await submitToHacienda({ id: "invoice-local" }, [], { pollAttempts: 1, persistDocument: async (doc) => { saved = true; return doc; } });
    expect(result).toMatchObject({ feStatus: "PENDING", feClave: "local-key", signedXml: xml });
    expect(fetch.mock.calls[1][1].body).toBe(JSON.stringify(receptionPayload(document)));
  });
  it("tras perder la respuesta, consulta la misma clave y no vuelve a generar ni enviar", async () => {
    let saved;
    fetch.mockResolvedValueOnce(response(404)).mockRejectedValueOnce(new Error("NETWORK_PRIVATE_TEST"));
    await expect(submitToHacienda({}, [], { persistDocument: async (doc) => { saved = doc; return doc; } })).rejects.toThrow();
    expect(saved).toEqual(document);
    mocks.generate.mockClear(); mocks.sign.mockClear(); fetch.mockClear();
    fetch.mockResolvedValueOnce(response(200, { "ind-estado": "aceptado" }));
    expect((await submitToHacienda(saved, [])).feStatus).toBe("ACCEPTED");
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(mocks.sign).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][1].method).toBe("GET");
  });
  it("si guardar el XML falla no contacta a Hacienda", async () => {
    await expect(submitToHacienda({}, [], { persistDocument: async () => { throw new Error("DB_FAILED"); } })).rejects.toThrow("DB_FAILED");
    expect(fetch).not.toHaveBeenCalled(); expect(mocks.token).not.toHaveBeenCalled();
  });
  it("una consulta fallida no provoca un nuevo POST", async () => {
    fetch.mockResolvedValueOnce(response(503));
    await expect(submitToHacienda(document, [])).rejects.toThrow("FE_STATUS_UNAVAILABLE");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("una identidad parcial requiere revisión y no se sustituye", async () => {
    await expect(submitToHacienda({ feClave: "old-key" }, [])).rejects.toThrow("FE_DOCUMENT_REVIEW_REQUIRED");
    expect(fetch).not.toHaveBeenCalled(); expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("rechaza un XML con identidad distinta o declaraciones de entidad", () => {
    expect(() => receptionPayload({ ...document, feClave: "another" })).toThrow("FE_DOCUMENT_ID_MISMATCH");
    expect(() => receptionPayload({ ...document, feXml: '<!DOCTYPE test>' + xml })).toThrow("FE_DOCUMENT_INVALID");
  });
});
