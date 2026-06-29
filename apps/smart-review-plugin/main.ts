import { Notice, Plugin, WorkspaceTabs, type TFile, type WorkspaceLeaf } from "obsidian";
import { getLocalDateString, type ReviewIndex, type ReviewRating } from "@smart-review/shared";
import { buildAiReviewCardsPayload } from "./ai-cards";
import { buildSmartReviewAnalytics } from "./analytics-service";
import type { SmartReviewAnalytics } from "./analytics-types";
import { resolveSmartReviewLocale, t, type SmartReviewLocale } from "./i18n";
import { MasteryConsentModal, MasteryExamModal, MasteryResultModal } from "./mastery-exam-modal";
import { generateMasteryExam, runAndStoreMasteryExam, type MasteryAnswer, type MasteryStage } from "./mastery-exam";
import { buildDailyReviewMarkdown } from "./markdown-export";
import { PauseReviewModal } from "./pause-review-modal";
import { calculateReviewResult, markFileReviewed } from "./review-actions";
import { pauseReview, resumeReview, type PauseDuration } from "./review-lifecycle";
import { ReviewCenterView, REVIEW_CENTER_VIEW_TYPE } from "./review-center-view";
import { buildReviewIndex } from "./scanner";
import { DEFAULT_SETTINGS, REVIEW_RATINGS, SmartReviewSettingTab, normalizeAiConnections, normalizeMasteryDrafts, type AiConnectionSettings, type SmartReviewSettings } from "./settings";
import { listAiModels, testAiConnection as verifyAiConnection } from "./ai-examiner";
import { ModelPickerModal } from "./model-picker-modal";
import { SmartReviewStatusBar } from "./status-bar";
import { ensureParentFolder, isMissingFileError, normalizeOutputPath, toFrontmatter } from "./utils";

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
      id: "start-current-note-mastery-exam",
      name: t(this.locale, "startCurrentMasteryExam"),
      callback: () => {
        void this.startCurrentNoteMasteryExam();
      }
    });

    this.addCommand({
      id: "pause-current-note-review",
      name: t(this.locale, "pauseCurrentReview"),
      callback: () => {
        this.openPauseCurrentNote();
      }
    });

    this.addCommand({
      id: "resume-current-note-review",
      name: t(this.locale, "resumeCurrentReview"),
      callback: () => {
        void this.resumeCurrentNoteReview();
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
      ...loaded,
      aiConnections: normalizeAiConnections(loaded?.aiConnections),
      masteryDrafts: normalizeMasteryDrafts(loaded?.masteryDrafts)
    };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  get locale(): SmartReviewLocale {
    return resolveSmartReviewLocale(this.settings.language);
  }

  async openReviewCenter(): Promise<void> {
    const existingLeaves = this.app.workspace.getLeavesOfType(REVIEW_CENTER_VIEW_TYPE);
    const mainLeaf = existingLeaves.find((candidate) => !this.isSideDockLeaf(candidate));
    const leaf = mainLeaf ?? this.app.workspace.getLeaf("tab");
    if (leaf === null) {
      new Notice(t(this.locale, "unableOpenCenter"));
      return;
    }

    await leaf.setViewState({ type: REVIEW_CENTER_VIEW_TYPE, active: true });
    await this.app.workspace.revealLeaf(leaf);
    for (const existing of existingLeaves) {
      if (existing !== leaf && this.isSideDockLeaf(existing)) {
        existing.detach();
      }
    }
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

  openPauseReview(filePath: string): void {
    const file = this.app.vault.getFileByPath(filePath);
    if (file === null) {
      new Notice(t(this.locale, "noteNotFound", { path: filePath }));
      return;
    }

    new PauseReviewModal(this.app, file, this.locale, async (duration, customDate) => {
      await this.pauseFile(file, duration, customDate);
    }).open();
  }

  async resumeReviewByPath(filePath: string): Promise<void> {
    const file = this.app.vault.getFileByPath(filePath);
    if (file === null) {
      new Notice(t(this.locale, "noteNotFound", { path: filePath }));
      return;
    }

    await this.resumeFile(file);
  }

  async startMasteryExamByPath(filePath: string): Promise<void> {
    const file = this.app.vault.getFileByPath(filePath);
    if (file === null) {
      new Notice(t(this.locale, "noteNotFound", { path: filePath }));
      return;
    }
    const examiner = this.getAiConnection(this.settings.examinerConnectionId);
    if (examiner === null) {
      new Notice(t(this.locale, "configureAiExaminerFirst"));
      this.openPluginSettings();
      return;
    }
    if (this.getMasteryStage(file) === "recheck") {
      const frontmatter = toFrontmatter(this.app.metadataCache.getFileCache(file)?.frontmatter);
      const recheckAt = typeof frontmatter.review_mastery_recheck_at === "string" ? frontmatter.review_mastery_recheck_at : "";
      if (recheckAt.length > 0 && recheckAt > getLocalDateString()) {
        new Notice(t(this.locale, "masteryRecheckNotDue", { date: recheckAt }));
        return;
      }
    }

    new MasteryConsentModal(this.app, file, examiner, this.locale, async () => {
      await this.prepareMasteryExam(file, examiner);
    }).open();
  }

  async testAiConnection(connectionId: string): Promise<void> {
    const connection = this.getAiConnection(connectionId);
    if (connection === null) {
      new Notice(t(this.locale, "aiConnectionMissing"));
      return;
    }
    const notice = new Notice(t(this.locale, "testingAiConnection"), 0);
    try {
      await verifyAiConnection(connection);
      notice.hide();
      new Notice(t(this.locale, "aiConnectionSuccess"));
    } catch (error) {
      notice.hide();
      console.error("AI connection test failed", error);
      new Notice(t(this.locale, "aiConnectionFailed", { error: getErrorMessage(error) }), 8_000);
    }
  }

  async chooseAiModel(connectionId: string): Promise<void> {
    const connection = this.getAiConnection(connectionId);
    if (connection === null) {
      new Notice(t(this.locale, "aiConnectionMissing"));
      return;
    }
    const notice = new Notice(t(this.locale, "loadingModels"), 0);
    try {
      const models = await listAiModels(connection);
      notice.hide();
      if (models.length === 0) {
        new Notice(t(this.locale, "manualModelRequired"));
        return;
      }
      new ModelPickerModal(this.app, models, (model) => {
        connection.model = model;
        void this.saveSettings().then(() => new Notice(t(this.locale, "modelSelected", { model })));
      }).open();
    } catch (error) {
      notice.hide();
      console.error("Failed to discover AI models", error);
      new Notice(t(this.locale, "modelDiscoveryFailed", { error: getErrorMessage(error) }), 8_000);
    }
  }

  openPluginSettings(): void {
    const appWithSettings = this.app as typeof this.app & {
      setting?: { open(): void; openTabById(id: string): void };
    };
    appWithSettings.setting?.open();
    appWithSettings.setting?.openTabById(this.manifest.id);
  }

  getReviewIntervalDays(filePath: string, rating: ReviewRating): number | null {
    const file = this.app.vault.getFileByPath(filePath);
    if (file === null) {
      return null;
    }

    const frontmatter = toFrontmatter(this.app.metadataCache.getFileCache(file)?.frontmatter);
    return calculateReviewResult(this.settings, frontmatter, rating).intervalDays;
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

  private openPauseCurrentNote(): void {
    const file = this.app.workspace.getActiveFile();
    if (file === null || file.extension !== "md") {
      new Notice(t(this.locale, "openMarkdownBeforeReview"));
      return;
    }
    this.openPauseReview(file.path);
  }

  private async resumeCurrentNoteReview(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (file === null || file.extension !== "md") {
      new Notice(t(this.locale, "openMarkdownBeforeReview"));
      return;
    }
    await this.resumeFile(file);
  }

  private async startCurrentNoteMasteryExam(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (file === null || file.extension !== "md") {
      new Notice(t(this.locale, "openMarkdownBeforeReview"));
      return;
    }
    await this.startMasteryExamByPath(file.path);
  }

  private async prepareMasteryExam(file: TFile, examiner: AiConnectionSettings): Promise<void> {
    const stage = this.getMasteryStage(file);
    const loading = new Notice(t(this.locale, "generatingMasteryExam"), 0);
    try {
      const source = await this.app.vault.cachedRead(file);
      const existingDraft = this.settings.masteryDrafts[file.path];
      const definition = existingDraft?.definition.stage === stage
        ? existingDraft.definition
        : await generateMasteryExam(examiner, source, stage, this.locale);
      loading.hide();
      const saveDraft = async (answers: MasteryAnswer[]) => {
        this.settings.masteryDrafts[file.path] = { definition, answers, savedAt: new Date().toISOString() };
        await this.saveSettings();
      };
      const discardDraft = async () => {
        delete this.settings.masteryDrafts[file.path];
        await this.saveSettings();
      };
      new MasteryExamModal(this.app, file, definition, this.locale, existingDraft?.answers ?? [], saveDraft, discardDraft, async (answers) => {
        this.settings.masteryDrafts[file.path] = { definition, answers, savedAt: new Date().toISOString() };
        await this.saveSettings();
        const grading = new Notice(t(this.locale, "gradingMasteryExam"), 0);
        try {
          const verifier = this.getAiConnection(this.settings.verifierConnectionId) ?? examiner;
          const result = await runAndStoreMasteryExam({
            app: this.app,
            settings: this.settings,
            file,
            source,
            definition,
            answers,
            examiner,
            verifier,
            locale: this.locale
          });
          grading.hide();
          delete this.settings.masteryDrafts[file.path];
          await this.saveSettings();
          await this.refreshReviewData({ writeIndex: true, notice: false });
          new MasteryResultModal(this.app, result, this.locale).open();
        } catch (error) {
          grading.hide();
          console.error("Failed to grade mastery exam", error);
          new Notice(t(this.locale, "masteryExamFailed", { error: getErrorMessage(error) }), 8_000);
        }
      }).open();
    } catch (error) {
      loading.hide();
      console.error("Failed to generate mastery exam", error);
      new Notice(t(this.locale, "masteryExamFailed", { error: getErrorMessage(error) }), 8_000);
    }
  }

  private getAiConnection(connectionId: string): AiConnectionSettings | null {
    if (connectionId.length === 0) return null;
    return this.settings.aiConnections.find((connection) => connection.id === connectionId) ?? null;
  }

  private getMasteryStage(file: TFile): MasteryStage {
    const frontmatter = toFrontmatter(this.app.metadataCache.getFileCache(file)?.frontmatter);
    return frontmatter.review_status === "mastery_pending" ? "recheck" : "initial";
  }

  private async pauseFile(file: TFile, duration: PauseDuration, customDate?: string): Promise<void> {
    try {
      await pauseReview(this.app, file, duration, customDate);
      await this.refreshReviewData({ writeIndex: true, notice: false });
      new Notice(t(this.locale, "reviewPaused", { title: file.basename }));
    } catch (error) {
      console.error("Failed to pause review", error);
      new Notice(t(this.locale, "reviewStateFailed"));
    }
  }

  private async resumeFile(file: TFile): Promise<void> {
    try {
      await resumeReview(this.app, file);
      await this.refreshReviewData({ writeIndex: true, notice: false });
      new Notice(t(this.locale, "reviewResumed", { title: file.basename }));
    } catch (error) {
      console.error("Failed to resume review", error);
      new Notice(t(this.locale, "reviewStateFailed"));
    }
  }

  private isSideDockLeaf(leaf: WorkspaceLeaf): boolean {
    return leaf.parent instanceof WorkspaceTabs &&
      (leaf.parent.parent === this.app.workspace.leftSplit || leaf.parent.parent === this.app.workspace.rightSplit);
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

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
