#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const VALID_RATINGS = new Set(["again", "hard", "good", "easy"]);

function usage() {
  console.log('Usage: node scripts/analyze-review-history.js "/path/to/review-history.jsonl"');
}

const inputPath = process.argv[2];

if (!inputPath) {
  usage();
  process.exit(1);
}

const historyPath = path.resolve(inputPath);

if (!fs.existsSync(historyPath)) {
  console.log(JSON.stringify({
    file: historyPath,
    total_reviews: 0,
    rating_counts: createRatingCounts(),
    daily_counts: {},
    top_reviewed_notes: [],
    latest_reviewed_at: null,
    warnings: [`Review history file not found: ${historyPath}`],
    errors: []
  }, null, 2));
  process.exit(0);
}

const lines = fs.readFileSync(historyPath, "utf8")
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line.length > 0);

const entries = [];
const warnings = [];
const errors = [];

for (const [index, line] of lines.entries()) {
  try {
    const entry = JSON.parse(line);
    const normalized = normalizeEntry(entry);
    if (normalized === null) {
      warnings.push(`Skipped malformed history entry at line ${index + 1}`);
      continue;
    }

    entries.push(normalized);
  } catch (error) {
    errors.push(`Invalid JSON at line ${index + 1}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const ratingCounts = createRatingCounts();
const dailyCounts = new Map();
const noteCounts = new Map();
let latestReviewedAt = null;

for (const entry of entries) {
  ratingCounts[entry.rating] += 1;
  increment(dailyCounts, entry.reviewed_at);
  increment(noteCounts, entry.file);

  if (latestReviewedAt === null || entry.reviewed_at > latestReviewedAt) {
    latestReviewedAt = entry.reviewed_at;
  }
}

console.log(JSON.stringify({
  file: historyPath,
  total_reviews: entries.length,
  rating_counts: ratingCounts,
  daily_counts: toSortedObject(dailyCounts),
  top_reviewed_notes: topEntries(noteCounts, 10),
  latest_reviewed_at: latestReviewedAt,
  warnings,
  errors
}, null, 2));

if (errors.length > 0) {
  process.exit(1);
}

function normalizeEntry(value) {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const reviewedAt = typeof value.reviewed_at === "string" ? value.reviewed_at : null;
  const file = typeof value.file === "string" ? value.file : null;
  const rating = typeof value.rating === "string" && VALID_RATINGS.has(value.rating) ? value.rating : null;

  if (reviewedAt === null || file === null || rating === null) {
    return null;
  }

  return {
    reviewed_at: reviewedAt,
    file,
    rating
  };
}

function createRatingCounts() {
  return {
    again: 0,
    hard: 0,
    good: 0,
    easy: 0
  };
}

function increment(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function toSortedObject(map) {
  return Object.fromEntries([...map.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
}

function topEntries(map, limit) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([file, count]) => ({ file, count }));
}

