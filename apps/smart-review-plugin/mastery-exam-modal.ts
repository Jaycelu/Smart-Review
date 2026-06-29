import { Modal, Notice, Setting, type App, type TFile } from "obsidian";
import { t, type SmartReviewLocale } from "./i18n";
import type { MasteryAnswer, MasteryExamDefinition, MasteryExamResult } from "./mastery-exam";
import type { AiConnectionSettings } from "./settings";

export class MasteryConsentModal extends Modal {
  constructor(
    app: App,
    private readonly file: TFile,
    private readonly connection: AiConnectionSettings,
    private readonly locale: SmartReviewLocale,
    private readonly onConfirm: () => Promise<void>
  ) {
    super(app);
  }

  override onOpen(): void {
    this.contentEl.empty();
    this.contentEl.createEl("h2", { text: t(this.locale, "masteryConsentTitle") });
    this.contentEl.createEl("p", { text: t(this.locale, "masteryConsentDesc", { title: this.file.basename, provider: this.connection.name }) });
    const actions = this.contentEl.createDiv({ cls: "smart-review-modal-actions" });
    const cancel = actions.createEl("button", { text: t(this.locale, "cancel") });
    cancel.onclick = () => this.close();
    const confirm = actions.createEl("button", { text: t(this.locale, "continue"), cls: "mod-cta" });
    confirm.onclick = async () => {
      confirm.disabled = true;
      this.close();
      await this.onConfirm();
    };
  }

  override onClose(): void {
    this.contentEl.empty();
  }
}

export class MasteryExamModal extends Modal {
  private readonly answers = new Map<string, string>();
  private submitted = false;
  private readonly hadInitialDraft: boolean;

  constructor(
    app: App,
    private readonly file: TFile,
    private readonly definition: MasteryExamDefinition,
    private readonly locale: SmartReviewLocale,
    initialAnswers: MasteryAnswer[],
    private readonly onSaveDraft: (answers: MasteryAnswer[]) => Promise<void>,
    private readonly onDiscardDraft: () => Promise<void>,
    private readonly onSubmit: (answers: MasteryAnswer[]) => Promise<void>
  ) {
    super(app);
    this.hadInitialDraft = initialAnswers.length > 0;
    for (const answer of initialAnswers) this.answers.set(answer.dimension, answer.answer);
  }

  override onOpen(): void {
    this.modalEl.addClass("smart-review-mastery-modal-shell");
    this.contentEl.empty();
    this.contentEl.addClass("smart-review-mastery-modal");
    this.contentEl.createEl("h2", { text: t(this.locale, this.definition.stage === "recheck" ? "masteryRecheckTitle" : "masteryExamTitle") });
    this.contentEl.createEl("p", { text: t(this.locale, "masteryClosedBookHint", { title: this.file.basename }), cls: "setting-item-description" });

    for (const question of this.definition.questions) {
      const block = this.contentEl.createDiv({ cls: "smart-review-question" });
      block.createEl("h3", { text: t(this.locale, dimensionKey(question.dimension)) });
      block.createEl("p", { text: question.prompt });
      const textarea = block.createEl("textarea", { cls: "smart-review-answer-input" });
      textarea.rows = 7;
      textarea.placeholder = t(this.locale, "answerPlaceholder");
      textarea.value = this.answers.get(question.dimension) ?? "";
      textarea.oninput = () => this.answers.set(question.dimension, textarea.value);
    }

    const actions = new Setting(this.contentEl)
      .addButton((button) => button.setButtonText(t(this.locale, "saveDraft")).onClick(async () => {
        this.submitted = true;
        await this.onSaveDraft(this.collectAnswers());
        this.close();
      }))
      .addButton((button) => button.setButtonText(t(this.locale, "cancel")).onClick(() => this.close()))
      .addButton((button) => button.setButtonText(t(this.locale, "submitForGrading")).setCta().onClick(async () => {
        const answers = this.collectAnswers();
        if (answers.some((answer) => answer.answer.length === 0)) {
          new Notice(t(this.locale, "answerAllQuestions"));
          return;
        }
        button.setDisabled(true);
        this.submitted = true;
        this.close();
        await this.onSubmit(answers);
      }));
    actions.settingEl.addClass("smart-review-mastery-actions");
    if (this.hadInitialDraft) {
      actions.addButton((button) => button.setButtonText(t(this.locale, "discardDraft")).setWarning().onClick(async () => {
        this.submitted = true;
        await this.onDiscardDraft();
        this.close();
      }));
    }
  }

  override onClose(): void {
    this.modalEl.removeClass("smart-review-mastery-modal-shell");
    if (!this.submitted && [...this.answers.values()].some((answer) => answer.trim().length > 0)) {
      void this.onSaveDraft(this.collectAnswers());
    }
    this.contentEl.empty();
  }

  private collectAnswers(): MasteryAnswer[] {
    return this.definition.questions.map((question) => ({
      dimension: question.dimension,
      answer: this.answers.get(question.dimension)?.trim() ?? ""
    }));
  }
}

export class MasteryResultModal extends Modal {
  constructor(app: App, private readonly result: MasteryExamResult, private readonly locale: SmartReviewLocale) {
    super(app);
  }

  override onOpen(): void {
    this.modalEl.addClass("smart-review-mastery-modal-shell");
    this.contentEl.empty();
    this.contentEl.addClass("smart-review-mastery-modal");
    this.contentEl.createEl("h2", { text: t(this.locale, "masteryResultTitle") });
    const summary = this.contentEl.createDiv({ cls: `smart-review-result-summary smart-review-result-${this.result.outcome}` });
    summary.createEl("strong", { text: t(this.locale, outcomeKey(this.result.outcome)) });
    summary.createSpan({ text: t(this.locale, "confidenceLabel", { confidence: t(this.locale, confidenceKey(this.result.confidence)) }) });
    summary.createEl("p", { text: this.result.examiner.overallReason });

    for (const item of this.result.examiner.items) {
      const block = this.contentEl.createDiv({ cls: "smart-review-result-item" });
      block.createEl("h3", { text: `${t(this.locale, dimensionKey(item.dimension))} - ${item.score}/2` });
      block.createEl("p", { text: item.reason });
      block.createEl("strong", { text: t(this.locale, "referenceAnswer") });
      block.createEl("p", { text: item.referenceAnswer });
      if (item.missing.length > 0) {
        block.createEl("strong", { text: t(this.locale, "missingPoints") });
        const list = block.createEl("ul");
        for (const missing of item.missing) list.createEl("li", { text: missing });
      }
    }

    this.contentEl.createEl("p", { text: this.result.nextStep, cls: "smart-review-result-next" });
    this.contentEl.createEl("p", { text: t(this.locale, "recordSavedAt", { path: this.result.recordPath }), cls: "setting-item-description" });
    new Setting(this.contentEl).addButton((button) => button.setButtonText(t(this.locale, "close")).setCta().onClick(() => this.close()));
  }

  override onClose(): void {
    this.modalEl.removeClass("smart-review-mastery-modal-shell");
    this.contentEl.empty();
  }
}

function dimensionKey(dimension: string): "dimensionRetention" | "dimensionDiscrimination" | "dimensionTransfer" | "dimensionGeneration" {
  if (dimension === "retention") return "dimensionRetention";
  if (dimension === "discrimination") return "dimensionDiscrimination";
  if (dimension === "transfer") return "dimensionTransfer";
  return "dimensionGeneration";
}

function outcomeKey(outcome: string): "masteryPassed" | "masteryFailed" | "masteryInconclusive" {
  if (outcome === "pass") return "masteryPassed";
  if (outcome === "fail") return "masteryFailed";
  return "masteryInconclusive";
}

function confidenceKey(confidence: string): "confidenceHigh" | "confidenceMedium" | "confidenceLow" {
  if (confidence === "high") return "confidenceHigh";
  if (confidence === "medium") return "confidenceMedium";
  return "confidenceLow";
}
