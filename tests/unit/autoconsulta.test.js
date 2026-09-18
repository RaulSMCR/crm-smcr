// Nadie se atiende a sí mismo.
//
// El 2026-09-11 quedó una cita reservada por un profesional consigo mismo desde
// la agenda pública. Lo que se fija acá no es solo que el caso se bloquee, sino
// que la comparación sea contra el USUARIO del que cuelga el perfil: comparar
// los dos identificadores que llegan —el del usuario y el del perfil— no
// coincide nunca y dejaría el candado puesto sin trabar nada.
import { describe, it, expect, vi, beforeEach } from "vitest";

const { prisma } = vi.hoisted(() => ({
  prisma: { professionalProfile: { findUnique: vi.fn() } },
}));

vi.mock("@/lib/prisma", () => ({ prisma }));

import { ERROR_AUTOCONSULTA, bloqueoPorAutoconsulta } from "@/lib/autoconsulta";

beforeEach(() => vi.clearAllMocks());

describe("bloqueoPorAutoconsulta()", () => {
  it("bloquea cuando el perfil elegido es el de quien reserva", async () => {
    prisma.professionalProfile.findUnique.mockResolvedValueOnce({ userId: "u1" });

    const res = await bloqueoPorAutoconsulta("u1", "perfil_de_u1");

    expect(res?.errorCode).toBe(ERROR_AUTOCONSULTA);
  });

  it("no compara el id del usuario contra el del perfil", async () => {
    // El caso real: los dos identificadores difieren siempre, así que un
    // `patientId === professionalId` habría dejado pasar la autoconsulta.
    prisma.professionalProfile.findUnique.mockResolvedValueOnce({ userId: "u1" });

    await bloqueoPorAutoconsulta("u1", "perfil_de_u1");

    expect(prisma.professionalProfile.findUnique).toHaveBeenCalledWith({
      where: { id: "perfil_de_u1" },
      select: { userId: true },
    });
  });

  it("deja pasar la reserva con otro profesional", async () => {
    prisma.professionalProfile.findUnique.mockResolvedValueOnce({ userId: "u2" });

    await expect(bloqueoPorAutoconsulta("u1", "perfil_de_u2")).resolves.toBeNull();
  });

  it("deja pasar si el perfil no existe: de eso se encarga la reserva", async () => {
    prisma.professionalProfile.findUnique.mockResolvedValueOnce(null);

    await expect(bloqueoPorAutoconsulta("u1", "inexistente")).resolves.toBeNull();
  });

  it("un perfil huérfano no bloquea a quien no tiene usuario", async () => {
    // Sin esta guarda, un perfil con userId nulo bloquearía a cualquiera que
    // llegue sin sesión resuelta: dos ausencias no son la misma persona.
    prisma.professionalProfile.findUnique.mockResolvedValueOnce({ userId: null });

    await expect(bloqueoPorAutoconsulta("", "perfil_huerfano")).resolves.toBeNull();
  });

  it("no falla abierto: si la base se cae, el error sube", async () => {
    prisma.professionalProfile.findUnique.mockRejectedValueOnce(new Error("db caída"));

    await expect(bloqueoPorAutoconsulta("u1", "perfil_de_u1")).rejects.toThrow("db caída");
  });
});
