// tests/unit/rates.test.js
// Resolución de tarifa por lugar y franja horaria.
import { describe, it, expect } from "vitest";
import {
  parseHHMM,
  minutesOfDay,
  resolveTimeBand,
  resolveRate,
  resolveAppointmentRate,
  findTimeBandOverlaps,
  snapshotLocation,
} from "../../src/lib/rates.js";

const MATUTINO = { id: "band_am", name: "Matutino", startTime: "07:00", endTime: "13:00" };
const VESPERTINO = { id: "band_pm", name: "Vespertino", startTime: "13:00", endTime: "19:00" };
const BANDS = [MATUTINO, VESPERTINO];

const OFICINA = "loc_oficina";
const DOMICILIO = "loc_domicilio";

function rate(overrides) {
  return {
    id: "r",
    locationId: null,
    timeBandId: null,
    status: "APPROVED",
    approvedPrice: 40000,
    ...overrides,
  };
}

describe("parseHHMM()", () => {
  it("convierte a minutos desde medianoche", () => {
    expect(parseHHMM("00:00")).toBe(0);
    expect(parseHHMM("07:30")).toBe(450);
    expect(parseHHMM("23:59")).toBe(1439);
  });

  it("rechaza valores inválidos", () => {
    for (const value of ["", "7", "24:00", "12:60", "abc", null, undefined]) {
      expect(parseHHMM(value)).toBeNull();
    }
  });
});

describe("resolveTimeBand()", () => {
  it("ubica la hora en su franja", () => {
    expect(resolveTimeBand(BANDS, parseHHMM("09:00"))?.id).toBe("band_am");
    expect(resolveTimeBand(BANDS, parseHHMM("15:00"))?.id).toBe("band_pm");
  });

  it("el borde pertenece a la franja que empieza, no a la que termina", () => {
    expect(resolveTimeBand(BANDS, parseHHMM("13:00"))?.id).toBe("band_pm");
  });

  it("retorna null fuera de toda franja", () => {
    expect(resolveTimeBand(BANDS, parseHHMM("05:00"))).toBeNull();
    expect(resolveTimeBand(BANDS, parseHHMM("22:00"))).toBeNull();
  });

  it("soporta una franja que cruza la medianoche", () => {
    const nocturno = [{ id: "band_night", name: "Nocturno", startTime: "22:00", endTime: "02:00" }];
    expect(resolveTimeBand(nocturno, parseHHMM("23:30"))?.id).toBe("band_night");
    expect(resolveTimeBand(nocturno, parseHHMM("01:00"))?.id).toBe("band_night");
    expect(resolveTimeBand(nocturno, parseHHMM("03:00"))).toBeNull();
  });
});

describe("minutesOfDay()", () => {
  it("usa la hora de Costa Rica, no la del servidor", () => {
    // 2026-08-20T15:00:00Z son las 09:00 en Costa Rica (UTC-6).
    expect(minutesOfDay(new Date("2026-08-20T15:00:00Z"))).toBe(9 * 60);
  });

  it("medianoche local da 0", () => {
    expect(minutesOfDay(new Date("2026-08-20T06:00:00Z"))).toBe(0);
  });
});

describe("resolveRate()", () => {
  it("prefiere la tarifa de lugar y franja exactos", () => {
    const rates = [
      rate({ id: "catch_all", approvedPrice: 40000 }),
      rate({ id: "solo_lugar", locationId: DOMICILIO, approvedPrice: 55000 }),
      rate({ id: "exacta", locationId: DOMICILIO, timeBandId: "band_pm", approvedPrice: 60000 }),
    ];
    const found = resolveRate(rates, { locationId: DOMICILIO, timeBandId: "band_pm" });
    expect(found.id).toBe("exacta");
  });

  it("cae al lugar cuando no hay tarifa para esa franja", () => {
    const rates = [
      rate({ id: "catch_all" }),
      rate({ id: "solo_lugar", locationId: DOMICILIO, approvedPrice: 55000 }),
    ];
    expect(resolveRate(rates, { locationId: DOMICILIO, timeBandId: "band_pm" }).id).toBe("solo_lugar");
  });

  it("prefiere la franja sobre el catch-all cuando el lugar no tiene tarifa", () => {
    const rates = [
      rate({ id: "catch_all" }),
      rate({ id: "solo_franja", timeBandId: "band_pm", approvedPrice: 48000 }),
    ];
    expect(resolveRate(rates, { locationId: OFICINA, timeBandId: "band_pm" }).id).toBe("solo_franja");
  });

  it("usa el catch-all cuando no hay nada más específico", () => {
    const rates = [rate({ id: "catch_all" })];
    expect(resolveRate(rates, { locationId: OFICINA, timeBandId: "band_am" }).id).toBe("catch_all");
  });

  it("ignora tarifas no aprobadas", () => {
    const rates = [
      rate({ id: "pendiente", locationId: DOMICILIO, status: "PENDING", approvedPrice: null }),
      rate({ id: "rechazada", locationId: DOMICILIO, status: "REJECTED", approvedPrice: 99000 }),
      rate({ id: "catch_all" }),
    ];
    expect(resolveRate(rates, { locationId: DOMICILIO, timeBandId: "band_am" }).id).toBe("catch_all");
  });

  it("ignora tarifas aprobadas sin precio útil", () => {
    expect(resolveRate([rate({ approvedPrice: 0 })], {})).toBeNull();
    expect(resolveRate([rate({ approvedPrice: null })], {})).toBeNull();
  });

  it("retorna null si no hay ninguna tarifa", () => {
    expect(resolveRate([], { locationId: OFICINA })).toBeNull();
    expect(resolveRate(null, {})).toBeNull();
  });

  it("no aplica una tarifa de otro lugar", () => {
    const rates = [rate({ id: "solo_domicilio", locationId: DOMICILIO, approvedPrice: 55000 })];
    expect(resolveRate(rates, { locationId: OFICINA, timeBandId: null })).toBeNull();
  });
});

describe("resolveAppointmentRate()", () => {
  it("combina franja y lugar para dar el precio congelado", () => {
    const rates = [
      rate({ id: "catch_all", approvedPrice: 40000 }),
      rate({ id: "pm_domicilio", locationId: DOMICILIO, timeBandId: "band_pm", approvedPrice: 65000 }),
    ];

    // 19:00 UTC = 13:00 en Costa Rica → franja vespertina.
    const result = resolveAppointmentRate({
      rates,
      timeBands: BANDS,
      locationId: DOMICILIO,
      startsAt: new Date("2026-08-20T19:00:00Z"),
    });

    expect(result.timeBand.id).toBe("band_pm");
    expect(result.rate.id).toBe("pm_domicilio");
    expect(result.price).toBe(65000);
  });

  it("sin franja que cubra la hora, cae a la tarifa del lugar", () => {
    const rates = [rate({ id: "solo_lugar", locationId: OFICINA, approvedPrice: 42000 })];
    const result = resolveAppointmentRate({
      rates,
      timeBands: BANDS,
      locationId: OFICINA,
      startsAt: new Date("2026-08-20T11:00:00Z"), // 05:00 en CR, fuera de toda franja
    });

    expect(result.timeBand).toBeNull();
    expect(result.price).toBe(42000);
  });

  it("sin tarifa aplicable el precio es null", () => {
    const result = resolveAppointmentRate({
      rates: [],
      timeBands: BANDS,
      locationId: OFICINA,
      startsAt: new Date("2026-08-20T15:00:00Z"),
    });
    expect(result.price).toBeNull();
    expect(result.rate).toBeNull();
  });
});

describe("findTimeBandOverlaps()", () => {
  it("no reporta franjas contiguas", () => {
    expect(findTimeBandOverlaps(BANDS)).toHaveLength(0);
  });

  it("detecta franjas que se pisan", () => {
    const solapadas = [MATUTINO, { id: "x", name: "Tarde", startTime: "12:00", endTime: "18:00" }];
    expect(findTimeBandOverlaps(solapadas)).toHaveLength(1);
  });

  it("detecta el solape de una franja que cruza medianoche", () => {
    const bands = [
      { id: "night", name: "Nocturno", startTime: "22:00", endTime: "02:00" },
      { id: "madrugada", name: "Madrugada", startTime: "01:00", endTime: "05:00" },
    ];
    expect(findTimeBandOverlaps(bands)).toHaveLength(1);
  });
});

describe("snapshotLocation()", () => {
  it("congela los datos visibles del lugar", () => {
    const snap = snapshotLocation({
      id: OFICINA,
      modality: "OFFICE",
      name: "Consultorio Escazú",
      address: "San Rafael, Escazú",
      instructions: "Segundo piso, timbre 3",
    });
    expect(snap).toEqual({
      locationId: OFICINA,
      modality: "OFFICE",
      locationName: "Consultorio Escazú",
      locationAddress: "San Rafael, Escazú",
      // Las señas se congelan con el resto: son lo que hace útil a la dirección
      // y el paciente las recibe al agendar y en cada recordatorio.
      locationNotes: "Segundo piso, timbre 3",
    });
  });

  it("no adelanta las instrucciones de un lugar virtual", () => {
    // Las instrucciones de un lugar virtual son el enlace de la sala, y ese lo
    // hace llegar el profesional antes de la cita, no el sistema al reservar.
    const snap = snapshotLocation({
      id: "loc_virtual",
      modality: "VIRTUAL",
      name: "Consulta virtual",
      address: null,
      instructions: "https://meet.example/sala-privada",
    });
    expect(snap.locationNotes).toBeNull();
  });

  it("no copia dirección en citas a domicilio: el lugar lo pone el paciente", () => {
    const snap = snapshotLocation({
      id: DOMICILIO,
      modality: "HOME",
      name: "A domicilio",
      address: "no aplica",
    });
    expect(snap.locationAddress).toBeNull();
  });

  it("tolera la ausencia de lugar", () => {
    expect(snapshotLocation(null).locationId).toBeNull();
  });
});
