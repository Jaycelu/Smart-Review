import type { CachedMetadata } from "obsidian";
import { normalizePath } from "obsidian";
import type { ReviewItem } from "@smart-review/shared";
import { DEFAULT_SETTINGS } from "./settings";

export type Frontmatter = Record<string, unknown>;

export function toFrontmatter(value: unknown): Frontmatter {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Frontmatter) : {};
}

export function getOptionalString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return undefined;
}

export function getOptionalNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function assignOptionalString<T extends "domain" | "type" | "series" | "status" | "review_resume_at" | "review_mastery_recheck_at" | "review_mastery_record">(
  item: ReviewItem,
  key: T,
  value: unknown
): void {
  const stringValue = getOptionalString(value);
  if (stringValue !== undefined) {
    item[key] = stringValue;
  }
}

export function assignOptionalOrder(item: ReviewItem, value: unknown): void {
  if (typeof value === "number" || typeof value === "string") {
    item.order = value;
  }
}

export function isAllowedStatus(status: string | undefined, allowedStatuses: string[]): boolean {
  const normalizedStatus = (status ?? "").trim().toLowerCase();
  if (normalizedStatus.length === 0) {
    return true;
  }

  return allowedStatuses.map((value) => value.toLowerCase()).includes(normalizedStatus);
}

export function collectTags(frontmatterTags: unknown, cache: CachedMetadata | null): string[] {
  const tags = new Set<string>();

  for (const tag of normalizeFrontmatterTags(frontmatterTags)) {
    const normalized = normalizeTag(tag);
    if (normalized !== null) {
      tags.add(normalized);
    }
  }

  for (const tagCache of cache?.tags ?? []) {
    const normalized = normalizeTag(tagCache.tag);
    if (normalized !== null) {
      tags.add(normalized);
    }
  }

  return [...tags].sort((a, b) => a.localeCompare(b));
}

export function normalizeFrontmatterTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((tag) => getOptionalString(tag)).filter((tag): tag is string => tag !== undefined);
  }

  if (typeof value === "string") {
    return value
      .split(/[,\s]+/)
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
  }

  return [];
}

export function normalizeTag(tag: string): string | null {
  const normalized = tag.trim().replace(/^#/, "");
  if (normalized.length === 0 || normalized.endsWith("/")) {
    return null;
  }

  return normalized;
}

export function createObsidianUri(vaultName: string, filePath: string): string {
  return `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(filePath)}`;
}

export function normalizeOutputPath(outputPath: string, fallback = DEFAULT_SETTINGS.outputPath): string {
  const trimmed = normalizePath(outputPath.trim().replace(/^\/+/, ""));
  return trimmed.length > 0 ? trimmed : fallback;
}

export function parseFilterList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function parseFolderPrefixList(value: string): string[] {
  return parseFilterList(value).map((item) => {
    const normalized = normalizePath(item.replace(/^\/+/, ""));
    return normalized.endsWith("/") ? normalized : `${normalized}/`;
  });
}

export function isMissingFileError(error: unknown): boolean {
  if (error instanceof Error) {
    return /not found|no such file|does not exist/i.test(error.message);
  }

  return /not found|no such file|does not exist/i.test(String(error));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function ensureParentFolder(adapter: { exists(path: string): Promise<boolean>; mkdir(path: string): Promise<void> }, filePath: string): Promise<void> {
  const normalized = normalizePath(filePath);
  const slashIndex = normalized.lastIndexOf("/");
  if (slashIndex <= 0) {
    return;
  }

  const folderPath = normalized.slice(0, slashIndex);
  if (await adapter.exists(folderPath)) {
    return;
  }

  const parts = folderPath.split("/");
  let current = "";
  for (const part of parts) {
    current = current.length === 0 ? part : `${current}/${part}`;
    if (!(await adapter.exists(current))) {
      await adapter.mkdir(current);
    }
  }
}

export function getNextReviewCount(value: unknown): number {
  const current = typeof value === "number" ? value : Number(value);
  return Number.isInteger(current) && current >= 0 ? current + 1 : 1;
}

export function getNextReviewLapses(value: unknown, lapseDelta: number): number {
  const current = typeof value === "number" ? value : Number(value);
  const existing = Number.isInteger(current) && current >= 0 ? current : 0;
  return existing + lapseDelta;
}

export function formatLocalDateTime(date = new Date()): string {
  const year = date.getFullYear().toString().padStart(4, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const hour = date.getHours().toString().padStart(2, "0");
  const minute = date.getMinutes().toString().padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}`;
}
