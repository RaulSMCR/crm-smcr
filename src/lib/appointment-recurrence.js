export const RECURRENCE_RULES = {
  NONE: "NONE",
  WEEKLY: "WEEKLY",
  BIWEEKLY: "BIWEEKLY",
  MONTHLY: "MONTHLY",
};

export const RECURRENCE_OPTIONS = [
  { value: RECURRENCE_RULES.NONE, label: "No recurrente" },
  { value: RECURRENCE_RULES.WEEKLY, label: "Cada semana" },
  { value: RECURRENCE_RULES.BIWEEKLY, label: "Cada dos semanas" },
  { value: RECURRENCE_RULES.MONTHLY, label: "Cada mes" },
];

const MIN_RECURRENCE_COUNT = 1;
const MAX_RECURRENCE_COUNT = 12;

export function normalizeRecurrenceRule(value) {
  const rule = String(value || RECURRENCE_RULES.NONE).toUpperCase();
  return Object.values(RECURRENCE_RULES).includes(rule) ? rule : RECURRENCE_RULES.NONE;
}

export function normalizeRecurrenceCount(value) {
  const count = Number.parseInt(String(value ?? MIN_RECURRENCE_COUNT), 10);
  if (!Number.isFinite(count)) return MIN_RECURRENCE_COUNT;
  return Math.min(Math.max(count, MIN_RECURRENCE_COUNT), MAX_RECURRENCE_COUNT);
}

function addMonthsKeepingDay(baseDate, monthsToAdd) {
  const next = new Date(baseDate);
  const dayOfMonth = next.getDate();

  next.setDate(1);
  next.setMonth(next.getMonth() + monthsToAdd);

  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(dayOfMonth, lastDay));

  return next;
}

function addRecurrence(date, rule, step) {
  const next = new Date(date);

  if (rule === RECURRENCE_RULES.WEEKLY) {
    next.setDate(next.getDate() + step * 7);
    return next;
  }

  if (rule === RECURRENCE_RULES.BIWEEKLY) {
    next.setDate(next.getDate() + step * 14);
    return next;
  }

  if (rule === RECURRENCE_RULES.MONTHLY) {
    return addMonthsKeepingDay(next, step);
  }

  return next;
}

export function buildRecurringStarts(startDate, recurrenceRule, recurrenceCount) {
  const rule = normalizeRecurrenceRule(recurrenceRule);
  const count = normalizeRecurrenceCount(recurrenceCount);
  const base = new Date(startDate);

  if (rule === RECURRENCE_RULES.NONE || count <= 1) {
    return [base];
  }

  const starts = [];
  for (let index = 0; index < count; index += 1) {
    starts.push(addRecurrence(base, rule, index));
  }
  return starts;
}
