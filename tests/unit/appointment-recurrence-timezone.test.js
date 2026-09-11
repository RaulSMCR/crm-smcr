import { describe, expect, it } from "vitest";
import { buildRecurringStarts, normalizeRecurrenceCount } from "@/lib/appointment-recurrence";
import { toGoogleDateTime } from "@/lib/timezone";
import { buildSlots } from "@/lib/appointment-slots";

describe("recurrencia y zona horaria", () => {
  it("limita la recurrencia al máximo configurado", () => {
    expect(normalizeRecurrenceCount(99)).toBe(12);
    // La recurrencia mensual conserva el día del calendario local del llamador.
    expect(buildRecurringStarts(new Date(2026, 0, 30, 9), "MONTHLY", 3).map((date) => date.getDate())).toEqual([30, 28, 30]);
  });

  it("formatea la cita en la zona de Costa Rica", () => {
    expect(toGoogleDateTime("2026-01-15T18:30:00Z")).toBe("2026-01-15T12:30:00");
  });

  it("excluye intervalos reservados y respeta el límite de días", () => {
    const now = new Date("2026-01-05T00:00:00-06:00");
    const days = buildSlots({
      now, daysAhead: 1, durationMin: 60,
      availability: [
        { dayOfWeek: 1, startTime: "09:00", endTime: "12:00" },
        { dayOfWeek: 2, startTime: "09:00", endTime: "12:00" },
      ],
      booked: [{ startISO: "2026-01-05T10:00:00-06:00", endISO: "2026-01-05T11:00:00-06:00" }],
    });
    expect(days).toHaveLength(1);
    expect(days[0].day.toISOString()).toBe("2026-01-05T06:00:00.000Z");
    expect(days[0].slots.map((slot) => slot.start.toISOString())).toEqual([
      "2026-01-05T15:00:00.000Z", "2026-01-05T17:00:00.000Z",
    ]);
  });

  it("usa el día de Costa Rica aunque el instante ya sea el día siguiente en UTC", () => {
    const days = buildSlots({
      now: new Date("2026-01-06T01:00:00Z"), daysAhead: 1, durationMin: 60,
      availability: [{ dayOfWeek: 1, startTime: "20:00", endTime: "22:00" }],
    });
    expect(days).toHaveLength(1);
    expect(days[0].day.toISOString()).toBe("2026-01-05T06:00:00.000Z");
    expect(days[0].slots.map((slot) => slot.start.toISOString())).toEqual([
      "2026-01-06T02:00:00.000Z", "2026-01-06T03:00:00.000Z",
    ]);
  });
});
