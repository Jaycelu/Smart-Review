const DATE_ONLY_PATTERN = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/;

export function normalizeDate(input: unknown): string | null {
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : getLocalDateString(input);
  }

  if (typeof input !== "string") {
    return null;
  }

  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const dateOnlyMatch = DATE_ONLY_PATTERN.exec(trimmed);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return buildDateString(Number(year), Number(month), Number(day));
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return getLocalDateString(parsed);
}

export function getLocalDateString(date: Date = new Date()): string {
  return buildDateString(date.getFullYear(), date.getMonth() + 1, date.getDate()) ?? "";
}

export function calculateDaysDelta(nextReview: string, today: string = getLocalDateString()): number | null {
  const normalizedNextReview = normalizeDate(nextReview);
  const normalizedToday = normalizeDate(today);

  if (normalizedNextReview === null || normalizedToday === null) {
    return null;
  }

  const nextTime = toUtcDateOnlyTime(normalizedNextReview);
  const todayTime = toUtcDateOnlyTime(normalizedToday);

  if (nextTime === null || todayTime === null) {
    return null;
  }

  return Math.round((nextTime - todayTime) / 86_400_000);
}

export function calculateNextReviewDate(
  reviewedAt: string = getLocalDateString(),
  intervalDays: number = 30
): string | null {
  const normalizedReviewedAt = normalizeDate(reviewedAt);
  if (normalizedReviewedAt === null || !Number.isInteger(intervalDays) || intervalDays < 1) {
    return null;
  }

  const reviewedAtTime = toUtcDateOnlyTime(normalizedReviewedAt);
  if (reviewedAtTime === null) {
    return null;
  }

  const nextReview = new Date(reviewedAtTime + intervalDays * 86_400_000);
  return buildDateString(nextReview.getUTCFullYear(), nextReview.getUTCMonth() + 1, nextReview.getUTCDate());
}

function buildDateString(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  const candidate = new Date(year, month - 1, day);
  if (
    candidate.getFullYear() !== year ||
    candidate.getMonth() !== month - 1 ||
    candidate.getDate() !== day
  ) {
    return null;
  }

  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day
    .toString()
    .padStart(2, "0")}`;
}

function toUtcDateOnlyTime(dateString: string): number | null {
  const match = DATE_ONLY_PATTERN.exec(dateString);
  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  return Date.UTC(Number(year), Number(month) - 1, Number(day));
}
