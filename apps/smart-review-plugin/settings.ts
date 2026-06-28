import { App, PluginSettingTab, Setting } from "obsidian";
import type SmartReviewPlugin from "./main";
import { DEFAULT_REVIEW_INTERVAL_RULES, type ReviewIntervalRules, type ReviewRating } from "@smart-review/shared";
import { resolveSmartReviewLocale, t, type SmartReviewLanguageSetting } from "./i18n";

export interface SmartReviewSettings {
  vaultName: string;
  outputPath: string;
  autoRefresh: boolean;
  ignoreInactive: boolean;
  allowedStatuses: string;
  ignoreTemplateFolder: boolean;
  ignoredFolderPrefixes: string;
  exportScope: "all" | "due_only";
  includedTypes: string;
  domainFilter: string;
  tagFilter: string;
  reviewIntervalDays: number;
  reviewAgainIntervalDays: number;
  reviewHardMultiplier: number;
  reviewGoodMultiplier: number;
  reviewEasyMultiplier: number;
  reviewHistoryPath: string;
  enableReviewHistory: boolean;
  dailyMarkdownPath: string;
  aiCardsPath: string;
  defaultReviewRating: ReviewRating;
  scanOnStartup: boolean;
  showStatusBarCount: boolean;
  language: SmartReviewLanguageSetting;
}

export const DEFAULT_SETTINGS: SmartReviewSettings = {
  vaultName: "",
  outputPath: "review-index.json",
  autoRefresh: false,
  ignoreInactive: true,
  allowedStatuses: "active,published,draft",
  ignoreTemplateFolder: true,
  ignoredFolderPrefixes: "99-模板/",
  exportScope: "all",
  includedTypes: "article",
  domainFilter: "",
  tagFilter: "",
  reviewIntervalDays: 30,
  reviewAgainIntervalDays: DEFAULT_REVIEW_INTERVAL_RULES.againIntervalDays,
  reviewHardMultiplier: DEFAULT_REVIEW_INTERVAL_RULES.hardMultiplier,
  reviewGoodMultiplier: DEFAULT_REVIEW_INTERVAL_RULES.goodMultiplier,
  reviewEasyMultiplier: DEFAULT_REVIEW_INTERVAL_RULES.easyMultiplier,
  reviewHistoryPath: "review-history.jsonl",
  enableReviewHistory: true,
  dailyMarkdownPath: "00-总览/今日复习.md",
  aiCardsPath: "review-ai-cards.json",
  defaultReviewRating: "good",
  scanOnStartup: true,
  showStatusBarCount: true,
  language: "auto"
};

export const REVIEW_RATINGS: ReviewRating[] = ["again", "hard", "good", "easy"];

export class SmartReviewSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: SmartReviewPlugin) {
    super(app, plugin);
  }

  override display(): void {
    const { containerEl } = this;
    const locale = resolveSmartReviewLocale(this.plugin.settings.language);
    containerEl.empty();

    new Setting(containerEl)
      .setName("Review behavior")
      .setHeading();
    containerEl.createEl("p", {
      text: t(locale, "settingsIntro"),
      cls: "smart-review-setting-note"
    });

    new Setting(containerEl)
      .setName(t(locale, "languageName"))
      .setDesc(t(locale, "languageDesc"))
      .addDropdown((dropdown) =>
        dropdown
          .addOption("auto", t(locale, "languageAuto"))
          .addOption("en", t(locale, "languageEnglish"))
          .addOption("zh", t(locale, "languageChinese"))
          .setValue(this.plugin.settings.language)
          .onChange(async (value) => {
            this.plugin.settings.language = isSmartReviewLanguageSetting(value) ? value : DEFAULT_SETTINGS.language;
            await this.plugin.saveSettings();
            this.plugin.updateStatusBar();
            this.plugin.renderReviewCenter();
            this.display();
          })
      );

    new Setting(containerEl)
      .setName(t(locale, "vaultName"))
      .setDesc(t(locale, "vaultNameDesc"))
      .addText((text) =>
        text
          .setPlaceholder(this.app.vault.getName())
          .setValue(this.plugin.settings.vaultName)
          .onChange(async (value) => {
            this.plugin.settings.vaultName = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t(locale, "outputPath"))
      .setDesc(t(locale, "outputPathDesc"))
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.outputPath)
          .setValue(this.plugin.settings.outputPath)
          .onChange(async (value) => {
            this.plugin.settings.outputPath = value.trim() || DEFAULT_SETTINGS.outputPath;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t(locale, "autoRefresh"))
      .setDesc(t(locale, "autoRefreshDesc"))
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.autoRefresh).onChange(async (value) => {
          this.plugin.settings.autoRefresh = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName(t(locale, "ignoreInactive"))
      .setDesc(t(locale, "ignoreInactiveDesc"))
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.ignoreInactive).onChange(async (value) => {
          this.plugin.settings.ignoreInactive = value;
          await this.plugin.saveSettings();
          await this.plugin.refreshReviewData({ writeIndex: true, notice: false });
        })
      );

    new Setting(containerEl)
      .setName(t(locale, "allowedStatuses"))
      .setDesc(t(locale, "allowedStatusesDesc"))
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.allowedStatuses)
          .setValue(this.plugin.settings.allowedStatuses)
          .onChange(async (value) => {
            this.plugin.settings.allowedStatuses = value.trim();
            await this.plugin.saveSettings();
            await this.plugin.refreshReviewData({ writeIndex: true, notice: false });
          })
      );

    new Setting(containerEl)
      .setName(t(locale, "ignoreFolders"))
      .setDesc(t(locale, "ignoreFoldersDesc"))
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.ignoreTemplateFolder).onChange(async (value) => {
          this.plugin.settings.ignoreTemplateFolder = value;
          await this.plugin.saveSettings();
          await this.plugin.refreshReviewData({ writeIndex: true, notice: false });
        })
      );

    new Setting(containerEl)
      .setName(t(locale, "ignoredFolderList"))
      .setDesc(t(locale, "ignoredFolderListDesc"))
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.ignoredFolderPrefixes)
          .setValue(this.plugin.settings.ignoredFolderPrefixes)
          .onChange(async (value) => {
            this.plugin.settings.ignoredFolderPrefixes = value.trim();
            await this.plugin.saveSettings();
            await this.plugin.refreshReviewData({ writeIndex: true, notice: false });
          })
      );

    new Setting(containerEl)
      .setName(t(locale, "exportScope"))
      .setDesc(t(locale, "exportScopeDesc"))
      .addDropdown((dropdown) =>
        dropdown
          .addOption("all", t(locale, "allTasks"))
          .addOption("due_only", t(locale, "dueOnly"))
          .setValue(this.plugin.settings.exportScope)
          .onChange(async (value) => {
            this.plugin.settings.exportScope = value === "due_only" ? "due_only" : "all";
            await this.plugin.saveSettings();
            await this.plugin.refreshReviewData({ writeIndex: true, notice: false });
          })
      );

    new Setting(containerEl)
      .setName(t(locale, "includedTypes"))
      .setDesc(t(locale, "includedTypesDesc"))
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.includedTypes)
          .setValue(this.plugin.settings.includedTypes)
          .onChange(async (value) => {
            this.plugin.settings.includedTypes = value.trim();
            await this.plugin.saveSettings();
            await this.plugin.refreshReviewData({ writeIndex: true, notice: false });
          })
      );

    new Setting(containerEl)
      .setName(t(locale, "domainFilter"))
      .setDesc(t(locale, "domainFilterDesc"))
      .addText((text) =>
        text
          .setPlaceholder(locale === "zh" ? "基础设施与运维, 知识管理与工作流" : "Infrastructure, Knowledge Management")
          .setValue(this.plugin.settings.domainFilter)
          .onChange(async (value) => {
            this.plugin.settings.domainFilter = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t(locale, "tagFilter"))
      .setDesc(t(locale, "tagFilterDesc"))
      .addText((text) =>
        text
          .setPlaceholder(locale === "zh" ? "主题/Obsidian, 模块/云计算" : "topic/Obsidian, module/cloud")
          .setValue(this.plugin.settings.tagFilter)
          .onChange(async (value) => {
            this.plugin.settings.tagFilter = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t(locale, "historyPath"))
      .setDesc(t(locale, "historyPathDesc"))
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.reviewHistoryPath)
          .setValue(this.plugin.settings.reviewHistoryPath)
          .onChange(async (value) => {
            this.plugin.settings.reviewHistoryPath = value.trim() || DEFAULT_SETTINGS.reviewHistoryPath;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t(locale, "enableHistory"))
      .setDesc(t(locale, "enableHistoryDesc"))
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.enableReviewHistory).onChange(async (value) => {
          this.plugin.settings.enableReviewHistory = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName(t(locale, "dailyMarkdownPath"))
      .setDesc(t(locale, "dailyMarkdownPathDesc"))
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.dailyMarkdownPath)
          .setValue(this.plugin.settings.dailyMarkdownPath)
          .onChange(async (value) => {
            this.plugin.settings.dailyMarkdownPath = value.trim() || DEFAULT_SETTINGS.dailyMarkdownPath;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t(locale, "aiCardsPath"))
      .setDesc(t(locale, "aiCardsPathDesc"))
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.aiCardsPath)
          .setValue(this.plugin.settings.aiCardsPath)
          .onChange(async (value) => {
            this.plugin.settings.aiCardsPath = value.trim() || DEFAULT_SETTINGS.aiCardsPath;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t(locale, "defaultRating"))
      .setDesc(t(locale, "defaultRatingDesc"))
      .addDropdown((dropdown) => {
        for (const rating of REVIEW_RATINGS) {
          dropdown.addOption(rating, rating);
        }
        dropdown.setValue(this.plugin.settings.defaultReviewRating).onChange(async (value) => {
          this.plugin.settings.defaultReviewRating = REVIEW_RATINGS.includes(value as ReviewRating)
            ? (value as ReviewRating)
            : DEFAULT_SETTINGS.defaultReviewRating;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName(t(locale, "intervalDays"))
      .setDesc(t(locale, "intervalDaysDesc"))
      .addText((text) =>
        text
          .setPlaceholder(String(DEFAULT_SETTINGS.reviewIntervalDays))
          .setValue(String(this.plugin.settings.reviewIntervalDays))
          .onChange(async (value) => {
            this.plugin.settings.reviewIntervalDays = parseReviewIntervalDays(value);
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t(locale, "againIntervalDays"))
      .setDesc(t(locale, "againIntervalDaysDesc"))
      .addText((text) => {
        text.inputEl.type = "number";
        text.inputEl.min = "1";
        text.inputEl.step = "1";
        text
          .setPlaceholder(String(DEFAULT_SETTINGS.reviewAgainIntervalDays))
          .setValue(String(this.plugin.settings.reviewAgainIntervalDays))
          .onChange(async (value) => {
            this.plugin.settings.reviewAgainIntervalDays = parsePositiveInteger(value, DEFAULT_SETTINGS.reviewAgainIntervalDays);
            await this.plugin.saveSettings();
            this.plugin.renderReviewCenter();
          });
      });

    this.addMultiplierSetting(
      containerEl,
      t(locale, "hardMultiplier"),
      t(locale, "hardMultiplierDesc"),
      "reviewHardMultiplier"
    );
    this.addMultiplierSetting(
      containerEl,
      t(locale, "goodMultiplier"),
      t(locale, "goodMultiplierDesc"),
      "reviewGoodMultiplier"
    );
    this.addMultiplierSetting(
      containerEl,
      t(locale, "easyMultiplier"),
      t(locale, "easyMultiplierDesc"),
      "reviewEasyMultiplier"
    );

    new Setting(containerEl)
      .setName(t(locale, "scanStartup"))
      .setDesc(t(locale, "scanStartupDesc"))
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.scanOnStartup).onChange(async (value) => {
          this.plugin.settings.scanOnStartup = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName(t(locale, "showStatusBar"))
      .setDesc(t(locale, "showStatusBarDesc"))
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.showStatusBarCount).onChange(async (value) => {
          this.plugin.settings.showStatusBarCount = value;
          await this.plugin.saveSettings();
          this.plugin.updateStatusBar();
        })
      );
  }

  private addMultiplierSetting(
    containerEl: HTMLElement,
    name: string,
    description: string,
    key: "reviewHardMultiplier" | "reviewGoodMultiplier" | "reviewEasyMultiplier"
  ): void {
    new Setting(containerEl)
      .setName(name)
      .setDesc(description)
      .addText((text) => {
        text.inputEl.type = "number";
        text.inputEl.min = "0.1";
        text.inputEl.step = "0.1";
        text
          .setPlaceholder(String(DEFAULT_SETTINGS[key]))
          .setValue(String(this.plugin.settings[key]))
          .onChange(async (value) => {
            this.plugin.settings[key] = parsePositiveNumber(value, DEFAULT_SETTINGS[key]);
            await this.plugin.saveSettings();
            this.plugin.renderReviewCenter();
          });
      });
  }
}

function isSmartReviewLanguageSetting(value: string): value is SmartReviewLanguageSetting {
  return value === "auto" || value === "en" || value === "zh";
}

export function parseReviewIntervalDays(value: string): number {
  return Math.min(parsePositiveInteger(value, DEFAULT_SETTINGS.reviewIntervalDays), 3650);
}

export function getReviewIntervalRules(settings: SmartReviewSettings): ReviewIntervalRules {
  return {
    againIntervalDays: settings.reviewAgainIntervalDays,
    hardMultiplier: settings.reviewHardMultiplier,
    goodMultiplier: settings.reviewGoodMultiplier,
    easyMultiplier: settings.reviewEasyMultiplier
  };
}

function parsePositiveInteger(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parsePositiveNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
