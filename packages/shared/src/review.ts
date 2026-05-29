import type { ReviewItem, ReviewRating, ReviewState, ReviewSummary, SpacedReviewInput, SpacedReviewResult } from "./types";

const DEFAULT_EASE = 2.5;
const MIN_EASE = 1.3;
const MAX_EASE = 3;
const DEFAULT_INTERVAL_DAYS = 30;

export function getReviewState(daysDelta: number | null): ReviewState {
  if (daysDelta === null) {
    return "invalid";
  }

  if (daysDelta < 0) {
    return "overdue";
  }

  if (daysDelta === 0) {
    return "today";
  }

  if (daysDelta <= 7) {
    return "next_7_days";
  }

  return "future";
}

export function createEmptySummary(): ReviewSummary {
  return {
    overdue: 0,
    today: 0,
    next_7_days: 0,
    future: 0,
    invalid: 0,
    total: 0
  };
}

export function summarizeReviewItems(items: ReviewItem[]): ReviewSummary {
  const summary = createEmptySummary();

  for (const item of items) {
    summary[item.review_state] += 1;
    summary.total += 1;
  }

  return summary;
}

export function calculateSpacedReview(input: SpacedReviewInput): SpacedReviewResult {
  const currentIntervalDays = normalizePositiveInteger(input.currentIntervalDays, 0);
  const defaultIntervalDays = normalizePositiveInteger(input.defaultIntervalDays, DEFAULT_INTERVAL_DAYS);
  const currentEase = clampEase(input.currentEase);

  if (input.rating === "again") {
    return {
      rating: input.rating,
      intervalDays: 1,
      ease: roundEase(currentEase - 0.2),
      lapseDelta: 1
    };
  }

  if (input.rating === "hard") {
    return {
      rating: input.rating,
      intervalDays: Math.max(2, Math.round(getBaseInterval(currentIntervalDays, defaultIntervalDays) * 1.2)),
      ease: roundEase(currentEase - 0.05),
      lapseDelta: 0
    };
  }

  if (input.rating === "easy") {
    return {
      rating: input.rating,
      intervalDays: Math.max(defaultIntervalDays, Math.round(getBaseInterval(currentIntervalDays, defaultIntervalDays) * currentEase * 1.3)),
      ease: roundEase(currentEase + 0.15),
      lapseDelta: 0
    };
  }

  return {
    rating: input.rating,
    intervalDays: Math.max(defaultIntervalDays, Math.round(getBaseInterval(currentIntervalDays, defaultIntervalDays) * currentEase)),
    ease: roundEase(currentEase),
    lapseDelta: 0
  };
}

function getBaseInterval(currentIntervalDays: number, defaultIntervalDays: number): number {
  return currentIntervalDays > 0 ? currentIntervalDays : defaultIntervalDays;
}

function normalizePositiveInteger(value: number | null | undefined, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : fallback;
}

function clampEase(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_EASE;
  }

  return Math.min(MAX_EASE, Math.max(MIN_EASE, value));
}

function roundEase(value: number): number {
  return Math.round(Math.min(MAX_EASE, Math.max(MIN_EASE, value)) * 100) / 100;
}
