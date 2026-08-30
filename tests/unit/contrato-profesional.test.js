import { describe, it, expect } from "vitest";
import {
  LINEA_EN_BLANCO,
  construirContratoProfesional,
  fechaEnLetras,
  formatearCedulaJuridica,
} from "@/lib/contratos/contrato-profesional";
import { cifraEnLetrasYNumero, numeroEnLetras } from "@/lib/contratos/numero-en-letras";

const EMPRESA_COMPLETA = {
  nombre: "SALUD MENTAL COSTA RICA CINCO CERO SEIS SOCIEDAD ANONIMA",
  cedulaJuridica: "3101885661",
  correo: "facturacion@ejemplo.cr",
  representante: {
    nombre: "Raúl Olmedo",
    identificacion: "1-1234-5678",
    condicion: "Apoderado Generalísimo sin límite de suma",
  },
};

const PROFESIONAL_COMPLETO = {
  nombre: "Ana Solano",
  grado: "licenciada",
  identificacion: "1-2345-6789",
  email: "ana@ejemplo.cr",
  especialidad: "Psicología clínica",
  domicilio: "San José, Curridabat",
  iban: "CR05015202001026284066",
};

function textoDe(contrato) {
  return contrato.bloques
    .map((b) => b.texto || (b.lineas || []).join(" ") || (b.items || []).join(" ") || "")
    .join("\n");
}

describe("números en letras", () => {
  it("escribe la cifra como la escribe un contrato", () => {
    expect(numeroEnLetras(30)).toBe("treinta");
    expect(numeroEnLetras(5)).toBe("cinco");
    expect(numeroEnLetras(21)).toBe("veintiuno");
    expect(numeroEnLetras(100)).toBe("cien");
    expect(numeroEnLetras(2026)).toBe("dos mil veintiséis");
    expect(cifraEnLetrasYNumero(30)).toBe("treinta (30)");
  });
});

describe("formato de la cédula jurídica", () => {
  it("agrupa los diez dígitos como los agrupa el Registro", () => {
    expect(formatearCedulaJuridica("3101885661")).toBe("3-101-885661");
    expect(formatearCedulaJuridica("3-101-885661")).toBe("3-101-885661");
  });

  it("deja intacto lo que no tiene esa forma en vez de deformarlo", () => {
    expect(formatearCedulaJuridica("12345")).toBe("12345");
  });
});

describe("fecha en letras", () => {
  it("escribe día, mes y año como los escribe un contrato", () => {
    expect(fechaEnLetras(new Date(2026, 7, 30))).toBe("treinta de agosto del dos mil veintiséis (2026)");
  });
});

describe("contrato de prestación de servicios profesionales", () => {
  it("sustituye los datos del profesional y de la sociedad", () => {
    const contrato = construirContratoProfesional({
      profesional: PROFESIONAL_COMPLETO,
      empresa: EMPRESA_COMPLETA,
      firma: { fecha: new Date(2026, 7, 30), lugar: "San José" },
    });
    const texto = textoDe(contrato);

    expect(texto).toContain("Licda. Ana Solano");
    expect(texto).toContain("1-2345-6789");
    expect(texto).toContain("SALUD MENTAL COSTA RICA CINCO CERO SEIS SOCIEDAD ANONIMA");
    expect(texto).toContain("3-101-885661");
    expect(texto).toContain("Raúl Olmedo");
    expect(texto).toContain("Apoderado Generalísimo sin límite de suma");
    expect(texto).toContain("ana@ejemplo.cr");
    expect(texto).toContain("treinta de agosto del dos mil veintiséis (2026)");
  });

  it("marca la casilla de disciplina que corresponde y ninguna otra", () => {
    const texto = textoDe(
      construirContratoProfesional({
        profesional: PROFESIONAL_COMPLETO,
        empresa: EMPRESA_COMPLETA,
      })
    );
    expect(texto).toContain("[X] Psicología");
    expect(texto).toContain("[ ] Medicina");
    expect(texto).toContain("[ ] Nutrición");
  });

  it("no encasilla una disciplina que el Anexo A no contempla: lo deja pendiente", () => {
    const contrato = construirContratoProfesional({
      profesional: { ...PROFESIONAL_COMPLETO, especialidad: "Musicoterapia" },
      empresa: EMPRESA_COMPLETA,
    });
    expect(textoDe(contrato)).not.toContain("[X]");
    expect(contrato.pendientes.join(" ")).toContain("Musicoterapia");
  });

  it("deja línea en blanco y avisa por cada dato que el CRM no tiene", () => {
    const contrato = construirContratoProfesional({
      profesional: { nombre: "Ana Solano", grado: "licenciada", especialidad: "Psicología clínica" },
      empresa: { nombre: "", cedulaJuridica: "", correo: "", representante: {} },
    });

    const texto = textoDe(contrato);
    expect(texto).toContain(LINEA_EN_BLANCO);

    const pendientes = contrato.pendientes.join(" ");
    expect(pendientes).toContain("cédula del profesional");
    expect(pendientes).toContain("representante legal");
    expect(pendientes).toContain("domicilio");
    expect(pendientes).toContain("IBAN");
  });

  it("siempre avisa de lo que ninguna configuración puede llenar", () => {
    const pendientes = construirContratoProfesional({
      profesional: PROFESIONAL_COMPLETO,
      empresa: EMPRESA_COMPLETA,
    }).pendientes.join(" ");

    expect(pendientes).toContain("plazo de pago de la cláusula 4.3");
    expect(pendientes).toContain("fecha de finalización");
  });

  it("lleva el domicilio y la cuenta IBAN del profesional cuando los tiene", () => {
    const contrato = construirContratoProfesional({
      profesional: PROFESIONAL_COMPLETO,
      empresa: EMPRESA_COMPLETA,
    });
    const texto = textoDe(contrato);

    expect(texto).toContain("domiciliado en San José, Curridabat");
    expect(texto).toContain("CR05 0152 0200 1026 2840 66");
    expect(contrato.pendientes.join(" ")).not.toContain("domicilio");
    expect(contrato.pendientes.join(" ")).not.toContain("IBAN");
  });

  it("remite el Precio al Anexo económico en vez de inventar un monto fijo", () => {
    // El campo preimpreso supone un monto fijo, incompatible con la comisión por
    // secuencia de consultas.
    expect(
      textoDe(construirContratoProfesional({ profesional: PROFESIONAL_COMPLETO, empresa: EMPRESA_COMPLETA }))
    ).toContain("patient-retention-2026-07");
  });

  it("transcribe el machote con sus defectos y los declara", () => {
    const contrato = construirContratoProfesional({
      profesional: PROFESIONAL_COMPLETO,
      empresa: EMPRESA_COMPLETA,
    });
    const texto = textoDe(contrato);

    // La numeración repetida se conserva: corregir un documento legal por
    // software no es una opción, señalarlo sí.
    expect(texto.match(/^5\.2\./gm)?.length).toBe(2);
    expect(texto.match(/^5\.3\./gm)?.length).toBe(2);
    expect(texto.match(/^5\.4\./gm)?.length).toBe(2);
    expect(contrato.defectosConocidos.join(" ")).toContain("dos 5.2");
  });

  it("no lleva impreso el año 2024 preimpreso del machote", () => {
    const texto = textoDe(
      construirContratoProfesional({
        profesional: PROFESIONAL_COMPLETO,
        empresa: EMPRESA_COMPLETA,
        firma: { fecha: new Date(2026, 7, 30) },
      })
    );
    expect(texto).not.toContain("dos mil veinticuatro");
    expect(texto).not.toContain("(2024)");
  });
});
