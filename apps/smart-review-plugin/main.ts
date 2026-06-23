import { Notice, Plugin, type TFile } from "obsidian";
import type { ReviewIndex, ReviewRating } from "@smart-review/shared";
import { buildAiReviewCardsPayload } from "./ai-cards";
import { buildSmartReviewAnalytics } from "./analytics-service";
import type { SmartReviewAnalytics } from "./analytics-types";
import { resolveSmartReviewLocale, t, type SmartReviewLocale } from "./i18n";
import { buildDailyReviewMarkdown } from "./markdown-export";
import { markFileReviewed } from "./review-actions";
import { ReviewCenterView, REVIEW_CENTER_VIEW_TYPE } from "./review-center-view";
import { buildReviewIndex } from "./scanner";
import { DEFAULT_SETTINGS, REVIEW_RATINGS, SmartReviewSettingTab, type SmartReviewSettings } from "./settings";
import { SmartReviewStatusBar } from "./status-bar";
import { ensureParentFolder, isMissingFileError, normalizeOutputPath } from "./utils";

export default class SmartReviewPlugin extends Plugin {
  settings: SmartReviewSettings = DEFAULT_SETTINGS;
  currentIndex: ReviewIndex | null = null;
  currentAnalytics: SmartReviewAnalytics | null = null;
  lastError: string | null = null;
  private refreshTimer: ReturnType<typeof window.setTimeout> | null = null;
  private statusBar: SmartReviewStatusBar | null = null;
  private startupScanCompleted = false;

  override async onload(): Promise<void> {
    await this.loadSettings();

    this.registerView(REVIEW_CENTER_VIEW_TYPE, (leaf) => new ReviewCenterView(leaf, this));
    this.statusBar = new SmartReviewStatusBar(this.addStatusBarItem(), () => {
      void this.openReviewCenter();
    });
    this.updateStatusBar();

    this.addRibbonIcon("calendar-check", t(this.locale, "openCenter"), () => {
      void this.openReviewCenter();
    });

    this.addCommand({
      id: "open-review-center",
      name: t(this.locale, "openCenter"),
      callback: () => {
        void this.openReviewCenter();
      }
    });

    this.addCommand({
      id: "generate-review-data",
      name: t(this.locale, "generateWidgetData"),
      callback: () => {
        void this.generateReviewIndex();
      }
    });

    this.addCommand({
      id: "refresh-review-data",
      name: t(this.locale, "refreshData"),
      callback: () => {
        void this.refreshReviewData({ writeIndex: false, notice: true });
      }
    });

    this.addCommand({
      id: "mark-current-note-reviewed",
      name: t(this.locale, "markCurrentReviewed"),
      callback: () => {
        void this.markCurrentNoteReviewed(this.settings.defaultReviewRating);
      }
    });

    for (const rating of REVIEW_RATINGS) {
      this.addCommand({
        id: `mark-current-note-reviewed-${rating}`,
        name: `Mark Current Note Reviewed: ${rating}`,
        callback: () => {
          void this.markCurrentNoteReviewed(rating);
        }
      });
    }

    this.addCommand({
      id: "generate-daily-review-markdown",
      name: t(this.locale, "generateDailyMarkdown"),
      callback: () => {
        void this.generateDailyReviewMarkdown();
      }
    });

    this.addCommand({
      id: "generate-ai-review-cards-payload",
      name: t(this.locale, "generateAiCards"),
      callback: () => {
        void this.generateAiReviewCardsPayload();
      }
    });

    this.addSettingTab(new SmartReviewSettingTab(this.app, this));
    this.registerAutoRefreshEvents();
    void this.loadReviewIndexSnapshot();
    this.registerStartupScan();
  }

  override onunload(): void {
    if (this.refreshTimer !== null) {
      window.clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  async loadSettings(): Promise<void> {
    const loaded = (await this.loadData()) as Partial<SmartReviewSettings> | null;
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...loaded
    };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  get locale(): SmartReviewLocale {
    return resolveSmartReviewLocale(this.settings.language);
  }

  async openReviewCenter(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(REVIEW_CENTER_VIEW_TYPE)[0];
    const leaf = existing ?? this.app.workspace.getLeaf(true);
    if (leaf === null) {
      new Notice(t(this.locale, "unableOpenCenter"));
      return;
    }

    await leaf.setViewState({ type: REVIEW_CENTER_VIEW_TYPE, active: true });
    await this.app.workspace.revealLeaf(leaf);
    if (this.currentIndex === null) {
      await this.loadReviewIndexSnapshot();
    }
    this.renderReviewCenter();
  }

  async ensureReviewDataForView(): Promise<void> {
    if (this.currentIndex !== null) {
      return;
    }

    await this.loadReviewIndexSnapshot();
    if (this.currentIndex === null && this.isMetadataLikelyReady()) {
      await this.refreshReviewData({ writeIndex: false, notice: false });
    }
  }

  async refreshReviewData(options: { writeIndex: boolean; notice: boolean }): Promise<ReviewIndex | null> {
    try {
      const index = buildReviewIndex(this.app, this.settings);
      const analytics = await buildSmartReviewAnalytics(this.app, this.settings, index);
      this.currentIndex = index;
      this.currentAnalytics = analytics;
      this.lastError = null;

      if (options.writeIndex) {
        await this.writeReviewIndex(index);
      }

      this.updateStatusBar();
      this.renderReviewCenter();

      if (options.notice) {
        new Notice(t(this.locale, "dataRefreshed", { count: index.items.length }));
      }

      return index;
    } catch (error) {
      console.error("Failed to refresh review data", error);
      this.lastError = error instanceof Error ? error.message : String(error);
      this.currentAnalytics = null;
      this.updateStatusBar();
      this.renderReviewCenter();
      if (options.notice) {
        new Notice(t(this.locale, "reviewFailed"));
      }
      return null;
    }
  }

  async generateReviewIndex(): Promise<void> {
    const index = await this.refreshReviewData({ writeIndex: true, notice: false });
    if (index === null) {
      new Notice(t(this.locale, "generateIndexFailed"));
      return;
    }

    const outputPath = normalizeOutputPath(this.settings.outputPath);
    new Notice(t(this.locale, "indexGenerated", { path: outputPath, count: index.items.length }));
  }

  async markCurrentNoteReviewed(rating: ReviewRating = "good"): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (file === null || file.extension !== "md") {
      new Notice(t(this.locale, "openMarkdownBeforeReview"));
      return;
    }

    await this.reviewFile(file, rating);
  }

  async reviewFileByPath(filePath: string, rating: ReviewRating): Promise<void> {
    const file = this.app.vault.getFileByPath(filePath);
    if (file === null) {
      new Notice(t(this.locale, "noteNotFound", { path: filePath }));
      return;
    }

    await this.reviewFile(file, rating);
  }

  async generateDailyReviewMarkdown(): Promise<void> {
    const index = this.currentIndex ?? (await this.refreshReviewData({ writeIndex: false, notice: false }));
    if (index === null) {
      new Notice(t(this.locale, "dailyMarkdownNoData"));
      return;
    }

    try {
      const outputPath = normalizeOutputPath(this.settings.dailyMarkdownPath, DEFAULT_SETTINGS.dailyMarkdownPath);
      await ensureParentFolder(this.app.vault.adapter, outputPath);
      await this.app.vault.adapter.write(outputPath, buildDailyReviewMarkdown(index, this.locale));
      new Notice(t(this.locale, "dailyMarkdownGenerated", { path: outputPath }));
    } catch (error) {
      console.error("Failed to generate daily review Markdown", error);
      new Notice(t(this.locale, "dailyMarkdownFailed"));
    }
  }

  async generateAiReviewCardsPayload(): Promise<void> {
    const index = this.currentIndex ?? (await this.refreshReviewData({ writeIndex: false, notice: false }));
    if (index === null) {
      new Notice(t(this.locale, "aiCardsNoData"));
      return;
    }

    try {
      const indexPath = normalizeOutputPath(this.settings.outputPath);
      const outputPath = normalizeOutputPath(this.settings.aiCardsPath, DEFAULT_SETTINGS.aiCardsPath);
      const payload = await buildAiReviewCardsPayload(this.app, index, indexPath);
      await ensureParentFolder(this.app.vault.adapter, outputPath);
      await this.app.vault.adapter.write(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
      new Notice(t(this.locale, "aiCardsGenerated", { path: outputPath, count: payload.items.length }));
    } catch (error) {
      console.error("Failed to generate AI review cards payload", error);
      new Notice(t(this.locale, "aiCardsFailed"));
    }
  }

  updateStatusBar(): void {
    this.statusBar?.update(this.currentIndex, this.settings.showStatusBarCount, this.locale);
  }

  scheduleGenerateReviewIndex(): void {
    if (!this.settings.autoRefresh) {
      return;
    }

    if (this.refreshTimer !== null) {
      window.clearTimeout(this.refreshTimer);
    }

    this.refreshTimer = window.setTimeout(() => {
      this.refreshTimer = null;
      void this.refreshReviewData({ writeIndex: true, notice: false });
    }, 1_000);
  }

  private async reviewFile(file: TFile, rating: ReviewRating): Promise<void> {
    try {
      const result = await markFileReviewed(this.app, this.settings, file, rating);
      await this.refreshReviewData({ writeIndex: true, notice: false });
      new Notice(t(this.locale, "reviewedNotice", { rating, title: file.basename, nextReview: result.nextReview }));
    } catch (error) {
      console.error("Failed to mark note reviewed", error);
      new Notice(t(this.locale, "reviewFailed"));
    }
  }

  private async writeReviewIndex(index: ReviewIndex): Promise<void> {
    const outputPath = normalizeOutputPath(this.settings.outputPath);
    await ensureParentFolder(this.app.vault.adapter, outputPath);
    await this.app.vault.adapter.write(outputPath, JSON.stringify(index, null, 2));
  }

  private async loadReviewIndexSnapshot(): Promise<void> {
    try {
      const outputPath = normalizeOutputPath(this.settings.outputPath);
      const raw = await this.app.vault.adapter.read(outputPath);
      const parsed = JSON.parse(raw) as unknown;
      if (!isReviewIndex(parsed)) {
        return;
      }

      this.currentIndex = parsed;
      this.currentAnalytics = await buildSmartReviewAnalytics(this.app, this.settings, parsed);
      this.lastError = null;
      this.updateStatusBar();
      this.renderReviewCenter();
    } catch (error) {
      if (!isMissingFileError(error)) {
        console.warn("Failed to load existing review-index.json", error);
      }
    }
  }

  private registerStartupScan(): void {
    if (!this.settings.scanOnStartup) {
      return;
    }

    const runStartupScan = async () => {
      if (this.startupScanCompleted || !this.isMetadataLikelyReady()) {
        return;
      }

      this.startupScanCompleted = true;
      await this.refreshReviewData({ writeIndex: true, notice: false });
    };

    this.registerEvent(
      this.app.metadataCache.on("resolved", () => {
        void runStartupScan();
      })
    );

    this.app.workspace.onLayoutReady(() => {
      window.setTimeout(() => {
        void runStartupScan();
      }, 1_500);
    });
  }

  private isMetadataLikelyReady(): boolean {
    return this.app.vault.getMarkdownFiles().length > 0;
  }

  renderReviewCenter(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(REVIEW_CENTER_VIEW_TYPE)) {
      const view = leaf.view;
      if (view instanceof ReviewCenterView) {
        view.render();
      }
    }
  }

  private registerAutoRefreshEvents(): void {
    this.registerEvent(
      this.app.metadataCache.on("changed", () => {
        this.scheduleGenerateReviewIndex();
      })
    );

    this.registerEvent(
      this.app.vault.on("rename", () => {
        this.scheduleGenerateReviewIndex();
      })
    );

    this.registerEvent(
      this.app.vault.on("delete", () => {
        this.scheduleGenerateReviewIndex();
      })
    );
  }
}

function isReviewIndex(value: unknown): value is ReviewIndex {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<ReviewIndex>;
  return (
    typeof candidate.generated_at === "string" &&
    typeof candidate.vault_name === "string" &&
    typeof candidate.summary === "object" &&
    candidate.summary !== null &&
    Array.isArray(candidate.items)
  );
}
