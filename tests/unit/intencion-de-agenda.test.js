// tests/unit/intencion-de-agenda.test.js
import { describe, it, expect } from "vitest";
import {
  etiquetaDelHorario,
  horarioPedido,
  leerIntencion,
  rutaDeReserva,
} from "../../src/lib/intencion-de-agenda.js";

const PRO = "cmtwgmv5p0001r44oz73sbk9d";
const SERVICIO = "cmabc1234567890xyz";

describe("armar la ruta de regreso", () => {
  it("lleva profesional, servicio y horario", () => {
    expect(rutaDeReserva({ professionalId: PRO, serviceId: SERVICIO, fecha: "2026-09-18", hora: "15:00" }))
      .toBe(`/agendar/${PRO}?serviceId=${SERVICIO}&fecha=2026-09-18&hora=15%3A00`);
  });

  it("sirve también sin horario elegido", () => {
    expect(rutaDeReserva({ professionalId: PRO, serviceId: SERVICIO }))
      .toBe(`/agendar/${PRO}?serviceId=${SERVICIO}`);
  });

  it("descarta media reserva: una fecha sin hora no reabre nada", () => {
    expect(rutaDeReserva({ professionalId: PRO, fecha: "2026-09-18" })).toBe(`/agendar/${PRO}`);
    expect(rutaDeReserva({ professionalId: PRO, hora: "15:00" })).toBe(`/agendar/${PRO}`);
  });

  it("sin profesional no hay ruta", () => {
    expect(rutaDeReserva({ serviceId: SERVICIO })).toBeNull();
    expect(rutaDeReserva({ professionalId: "../../admin" })).toBeNull();
    expect(rutaDeReserva()).toBeNull();
  });

  it("ignora un servicio con forma inválida en vez de propagarlo", () => {
    expect(rutaDeReserva({ professionalId: PRO, serviceId: "<script>" })).toBe(`/agendar/${PRO}`);
  });
});

describe("leer la intención de un next", () => {
  it("devuelve lo que había detrás", () => {
    expect(leerIntencion(`/agendar/${PRO}?serviceId=${SERVICIO}&fecha=2026-09-18&hora=15:00`)).toEqual({
      professionalId: PRO,
      serviceId: SERVICIO,
      fecha: "2026-09-18",
      hora: "15:00",
    });
  });

  it("es de ida y vuelta con la ruta que arma", () => {
    const datos = { professionalId: PRO, serviceId: SERVICIO, fecha: "2026-09-18", hora: "15:00" };
    expect(leerIntencion(rutaDeReserva(datos))).toEqual(datos);
  });

  it("no acepta rutas de otro sitio", () => {
    // Lo que salga de acá termina en un href y en un texto en pantalla.
    expect(leerIntencion("//evil.example/agendar/x")).toBeNull();
    expect(leerIntencion("https://evil.example/agendar/x")).toBeNull();
    expect(leerIntencion("/panel/admin")).toBeNull();
    expect(leerIntencion("/agendar")).toBeNull();
    expect(leerIntencion(`/agendar/${PRO}/extra`)).toBeNull();
    expect(leerIntencion("")).toBeNull();
    expect(leerIntencion(null)).toBeNull();
  });

  it("descarta un horario a medias o mal formado", () => {
    expect(leerIntencion(`/agendar/${PRO}?fecha=2026-09-18`)).toMatchObject({ fecha: null, hora: null });
    expect(leerIntencion(`/agendar/${PRO}?fecha=18-09-2026&hora=15:00`)).toMatchObject({ fecha: null, hora: null });
    expect(leerIntencion(`/agendar/${PRO}?fecha=2026-09-18&hora=25:00`)).toMatchObject({ fecha: null, hora: null });
  });

  it("descarta un servicio inválido pero conserva la reserva", () => {
    expect(leerIntencion(`/agendar/${PRO}?serviceId=..%2F..%2Fadmin`)).toMatchObject({
      professionalId: PRO,
      serviceId: null,
    });
  });
});

describe("horario pedido por la dirección", () => {
  it("son los dos o ninguno", () => {
    expect(horarioPedido("2026-09-18", "15:00")).toEqual({ fecha: "2026-09-18", hora: "15:00" });
    expect(horarioPedido("2026-09-18", undefined)).toEqual({ fecha: null, hora: null });
    expect(horarioPedido("ayer", "15:00")).toEqual({ fecha: null, hora: null });
  });
});

describe("el horario en palabras", () => {
  it("dice el día y la hora tica, no la del servidor", () => {
    const texto = etiquetaDelHorario("2026-09-18", "15:00");
    expect(texto).toMatch(/viernes/i);
    expect(texto).toContain("18");
    expect(texto).toMatch(/septiembre/i);
    // 15:00 en Costa Rica son las 3 de la tarde en Costa Rica: si esto dijera
    // 21:00 sería que la etiqueta se armó con el reloj de quien corre el test.
    expect(texto).toMatch(/\b0?3:00/);
  });

  it("no inventa nada si el horario no está completo", () => {
    expect(etiquetaDelHorario("2026-09-18", null)).toBeNull();
    expect(etiquetaDelHorario(null, "15:00")).toBeNull();
    // Con forma de fecha pero inexistente: antes esto llegaba a
    // `Intl.DateTimeFormat`, que lanza, y la página del registro moría con ella.
    expect(etiquetaDelHorario("2026-13-40", "15:00")).toBeNull();
    expect(etiquetaDelHorario("2026-02-30", "15:00")).toBeNull();
    expect(leerIntencion(`/agendar/${PRO}?fecha=2026-02-30&hora=15:00`)).toMatchObject({ fecha: null, hora: null });
  });
});
