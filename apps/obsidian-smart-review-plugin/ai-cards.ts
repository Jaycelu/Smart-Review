import type { App } from "obsidian";
import type { ReviewIndex, ReviewItem } from "@obsidian-smart-review/shared";

const DUE_STATES = new Set<ReviewItem["review_state"]>(["overdue", "today"]);

export interface AiReviewCardsPayload {
  generated_at: string;
  vault_name: string;
  source_review_index: string;
  mode: "prompt_payload";
  items: AiReviewCardPrompt[];
}

export interface AiReviewCardPrompt {
  file: string;
  title: string;
  review_state: ReviewItem["review_state"];
  days_delta: number | null;
  source_updated: null;
  prompt: string;
  questions: [];
  summary: "";
  cards: [];
}

export async function buildAiReviewCardsPayload(
  app: App,
  index: ReviewIndex,
  sourceReviewIndexPath: string,
  limit = 10
): Promise<AiReviewCardsPayload> {
  const selectedItems = index.items.filter((item) => DUE_STATES.has(item.review_state)).slice(0, limit);
  const items: AiReviewCardPrompt[] = [];

  for (const item of selectedItems) {
    items.push(await createPromptPayload(app, item));
  }

  return {
    generated_at: new Date().toISOString(),
    vault_name: index.vault_name,
    source_review_index: sourceReviewIndexPath,
    mode: "prompt_payload",
    items
  };
}

async function createPromptPayload(app: App, item: ReviewItem): Promise<AiReviewCardPrompt> {
  const file = app.vault.getFileByPath(item.file);
  const markdown = file === null ? "" : await app.vault.cachedRead(file);
  const content = stripFrontmatter(markdown).trim().slice(0, 12_000);

  return {
    file: item.file,
    title: item.title,
    review_state: item.review_state,
    days_delta: item.days_delta,
    source_updated: null,
    prompt: buildPrompt(item, content),
    questions: [],
    summary: "",
    cards: []
  };
}

function buildPrompt(item: ReviewItem, content: string): string {
  return [
    "你是一个知识复习助手。请基于下面的 Obsidian 笔记生成复习材料。",
    "",
    "要求：",
    "1. 生成 3-5 个主动回忆问题。",
    "2. 生成 1 段 120 字以内的摘要。",
    "3. 生成 3 张知识卡片，每张包含 title、kind、content。",
    "4. 只基于笔记内容，不要编造事实。",
    "5. 输出 JSON，字段为 questions、summary、cards。",
    "",
    `标题：${item.title}`,
    `文件：${item.file}`,
    `复习状态：${item.review_state}`,
    "",
    "笔记内容：",
    content
  ].join("\n");
}

function stripFrontmatter(markdown: string): string {
  if (!markdown.startsWith("---")) {
    return markdown;
  }

  const end = markdown.indexOf("\n---", 3);
  return end === -1 ? markdown : markdown.slice(end + 4);
}
