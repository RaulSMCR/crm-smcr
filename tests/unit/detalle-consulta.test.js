import { describe, it, expect } from "vitest";
import {
  PRODUCTO_CARGO_CANCELACION,
  PRODUCTO_SERVICIOS_PROFESIONALES,
  detalleLineaFactura,
  fechaLargaCR,
  nombreDelProfesional,
  rotuloCobroOnvo,
} from "@/lib/detalle-consulta";
import { nombreConGrado, esGradoValido, normalizarGrado } from "@/lib/grados-academicos";

const CITA = new Date("2026-08-15T16:00:00Z"); // 10:00 en Costa Rica

describe("grados académicos", () => {
  it("antepone la abreviatura al nombre", () => {
    expect(nombreConGrado("Ana Solano", "licenciada")).toBe("Licda. Ana Solano");
    expect(nombreConGrado("Ana Solano", "doctora")).toBe("Dra. Ana Solano");
    expect(nombreConGrado("Juan Pérez", "master")).toBe("MSc. Juan Pérez");
    expect(nombreConGrado("Juan Pérez", "bachiller")).toBe("Bach. Juan Pérez");
  });

  it("no inventa un tratamiento cuando el perfil no lo declaró", () => {
    expect(nombreConGrado("Ana Solano", null)).toBe("Ana Solano");
    expect(nombreConGrado("Ana Solano", "sabelotodo")).toBe("Ana Solano");
  });

  it("no deduce el género a partir del grado masculino", () => {
    // Son entradas distintas justamente para que nadie tenga que adivinar.
    expect(esGradoValido("licenciada")).toBe(true);
    expect(esGradoValido("doctora")).toBe(true);
  });

  it("normaliza lo que venga del formulario y descarta lo que no es del catálogo", () => {
    expect(normalizarGrado("  Licenciado ")).toBe("licenciado");
    expect(normalizarGrado("ingeniero")).toBeNull();
    expect(normalizarGrado("")).toBeNull();
  });
});

describe("nombre del profesional en el detalle", () => {
  it("lee el perfil con su user anidado", () => {
    expect(
      nombreDelProfesional({ academicDegree: "licenciada", user: { name: "Ana Solano" } })
    ).toBe("Licda. Ana Solano");
  });

  it("acepta también el user suelto", () => {
    expect(nombreDelProfesional({ name: "Ana Solano", academicDegree: "doctora" })).toBe(
      "Dra. Ana Solano"
    );
  });

  it("devuelve cadena vacía sin profesional", () => {
    expect(nombreDelProfesional(null)).toBe("");
  });
});

describe("detalle de la línea de factura", () => {
  const profesional = { academicDegree: "licenciada", user: { name: "Ana Solano" } };

  it("factura servicios profesionales, con fecha y con quien atendió", () => {
    const linea = detalleLineaFactura({ fecha: CITA, profesional, paymentType: "FULL" });
    expect(linea.productName).toBe(PRODUCTO_SERVICIOS_PROFESIONALES);
    expect(linea.description).toBe("Consulta del 15 de agosto de 2026 con Licda. Ana Solano");
  });

  it("dice cuando es adelanto o saldo, sin perder la fecha ni el profesional", () => {
    expect(detalleLineaFactura({ fecha: CITA, profesional, paymentType: "DEPOSIT_50" }).description).toBe(
      "Adelanto 50% de la consulta del 15 de agosto de 2026 con Licda. Ana Solano"
    );
    expect(detalleLineaFactura({ fecha: CITA, profesional, paymentType: "BALANCE_50" }).description).toBe(
      "Saldo 50% de la consulta del 15 de agosto de 2026 con Licda. Ana Solano"
    );
  });

  it("no llama consulta al cargo por cancelación tardía", () => {
    // El Anexo económico es explícito: no es una consulta efectiva.
    const linea = detalleLineaFactura({ fecha: CITA, profesional, paymentType: "PENALTY_50" });
    expect(linea.productName).toBe(PRODUCTO_CARGO_CANCELACION);
    expect(linea.description).toBe(
      "Cargo por cancelación tardía de la cita del 15 de agosto de 2026 con Licda. Ana Solano"
    );
    expect(linea.description).not.toMatch(/consulta/i);
  });

  it("usa la fecha de Costa Rica y no la del servidor", () => {
    // Las 03:00 UTC del 16 todavía son el 15 en Costa Rica.
    expect(fechaLargaCR(new Date("2026-08-16T03:00:00Z"))).toBe("15 de agosto de 2026");
  });

  it("omite lo que falta en vez de dejar un hueco", () => {
    expect(detalleLineaFactura({ paymentType: "FULL" }).description).toBe("Consulta");
    expect(detalleLineaFactura({ fecha: CITA, paymentType: "FULL" }).description).toBe(
      "Consulta del 15 de agosto de 2026"
    );
  });
});

describe("rótulo del cobro de ONVO", () => {
  const cita = {
    date: CITA,
    locationName: "Oficentro Del Prado",
    service: { title: "Consulta psicológica" },
    professional: { academicDegree: "licenciada", user: { name: "Ana Solano" } },
  };

  it("nombra al profesional y la fecha, como la factura", () => {
    const rotulo = rotuloCobroOnvo(cita, "DEPOSIT_50");
    expect(rotulo).toContain("Licda. Ana Solano");
    expect(rotulo).toContain("15 ago");
    expect(rotulo).toContain("adelanto 50%");
  });

  it("va sin tildes: ONVO devuelve el nombre con la codificación rota", () => {
    expect(rotuloCobroOnvo(cita, "FULL")).not.toMatch(/[áéíóúñ]/i);
  });

  it("suelta el lugar antes que la fecha cuando no cabe", () => {
    const largo = {
      ...cita,
      locationName: "Consultorio del Oficentro Del Prado, segundo piso, local numero catorce",
      service: { title: "Consulta psicologica de seguimiento para adultos mayores" },
    };
    const rotulo = rotuloCobroOnvo(largo, "DEPOSIT_50");
    expect(rotulo.length).toBeLessThanOrEqual(120);
    expect(rotulo).toContain("15 ago");
    expect(rotulo).not.toContain("segundo piso");
  });
});
