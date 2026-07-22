// tests/unit/admin-view-as.test.js
// F04: el modo «ver como» presta un ROL al admin, pero NO su identidad: `sub`
// sigue siendo la del admin. Por eso una escritura en modo preview no simula
// nada — crearía datos reales a nombre del admin — y las acciones de pago,
// facturación y documentos deben rechazarla.
//
// El montaje de `cache()` sigue el mismo patrón que session-cache.test.js: ver
// ahí la explicación de por qué mockeamos `react` a la build vendorizada de Next.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { prisma, cookieStore } = vi.hoisted(() => ({
  // `findFirst` lo usa la resolución del usuario/profesional real de la vista previa.
  prisma: { user: { findUnique: vi.fn(), findFirst: vi.fn() } },
  cookieStore: { get: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));
vi.mock("react", async () => {
  const mod = await import("next/dist/compiled/react/react.react-server.js");
  return mod.default ?? mod;
});

const reactServer = await import("next/dist/compiled/react/react.react-server.js");
const ReactSharedInternals =
  (reactServer.default ?? reactServer)
    .__SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;

function enterRequest() {
  const perType = new Map();
  ReactSharedInternals.A = {
    getCacheForType(resourceType) {
      if (!perType.has(resourceType)) perType.set(resourceType, resourceType());
      return perType.get(resourceType);
    },
    cacheSignal: () => null,
  };
}

function exitRequest() {
  ReactSharedInternals.A = null;
}

process.env.SESSION_SECRET = "test-secret-con-largo-suficiente-para-hs256";

const {
  getSession,
  isPreviewSession,
  signToken,
  signAdminViewToken,
  verifyAdminViewToken,
  ADMIN_VIEW_MAX_AGE_SECONDS,
} = await import("@/lib/auth");

const ADMIN_ID = "admin-1";
// Usuario real de prueba que la vista «ver como usuario» presta para mostrar datos.
const PREVIEW_USER_ID = "user-preview-1";
const ACTIVE_ADMIN = {
  sessionVersion: 1,
  isActive: true,
  role: "ADMIN",
  professionalProfile: null,
};

async function setCookies({ session, adminView }) {
  cookieStore.get.mockImplementation((name) => {
    if (name === "session" && session) return { value: session };
    if (name === "admin_view" && adminView) return { value: adminView };
    return undefined;
  });
}

beforeEach(async () => {
  vi.clearAllMocks();
  prisma.user.findUnique.mockResolvedValue(ACTIVE_ADMIN);
  prisma.user.findFirst.mockResolvedValue({ id: PREVIEW_USER_ID });
  enterRequest();
});

afterEach(() => {
  exitRequest();
});

describe("modo «ver como» (F04)", () => {
  it("el token de vista expira en 1 hora, no en 1 día", async () => {
    expect(ADMIN_VIEW_MAX_AGE_SECONDS).toBe(3600);

    const token = await signAdminViewToken(ADMIN_ID, "USER");
    const payload = await verifyAdminViewToken(token);

    expect(payload.exp - payload.iat).toBe(3600);
  });

  it("presta el rol pero conserva la identidad real del admin", async () => {
    const adminSession = await signToken({ sub: ADMIN_ID, role: "ADMIN", sessionVersion: 1 });
    await setCookies({ session: adminSession, adminView: await signAdminViewToken(ADMIN_ID, "USER") });

    const session = await getSession();

    expect(session).toMatchObject({ sub: ADMIN_ID, role: "USER", actualRole: "ADMIN", isPreview: true });
    expect(isPreviewSession(session)).toBe(true);
    // La identidad sigue siendo la del admin, pero las lecturas de paciente se
    // redirigen al usuario real prestado (si no, la vista saldría vacía).
    expect(session.previewUserId).toBe(PREVIEW_USER_ID);
  });

  it("ignora una cookie de vista emitida para OTRO admin", async () => {
    const adminSession = await signToken({ sub: ADMIN_ID, role: "ADMIN", sessionVersion: 1 });
    await setCookies({ session: adminSession, adminView: await signAdminViewToken("otro-admin", "USER") });

    const session = await getSession();

    expect(session).toMatchObject({ role: "ADMIN", isPreview: false });
  });

  it("ignora la cookie de vista si el rol real no es ADMIN", async () => {
    prisma.user.findUnique.mockResolvedValue({ ...ACTIVE_ADMIN, role: "USER" });
    const userSession = await signToken({ sub: ADMIN_ID, role: "USER", sessionVersion: 1 });
    await setCookies({ session: userSession, adminView: await signAdminViewToken(ADMIN_ID, "PROFESSIONAL") });

    const session = await getSession();

    expect(session).toMatchObject({ role: "USER", actualRole: "USER", isPreview: false });
  });

  it("revocar al admin (sessionVersion) también mata el modo vista", async () => {
    const adminSession = await signToken({ sub: ADMIN_ID, role: "ADMIN", sessionVersion: 1 });
    await setCookies({ session: adminSession, adminView: await signAdminViewToken(ADMIN_ID, "USER") });
    prisma.user.findUnique.mockResolvedValue({ ...ACTIVE_ADMIN, sessionVersion: 2 });

    expect(await getSession()).toBeNull();
  });

  it("rechaza un token de vista con un rol no permitido", async () => {
    const forged = await signAdminViewToken(ADMIN_ID, "ADMIN");
    expect(await verifyAdminViewToken(forged)).toBeNull();
  });

  it("isPreviewSession es falso para una sesión normal", async () => {
    prisma.user.findUnique.mockResolvedValue({ ...ACTIVE_ADMIN, role: "USER" });
    await setCookies({ session: await signToken({ sub: ADMIN_ID, role: "USER", sessionVersion: 1 }) });

    expect(isPreviewSession(await getSession())).toBe(false);
  });
});
