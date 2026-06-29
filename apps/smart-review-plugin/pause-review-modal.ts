import { Modal, Notice, Setting, type App, type TFile } from "obsidian";
import { getLocalDateString } from "@smart-review/shared";
import { t, type SmartReviewLocale } from "./i18n";

export class PauseReviewModal extends Modal {
  private customDate = "";

  constructor(
    app: App,
    private readonly file: TFile,
    private readonly locale: SmartReviewLocale,
    private readonly onPause: (days: 30 | 90 | "indefinite", customDate?: string) => Promise<void>
  ) {
    super(app);
  }

  override onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("smart-review-pause-modal");
    contentEl.createEl("h2", { text: t(this.locale, "pauseReviewTitle") });
    contentEl.createEl("p", { text: this.file.basename, cls: "setting-item-description" });

    const presets = contentEl.createDiv({ cls: "smart-review-modal-actions" });
    this.addPauseButton(presets, t(this.locale, "pause30Days"), 30);
    this.addPauseButton(presets, t(this.locale, "pause90Days"), 90);
    this.addPauseButton(presets, t(this.locale, "pauseIndefinitely"), "indefinite");

    new Setting(contentEl)
      .setName(t(this.locale, "customResumeDate"))
      .setDesc(t(this.locale, "customResumeDateDesc"))
      .addText((text) => {
        text.inputEl.type = "date";
        text.inputEl.min = getLocalDateString();
        text.onChange((value) => {
          this.customDate = value;
        });
      })
      .addButton((button) =>
        button.setButtonText(t(this.locale, "pauseUntilDate")).setCta().onClick(async () => {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(this.customDate) || this.customDate < getLocalDateString()) {
            new Notice(t(this.locale, "invalidResumeDate"));
            return;
          }
          await this.onPause("indefinite", this.customDate);
          this.close();
        })
      );
  }

  override onClose(): void {
    this.contentEl.empty();
  }

  private addPauseButton(container: HTMLElement, label: string, duration: 30 | 90 | "indefinite"): void {
    const button = container.createEl("button", { text: label });
    button.onclick = async () => {
      await this.onPause(duration);
      this.close();
    };
  }
}
