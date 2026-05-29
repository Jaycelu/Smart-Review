import type { App, TFile } from "obsidian";
import {
  calculateNextReviewDate,
  calculateSpacedReview,
  getLocalDateString,
  normalizeDate,
  type ReviewRating
} from "@smart-review/shared";
import type { SmartReviewSettings } from "./settings";
import {
  ensureParentFolder,
  getNextReviewCount,
  getNextReviewLapses,
  getOptionalNumber,
  getOptionalString,
  isMissingFileError,
  normalizeOutputPath,
  sleep,
  type Frontmatter
} from "./utils";

export interface ReviewHistoryEntry {
  reviewed_at: string;
  file: string;
  title: string;
  rating: ReviewRating;
  previous_next_review: string | null;
  next_review: string;
  interval_days: number;
  ease: number;
  review_count: number;
  review_lapses: number;
}

export interface ReviewActionResult {
  nextReview: string;
  historyEntry: ReviewHistoryEntry;
}

export async function markFileReviewed(
  app: App,
  settings: SmartReviewSettings,
  file: TFile,
  rating: ReviewRating
): Promise<ReviewActionResult> {
  const reviewedAt = getLocalDateString();
  let historyEntry: ReviewHistoryEntry | null = null;
  let nextReview: string | null = null;

  await app.fileManager.processFrontMatter(file, (frontmatter: Frontmatter) => {
    const reviewResult = calculateSpacedReview({
      rating,
      currentIntervalDays: getOptionalNumber(frontmatter.review_interval_days),
      currentEase: getOptionalNumber(frontmatter.review_ease),
      defaultIntervalDays: settings.reviewIntervalDays
    });
    nextReview = calculateNextReviewDate(reviewedAt, reviewResult.intervalDays);
    if (nextReview === null) {
      throw new Error("Invalid next review date.");
    }

    const reviewCount = getNextReviewCount(frontmatter.review_count);
    const reviewLapses = getNextReviewLapses(frontmatter.review_lapses, reviewResult.lapseDelta);
    const previousNextReview = normalizeDate(frontmatter.next_review);

    frontmatter.last_reviewed = reviewedAt;
    frontmatter.next_review = nextReview;
    frontmatter.review_count = reviewCount;
    frontmatter.review_rating = rating;
    frontmatter.review_interval_days = reviewResult.intervalDays;
    frontmatter.review_ease = reviewResult.ease;
    frontmatter.review_lapses = reviewLapses;
    reorderReviewFrontmatter(frontmatter);

    historyEntry = {
      reviewed_at: reviewedAt,
      file: file.path,
      title: getOptionalString(frontmatter.title) ?? file.basename,
      rating,
      previous_next_review: previousNextReview,
      next_review: nextReview,
      interval_days: reviewResult.intervalDays,
      ease: reviewResult.ease,
      review_count: reviewCount,
      review_lapses: reviewLapses
    };
  });

  if (historyEntry === null || nextReview === null) {
    throw new Error("Review action did not produce a result.");
  }

  if (settings.enableReviewHistory) {
    await appendReviewHistory(app, settings.reviewHistoryPath, historyEntry);
  }

  await waitForFrontmatterValue(app, file, "next_review", nextReview);

  return { nextReview, historyEntry };
}

function reorderReviewFrontmatter(frontmatter: Frontmatter): void {
  const originalEntries = Object.entries(frontmatter);
  const valueByKey = new Map(originalEntries);
  const tagsValue = valueByKey.get("tags");
  const hasTags = valueByKey.has("tags");
  const reviewKeys = [
    "last_reviewed",
    "review_rating",
    "review_interval_days",
    "review_count",
    "review_ease",
    "review_lapses"
  ];
  const orderedKeys: string[] = [];
  const pushed = new Set<string>();

  for (const [key] of originalEntries) {
    if (key === "tags" || reviewKeys.includes(key)) {
      continue;
    }

    orderedKeys.push(key);
    pushed.add(key);

    if (key === "next_review") {
      for (const reviewKey of reviewKeys) {
        if (valueByKey.has(reviewKey)) {
          orderedKeys.push(reviewKey);
          pushed.add(reviewKey);
        }
      }
    }
  }

  if (!pushed.has("next_review")) {
    for (const reviewKey of reviewKeys) {
      if (valueByKey.has(reviewKey) && !pushed.has(reviewKey)) {
        orderedKeys.push(reviewKey);
        pushed.add(reviewKey);
      }
    }
  }

  for (const [key] of originalEntries) {
    if (key !== "tags" && !pushed.has(key)) {
      orderedKeys.push(key);
      pushed.add(key);
    }
  }

  if (hasTags) {
    orderedKeys.push("tags");
  }

  for (const key of Object.keys(frontmatter)) {
    delete frontmatter[key];
  }

  for (const key of orderedKeys) {
    frontmatter[key] = key === "tags" ? tagsValue : valueByKey.get(key);
  }
}

async function appendReviewHistory(app: App, reviewHistoryPath: string, entry: ReviewHistoryEntry): Promise<void> {
  const outputPath = normalizeOutputPath(reviewHistoryPath, "review-history.jsonl");
  const line = `${JSON.stringify(entry)}\n`;
  await ensureParentFolder(app.vault.adapter, outputPath);

  try {
    const current = await app.vault.adapter.read(outputPath);
    await app.vault.adapter.write(outputPath, `${current.replace(/\s*$/, "\n")}${line}`);
  } catch (error) {
    if (!isMissingFileError(error)) {
      throw error;
    }

    await app.vault.adapter.write(outputPath, line);
  }
}

async function waitForFrontmatterValue(app: App, file: TFile, key: string, expectedValue: string): Promise<void> {
  const deadline = Date.now() + 2_000;

  while (Date.now() < deadline) {
    const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter as Frontmatter | undefined;
    if (getOptionalString(frontmatter?.[key]) === expectedValue) {
      return;
    }

    await sleep(100);
  }
}
