import type { App, TFile } from "obsidian";
import {
  calculateDaysDelta,
  getReviewState,
  normalizeDate,
  summarizeReviewItems,
  type ReviewIndex,
  type ReviewItem
} from "@obsidian-smart-review/shared";
import type { SmartReviewSettings } from "./settings";
import {
  assignOptionalOrder,
  assignOptionalString,
  collectTags,
  createObsidianUri,
  getOptionalString,
  isAllowedStatus,
  parseFilterList,
  parseFolderPrefixList,
  type Frontmatter
} from "./utils";

export function buildReviewIndex(app: App, settings: SmartReviewSettings): ReviewIndex {
  const vaultName = resolveVaultName(app, settings);
  const files = app.vault.getMarkdownFiles();
  const items = files.flatMap((file) => createReviewItem(app, settings, file, vaultName));

  return {
    generated_at: new Date().toISOString(),
    vault_name: vaultName,
    summary: summarizeReviewItems(items),
    items
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
  const frontmatter = (cache?.frontmatter ?? {}) as Frontmatter;
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
    tags: collectTags(frontmatter.tags, cache),
    obsidian_uri: createObsidianUri(vaultName, file.path)
  };

  assignOptionalString(item, "domain", frontmatter.domain);
  assignOptionalString(item, "type", frontmatter.type);
  assignOptionalString(item, "series", frontmatter.series);
  assignOptionalOrder(item, frontmatter.order);
  assignOptionalString(item, "status", frontmatter.status);

  return shouldIncludeItem(settings, item) ? [item] : [];
}

function shouldIgnoreFolder(filePath: string, ignoredFolderPrefixes: string): boolean {
  const prefixes = parseFolderPrefixList(ignoredFolderPrefixes);
  return prefixes.length > 0 && prefixes.some((prefix) => filePath.startsWith(prefix));
}

function shouldIncludeItem(settings: SmartReviewSettings, item: ReviewItem): boolean {
  if (settings.exportScope === "due_only" && !["overdue", "today", "next_7_days"].includes(item.review_state)) {
    return false;
  }

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
