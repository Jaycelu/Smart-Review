import { getLocalDateString, normalizeDate } from "@smart-review/shared";
import type { HeatmapDay } from "./analytics-types";

const DAY_MS = 86_400_000;
const HEATMAP_DAYS = 365;

export function buildHeatmapDays(countsByDate: Map<string, number>, today = new Date()): HeatmapDay[] {
  const todayUtc = toUtcDateOnlyTime(getLocalDateString(today));
  const startUtc = todayUtc - (HEATMAP_DAYS - 1) * DAY_MS;
  const maxCount = Math.max(0, ...countsByDate.values());
  const days: HeatmapDay[] = [];

  for (let index = 0; index < HEATMAP_DAYS; index += 1) {
    const date = fromUtcDateOnlyTime(startUtc + index * DAY_MS);
    const count = countsByDate.get(date) ?? 0;
    days.push({
      date,
      count,
      level: countToLevel(count, maxCount)
    });
  }

  return days;
}

export function incrementDateCount(countsByDate: Map<string, number>, value: unknown): void {
  const date = normalizeDate(value);
  if (date === null) {
    return;
  }

  countsByDate.set(date, (countsByDate.get(date) ?? 0) + 1);
}

export function getDateDaysAgo(daysAgo: number, today = new Date()): string {
  const todayUtc = toUtcDateOnlyTime(getLocalDateString(today));
  return fromUtcDateOnlyTime(todayUtc - daysAgo * DAY_MS);
}

function countToLevel(count: number, maxCount: number): HeatmapDay["level"] {
  if (count <= 0 || maxCount <= 0) {
    return 0;
  }

  if (count === 1) {
    return 1;
  }

  const ratio = count / maxCount;
  if (ratio <= 0.35) {
    return 2;
  }
  if (ratio <= 0.7) {
    return 3;
  }
  return 4;
}

function toUtcDateOnlyTime(dateString: string): number {
  const parts = dateString.split("-").map(Number);
  const year = parts[0] ?? 1970;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  return Date.UTC(year, month - 1, day);
}

function fromUtcDateOnlyTime(time: number): string {
  const date = new Date(time);
  return `${date.getUTCFullYear().toString().padStart(4, "0")}-${(date.getUTCMonth() + 1)
    .toString()
    .padStart(2, "0")}-${date.getUTCDate().toString().padStart(2, "0")}`;
}
