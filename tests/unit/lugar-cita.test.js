import { describe, it, expect } from "vitest";
import { AVISO_ENLACE_VIRTUAL, detalleLugarCita, lugarCitaEnUnaLinea } from "@/lib/lugar-cita";

const PRESENCIAL = {
  modality: "OFFICE",
  locationName: "Consultorio Moravia",
  locationAddress: "Moravia, San Vicente, 200 m norte de la iglesia, edificio Aurora",
  locationNotes: "Segundo piso, oficina 4. Timbre 2.",
};

describe("dónde es la cita", () => {
  it("da la dirección del consultorio, no solo el cantón", () => {
    // El paciente veía "Moravia" y tenía que preguntar a dónde ir.
    const lugar = detalleLugarCita(PRESENCIAL);
    expect(lugar.titulo).toBe("Consultorio Moravia");
    expect(lugar.direccion).toContain("200 m norte de la iglesia");
    expect(lugar.comoLlegar).toContain("Timbre 2");
    expect(lugar.tieneDireccion).toBe(true);
    expect(lugar.modalidad).toBe("Presencial");
  });

  it("en virtual avisa cuándo llega el enlace, en vez de dejar el lugar vacío", () => {
    const lugar = detalleLugarCita({
      modality: "VIRTUAL",
      locationName: "Consulta virtual",
      locationAddress: null,
      locationNotes: null,
    });
    expect(lugar.esVirtual).toBe(true);
    expect(lugar.direccion).toBe("");
    expect(lugar.aviso).toBe(AVISO_ENLACE_VIRTUAL);
  });

  it("nunca filtra una dirección en una cita virtual, aunque la cita la traiga", () => {
    // Defensa contra citas viejas guardadas antes de que el snapshot limpiara.
    const lugar = detalleLugarCita({
      modality: "VIRTUAL",
      locationName: "Consulta virtual",
      locationAddress: "https://meet.example/sala-privada",
      locationNotes: "clave 1234",
    });
    expect(lugar.direccion).toBe("");
    expect(lugar.comoLlegar).toBe("");
  });

  it("a domicilio explica que el profesional se traslada", () => {
    const lugar = detalleLugarCita({ modality: "HOME", locationName: "A domicilio" });
    expect(lugar.aviso).toMatch(/se traslada/);
    expect(lugar.tieneDireccion).toBe(false);
  });

  it("no inventa nada cuando la cita no tiene lugar registrado", () => {
    const lugar = detalleLugarCita({});
    expect(lugar.titulo).toBe("");
    expect(lugar.aviso).toBe("");
    expect(lugarCitaEnUnaLinea({})).toBe("");
  });

  it("arma una línea con todo para el correo", () => {
    expect(lugarCitaEnUnaLinea(PRESENCIAL)).toBe(
      "Consultorio Moravia · (Presencial) · Moravia, San Vicente, 200 m norte de la iglesia, edificio Aurora · Segundo piso, oficina 4. Timbre 2."
    );
  });
});
