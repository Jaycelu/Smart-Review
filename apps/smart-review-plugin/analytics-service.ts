import type { App, TFile } from "obsidian";
import { getLocalDateString, normalizeDate, type ReviewIndex, type ReviewItem, type ReviewRating } from "@smart-review/shared";
import type { SmartReviewSettings } from "./settings";
import { DEFAULT_SETTINGS } from "./settings";
import { buildHeatmapDays, getDateDaysAgo, incrementDateCount } from "./heatmap";
import { UNCATEGORIZED_DOMAIN, type DistributionItem, type ReviewHistoryDetail, type SmartReviewAnalytics } from "./analytics-types";
import {
  collectTags,
  getOptionalString,
  isAllowedStatus,
  isMissingFileError,
  normalizeOutputPath,
  parseFilterList,
  parseFolderPrefixList,
  type Frontmatter
} from "./utils";

interface ReviewHistoryRecord {
  reviewedAt: string;
  rating: ReviewRating;
  file: string;
  title: string;
  nextReview: string | null;
}

interface VaultMetadataStats {
  activeNotes: number;
  notesWithNextReview: number;
  metadataCompleteness: number;
  creationCountsByDate: Map<string, number>;
}

const RATING_NAMES: ReviewRating[] = ["again", "hard", "good", "easy"];

export async function buildSmartReviewAnalytics(
  app: App,
  settings: SmartReviewSettings,
  index: ReviewIndex
): Promise<SmartReviewAnalytics> {
  const history = await readReviewHistory(app, settings.reviewHistoryPath);
  const today = getLocalDateString();
  const weekStart = getDateDaysAgo(6);
  const reviewCountsByDate = new Map<string, number>();
  const ratingCounts = new Map<string, number>();
  let completedToday = 0;
  let completedThisWeek = 0;

  for (const record of history) {
    incrementDateCount(reviewCountsByDate, record.reviewedAt);
    ratingCounts.set(record.rating, (ratingCounts.get(record.rating) ?? 0) + 1);
    if (record.reviewedAt === today) {
      completedToday += 1;
    }
    if (record.reviewedAt >= weekStart && record.reviewedAt <= today) {
      completedThisWeek += 1;
    }
  }

  const vaultStats = collectVaultMetadataStats(app, settings);
  const dueToday = index.summary.today;
  const overdue = index.summary.overdue;
  const next7Days = index.summary.next_7_days;
  const totalDueAndCompleted = Math.max(dueToday + overdue + completedToday, 1);
  const completionRate = completedToday / totalDueAndCompleted;
  const overdueRate = index.summary.total > 0 ? overdue / index.summary.total : 0;

  return {
    generatedAt: new Date().toISOString(),
    vaultName: index.vault_name,
    overview: {
      today: dueToday,
      overdue,
      next7Days,
      totalReviewItems: index.summary.total,
      completedThisWeek,
      completedToday,
      healthScore: calculateHealthScore(index, vaultStats, history),
      overdueRate
    },
    taskFlow: {
      dueToday,
      overdue,
      completedToday,
      completedThisWeek,
      completionRate
    },
    heatmaps: {
      reviewActivity: buildHeatmapDays(reviewCountsByDate),
      noteCreation: buildHeatmapDays(vaultStats.creationCountsByDate)
    },
    distributions: {
      byDomain: buildDistribution(index.items.map((item) => item.domain ?? UNCATEGORIZED_DOMAIN)),
      byTag: buildDistribution(index.items.flatMap((item) => item.tags)).slice(0, 10),
      byRating: buildDistributionFromCounts(ratingCounts, RATING_NAMES),
      byState: buildDistribution(index.items.map((item) => item.review_state))
    },
    details: {
      reviewHistory: history.map(toReviewHistoryDetail)
    }
  };
}

async function readReviewHistory(app: App, reviewHistoryPath: string): Promise<ReviewHistoryRecord[]> {
  const outputPath = normalizeOutputPath(reviewHistoryPath, DEFAULT_SETTINGS.reviewHistoryPath);

  try {
    const raw = await app.vault.adapter.read(outputPath);
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .flatMap(parseReviewHistoryLine);
  } catch (error) {
    if (isMissingFileError(error)) {
      return [];
    }

    console.warn("Failed to read review history for analytics", error);
    return [];
  }
}

function parseReviewHistoryLine(line: string): ReviewHistoryRecord[] {
  try {
    const parsed = JSON.parse(line) as unknown;
    if (typeof parsed !== "object" || parsed === null) {
      return [];
    }

    const record = parsed as Partial<{ reviewed_at: unknown; rating: unknown; file: unknown; title: unknown; next_review: unknown }>;
    const reviewedAt = normalizeDate(record.reviewed_at);
    const file = getOptionalString(record.file);
    if (reviewedAt === null || !isReviewRating(record.rating)) {
      return [];
    }

    return [{
      reviewedAt,
      rating: record.rating,
      file: file ?? "",
      title: getOptionalString(record.title) ?? file ?? "(untitled)",
      nextReview: normalizeDate(record.next_review)
    }];
  } catch {
    return [];
  }
}

function collectVaultMetadataStats(app: App, settings: SmartReviewSettings): VaultMetadataStats {
  const creationCountsByDate = new Map<string, number>();
  let activeNotes = 0;
  let notesWithNextReview = 0;
  let completenessTotal = 0;

  for (const file of app.vault.getMarkdownFiles()) {
    const cache = app.metadataCache.getFileCache(file);
    const frontmatter = (cache?.frontmatter ?? {}) as Frontmatter;
    if (!shouldIncludeMetadataFile(file, frontmatter, settings)) {
      continue;
    }

    activeNotes += 1;
    if (normalizeDate(frontmatter.next_review) !== null) {
      notesWithNextReview += 1;
    }

    completenessTotal += calculateMetadataCompleteness(frontmatter, file, cache);
    incrementDateCount(creationCountsByDate, getCreationDate(frontmatter, file));
  }

  return {
    activeNotes,
    notesWithNextReview,
    metadataCompleteness: activeNotes > 0 ? completenessTotal / activeNotes : 1,
    creationCountsByDate
  };
}

function shouldIncludeMetadataFile(file: TFile, frontmatter: Frontmatter, settings: SmartReviewSettings): boolean {
  if (settings.ignoreTemplateFolder) {
    const prefixes = parseFolderPrefixList(settings.ignoredFolderPrefixes);
    if (prefixes.some((prefix) => file.path.startsWith(prefix))) {
      return false;
    }
  }

  const status = getOptionalString(frontmatter.status);
  return !settings.ignoreInactive || isAllowedStatus(status, parseFilterList(settings.allowedStatuses));
}

function calculateMetadataCompleteness(frontmatter: Frontmatter, file: TFile, cache: ReturnType<App["metadataCache"]["getFileCache"]>): number {
  const titleComplete = getOptionalString(frontmatter.title) ?? file.basename;
  const domainComplete = getOptionalString(frontmatter.domain);
  const tagsComplete = collectTags(frontmatter.tags, cache).length > 0;
  let score = 0;

  if (titleComplete.trim().length > 0) {
    score += 1;
  }
  if (domainComplete !== undefined) {
    score += 1;
  }
  if (tagsComplete) {
    score += 1;
  }

  return score / 3;
}

function getCreationDate(frontmatter: Frontmatter, file: TFile): string {
  return (
    normalizeDate(frontmatter.created) ??
    normalizeDate(new Date(file.stat.ctime)) ??
    normalizeDate(new Date(file.stat.mtime)) ??
    getLocalDateString()
  );
}

// The health score is a lightweight operations indicator, not a judgment of knowledge quality.
// It combines review coverage, overdue control, recent activity, metadata completeness, and AI card readiness.
function calculateHealthScore(index: ReviewIndex, vaultStats: VaultMetadataStats, history: ReviewHistoryRecord[]): number {
  const reviewCoverage = vaultStats.activeNotes > 0 ? vaultStats.notesWithNextReview / vaultStats.activeNotes : 1;
  const overdueControl = index.summary.total > 0 ? 1 - index.summary.overdue / index.summary.total : 1;
  const recentActivity = history.some((record) => record.reviewedAt >= getDateDaysAgo(6) && record.reviewedAt <= getLocalDateString()) ? 1 : 0;
  const metadataCompleteness = vaultStats.metadataCompleteness;
  const dueItems = index.items.filter((item) => item.review_state === "overdue" || item.review_state === "today");
  const aiCardReadiness = dueItems.length > 0 ? dueItems.filter(isAiCardReady).length / dueItems.length : 1;

  const weighted =
    reviewCoverage * 25 +
    overdueControl * 25 +
    recentActivity * 20 +
    metadataCompleteness * 15 +
    aiCardReadiness * 15;

  return Math.max(0, Math.min(100, Math.round(weighted)));
}

function isAiCardReady(item: ReviewItem): boolean {
  return item.title.trim().length > 0 && item.file.trim().length > 0 && item.next_review !== null;
}

function buildDistribution(values: string[]): DistributionItem[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    const normalized = value.trim();
    if (normalized.length === 0) {
      continue;
    }
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }

  return buildDistributionFromCounts(counts);
}

function buildDistributionFromCounts(counts: Map<string, number>, orderedNames?: string[]): DistributionItem[] {
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  const names = orderedNames ?? [...counts.keys()].sort((left, right) => (counts.get(right) ?? 0) - (counts.get(left) ?? 0) || left.localeCompare(right));

  return names
    .map((name) => {
      const count = counts.get(name) ?? 0;
      return {
        name,
        count,
        ratio: total > 0 ? count / total : 0
      };
    })
    .filter((item) => item.count > 0);
}

function isReviewRating(value: unknown): value is ReviewRating {
  return typeof value === "string" && RATING_NAMES.includes(value as ReviewRating);
}

function toReviewHistoryDetail(record: ReviewHistoryRecord): ReviewHistoryDetail {
  return {
    reviewedAt: record.reviewedAt,
    file: record.file,
    title: record.title,
    rating: record.rating,
    nextReview: record.nextReview
  };
}
