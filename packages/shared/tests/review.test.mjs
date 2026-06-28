import test from "node:test";
import assert from "node:assert/strict";
import { calculateSpacedReview, createEmptySummary, getReviewState, summarizeReviewItems } from "../dist/review.js";

test("getReviewState maps day deltas to states", () => {
  assert.equal(getReviewState(null), "invalid");
  assert.equal(getReviewState(-1), "overdue");
  assert.equal(getReviewState(0), "today");
  assert.equal(getReviewState(7), "next_7_days");
  assert.equal(getReviewState(8), "future");
});

test("summarizeReviewItems counts review states and total", () => {
  const items = [
    createItem("overdue"),
    createItem("today"),
    createItem("next_7_days"),
    createItem("future"),
    createItem("invalid"),
    createItem("overdue")
  ];

  assert.deepEqual(summarizeReviewItems(items), {
    overdue: 2,
    today: 1,
    next_7_days: 1,
    future: 1,
    invalid: 1,
    total: 6
  });
});

test("createEmptySummary returns zero counts", () => {
  assert.deepEqual(createEmptySummary(), {
    overdue: 0,
    today: 0,
    next_7_days: 0,
    future: 0,
    invalid: 0,
    total: 0
  });
});

test("calculateSpacedReview maps ratings to intervals and ease", () => {
  assert.deepEqual(
    calculateSpacedReview({ rating: "again", currentIntervalDays: 30, currentEase: 2.5 }),
    { rating: "again", intervalDays: 1, ease: 2.3, lapseDelta: 1 }
  );

  assert.deepEqual(
    calculateSpacedReview({ rating: "hard", currentIntervalDays: 30, currentEase: 2.5 }),
    { rating: "hard", intervalDays: 36, ease: 2.45, lapseDelta: 0 }
  );

  assert.deepEqual(
    calculateSpacedReview({ rating: "good", currentIntervalDays: 30, currentEase: 2.5 }),
    { rating: "good", intervalDays: 75, ease: 2.5, lapseDelta: 0 }
  );

  assert.deepEqual(
    calculateSpacedReview({ rating: "easy", currentIntervalDays: 30, currentEase: 2.5 }),
    { rating: "easy", intervalDays: 98, ease: 2.65, lapseDelta: 0 }
  );
});

test("calculateSpacedReview uses defaults for new notes", () => {
  assert.deepEqual(
    calculateSpacedReview({ rating: "good", defaultIntervalDays: 7 }),
    { rating: "good", intervalDays: 18, ease: 2.5, lapseDelta: 0 }
  );
});

test("calculateSpacedReview applies configurable rating rules", () => {
  const intervalRules = {
    againIntervalDays: 2,
    hardMultiplier: 1.5,
    goodMultiplier: 0.8,
    easyMultiplier: 1.6
  };

  assert.equal(calculateSpacedReview({ rating: "again", currentIntervalDays: 30, intervalRules }).intervalDays, 2);
  assert.equal(calculateSpacedReview({ rating: "hard", currentIntervalDays: 30, intervalRules }).intervalDays, 45);
  assert.equal(calculateSpacedReview({ rating: "good", currentIntervalDays: 30, currentEase: 2.5, intervalRules }).intervalDays, 60);
  assert.equal(calculateSpacedReview({ rating: "easy", currentIntervalDays: 30, currentEase: 2.5, intervalRules }).intervalDays, 120);
});

test("calculateSpacedReview falls back for invalid configurable rules", () => {
  const intervalRules = {
    againIntervalDays: 0,
    hardMultiplier: Number.NaN,
    goodMultiplier: -1,
    easyMultiplier: 0
  };

  assert.equal(calculateSpacedReview({ rating: "again", currentIntervalDays: 30, intervalRules }).intervalDays, 1);
  assert.equal(calculateSpacedReview({ rating: "hard", currentIntervalDays: 30, intervalRules }).intervalDays, 36);
  assert.equal(calculateSpacedReview({ rating: "good", currentIntervalDays: 30, currentEase: 2.5, intervalRules }).intervalDays, 75);
  assert.equal(calculateSpacedReview({ rating: "easy", currentIntervalDays: 30, currentEase: 2.5, intervalRules }).intervalDays, 98);
});

function createItem(reviewState) {
  return {
    title: reviewState,
    file: `${reviewState}.md`,
    next_review: null,
    review_state: reviewState,
    days_delta: null,
    tags: [],
    obsidian_uri: `obsidian://open?vault=test&file=${reviewState}.md`
  };
}
