// tests/unit/placetopay-auth.test.js
import { describe, it, expect, beforeEach } from "vitest";
import { generateAuth } from "../../src/lib/placetopay/auth.js";

const TEST_LOGIN = "test_merchant";
const TEST_SECRET = "super_secret_key_123";

describe("generateAuth()", () => {
  it("devuelve los 4 campos requeridos", () => {
    const auth = generateAuth(TEST_LOGIN, TEST_SECRET);
    expect(auth).toHaveProperty("login", TEST_LOGIN);
    expect(auth).toHaveProperty("nonce");
    expect(auth).toHaveProperty("seed");
    expect(auth).toHaveProperty("tranKey");
  });

  it("nonce es un string Base64 válido", () => {
    const { nonce } = generateAuth(TEST_LOGIN, TEST_SECRET);
    expect(typeof nonce).toBe("string");
    expect(nonce.length).toBeGreaterThan(0);
    // Base64 válido: solo caracteres A-Z, a-z, 0-9, +, /, =
    expect(nonce).toMatch(/^[A-Za-z0-9+/=]+$/);
  });

  it("seed es una fecha ISO 8601 válida", () => {
    const { seed } = generateAuth(TEST_LOGIN, TEST_SECRET);
    expect(typeof seed).toBe("string");
    expect(new Date(seed).toISOString()).toBe(seed);
  });

  it("tranKey es un string Base64 válido (SHA-256)", () => {
    const { tranKey } = generateAuth(TEST_LOGIN, TEST_SECRET);
    expect(typeof tranKey).toBe("string");
    // SHA-256 → 32 bytes → 44 chars en Base64 (con padding)
    expect(tranKey.length).toBe(44);
    expect(tranKey).toMatch(/^[A-Za-z0-9+/=]+$/);
  });

  it("genera nonces distintos en llamadas sucesivas", () => {
    const auth1 = generateAuth(TEST_LOGIN, TEST_SECRET);
    const auth2 = generateAuth(TEST_LOGIN, TEST_SECRET);
    expect(auth1.nonce).not.toBe(auth2.nonce);
    expect(auth1.tranKey).not.toBe(auth2.tranKey);
  });

  it("lanza error si login está vacío", () => {
    expect(() => generateAuth("", TEST_SECRET)).toThrow();
  });

  it("lanza error si secretKey está vacío", () => {
    expect(() => generateAuth(TEST_LOGIN, "")).toThrow();
  });
});
