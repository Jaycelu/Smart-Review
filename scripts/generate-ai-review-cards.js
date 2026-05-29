#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const DUE_STATES = new Set(["overdue", "today", "next_7_days"]);

function usage() {
  console.log('Usage: node scripts/generate-ai-review-cards.js "/path/to/vault" "/path/to/review-index.json" [output.json] [limit]');
}

const [vaultArg, indexArg, outputArg, limitArg] = process.argv.slice(2);

if (!vaultArg || !indexArg) {
  usage();
  process.exit(1);
}

const vaultPath = path.resolve(vaultArg);
const indexPath = path.resolve(indexArg);
const outputPath = path.resolve(outputArg ?? path.join(vaultPath, "review-ai-cards.json"));
const limit = parseLimit(limitArg);

if (!fs.existsSync(vaultPath) || !fs.statSync(vaultPath).isDirectory()) {
  console.error(`Error: vault path not found or not a directory: ${vaultPath}`);
  process.exit(1);
}

if (!fs.existsSync(indexPath)) {
  console.error(`Error: review-index.json not found: ${indexPath}`);
  process.exit(1);
}

const reviewIndex = JSON.parse(fs.readFileSync(indexPath, "utf8"));
const items = Array.isArray(reviewIndex.items) ? reviewIndex.items : [];
const selectedItems = items
  .filter((item) => DUE_STATES.has(item.review_state))
  .slice(0, limit);

const output = {
  generated_at: new Date().toISOString(),
  vault_name: reviewIndex.vault_name ?? path.basename(vaultPath),
  source_review_index: indexPath,
  mode: "prompt_payload",
  items: selectedItems.map((item) => createPromptPayload(vaultPath, item))
};

fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({
  output: outputPath,
  item_count: output.items.length,
  mode: output.mode
}, null, 2));

function createPromptPayload(vaultPath, item) {
  const notePath = path.join(vaultPath, item.file);
  const markdown = fs.existsSync(notePath) ? fs.readFileSync(notePath, "utf8") : "";
  const content = stripFrontmatter(markdown).trim().slice(0, 12_000);

  return {
    file: item.file,
    title: item.title,
    review_state: item.review_state,
    days_delta: item.days_delta,
    source_updated: item.updated ?? null,
    prompt: buildPrompt(item, content),
    questions: [],
    summary: "",
    cards: []
  };
}

function buildPrompt(item, content) {
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

function stripFrontmatter(markdown) {
  if (!markdown.startsWith("---")) {
    return markdown;
  }

  const end = markdown.indexOf("\n---", 3);
  return end === -1 ? markdown : markdown.slice(end + 4);
}

function parseLimit(value) {
  const parsed = Number(value ?? 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 10;
}

