import { describe, expect, it } from "vitest";
import { datosHeredadosEnLaSerie } from "@/lib/appointment-recurrence";

// La primera cita de Katherine: virtual, primera con el profesional y con el
// adelanto pagado.
const primera = {
  id: "cita-1",
  serviceId: "psicoterapia",
  pricePaid: 30000,
  paymentStatus: "PARTIALLY_PAID",
  isFirstWithProfessional: true,
  priceTierId: "escalon-1",
  rateId: "tarifa",
  locationId: "virtual",
  modality: "VIRTUAL",
  locationName: "Consulta virtual",
  locationAddress: null,
  locationNotes: null,
  timeBandName: null,
  gcalEventId: "evento",
  meetLink: "https://meet.google.com/abc",
};

describe("datosHeredadosEnLaSerie", () => {
  it("las demás semanas conservan lugar y modalidad, para que salgan con su Meet", () => {
    const datos = datosHeredadosEnLaSerie(primera);
    expect(datos).toMatchObject({
      modality: "VIRTUAL",
      locationId: "virtual",
      locationName: "Consulta virtual",
      rateId: "tarifa",
      pricePaid: 30000,
      serviceId: "psicoterapia",
    });
  });

  it("cada semana se cobra por su cuenta y ninguna es la primera", () => {
    const datos = datosHeredadosEnLaSerie(primera);
    expect(datos.paymentStatus).toBe("UNPAID");
    expect(datos.isFirstWithProfessional).toBe(false);
  });

  it("no copia lo que es propio de la primera cita: escalón, evento de Google ni sala", () => {
    const datos = datosHeredadosEnLaSerie(primera);
    expect(datos).not.toHaveProperty("priceTierId");
    expect(datos).not.toHaveProperty("gcalEventId");
    expect(datos).not.toHaveProperty("meetLink");
    expect(datos).not.toHaveProperty("id");
  });
});
