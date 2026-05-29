import { ItemView, Notice, type WorkspaceLeaf } from "obsidian";
import type { ReviewItem, ReviewRating, ReviewState } from "@obsidian-smart-review/shared";
import type SmartReviewPlugin from "./main";
import { REVIEW_RATINGS } from "./settings";
import { formatLocalDateTime } from "./utils";

export const REVIEW_CENTER_VIEW_TYPE = "smart-review-center";

const GROUPS: Array<{ state: ReviewState; title: string; empty: string }> = [
  { state: "overdue", title: "已逾期", empty: "没有逾期任务" },
  { state: "today", title: "今日复习", empty: "今日没有待复习任务" },
  { state: "next_7_days", title: "未来 7 天", empty: "未来 7 天没有复习任务" },
  { state: "future", title: "更远未来", empty: "没有更远未来任务" },
  { state: "invalid", title: "日期无效", empty: "没有日期无效任务" }
];

export class ReviewCenterView extends ItemView {
  constructor(leaf: WorkspaceLeaf, private readonly plugin: SmartReviewPlugin) {
    super(leaf);
  }

  getViewType(): string {
    return REVIEW_CENTER_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Review Center";
  }

  override getIcon(): string {
    return "calendar-check";
  }

  override async onOpen(): Promise<void> {
    this.render();
    if (this.plugin.currentIndex === null) {
      await this.plugin.ensureReviewDataForView();
    }
  }

  render(): void {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("smart-review-center");

    const index = this.plugin.currentIndex;
    this.renderHeader(container, index);
    this.renderActions(container);

    if (this.plugin.lastError !== null) {
      container.createDiv({ cls: "smart-review-error", text: this.plugin.lastError });
    }

    if (index === null) {
      container.createDiv({
        cls: "smart-review-empty",
        text: "还没有扫描数据。点击“刷新数据”开始扫描当前 Vault。"
      });
      return;
    }

    for (const group of GROUPS) {
      this.renderGroup(container, group.title, group.empty, index.items.filter((item) => item.review_state === group.state), group.state);
    }
  }

  private renderHeader(container: HTMLElement, index: SmartReviewPlugin["currentIndex"]): void {
    const header = container.createDiv({ cls: "smart-review-header" });
    header.createEl("h1", { text: "Obsidian Smart Review" });
    header.createEl("p", {
      text: "基于 Properties / YAML frontmatter 的插件内复习中心。",
      cls: "smart-review-subtitle"
    });

    const stats = header.createDiv({ cls: "smart-review-stats" });
    this.renderStat(stats, "今日", index?.summary.today ?? 0, "today");
    this.renderStat(stats, "逾期", index?.summary.overdue ?? 0, "overdue");
    this.renderStat(stats, "未来 7 天", index?.summary.next_7_days ?? 0, "next");
    this.renderStat(stats, "全部", index?.summary.total ?? 0, "total");

    header.createDiv({
      cls: "smart-review-generated-at",
      text: index === null ? "最近生成时间：尚未生成" : `最近生成时间：${formatLocalDateTime(new Date(index.generated_at))}`
    });
  }

  private renderStat(container: HTMLElement, label: string, value: number, tone: string): void {
    const stat = container.createDiv({ cls: `smart-review-stat smart-review-stat-${tone}` });
    stat.createDiv({ cls: "smart-review-stat-value", text: String(value) });
    stat.createDiv({ cls: "smart-review-stat-label", text: label });
  }

  private renderActions(container: HTMLElement): void {
    const actions = container.createDiv({ cls: "smart-review-actions" });
    this.renderActionButton(actions, "刷新数据", async () => {
      await this.plugin.refreshReviewData({ writeIndex: false, notice: true });
    });
    this.renderActionButton(actions, "重新生成 review-index.json", () => this.plugin.generateReviewIndex());
    this.renderActionButton(actions, "生成今日复习 Markdown", () => this.plugin.generateDailyReviewMarkdown());
    this.renderActionButton(actions, "生成 AI 卡片 Payload", () => this.plugin.generateAiReviewCardsPayload());
    this.renderActionButton(actions, "打开插件设置", () => {
      const appWithSettings = this.app as typeof this.app & {
        setting?: { open(): void; openTabById(id: string): void };
      };
      appWithSettings.setting?.open();
      appWithSettings.setting?.openTabById(this.plugin.manifest.id);
    });

    container.createDiv({
      cls: "smart-review-feedback-help",
      text: "复习反馈：点击重来 / 困难 / 掌握 / 简单后，会立即更新该笔记的 next_review 和复习字段，并追加 review-history.jsonl。"
    });
  }

  private renderActionButton(container: HTMLElement, text: string, callback: () => void | Promise<void>): void {
    const button = container.createEl("button", { text, cls: "smart-review-action-button" });
    button.onclick = () => {
      void callback();
    };
  }

  private renderGroup(container: HTMLElement, title: string, empty: string, items: ReviewItem[], state: ReviewState): void {
    const section = container.createDiv({ cls: `smart-review-group smart-review-group-${state}` });
    const heading = section.createDiv({ cls: "smart-review-group-heading" });
    heading.createEl("h2", { text: title });
    heading.createSpan({ cls: "smart-review-group-count", text: String(items.length) });

    if (items.length === 0) {
      section.createDiv({ cls: "smart-review-empty smart-review-empty-inline", text: empty });
      return;
    }

    const list = section.createDiv({ cls: "smart-review-task-list" });
    for (const item of items) {
      this.renderTask(list, item);
    }
  }

  private renderTask(container: HTMLElement, item: ReviewItem): void {
    const task = container.createDiv({ cls: `smart-review-task smart-review-task-${item.review_state}` });
    const main = task.createDiv({ cls: "smart-review-task-main" });
    const titleRow = main.createDiv({ cls: "smart-review-task-title-row" });
    const title = titleRow.createEl("button", { text: item.title, cls: "smart-review-task-title" });
    title.onclick = async () => {
      const file = this.app.vault.getFileByPath(item.file);
      if (file === null) {
        new Notice(`Note not found: ${item.file}`);
        return;
      }
      await this.app.workspace.getLeaf(false).openFile(file);
    };
    titleRow.createSpan({ cls: `smart-review-state smart-review-state-${item.review_state}`, text: stateLabel(item) });

    main.createDiv({ cls: "smart-review-task-path", text: item.file });
    const meta = main.createDiv({ cls: "smart-review-task-meta" });
    renderMeta(meta, "下次", item.next_review ?? "无效");
    renderMeta(meta, "差值", item.days_delta === null ? "invalid" : String(item.days_delta));
    renderMeta(meta, "领域", item.domain);
    renderMeta(meta, "类型", item.type);
    renderMeta(meta, "系列", item.series);

    if (item.tags.length > 0) {
      const tags = main.createDiv({ cls: "smart-review-tags" });
      const visibleTags = item.tags.slice(0, 4);
      for (const tag of visibleTags) {
        tags.createSpan({ cls: "smart-review-tag", text: tag });
      }
      if (item.tags.length > visibleTags.length) {
        tags.createSpan({ cls: "smart-review-tag smart-review-tag-more", text: `+${item.tags.length - visibleTags.length}` });
      }
    }

    const feedback = task.createDiv({ cls: "smart-review-feedback" });
    feedback.createDiv({ cls: "smart-review-feedback-label", text: "本次复习结果" });
    const buttons = feedback.createDiv({ cls: "smart-review-feedback-buttons" });
    for (const rating of REVIEW_RATINGS) {
      const button = buttons.createEl("button", {
        cls: `smart-review-rating smart-review-rating-${rating}`
      });
      button.setAttr("title", ratingTooltip(rating));
      button.createSpan({ cls: "smart-review-rating-label", text: ratingLabel(rating) });
      button.createSpan({ cls: "smart-review-rating-subtitle", text: ratingSubtitle(rating) });
      button.onclick = async () => {
        await this.plugin.reviewFileByPath(item.file, rating);
      };
    }
  }
}

function renderMeta(container: HTMLElement, label: string, value: string | undefined): void {
  if (value === undefined || value.trim().length === 0) {
    return;
  }

  const item = container.createSpan({ cls: "smart-review-meta-item" });
  item.createSpan({ cls: "smart-review-meta-label", text: label });
  item.createSpan({ cls: "smart-review-meta-value", text: value });
}

function ratingLabel(rating: ReviewRating): string {
  if (rating === "again") {
    return "重来";
  }
  if (rating === "hard") {
    return "困难";
  }
  if (rating === "easy") {
    return "简单";
  }
  return "掌握";
}

function ratingSubtitle(rating: ReviewRating): string {
  if (rating === "again") {
    return "Again";
  }
  if (rating === "hard") {
    return "Hard";
  }
  if (rating === "easy") {
    return "Easy";
  }
  return "Good";
}

function ratingTooltip(rating: ReviewRating): string {
  if (rating === "again") {
    return "没有掌握，安排短间隔复习，并增加 lapse 计数。";
  }
  if (rating === "hard") {
    return "比较吃力，安排较短间隔复习。";
  }
  if (rating === "easy") {
    return "很轻松，安排更长间隔复习。";
  }
  return "正常掌握，按默认间隔重复算法安排下一次复习。";
}

function stateLabel(item: ReviewItem): string {
  if (item.review_state === "overdue" && item.days_delta !== null) {
    return `逾期 ${Math.abs(item.days_delta)} 天`;
  }

  if (item.review_state === "today") {
    return "今日";
  }

  if (item.review_state === "next_7_days" && item.days_delta !== null) {
    return `${item.days_delta} 天后`;
  }

  if (item.review_state === "future" && item.days_delta !== null) {
    return `${item.days_delta} 天后`;
  }

  return "日期无效";
}
