import { describe, expect, it } from "vitest";
import { APPOINTMENT_OVERLAP_MESSAGE, isAppointmentOverlapError } from "../../src/lib/appointment-errors.js";

describe("appointment overlap errors", () => {
  it("maps PostgreSQL exclusion violations", () => {
    expect(isAppointmentOverlapError({ code: "P2010", message: "ERROR: 23P01 appointment_no_overlap" })).toBe(true);
    expect(APPOINTMENT_OVERLAP_MESSAGE).toContain("Elegí otro espacio");
  });

  it("does not hide unrelated database errors", () => {
    expect(isAppointmentOverlapError({ code: "P2002", message: "unique violation" })).toBe(false);
  });
});
