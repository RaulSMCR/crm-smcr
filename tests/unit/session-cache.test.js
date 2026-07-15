// tests/unit/session-cache.test.js
// F03: getSession() está envuelta en cache() de React, así que las múltiples
// llamadas de un mismo request (layout, página, server actions) comparten una
// sola consulta a la BD — pero el caché muere con el request, que es lo que
// mantiene intacta la revocación de B05 (sessionVersion / isActive).
//
// Dos detalles del entorno que explican la forma de este test:
//
//   1. La app declara react 18.2.0, cuyo subset `react-server` NO exporta
//      `cache`. En el servidor, Next 16 resuelve `react` a su copia vendorizada
//      (React 19), que sí la trae. Vitest resuelve el react 18.2.0 real, donde
//      `cache` es undefined — por eso mockeamos `react` apuntando a la MISMA
//      build vendorizada que corre en producción, en vez de a un doble casero.
//
//   2. `cache(fn)` sólo memoiza si hay un dispatcher de caché instalado; sin él
//      hace `return fn.apply(null, arguments)` (pass-through). En producción lo
//      instala Next por request vía AsyncLocalStorage. Aquí lo instalamos a mano:
//      cada scope creado = un request.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { prisma, cookieStore } = vi.hoisted(() => ({
  prisma: { user: { findUnique: vi.fn() } },
  cookieStore: { get: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));
// La build react-server vendorizada de Next: el mismo `cache` que corre en prod.
vi.mock("react", async () => {
  const mod = await import("next/dist/compiled/react/react.react-server.js");
  return mod.default ?? mod;
});

const reactServer = await import("next/dist/compiled/react/react.react-server.js");
const ReactSharedInternals =
  (reactServer.default ?? reactServer)
    .__SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;

/**
 * Instala un dispatcher de caché nuevo = entra a un request nuevo.
 * Reproduce el contrato que React espera de Next: `getCacheForType(resourceType)`
 * devuelve un contenedor estable mientras dure el scope.
 */
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

const { getSession, signToken } = await import("@/lib/auth");

const USER_ID = "user-1";
const ACTIVE_USER = {
  sessionVersion: 3,
  isActive: true,
  role: "USER",
  professionalProfile: null,
};

beforeEach(async () => {
  vi.clearAllMocks();
  const token = await signToken({ sub: USER_ID, role: "USER", sessionVersion: 3 });
  cookieStore.get.mockImplementation((name) => (name === "session" ? { value: token } : undefined));
  prisma.user.findUnique.mockResolvedValue(ACTIVE_USER);
  enterRequest();
});

afterEach(() => {
  exitRequest();
});

describe("getSession — caché por request (F03)", () => {
  it("dos llamadas en el mismo request ejecutan una sola consulta", async () => {
    const first = await getSession();
    const second = await getSession();

    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
    expect(first).toMatchObject({ sub: USER_ID, actualRole: "USER", isPreview: false });
    expect(second).toBe(first);
  });

  it("las llamadas concurrentes del mismo request comparten la consulta", async () => {
    // El caso real: layout y página resuelven getSession() en paralelo, no en serie.
    const [a, b, c] = await Promise.all([getSession(), getSession(), getSession()]);

    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("un request nuevo vuelve a consultar: la revocación sigue siendo inmediata (B05)", async () => {
    await getSession();
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);

    // Siguiente request: el admin acaba de desactivar al usuario.
    exitRequest();
    enterRequest();
    prisma.user.findUnique.mockResolvedValue({ ...ACTIVE_USER, isActive: false });

    expect(await getSession()).toBeNull();
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(2);
  });

  it("un request nuevo detecta el bump de sessionVersion", async () => {
    expect(await getSession()).not.toBeNull();

    exitRequest();
    enterRequest();
    prisma.user.findUnique.mockResolvedValue({ ...ACTIVE_USER, sessionVersion: 4 });

    expect(await getSession()).toBeNull();
  });

  it("sin cookie de sesión no consulta la BD", async () => {
    cookieStore.get.mockReturnValue(undefined);

    expect(await getSession()).toBeNull();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
