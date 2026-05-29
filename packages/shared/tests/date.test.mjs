import test from "node:test";
import assert from "node:assert/strict";
import { calculateDaysDelta, calculateNextReviewDate, getLocalDateString, normalizeDate } from "../dist/date.js";

test("normalizeDate normalizes supported date inputs", () => {
  assert.equal(normalizeDate("2026-05-28"), "2026-05-28");
  assert.equal(normalizeDate("2026/05/28"), "2026-05-28");
  assert.equal(normalizeDate(new Date(2026, 4, 28)), "2026-05-28");
});

test("normalizeDate rejects invalid or empty values", () => {
  assert.equal(normalizeDate(""), null);
  assert.equal(normalizeDate("YYYY-MM-DD"), null);
  assert.equal(normalizeDate(null), null);
});

test("getLocalDateString formats local date parts", () => {
  assert.equal(getLocalDateString(new Date(2026, 0, 9)), "2026-01-09");
});

test("calculateDaysDelta calculates review deltas", () => {
  assert.equal(calculateDaysDelta("2026-06-04", "2026-05-28"), 7);
  assert.equal(calculateDaysDelta("2026-05-28", "2026-05-28"), 0);
  assert.equal(calculateDaysDelta("2026-05-20", "2026-05-28"), -8);
  assert.equal(calculateDaysDelta("invalid", "2026-05-28"), null);
});

test("calculateNextReviewDate adds a positive review interval", () => {
  assert.equal(calculateNextReviewDate("2026-05-28", 30), "2026-06-27");
  assert.equal(calculateNextReviewDate("2026/05/28", 7), "2026-06-04");
  assert.equal(calculateNextReviewDate("invalid", 7), null);
  assert.equal(calculateNextReviewDate("2026-05-28", 0), null);
});
