#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const VALID_STATES = new Set(["overdue", "today", "next_7_days", "future", "invalid"]);

function usage() {
  console.log('Usage: node scripts/audit-review-index.js "/path/to/review-index.json"');
}

const inputPath = process.argv[2];

if (!inputPath) {
  usage();
  process.exit(1);
}

const reviewIndexPath = path.resolve(inputPath);

if (!fs.existsSync(reviewIndexPath)) {
  console.error(`Error: review-index.json not found: ${reviewIndexPath}`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(reviewIndexPath, "utf8"));
const items = Array.isArray(data.items) ? data.items : [];
const summary = data.summary ?? {};
const warnings = [];
const errors = [];

const stateCounts = createStateCounts();
const statusCounts = new Map();
const domainCounts = new Map();
const typeCounts = new Map();
const emptyTailTags = [];
const templateItems = [];
const invalidItems = [];
const malformedUris = [];

for (const item of items) {
  if (!VALID_STATES.has(item.review_state)) {
    errors.push(`Invalid review_state for ${item.file ?? item.title ?? "(unknown item)"}`);
    continue;
  }

  stateCounts[item.review_state] += 1;
  increment(statusCounts, item.status ?? "(empty)");
  increment(domainCounts, item.domain ?? "(empty)");
  increment(typeCounts, item.type ?? "(empty)");

  if (item.review_state === "invalid") {
    invalidItems.push(item);
  }

  if (typeof item.file === "string" && item.file.startsWith("99-模板/")) {
    templateItems.push(item);
  }

  if (Array.isArray(item.tags)) {
    for (const tag of item.tags) {
      if (typeof tag === "string" && tag.endsWith("/")) {
        emptyTailTags.push({ file: item.file, title: item.title, tag });
      }
    }
  }

  if (typeof item.obsidian_uri !== "string" || !item.obsidian_uri.startsWith("obsidian://open?")) {
    malformedUris.push({ file: item.file, title: item.title, obsidian_uri: item.obsidian_uri });
  }
}

stateCounts.total = items.length;

for (const key of ["overdue", "today", "next_7_days", "future", "invalid", "total"]) {
  if (summary[key] !== stateCounts[key]) {
    errors.push(`Summary mismatch: ${key} expected ${stateCounts[key]}, got ${summary[key]}`);
  }
}

if (emptyTailTags.length > 0) {
  warnings.push(`Found ${emptyTailTags.length} empty tail tags, for example ${emptyTailTags[0].tag}`);
}

if (templateItems.length > 0) {
  warnings.push(`Found ${templateItems.length} template items under 99-模板/`);
}

if (malformedUris.length > 0) {
  errors.push(`Found ${malformedUris.length} malformed obsidian_uri values`);
}

console.log(JSON.stringify({
  file: reviewIndexPath,
  generated_at: data.generated_at,
  vault_name: data.vault_name,
  summary,
  recomputed_summary: stateCounts,
  status_counts: toObject(statusCounts),
  top_domains: topEntries(domainCounts, 10),
  type_counts: toObject(typeCounts),
  invalid_count: invalidItems.length,
  template_item_count: templateItems.length,
  empty_tail_tag_count: emptyTailTags.length,
  malformed_uri_count: malformedUris.length,
  sample_invalid: invalidItems.slice(0, 5).map(toSample),
  sample_empty_tail_tags: emptyTailTags.slice(0, 5),
  warnings,
  errors
}, null, 2));

if (errors.length > 0) {
  process.exit(1);
}

function createStateCounts() {
  return {
    overdue: 0,
    today: 0,
    next_7_days: 0,
    future: 0,
    invalid: 0,
    total: 0
  };
}

function increment(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function toObject(map) {
  return Object.fromEntries([...map.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
}

function topEntries(map, limit) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

function toSample(item) {
  return {
    title: item.title,
    file: item.file,
    next_review: item.next_review,
    status: item.status,
    tags: item.tags
  };
}
