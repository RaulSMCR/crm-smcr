import { describe, expect, it } from "vitest";
import { buildRecurringStarts, normalizeRecurrenceCount } from "@/lib/appointment-recurrence";
import { toGoogleDateTime } from "@/lib/timezone";
import { buildSlots } from "@/lib/appointment-slots";

describe("recurrencia y zona horaria", () => {
  it("limita la recurrencia al máximo configurado", () => {
    expect(normalizeRecurrenceCount(99)).toBe(12);
    expect(buildRecurringStarts(new Date("2026-01-30T15:00:00Z"), "MONTHLY", 3).map((date) => date.getDate())).toEqual([30, 28, 30]);
  });

  it("formatea la cita en la zona de Costa Rica", () => {
    expect(toGoogleDateTime("2026-01-15T18:30:00Z")).toBe("2026-01-15T12:30:00");
  });

  it("excluye intervalos reservados y respeta el límite de días", () => {
    const now = new Date("2026-01-05T00:00:00");
    const days = buildSlots({ now, daysAhead: 1, durationMin: 60, availability: [{ dayOfWeek: 1, startTime: "09:00", endTime: "12:00" }], booked: [{ startISO: "2026-01-05T10:00:00", endISO: "2026-01-05T11:00:00" }] });
    expect(days[0].slots.map((slot) => slot.start.getHours())).toEqual([9, 11]);
  });
});
