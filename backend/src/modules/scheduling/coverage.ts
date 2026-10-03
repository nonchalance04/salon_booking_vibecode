import { Temporal } from "@js-temporal/polyfill";
import { days } from "../configuration/configuration.schema.js";

export type WeeklyWindow = {
  dayOfWeek: string; startTime: Date; endTime: Date;
  effectiveFrom?: Date | null; effectiveTo?: Date | null;
};

export function coversReservation(start: Date, end: Date, windows: WeeklyWindow[], timeZone: string) {
  const first = Temporal.Instant.fromEpochMilliseconds(start.getTime()).toZonedDateTimeISO(timeZone).toPlainDate();
  const last = Temporal.Instant.fromEpochMilliseconds(end.getTime() - 1).toZonedDateTimeISO(timeZone).toPlainDate();
  const intervals: [number, number][] = [];
  for (let day = first; Temporal.PlainDate.compare(day, last) <= 0; day = day.add({ days: 1 })) {
    const localDate = day.toString();
    for (const window of windows) {
      if (window.dayOfWeek !== days[day.dayOfWeek - 1]) continue;
      if (window.effectiveFrom && localDate < window.effectiveFrom.toISOString().slice(0, 10)) continue;
      if (window.effectiveTo && localDate > window.effectiveTo.toISOString().slice(0, 10)) continue;
      const at = (time: Date) => day.toPlainDateTime(time.toISOString().slice(11, 19)).toZonedDateTime(timeZone).epochMilliseconds;
      intervals.push([at(window.startTime), at(window.endTime)]);
    }
  }
  let coveredUntil = start.getTime();
  for (const [from, to] of intervals.sort((a, b) => a[0] - b[0])) {
    if (from > coveredUntil) break;
    if (to > coveredUntil) coveredUntil = to;
    if (coveredUntil >= end.getTime()) return true;
  }
  return false;
}

export function overlaps(start: Date, end: Date, otherStart: Date, otherEnd: Date) {
  return start < otherEnd && end > otherStart;
}
