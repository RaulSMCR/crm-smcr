// tests/unit/rate-limit.test.js
// Tests para el helper de rate limiting contra PostgreSQL (SEC-01).
// Prisma se mockea con un almacén en memoria para ejercitar ventana, conteo y
// el comportamiento fail-open.
import { describe, it, expect, vi, beforeEach } from "vitest";

// Almacén en memoria que imita prisma.rateLimitEntry.
const db = { rows: [] };

vi.mock("@/lib/prisma", () => ({
  prisma: {
    rateLimitEntry: {
      deleteMany: vi.fn(async ({ where }) => {
        const before = db.rows.length;
        db.rows = db.rows.filter(
          (e) => !(e.key === where.key && e.createdAt < where.createdAt.lt)
        );
        return { count: before - db.rows.length };
      }),
      count: vi.fn(async ({ where }) =>
        db.rows.filter((e) => e.key === where.key && e.createdAt >= where.createdAt.gte).length
      ),
      create: vi.fn(async ({ data }) => {
        const row = { key: data.key, createdAt: new Date() };
        db.rows.push(row);
        return row;
      }),
      findFirst: vi.fn(async ({ where }) => {
        const rows = db.rows
          .filter((e) => e.key === where.key && e.createdAt >= where.createdAt.gte)
          .sort((a, b) => a.createdAt - b.createdAt);
        return rows[0] || null;
      }),
    },
  },
}));

import { checkRateLimit, recordAttempt } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";

beforeEach(() => {
  db.rows = [];
  vi.clearAllMocks();
});

describe("checkRateLimit()", () => {
  it("no limita mientras el conteo esté por debajo del máximo y registra cada intento", async () => {
    const opts = { max: 5, windowMinutes: 15 };
    for (let i = 0; i < 5; i++) {
      const res = await checkRateLimit("login:1.2.3.4:a@x.com", opts);
      expect(res.limited).toBe(false);
    }
    // Se registraron 5 intentos.
    expect(db.rows.length).toBe(5);
  });

  it("limita en el intento que alcanza el máximo y expone retryAfterMinutes", async () => {
    const opts = { max: 5, windowMinutes: 15 };
    for (let i = 0; i < 5; i++) await checkRateLimit("k", opts);

    const res = await checkRateLimit("k", opts);
    expect(res.limited).toBe(true);
    expect(res.retryAfterMinutes).toBeGreaterThanOrEqual(1);
    expect(res.retryAfterMinutes).toBeLessThanOrEqual(15);
    // Al estar limitado NO se registra un intento adicional.
    expect(db.rows.length).toBe(5);
  });

  it("con record:false consulta pero no registra (caso login)", async () => {
    const opts = { max: 5, windowMinutes: 15, record: false };
    const res = await checkRateLimit("k", opts);
    expect(res.limited).toBe(false);
    expect(db.rows.length).toBe(0);
  });

  it("ignora entradas fuera de la ventana (limpieza oportunista)", async () => {
    // Entrada vieja (20 min atrás) para una ventana de 15 min.
    db.rows.push({ key: "k", createdAt: new Date(Date.now() - 20 * 60 * 1000) });
    const res = await checkRateLimit("k", { max: 1, windowMinutes: 15 });
    // La vieja se limpió y esta cuenta como primera → no limitado.
    expect(res.limited).toBe(false);
    // deleteMany eliminó la vieja; queda solo la nueva.
    expect(db.rows.filter((e) => e.key === "k").length).toBe(1);
  });

  it("falla ABIERTO si la base lanza un error", async () => {
    prisma.rateLimitEntry.count.mockImplementationOnce(async () => {
      throw new Error("db down");
    });
    const res = await checkRateLimit("k", { max: 1, windowMinutes: 15 });
    expect(res.limited).toBe(false);
  });
});

describe("recordAttempt()", () => {
  it("registra un intento", async () => {
    await recordAttempt("login:1.2.3.4:a@x.com");
    expect(db.rows.length).toBe(1);
  });

  it("no lanza si la base falla (fail-open)", async () => {
    prisma.rateLimitEntry.create.mockImplementationOnce(async () => {
      throw new Error("db down");
    });
    await expect(recordAttempt("k")).resolves.toBeUndefined();
  });
});
