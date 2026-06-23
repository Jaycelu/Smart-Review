import type { ReviewState } from "@smart-review/shared";

export const UNCATEGORIZED_DOMAIN = "__uncategorized__";

export interface SmartReviewAnalytics {
  generatedAt: string;
  vaultName: string;
  overview: {
    today: number;
    overdue: number;
    next7Days: number;
    totalReviewItems: number;
    completedThisWeek: number;
    completedToday: number;
    healthScore: number;
    overdueRate: number;
  };
  taskFlow: {
    dueToday: number;
    overdue: number;
    completedToday: number;
    completedThisWeek: number;
    completionRate: number;
  };
  heatmaps: {
    reviewActivity: HeatmapDay[];
    noteCreation: HeatmapDay[];
  };
  distributions: {
    byDomain: DistributionItem[];
    byTag: DistributionItem[];
    byRating: DistributionItem[];
    byState: DistributionItem[];
  };
  details: {
    reviewHistory: ReviewHistoryDetail[];
    noteCreation: NoteCreationDetail[];
  };
}

export interface HeatmapDay {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface DistributionItem {
  name: string;
  count: number;
  ratio: number;
}

export interface ReviewHistoryDetail {
  reviewedAt: string;
  file: string;
  title: string;
  rating: string;
  nextReview: string | null;
}

export interface NoteCreationDetail {
  date: string;
  file: string;
  title: string;
}

export type ReviewStateDistributionName = ReviewState | "unknown";
