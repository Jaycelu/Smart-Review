import type { App, TFile } from "obsidian";
import { getLocalDateString } from "@smart-review/shared";
import type { Frontmatter } from "./utils";

export type PauseDuration = 30 | 90 | "indefinite";

export async function pauseReview(app: App, file: TFile, duration: PauseDuration, customResumeAt?: string): Promise<void> {
  const pausedAt = getLocalDateString();
  const resumeAt = customResumeAt ?? (duration === "indefinite" ? null : addDays(pausedAt, duration));

  await app.fileManager.processFrontMatter(file, (frontmatter: Frontmatter) => {
    frontmatter.review_status = "paused";
    frontmatter.review_paused_at = pausedAt;
    if (resumeAt === null) {
      delete frontmatter.review_resume_at;
    } else {
      frontmatter.review_resume_at = resumeAt;
    }
  });
}

export async function resumeReview(app: App, file: TFile): Promise<void> {
  await app.fileManager.processFrontMatter(file, (frontmatter: Frontmatter) => {
    frontmatter.review_status = "active";
    frontmatter.next_review = getLocalDateString();
    delete frontmatter.review_paused_at;
    delete frontmatter.review_resume_at;
    delete frontmatter.review_mastery_recheck_at;
    delete frontmatter.review_mastered_at;
  });
}

export async function markMasteryPending(app: App, file: TFile, recordLink: string): Promise<void> {
  const reviewedAt = getLocalDateString();
  await app.fileManager.processFrontMatter(file, (frontmatter: Frontmatter) => {
    frontmatter.review_status = "mastery_pending";
    frontmatter.review_mastery_recheck_at = addDays(reviewedAt, 30);
    frontmatter.review_mastery_record = recordLink;
    delete frontmatter.review_paused_at;
    delete frontmatter.review_resume_at;
  });
}

export async function markMastered(app: App, file: TFile, recordLink: string): Promise<void> {
  await app.fileManager.processFrontMatter(file, (frontmatter: Frontmatter) => {
    frontmatter.review_status = "mastered";
    frontmatter.review_mastered_at = getLocalDateString();
    frontmatter.review_mastery_record = recordLink;
    delete frontmatter.review_mastery_recheck_at;
    delete frontmatter.review_paused_at;
    delete frontmatter.review_resume_at;
  });
}

export async function linkMasteryRecord(app: App, file: TFile, recordLink: string): Promise<void> {
  await app.fileManager.processFrontMatter(file, (frontmatter: Frontmatter) => {
    frontmatter.review_mastery_record = recordLink;
  });
}

export async function returnToReview(app: App, file: TFile, days = 7): Promise<void> {
  const today = getLocalDateString();
  await app.fileManager.processFrontMatter(file, (frontmatter: Frontmatter) => {
    frontmatter.review_status = "active";
    frontmatter.next_review = addDays(today, days);
    delete frontmatter.review_mastery_recheck_at;
  });
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  return `${value.getFullYear().toString().padStart(4, "0")}-${(value.getMonth() + 1).toString().padStart(2, "0")}-${value.getDate().toString().padStart(2, "0")}`;
}
