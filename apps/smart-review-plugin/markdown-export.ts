import type { ReviewIndex, ReviewItem } from "@smart-review/shared";
import { t, type SmartReviewLocale } from "./i18n";
import { formatLocalDateTime } from "./utils";

export function buildDailyReviewMarkdown(index: ReviewIndex, locale: SmartReviewLocale = "zh"): string {
  const overdue = filterItems(index.items, "overdue");
  const today = filterItems(index.items, "today");
  const next7 = filterItems(index.items, "next_7_days");

  return [
    `# ${t(locale, "dailyTitle")}`,
    "",
    t(locale, "generatedAt", { time: formatLocalDateTime() }),
    "",
    `## ${t(locale, "mdOverdue")}`,
    "",
    renderList(overdue, (item) => {
      const days = item.days_delta === null ? "" : t(locale, "mdOverdueDays", { count: Math.abs(item.days_delta) });
      return `- ${toWikiLink(item)}${days}`;
    }, locale),
    "",
    `## ${t(locale, "mdToday")}`,
    "",
    renderList(today, (item) => `- ${toWikiLink(item)}`, locale),
    "",
    `## ${t(locale, "mdNext7")}`,
    "",
    renderList(next7, (item) => {
      const days = item.days_delta === null ? "" : t(locale, "mdDaysLater", { count: item.days_delta });
      return `- ${toWikiLink(item)}${days}`;
    }, locale),
    ""
  ].join("\n");
}

function filterItems(items: ReviewItem[], state: ReviewItem["review_state"]): ReviewItem[] {
  return items.filter((item) => item.review_state === state);
}

function renderList(items: ReviewItem[], render: (item: ReviewItem) => string, locale: SmartReviewLocale): string {
  if (items.length === 0) {
    return t(locale, "mdEmpty");
  }

  return items.map(render).join("\n");
}

function toWikiLink(item: ReviewItem): string {
  const pathWithoutExt = item.file.replace(/\.md$/i, "");
  const display = item.title.trim();
  return display.length > 0 && display !== pathWithoutExt ? `[[${pathWithoutExt}|${display}]]` : `[[${pathWithoutExt}]]`;
}
