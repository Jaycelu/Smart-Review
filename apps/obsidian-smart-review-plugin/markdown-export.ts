import type { ReviewIndex, ReviewItem } from "@obsidian-smart-review/shared";
import { formatLocalDateTime } from "./utils";

export function buildDailyReviewMarkdown(index: ReviewIndex): string {
  const overdue = filterItems(index.items, "overdue");
  const today = filterItems(index.items, "today");
  const next7 = filterItems(index.items, "next_7_days");

  return [
    "# 今日复习",
    "",
    `生成时间：${formatLocalDateTime()}`,
    "",
    "## 已逾期",
    "",
    renderList(overdue, (item) => {
      const days = item.days_delta === null ? "" : `：逾期 ${Math.abs(item.days_delta)} 天`;
      return `- ${toWikiLink(item)}${days}`;
    }),
    "",
    "## 今日",
    "",
    renderList(today, (item) => `- ${toWikiLink(item)}`),
    "",
    "## 未来 7 天",
    "",
    renderList(next7, (item) => {
      const days = item.days_delta === null ? "" : `：${item.days_delta} 天后`;
      return `- ${toWikiLink(item)}${days}`;
    }),
    ""
  ].join("\n");
}

function filterItems(items: ReviewItem[], state: ReviewItem["review_state"]): ReviewItem[] {
  return items.filter((item) => item.review_state === state);
}

function renderList(items: ReviewItem[], render: (item: ReviewItem) => string): string {
  if (items.length === 0) {
    return "- 暂无";
  }

  return items.map(render).join("\n");
}

function toWikiLink(item: ReviewItem): string {
  const pathWithoutExt = item.file.replace(/\.md$/i, "");
  const display = item.title.trim();
  return display.length > 0 && display !== pathWithoutExt ? `[[${pathWithoutExt}|${display}]]` : `[[${pathWithoutExt}]]`;
}
