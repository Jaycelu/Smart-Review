import type { App, TFile } from "obsidian";
import {
  calculateDaysDelta,
  getReviewState,
  normalizeDate,
  summarizeReviewItems,
  type ReviewIndex,
  type ReviewItem,
  type ReviewLifecycleStatus
} from "@smart-review/shared";
import type { SmartReviewSettings } from "./settings";
import {
  assignOptionalOrder,
  assignOptionalString,
  collectTags,
  createObsidianUri,
  getOptionalString,
  getOptionalNumber,
  isAllowedStatus,
  parseFilterList,
  parseFolderPrefixList,
  type Frontmatter
} from "./utils";

export function buildReviewIndex(app: App, settings: SmartReviewSettings): ReviewIndex {
  const vaultName = resolveVaultName(app, settings);
  const files = app.vault.getMarkdownFiles();
  const allItems = files.flatMap((file) => createReviewItem(app, settings, file, vaultName));
  const items = allItems.filter((item) => item.review_status === "active" && shouldIncludeExportScope(settings, item));

  return {
    generated_at: new Date().toISOString(),
    vault_name: vaultName,
    summary: summarizeReviewItems(items),
    items,
    paused_items: allItems.filter((item) => item.review_status === "paused"),
    mastery_pending_items: allItems.filter((item) => item.review_status === "mastery_pending"),
    mastered_items: allItems.filter((item) => item.review_status === "mastered")
  };
}

export function resolveVaultName(app: App, settings: SmartReviewSettings): string {
  const configured = settings.vaultName.trim();
  return configured.length > 0 ? configured : app.vault.getName();
}

function createReviewItem(app: App, settings: SmartReviewSettings, file: TFile, vaultName: string): ReviewItem[] {
  if (settings.ignoreTemplateFolder && shouldIgnoreFolder(file.path, settings.ignoredFolderPrefixes)) {
    return [];
  }

  const cache = app.metadataCache.getFileCache(file);
  const frontmatter: Frontmatter = cache?.frontmatter ?? {};
  const status = getOptionalString(frontmatter.status);

  if (settings.ignoreInactive && !isAllowedStatus(status, parseFilterList(settings.allowedStatuses))) {
    return [];
  }

  const nextReview = normalizeDate(frontmatter.next_review);
  const daysDelta = nextReview === null ? null : calculateDaysDelta(nextReview);
  const item: ReviewItem = {
    title: getOptionalString(frontmatter.title) ?? file.basename,
    file: file.path,
    next_review: nextReview,
    review_state: getReviewState(daysDelta),
    days_delta: daysDelta,
    review_status: normalizeReviewStatus(frontmatter.review_status),
    tags: collectTags(frontmatter.tags, cache),
    obsidian_uri: createObsidianUri(vaultName, file.path)
  };

  assignOptionalString(item, "domain", frontmatter.domain);
  assignOptionalString(item, "type", frontmatter.type);
  assignOptionalString(item, "series", frontmatter.series);
  assignOptionalOrder(item, frontmatter.order);
  assignOptionalString(item, "status", frontmatter.status);
  assignOptionalString(item, "review_resume_at", frontmatter.review_resume_at);
  assignOptionalString(item, "review_mastery_recheck_at", frontmatter.review_mastery_recheck_at);
  assignOptionalString(item, "review_mastery_record", frontmatter.review_mastery_record);
  const reviewCount = getOptionalNumber(frontmatter.review_count);
  if (reviewCount !== null) item.review_count = reviewCount;
  const reviewInterval = getOptionalNumber(frontmatter.review_interval_days);
  if (reviewInterval !== null) item.review_interval_days = reviewInterval;
  const rating = getOptionalString(frontmatter.review_rating);
  if (rating === "again" || rating === "hard" || rating === "good" || rating === "easy") item.review_rating = rating;

  return shouldIncludeItem(settings, item) ? [item] : [];
}

function shouldIgnoreFolder(filePath: string, ignoredFolderPrefixes: string): boolean {
  const prefixes = parseFolderPrefixList(ignoredFolderPrefixes);
  return prefixes.length > 0 && prefixes.some((prefix) => filePath.startsWith(prefix));
}

function shouldIncludeItem(settings: SmartReviewSettings, item: ReviewItem): boolean {
  const includedTypes = parseFilterList(settings.includedTypes);
  if (includedTypes.length > 0 && !includedTypes.includes(item.type ?? "")) {
    return false;
  }

  const domainFilter = parseFilterList(settings.domainFilter);
  if (domainFilter.length > 0 && !domainFilter.includes(item.domain ?? "")) {
    return false;
  }

  const tagFilter = parseFilterList(settings.tagFilter);
  if (tagFilter.length > 0 && !item.tags.some((tag) => tagFilter.includes(tag))) {
    return false;
  }

  return true;
}

function shouldIncludeExportScope(settings: SmartReviewSettings, item: ReviewItem): boolean {
  return settings.exportScope !== "due_only" || ["overdue", "today", "next_7_days"].includes(item.review_state);
}

function normalizeReviewStatus(value: unknown): ReviewLifecycleStatus {
  return value === "paused" || value === "mastery_pending" || value === "mastered" ? value : "active";
}
