// tests/unit/reenganche.test.js
// La secuencia de reenganche: cuándo sale, y sobre todo cuándo NO sale.
//
// Lo que más se cuida acá es lo segundo. Seguir mandándole "no desistás de estar
// mejor" a alguien que ya volvió a agendar, o a alguien que dijo que no quiere
// continuar, no es un bug cosmético: es la forma más rápida de que se arrepienta
// de haber vuelto.
import { describe, it, expect, vi, beforeEach } from "vitest";

const { prisma } = vi.hoisted(() => ({
  prisma: {
    appointment: { count: vi.fn(), findUnique: vi.fn() },
    contactoReenganche: { findFirst: vi.fn(), create: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/qstash", () => ({ scheduleReengagement: vi.fn() }));

import { enviarSeguimiento, yaVolvioAAgendar } from "@/lib/reenganche";
import {
  DIAS_ALERTA_SIN_CONTACTO,
  DIAS_DE_SEGUIMIENTO,
  diasDesde,
  necesitaSeguimientoHumano,
} from "@/lib/reenganche-policy";

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.RESEND_API_KEY;
});

describe("diasDesde()", () => {
  const ahora = new Date("2026-08-15T12:00:00Z");

  it("cuenta días completos", () => {
    expect(diasDesde(new Date("2026-08-12T12:00:00Z"), ahora)).toBe(3);
    expect(diasDesde(new Date("2026-08-15T00:00:00Z"), ahora)).toBe(0);
  });

  it("devuelve null si nunca pasó", () => {
    expect(diasDesde(null, ahora)).toBeNull();
  });
});

describe("necesitaSeguimientoHumano()", () => {
  const ahora = new Date("2026-08-15T12:00:00Z");

  it("quien nunca fue contactado necesita seguimiento", () => {
    expect(necesitaSeguimientoHumano(null, ahora)).toBe(true);
  });

  it("recién contactado, no", () => {
    expect(necesitaSeguimientoHumano(new Date("2026-08-14T12:00:00Z"), ahora)).toBe(false);
  });

  it("pasado el umbral, sí", () => {
    const viejo = new Date(ahora.getTime() - DIAS_ALERTA_SIN_CONTACTO * 24 * 60 * 60 * 1000);
    expect(necesitaSeguimientoHumano(viejo, ahora)).toBe(true);
  });
});

describe("DIAS_DE_SEGUIMIENTO", () => {
  it("no arranca al día siguiente: el primero es a los tres días", () => {
    expect(DIAS_DE_SEGUIMIENTO[0]).toBeGreaterThanOrEqual(3);
  });

  it("son dos recordatorios, no una campaña", () => {
    expect(DIAS_DE_SEGUIMIENTO.length).toBe(2);
  });
});

describe("yaVolvioAAgendar()", () => {
  it("no cuenta las citas canceladas ni las no asistidas", async () => {
    prisma.appointment.count.mockResolvedValueOnce(0);
    expect(await yaVolvioAAgendar("p1", new Date())).toBe(false);

    const filtro = prisma.appointment.count.mock.calls[0][0].where;
    expect(filtro.status.notIn).toContain("CANCELLED_BY_USER");
    expect(filtro.status.notIn).toContain("NO_SHOW");
  });

  it("es verdadero si reservó algo después", async () => {
    prisma.appointment.count.mockResolvedValueOnce(1);
    expect(await yaVolvioAAgendar("p1", new Date())).toBe(true);
  });
});

describe("enviarSeguimiento()", () => {
  const CITA = { id: "cita1", date: new Date("2026-08-01T10:00:00Z"), professionalId: "pro1" };

  it("se calla si la persona ya volvió a agendar", async () => {
    prisma.appointment.findUnique.mockResolvedValueOnce(CITA);
    prisma.appointment.count.mockResolvedValueOnce(1); // reagendó

    const res = await enviarSeguimiento({ patientId: "p1", appointmentId: "cita1", intento: 1 });

    expect(res).toEqual({ enviado: false, motivo: "YA_REAGENDO" });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("se calla si alguien ya habló y la conversación quedó cerrada", async () => {
    prisma.appointment.findUnique.mockResolvedValueOnce(CITA);
    prisma.appointment.count.mockResolvedValueOnce(0);
    prisma.contactoReenganche.findFirst.mockResolvedValueOnce({ id: "c1" });

    const res = await enviarSeguimiento({ patientId: "p1", appointmentId: "cita1", intento: 1 });

    expect(res).toEqual({ enviado: false, motivo: "CONVERSACION_CERRADA" });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("no intenta escribirle a quien no tiene correo", async () => {
    prisma.appointment.findUnique.mockResolvedValueOnce(CITA);
    prisma.appointment.count.mockResolvedValueOnce(0);
    prisma.contactoReenganche.findFirst.mockResolvedValueOnce(null);
    prisma.user.findUnique.mockResolvedValueOnce({ name: "Ana", email: null });

    const res = await enviarSeguimiento({ patientId: "p1", appointmentId: "cita1", intento: 1 });

    expect(res.enviado).toBe(false);
    expect(res.motivo).toBe("SIN_CORREO");
  });

  it("sin Resend configurado no anota un contacto que nunca salió", async () => {
    prisma.appointment.findUnique.mockResolvedValueOnce(CITA);
    prisma.appointment.count.mockResolvedValueOnce(0);
    prisma.contactoReenganche.findFirst.mockResolvedValueOnce(null);
    prisma.user.findUnique.mockResolvedValueOnce({ name: "Ana", email: "ana@example.com" });

    const res = await enviarSeguimiento({ patientId: "p1", appointmentId: "cita1", intento: 1 });

    expect(res.enviado).toBe(false);
    expect(prisma.contactoReenganche.create).not.toHaveBeenCalled();
  });
});
