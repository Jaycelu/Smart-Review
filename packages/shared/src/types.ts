export type ReviewState = "overdue" | "today" | "next_7_days" | "future" | "invalid";
export type ReviewRating = "again" | "hard" | "good" | "easy";

export interface ReviewItem {
  title: string;
  file: string;
  next_review: string | null;
  review_state: ReviewState;
  days_delta: number | null;
  domain?: string;
  type?: string;
  series?: string;
  order?: number | string;
  status?: string;
  tags: string[];
  obsidian_uri: string;
}

export interface ReviewSummary {
  overdue: number;
  today: number;
  next_7_days: number;
  future: number;
  invalid: number;
  total: number;
}

export interface ReviewIndex {
  generated_at: string;
  vault_name: string;
  summary: ReviewSummary;
  items: ReviewItem[];
}

export interface SpacedReviewInput {
  rating: ReviewRating;
  currentIntervalDays?: number | null;
  currentEase?: number | null;
  defaultIntervalDays?: number;
  intervalRules?: Partial<ReviewIntervalRules>;
}

export interface ReviewIntervalRules {
  againIntervalDays: number;
  hardMultiplier: number;
  goodMultiplier: number;
  easyMultiplier: number;
}

export interface SpacedReviewResult {
  rating: ReviewRating;
  intervalDays: number;
  ease: number;
  lapseDelta: number;
}
