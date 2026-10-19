import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ session: vi.fn(), findUnique: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getSession: mocks.session }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: mocks.findUnique } } }));

const cargar = async () => await import("@/lib/api-guards");

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
});
afterEach(() => vi.unstubAllEnvs());

const admin = { sub: "admin-1", role: "ADMIN" };

describe("requireEmisorResponsable", () => {
  it("deja pasar a la cuenta responsable de la emisión", async () => {
    mocks.session.mockResolvedValue(admin);
    mocks.findUnique.mockResolvedValue({ email: "contacto@saludmentalcostarica.com", isActive: true });

    const { requireEmisorResponsable } = await cargar();
    const auth = await requireEmisorResponsable();

    expect(auth.error).toBeUndefined();
    expect(auth.session).toMatchObject({ sub: "admin-1" });
  });

  it("rechaza a otro ADMIN: el rol no alcanza para emitir", async () => {
    // Es el caso que este guard existe para cubrir. Agregar una asistente o un
    // contador como ADMIN no puede entregarle de paso la facultad de afirmarle
    // a Hacienda que hubo una venta.
    mocks.session.mockResolvedValue({ sub: "admin-2", role: "ADMIN" });
    mocks.findUnique.mockResolvedValue({ email: "asistente@saludmentalcostarica.com", isActive: true });

    const { requireEmisorResponsable } = await cargar();
    const auth = await requireEmisorResponsable();

    expect(auth.error.status).toBe(403);
  });

  it("rechaza a la cuenta responsable si quedó desactivada", async () => {
    mocks.session.mockResolvedValue(admin);
    mocks.findUnique.mockResolvedValue({ email: "contacto@saludmentalcostarica.com", isActive: false });

    const { requireEmisorResponsable } = await cargar();
    expect((await requireEmisorResponsable()).error.status).toBe(403);
  });

  it("rechaza cuando el usuario del token ya no existe", async () => {
    mocks.session.mockResolvedValue(admin);
    mocks.findUnique.mockResolvedValue(null);

    const { requireEmisorResponsable } = await cargar();
    expect((await requireEmisorResponsable()).error.status).toBe(403);
  });

  it("sin sesión responde 401, no 403", async () => {
    mocks.session.mockResolvedValue(null);
    const { requireEmisorResponsable } = await cargar();
    expect((await requireEmisorResponsable()).error.status).toBe(401);
  });

  it("un rol que no es ADMIN se detiene antes de consultar la base", async () => {
    mocks.session.mockResolvedValue({ sub: "user-1", role: "USER" });
    const { requireEmisorResponsable } = await cargar();

    expect((await requireEmisorResponsable()).error.status).toBe(403);
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("FE_EMISOR_RESPONSABLE_EMAIL puede mover la autorización sin tocar código", async () => {
    vi.stubEnv("FE_EMISOR_RESPONSABLE_EMAIL", "  Otro@Ejemplo.CR ");
    mocks.session.mockResolvedValue(admin);
    mocks.findUnique.mockResolvedValue({ email: "otro@ejemplo.cr", isActive: true });

    const { requireEmisorResponsable, esEmisorResponsable } = await cargar();

    // El cotejo ignora espacios y mayúsculas de los dos lados.
    expect(esEmisorResponsable("OTRO@EJEMPLO.CR")).toBe(true);
    expect(esEmisorResponsable("contacto@saludmentalcostarica.com")).toBe(false);
    expect((await requireEmisorResponsable()).error).toBeUndefined();
  });

  it("esEmisorResponsable no se deja engañar por un correo vacío", async () => {
    const { esEmisorResponsable } = await cargar();
    expect(esEmisorResponsable("")).toBe(false);
    expect(esEmisorResponsable(null)).toBe(false);
    expect(esEmisorResponsable(undefined)).toBe(false);
  });
});
