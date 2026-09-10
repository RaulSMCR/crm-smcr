import { createHash } from "node:crypto";
import { SignJWT } from "jose";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { withQstashSignature } from "@/lib/qstash-webhook";

const CURRENT = "local-test-current-signing-key";
const NEXT = "local-test-next-signing-key";
const BODY = JSON.stringify({ appointmentId: "test-appointment" });
const URL = "https://site.example.invalid/api/reminders/send";

beforeEach(() => {
  vi.stubEnv("QSTASH_CURRENT_SIGNING_KEY", CURRENT);
  vi.stubEnv("QSTASH_NEXT_SIGNING_KEY", NEXT);
  vi.stubEnv("QSTASH_REGION", undefined);
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network forbidden in this test"); }));
});
afterEach(() => {
  expect(fetch).not.toHaveBeenCalled();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function signature(key = CURRENT, body = BODY) {
  return new SignJWT({ body: createHash("sha256").update(body).digest("base64url") })
    .setProtectedHeader({ alg: "HS256" }).setIssuer("Upstash").setSubject(URL)
    .setIssuedAt().setExpirationTime("5m").sign(new TextEncoder().encode(key));
}
function request(token, body = BODY) {
  return new Request(URL, { method: "POST", body, headers: token ? { "upstash-signature": token } : {} });
}

it("permite cargar el receptor sin claves y devuelve 503 sin leer ni procesar solicitudes", async () => {
  vi.stubEnv("QSTASH_CURRENT_SIGNING_KEY", undefined);
  vi.stubEnv("QSTASH_NEXT_SIGNING_KEY", undefined);
  const handler = vi.fn();
  const POST = withQstashSignature(handler);
  expect((await POST({})).status).toBe(503);
  expect(handler).not.toHaveBeenCalled();
});

it("rechaza solicitudes sin firma", async () => {
  const handler = vi.fn();
  expect((await withQstashSignature(handler)(request())).status).toBe(403);
  expect(handler).not.toHaveBeenCalled();
});

it.each([CURRENT, NEXT])("acepta una firma válida con la clave de prueba %s y conserva el cuerpo", async (key) => {
  const handler = vi.fn(async (req) => Response.json(await req.json()));
  const response = await withQstashSignature(handler)(request(await signature(key)));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ appointmentId: "test-appointment" });
  expect(handler).toHaveBeenCalledTimes(1);
});

it.each(["firma", "cuerpo"])("rechaza la manipulación de %s sin ejecutar el handler", async (type) => {
  const token = await signature(type === "firma" ? "untrusted-test-key" : CURRENT);
  const handler = vi.fn();
  const response = await withQstashSignature(handler)(request(token, type === "cuerpo" ? "altered" : BODY));
  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({ ok: false });
  expect(handler).not.toHaveBeenCalled();
});
