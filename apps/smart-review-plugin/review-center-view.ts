import { ItemView, Notice, type WorkspaceLeaf } from "obsidian";
import type { ReviewItem, ReviewRating, ReviewState } from "@smart-review/shared";
import { UNCATEGORIZED_DOMAIN, type DistributionItem, type HeatmapDay, type NoteCreationDetail, type ReviewHistoryDetail, type SmartReviewAnalytics } from "./analytics-types";
import { t, type SmartReviewLocale, type SmartReviewTranslationKey } from "./i18n";
import type SmartReviewPlugin from "./main";
import { REVIEW_RATINGS } from "./settings";
import { formatLocalDateTime } from "./utils";

export const REVIEW_CENTER_VIEW_TYPE = "smart-review-center";

interface PlanGroup {
  state: Extract<ReviewState, "overdue" | "today" | "next_7_days">;
  title: SmartReviewTranslationKey;
  empty: SmartReviewTranslationKey;
  limit: number;
  defaultCollapsed: boolean;
}

const PLAN_GROUPS: PlanGroup[] = [
  { state: "overdue", title: "overdueGroup", empty: "overdueEmpty", limit: 5, defaultCollapsed: false },
  { state: "today", title: "todayGroup", empty: "todayEmpty", limit: 5, defaultCollapsed: false },
  { state: "next_7_days", title: "next7Group", empty: "next7Empty", limit: 5, defaultCollapsed: true }
];

type DrilldownKind = "domain" | "tag" | "rating";
type HeatmapKind = "review" | "creation";

interface DrilldownSelection {
  kind: DrilldownKind;
  name: string;
}

interface HeatmapSelection {
  kind: HeatmapKind;
  date: string;
}

export class ReviewCenterView extends ItemView {
  private readonly expandedGroups = new Set<ReviewState>();
  private selectedDrilldown: DrilldownSelection | null = null;
  private drilldownExpanded = false;
  private selectedHeatmap: HeatmapSelection | null = null;
  private heatmapExpanded = false;

  constructor(leaf: WorkspaceLeaf, private readonly plugin: SmartReviewPlugin) {
    super(leaf);
  }

  getViewType(): string {
    return REVIEW_CENTER_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Smart Review Center";
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
    const analytics = this.plugin.currentAnalytics;
    this.renderHeader(container, index);

    if (this.plugin.lastError !== null) {
      container.createDiv({ cls: "smart-review-error", text: this.plugin.lastError });
    }

    if (index === null) {
      container.createDiv({
        cls: "smart-review-empty-state",
        text: t(this.plugin.locale, "noScanData")
      });
      return;
    }

    this.renderReviewPlan(container, index.items);

    if (analytics === null) {
      container.createDiv({
        cls: "smart-review-empty-state",
        text: t(this.plugin.locale, "analyticsWaiting")
      });
      return;
    }

    this.renderMetrics(container, analytics);
    this.renderTaskFlow(container, analytics);
    this.renderHeatmapSection(container, t(this.plugin.locale, "reviewHeatmapTitle"), t(this.plugin.locale, "reviewHeatmapSubtitle"), analytics.heatmaps.reviewActivity, t(this.plugin.locale, "reviewUnit"), "review", analytics);
    this.renderHeatmapSection(container, t(this.plugin.locale, "creationHeatmapTitle"), t(this.plugin.locale, "creationHeatmapSubtitle"), analytics.heatmaps.noteCreation, t(this.plugin.locale, "creationUnit"), "creation", analytics);
    this.renderDistributions(container, analytics);
  }

  private renderHeader(container: HTMLElement, index: SmartReviewPlugin["currentIndex"]): void {
    const header = container.createDiv({ cls: "smart-review-header" });
    const copy = header.createDiv({ cls: "smart-review-header-copy" });
    copy.createEl("h1", { text: t(this.plugin.locale, "centerTitle") });
    copy.createEl("p", {
      text: t(this.plugin.locale, "centerSubtitle"),
      cls: "smart-review-subtitle"
    });

    const actionsWrap = header.createDiv({ cls: "smart-review-header-actions" });
    actionsWrap.createDiv({
      cls: "smart-review-last-sync",
      text: index === null ? t(this.plugin.locale, "lastSyncEmpty") : t(this.plugin.locale, "lastSync", { time: formatLocalDateTime(new Date(index.generated_at)) })
    });

    const actions = actionsWrap.createDiv({ cls: "smart-review-action-row" });
    this.renderActionButton(actions, t(this.plugin.locale, "refresh"), async () => {
      await this.plugin.refreshReviewData({ writeIndex: true, notice: true });
    });
    this.renderActionButton(actions, t(this.plugin.locale, "settings"), () => {
      const appWithSettings = this.app as typeof this.app & {
        setting?: { open(): void; openTabById(id: string): void };
      };
      appWithSettings.setting?.open();
      appWithSettings.setting?.openTabById(this.plugin.manifest.id);
    });
  }

  private renderActionButton(container: HTMLElement, text: string, callback: () => void | Promise<void>): void {
    const button = container.createEl("button", { text, cls: "smart-review-action-button" });
    button.onclick = () => {
      void callback();
    };
  }

  private renderReviewPlan(container: HTMLElement, items: ReviewItem[]): void {
    const section = container.createDiv({ cls: "smart-review-plan-section" });
    this.renderSectionHeading(section, t(this.plugin.locale, "planTitle"), t(this.plugin.locale, "planSubtitle"));

    const dueCount = items.filter((item) => item.review_state === "overdue" || item.review_state === "today").length;
    if (dueCount === 0) {
      section.createDiv({
        cls: "smart-review-empty-state smart-review-empty-state-soft",
        text: t(this.plugin.locale, "noDueToday")
      });
    }

    for (const group of PLAN_GROUPS) {
      this.renderPlanGroup(section, group, items.filter((item) => item.review_state === group.state));
    }
  }

  private renderPlanGroup(container: HTMLElement, group: PlanGroup, items: ReviewItem[]): void {
    const section = container.createDiv({ cls: `smart-review-plan-group smart-review-plan-group-${group.state}` });
    const heading = section.createDiv({ cls: "smart-review-plan-group-heading" });
    const titleWrap = heading.createDiv({ cls: "smart-review-plan-group-title" });
    titleWrap.createEl("h3", { text: t(this.plugin.locale, group.title) });
    titleWrap.createSpan({ cls: "smart-review-subtle-badge", text: String(items.length) });

    const shouldCollapse = group.defaultCollapsed || items.length > group.limit;
    const expanded = this.expandedGroups.has(group.state);
    if (shouldCollapse && items.length > 0) {
      const toggle = heading.createEl("button", {
        cls: "smart-review-link-button",
        text: expanded ? t(this.plugin.locale, "collapse") : t(this.plugin.locale, "expandAll")
      });
      toggle.onclick = () => {
        if (expanded) {
          this.expandedGroups.delete(group.state);
        } else {
          this.expandedGroups.add(group.state);
        }
        this.render();
      };
    }

    if (items.length === 0) {
      section.createDiv({ cls: "smart-review-empty-state smart-review-empty-inline", text: t(this.plugin.locale, group.empty) });
      return;
    }

    const list = section.createDiv({ cls: "smart-review-plan-list" });
    const visibleItems = shouldCollapse && !expanded ? items.slice(0, group.defaultCollapsed ? 0 : group.limit) : items;
    if (visibleItems.length === 0) {
      list.createDiv({ cls: "smart-review-empty-state smart-review-empty-inline", text: t(this.plugin.locale, "collapsedHint") });
      return;
    }

    for (const item of visibleItems) {
      this.renderPlanItem(list, item);
    }
  }

  private renderPlanItem(container: HTMLElement, item: ReviewItem): void {
    const task = container.createDiv({ cls: `smart-review-plan-item smart-review-plan-item-${item.review_state}` });
    const main = task.createDiv({ cls: "smart-review-plan-main" });
    const titleRow = main.createDiv({ cls: "smart-review-plan-title-row" });
    const title = titleRow.createEl("button", { text: item.title, cls: "smart-review-task-title" });
    title.onclick = async () => {
      const file = this.app.vault.getFileByPath(item.file);
      if (file === null) {
        new Notice(t(this.plugin.locale, "noteNotFound", { path: item.file }));
        return;
      }
      await this.app.workspace.getLeaf(false).openFile(file);
    };
    titleRow.createSpan({ cls: `smart-review-state smart-review-state-${item.review_state}`, text: stateLabel(this.plugin.locale, item) });

    main.createDiv({ cls: "smart-review-task-path", text: item.file });
    const meta = main.createDiv({ cls: "smart-review-plan-meta" });
    renderMeta(meta, "next_review", item.next_review ?? t(this.plugin.locale, "invalid"));
    renderMeta(meta, "days_delta", item.days_delta === null ? "invalid" : String(item.days_delta));
    renderMeta(meta, "domain", item.domain);

    if (item.tags.length > 0) {
      const tags = main.createDiv({ cls: "smart-review-tags" });
      const visibleTags = item.tags.slice(0, 4);
      for (const tag of visibleTags) {
        tags.createSpan({ cls: "smart-review-tag", text: tag, attr: { title: tag } });
      }
      if (item.tags.length > visibleTags.length) {
        tags.createSpan({ cls: "smart-review-tag smart-review-tag-more", text: `+${item.tags.length - visibleTags.length}` });
      }
    }

    const feedback = task.createDiv({ cls: "smart-review-rating-actions" });
    for (const rating of REVIEW_RATINGS) {
      const button = feedback.createEl("button", {
        cls: `smart-review-rating smart-review-rating-${rating}`,
        text: ratingText(rating)
      });
      button.setAttr("title", ratingTooltip(this.plugin.locale, rating));
      button.onclick = async () => {
        await this.plugin.reviewFileByPath(item.file, rating);
      };
    }
  }

  private renderMetrics(container: HTMLElement, analytics: SmartReviewAnalytics): void {
    const grid = container.createDiv({ cls: "smart-review-metrics-grid" });
    this.renderMetricCard(grid, t(this.plugin.locale, "todayMetric"), analytics.overview.today, t(this.plugin.locale, "todayMetricDesc"));
    this.renderMetricCard(grid, t(this.plugin.locale, "overdueMetric"), analytics.overview.overdue, t(this.plugin.locale, "overdueRate", { value: formatPercent(analytics.overview.overdueRate) }));
    this.renderMetricCard(grid, t(this.plugin.locale, "weekDoneMetric"), analytics.overview.completedThisWeek, t(this.plugin.locale, "completedToday", { count: analytics.overview.completedToday }));
    this.renderMetricCard(grid, t(this.plugin.locale, "healthMetric"), analytics.overview.healthScore, t(this.plugin.locale, "healthDesc"), analytics.overview.healthScore / 100);
  }

  private renderMetricCard(container: HTMLElement, label: string, value: number, description: string, progress?: number): void {
    const card = container.createDiv({ cls: "smart-review-metric-card" });
    card.createDiv({ cls: "smart-review-metric-value", text: String(value) });
    card.createDiv({ cls: "smart-review-metric-label", text: label });
    card.createDiv({ cls: "smart-review-metric-description", text: description });
    if (progress !== undefined) {
      this.renderProgress(card, progress);
    }
  }

  private renderTaskFlow(container: HTMLElement, analytics: SmartReviewAnalytics): void {
    const section = container.createDiv({ cls: "smart-review-task-flow" });
    this.renderSectionHeading(
      section,
      t(this.plugin.locale, "taskFlowTitle"),
      t(this.plugin.locale, "taskFlowDesc", { today: analytics.taskFlow.dueToday, overdue: analytics.taskFlow.overdue, week: analytics.taskFlow.completedThisWeek })
    );
    const row = section.createDiv({ cls: "smart-review-task-flow-row" });
    row.createDiv({ cls: "smart-review-task-flow-value", text: formatPercent(analytics.taskFlow.completionRate) });
    this.renderProgress(row, analytics.taskFlow.completionRate);
  }

  private renderHeatmapSection(container: HTMLElement, title: string, subtitle: string, days: HeatmapDay[], unit: string, kind: HeatmapKind, analytics: SmartReviewAnalytics): void {
    const section = container.createDiv({ cls: "smart-review-heatmap-section" });
    this.renderSectionHeading(section, title, subtitle);

    if (!days.some((day) => day.count > 0)) {
      section.createDiv({ cls: "smart-review-empty-state smart-review-empty-inline", text: t(this.plugin.locale, "noChartData") });
    }

    const viewport = section.createDiv({ cls: "smart-review-heatmap-viewport" });
    const months = viewport.createDiv({ cls: "smart-review-heatmap-months" });
    for (const month of getMonthLabels(this.plugin.locale, days)) {
      const label = months.createSpan({ text: month.label });
      label.setAttr("style", `grid-column: ${month.week + 1};`);
    }

    const heatmap = viewport.createDiv({ cls: "smart-review-heatmap" });
    for (const [index, day] of days.entries()) {
      const selected = this.selectedHeatmap?.kind === kind && this.selectedHeatmap.date === day.date;
      const cell = heatmap.createEl("button", {
        cls: `smart-review-heatmap-cell smart-review-heatmap-level-${day.level}${selected ? " smart-review-heatmap-cell-selected" : ""}`
      });
      cell.setAttr("style", `grid-column: ${Math.floor(index / 7) + 1}; grid-row: ${(index % 7) + 1};`);
      cell.setAttr("type", "button");
      cell.setAttr("title", `${day.date}: ${day.count} ${unit}`);
      cell.setAttr("aria-label", `${day.date}: ${day.count} ${unit}. ${t(this.plugin.locale, "heatmapClickHint")}`);
      cell.setAttr("data-tooltip", `${day.date}\A${day.count} ${unit}\A${t(this.plugin.locale, "heatmapClickHint")}`);
      cell.onclick = () => {
        this.selectedHeatmap = selected ? null : { kind, date: day.date };
        this.heatmapExpanded = false;
        this.render();
        if (!selected) {
          this.focusHeatmapDetailAfterRender();
        }
      };
    }

    this.renderHeatmapDrilldown(section, kind, analytics);
  }

  private renderHeatmapDrilldown(container: HTMLElement, kind: HeatmapKind, analytics: SmartReviewAnalytics): void {
    if (this.selectedHeatmap === null || this.selectedHeatmap.kind !== kind) {
      return;
    }

    const rows = getHeatmapRows(this.selectedHeatmap, analytics);
    const panel = container.createDiv({ cls: "smart-review-drilldown-panel smart-review-heatmap-detail-panel" });
    panel.setAttr("tabindex", "-1");
    const header = panel.createDiv({ cls: "smart-review-drilldown-header" });
    const title = header.createDiv({ cls: "smart-review-drilldown-title" });
    title.createEl("h3", { text: getHeatmapDrilldownTitle(this.plugin.locale, this.selectedHeatmap) });
    title.createSpan({ cls: "smart-review-subtle-badge", text: t(this.plugin.locale, "detailCount", { count: rows.length }) });

    const actions = header.createDiv({ cls: "smart-review-drilldown-actions" });
    if (rows.length > 10) {
      const toggle = actions.createEl("button", {
        cls: "smart-review-link-button",
        text: this.heatmapExpanded ? t(this.plugin.locale, "collapse") : t(this.plugin.locale, "expandAll")
      });
      toggle.onclick = () => {
        this.heatmapExpanded = !this.heatmapExpanded;
        this.render();
        this.focusHeatmapDetailAfterRender();
      };
    }

    const close = actions.createEl("button", { cls: "smart-review-link-button", text: t(this.plugin.locale, "close") });
    close.onclick = () => {
      this.selectedHeatmap = null;
      this.heatmapExpanded = false;
      this.render();
    };

    if (rows.length === 0) {
      panel.createDiv({ cls: "smart-review-empty-state smart-review-empty-inline", text: t(this.plugin.locale, "noDetailRecords") });
      return;
    }

    const list = panel.createDiv({ cls: "smart-review-drilldown-list" });
    for (const row of this.heatmapExpanded ? rows : rows.slice(0, 10)) {
      this.renderDrilldownRow(list, row);
    }
  }

  private renderDistributions(container: HTMLElement, analytics: SmartReviewAnalytics): void {
    const grid = container.createDiv({ cls: "smart-review-distributions-grid" });
    this.renderDistributionCard(grid, t(this.plugin.locale, "domainDistribution"), analytics.distributions.byDomain, "domain");
    this.renderDistributionCard(grid, t(this.plugin.locale, "ratingDistribution"), analytics.distributions.byRating, "rating");
    this.renderDistributionCard(grid, t(this.plugin.locale, "tagDistribution"), analytics.distributions.byTag, "tag");
    this.renderDrilldown(container, analytics);
  }

  private renderDistributionCard(container: HTMLElement, title: string, items: DistributionItem[], kind: DrilldownKind): void {
    const card = container.createDiv({ cls: "smart-review-distribution-card" });
    card.createEl("h3", { text: title });
    if (items.length === 0) {
      card.createDiv({ cls: "smart-review-empty-state smart-review-empty-inline", text: t(this.plugin.locale, "noData") });
      return;
    }

    const displayPercents = getDisplayPercents(items);
    for (const item of items) {
      const selected = this.selectedDrilldown?.kind === kind && this.selectedDrilldown.name === item.name;
      const row = card.createEl("button", {
        cls: `smart-review-distribution-row${selected ? " smart-review-distribution-row-selected" : ""}`
      });
      const displayName = getDistributionDisplayName(this.plugin.locale, item.name);
      row.setAttr("title", t(this.plugin.locale, "viewDetail", { name: displayName }));
      row.onclick = () => {
        this.selectedDrilldown = selected ? null : { kind, name: item.name };
        this.drilldownExpanded = false;
        this.render();
        if (!selected) {
          this.focusDrilldownAfterRender();
        }
      };
      const label = row.createDiv({ cls: "smart-review-distribution-label" });
      label.createSpan({ cls: "smart-review-distribution-name", text: displayName, attr: { title: displayName } });
      label.createSpan({ cls: "smart-review-distribution-count", text: `${item.count} · ${displayPercents.get(item.name) ?? formatPercent(item.ratio)}` });
      this.renderProgress(row, item.ratio);
    }
  }

  private renderDrilldown(container: HTMLElement, analytics: SmartReviewAnalytics): void {
    if (this.selectedDrilldown === null || this.plugin.currentIndex === null) {
      return;
    }

    const selection = this.selectedDrilldown;
    const panel = container.createDiv({ cls: "smart-review-drilldown-panel" });
    panel.setAttr("tabindex", "-1");
    const header = panel.createDiv({ cls: "smart-review-drilldown-header" });
    const title = header.createDiv({ cls: "smart-review-drilldown-title" });
    title.createEl("h3", { text: getDrilldownTitle(this.plugin.locale, selection) });

    const rows = getDrilldownRows(selection, this.plugin.currentIndex.items, analytics.details.reviewHistory);
    title.createSpan({ cls: "smart-review-subtle-badge", text: t(this.plugin.locale, "detailCount", { count: rows.length }) });

    const actions = header.createDiv({ cls: "smart-review-drilldown-actions" });
    if (rows.length > 10) {
      const toggle = actions.createEl("button", {
        cls: "smart-review-link-button",
        text: this.drilldownExpanded ? t(this.plugin.locale, "collapse") : t(this.plugin.locale, "expandAll")
      });
      toggle.onclick = () => {
        this.drilldownExpanded = !this.drilldownExpanded;
        this.render();
      };
    }

    const close = actions.createEl("button", { cls: "smart-review-link-button", text: t(this.plugin.locale, "close") });
    close.onclick = () => {
      this.selectedDrilldown = null;
      this.drilldownExpanded = false;
      this.render();
    };

    if (rows.length === 0) {
      panel.createDiv({ cls: "smart-review-empty-state smart-review-empty-inline", text: t(this.plugin.locale, "noDetailRecords") });
      return;
    }

    const list = panel.createDiv({ cls: "smart-review-drilldown-list" });
    for (const row of this.drilldownExpanded ? rows : rows.slice(0, 10)) {
      this.renderDrilldownRow(list, row);
    }
  }

  private renderDrilldownRow(container: HTMLElement, row: ReviewItem | ReviewHistoryDetail | NoteCreationDetail): void {
    const item = container.createDiv({ cls: "smart-review-drilldown-row" });
    const main = item.createDiv({ cls: "smart-review-drilldown-main" });
    const title = main.createEl("button", { text: row.title, cls: "smart-review-task-title" });
    title.onclick = async () => {
      if (row.file.trim().length === 0) {
        new Notice(t(this.plugin.locale, "missingHistoryPath"));
        return;
      }

      const file = this.app.vault.getFileByPath(row.file);
      if (file === null) {
        new Notice(t(this.plugin.locale, "noteNotFound", { path: row.file }));
        return;
      }
      await this.app.workspace.getLeaf(false).openFile(file);
    };

    main.createDiv({ cls: "smart-review-task-path", text: row.file || t(this.plugin.locale, "noFilePath") });
    const meta = main.createDiv({ cls: "smart-review-plan-meta" });
    if ("review_state" in row) {
      renderMeta(meta, t(this.plugin.locale, "statusLabel"), stateLabel(this.plugin.locale, row));
      renderMeta(meta, "next_review", row.next_review ?? t(this.plugin.locale, "invalid"));
      renderMeta(meta, "domain", row.domain);
    } else if ("reviewedAt" in row) {
      renderMeta(meta, t(this.plugin.locale, "reviewedAt"), row.reviewedAt);
      renderMeta(meta, t(this.plugin.locale, "rating"), row.rating);
      renderMeta(meta, "next_review", row.nextReview ?? t(this.plugin.locale, "noRecord"));
    } else {
      renderMeta(meta, t(this.plugin.locale, "createdAt"), row.date);
    }
  }

  private focusDrilldownAfterRender(): void {
    window.setTimeout(() => {
      const container = this.containerEl.children[1] as HTMLElement;
      const panel = container.querySelector<HTMLElement>(".smart-review-drilldown-panel");
      if (panel === null) {
        return;
      }

      panel.addClass("smart-review-drilldown-panel-focus");
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
      panel.focus({ preventScroll: true });
      window.setTimeout(() => {
        panel.removeClass("smart-review-drilldown-panel-focus");
      }, 1_200);
    }, 0);
  }

  private focusHeatmapDetailAfterRender(): void {
    window.setTimeout(() => {
      const container = this.containerEl.children[1] as HTMLElement;
      const panel = container.querySelector<HTMLElement>(".smart-review-heatmap-detail-panel");
      if (panel === null) {
        return;
      }

      panel.addClass("smart-review-drilldown-panel-focus");
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
      panel.focus({ preventScroll: true });
      window.setTimeout(() => {
        panel.removeClass("smart-review-drilldown-panel-focus");
      }, 1_200);
    }, 0);
  }

  private renderSectionHeading(container: HTMLElement, title: string, subtitle: string): void {
    const heading = container.createDiv({ cls: "smart-review-section-heading" });
    heading.createEl("h2", { text: title });
    heading.createEl("p", { text: subtitle });
  }

  private renderProgress(container: HTMLElement, ratio: number): void {
    const progress = container.createDiv({ cls: "smart-review-progress" });
    const fill = progress.createDiv({ cls: "smart-review-progress-fill" });
    fill.setAttr("style", `width: ${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%;`);
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

function ratingText(rating: ReviewRating): string {
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

function ratingTooltip(locale: SmartReviewLocale, rating: ReviewRating): string {
  if (rating === "again") {
    return t(locale, "ratingAgainTip");
  }
  if (rating === "hard") {
    return t(locale, "ratingHardTip");
  }
  if (rating === "easy") {
    return t(locale, "ratingEasyTip");
  }
  return t(locale, "ratingGoodTip");
}

function stateLabel(locale: SmartReviewLocale, item: ReviewItem): string {
  if (item.review_state === "overdue" && item.days_delta !== null) {
    return t(locale, "overdueDays", { count: Math.abs(item.days_delta) });
  }

  if (item.review_state === "today") {
    return t(locale, "dueToday");
  }

  if (item.review_state === "next_7_days" && item.days_delta !== null) {
    return t(locale, "daysLater", { count: item.days_delta });
  }

  return t(locale, "invalid");
}

function formatPercent(value: number): string {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

function getDisplayPercents(items: DistributionItem[]): Map<string, string> {
  const ratioSum = items.reduce((sum, item) => sum + item.ratio, 0);
  if (ratioSum < 0.98 || ratioSum > 1.02) {
    return new Map(items.map((item) => [item.name, formatPercent(item.ratio)]));
  }

  const raw = items.map((item) => ({
    name: item.name,
    floor: Math.floor(item.ratio * 100),
    remainder: item.ratio * 100 - Math.floor(item.ratio * 100)
  }));
  let remaining = 100 - raw.reduce((sum, item) => sum + item.floor, 0);
  const sorted = [...raw].sort((left, right) => right.remainder - left.remainder);
  const extraByName = new Map<string, number>();

  for (const item of sorted) {
    if (remaining <= 0) {
      break;
    }
    extraByName.set(item.name, (extraByName.get(item.name) ?? 0) + 1);
    remaining -= 1;
  }

  return new Map(raw.map((item) => [item.name, `${item.floor + (extraByName.get(item.name) ?? 0)}%`]));
}

function getDrilldownTitle(locale: SmartReviewLocale, selection: DrilldownSelection): string {
  const name = getDistributionDisplayName(locale, selection.name);
  if (selection.kind === "domain") {
    return t(locale, "domainDetail", { name });
  }
  if (selection.kind === "tag") {
    return t(locale, "tagDetail", { name });
  }
  return t(locale, "ratingDetail", { name });
}

function getDrilldownRows(
  selection: DrilldownSelection,
  items: ReviewItem[],
  history: ReviewHistoryDetail[]
): Array<ReviewItem | ReviewHistoryDetail> {
  if (selection.kind === "domain") {
    return items.filter((item) => (item.domain ?? UNCATEGORIZED_DOMAIN) === selection.name);
  }

  if (selection.kind === "tag") {
    return items.filter((item) => item.tags.includes(selection.name));
  }

  return history
    .filter((entry) => entry.rating === selection.name)
    .sort((left, right) => right.reviewedAt.localeCompare(left.reviewedAt));
}

function getHeatmapRows(selection: HeatmapSelection, analytics: SmartReviewAnalytics): Array<ReviewHistoryDetail | NoteCreationDetail> {
  if (selection.kind === "review") {
    return analytics.details.reviewHistory
      .filter((entry) => entry.reviewedAt === selection.date)
      .sort((left, right) => left.title.localeCompare(right.title));
  }

  return analytics.details.noteCreation
    .filter((entry) => entry.date === selection.date)
    .sort((left, right) => left.title.localeCompare(right.title));
}

function getHeatmapDrilldownTitle(locale: SmartReviewLocale, selection: HeatmapSelection): string {
  if (selection.kind === "review") {
    return t(locale, "reviewDayDetail", { date: selection.date });
  }

  return t(locale, "creationDayDetail", { date: selection.date });
}

function getDistributionDisplayName(locale: SmartReviewLocale, name: string): string {
  return name === UNCATEGORIZED_DOMAIN ? t(locale, "uncategorized") : name;
}

function getMonthLabels(locale: SmartReviewLocale, days: HeatmapDay[]): Array<{ label: string; week: number }> {
  const labels: Array<{ label: string; week: number }> = [];
  let lastMonth = "";
  for (const [index, day] of days.entries()) {
    const month = day.date.slice(5, 7);
    if (month !== lastMonth) {
      labels.push({ label: formatMonthLabel(locale, day.date), week: Math.floor(index / 7) });
      lastMonth = month;
    }
  }
  return labels;
}

function formatMonthLabel(locale: SmartReviewLocale, dateString: string): string {
  const [, month = "1"] = dateString.split("-");
  if (locale === "zh") {
    return `${Number(month)}月`;
  }

  return new Intl.DateTimeFormat("en", { month: "short" }).format(new Date(2026, Number(month) - 1, 1));
}
