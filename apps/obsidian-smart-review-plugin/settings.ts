import { App, PluginSettingTab, Setting } from "obsidian";
import type ReviewSmartReviewPlugin from "./main";
import type { ReviewRating } from "@obsidian-smart-review/shared";

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
  reviewHistoryPath: string;
  enableReviewHistory: boolean;
  dailyMarkdownPath: string;
  aiCardsPath: string;
  defaultReviewRating: ReviewRating;
  scanOnStartup: boolean;
  showStatusBarCount: boolean;
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
  reviewHistoryPath: "review-history.jsonl",
  enableReviewHistory: true,
  dailyMarkdownPath: "00-总览/今日复习.md",
  aiCardsPath: "review-ai-cards.json",
  defaultReviewRating: "good",
  scanOnStartup: true,
  showStatusBarCount: true
};

export const REVIEW_RATINGS: ReviewRating[] = ["again", "hard", "good", "easy"];

export class SmartReviewSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: ReviewSmartReviewPlugin) {
    super(app, plugin);
  }

  override display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Obsidian Smart Review" });
    containerEl.createEl("p", {
      text: "插件本体可独立完成复习队列、Review Center、复习反馈、历史记录和 AI Payload 生成。",
      cls: "smart-review-setting-note"
    });

    new Setting(containerEl)
      .setName("Vault 名称")
      .setDesc("用于 review-index.json 和 Obsidian URI。留空时使用当前 Vault 名称。")
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
      .setName("review-index.json 输出路径")
      .setDesc("覆盖写入的当前复习索引快照。默认：review-index.json")
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
      .setName("自动刷新")
      .setDesc("元数据变化、文件重命名或删除后自动重新扫描并覆盖更新 review-index.json。")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.autoRefresh).onChange(async (value) => {
          this.plugin.settings.autoRefresh = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("忽略 inactive / archived / deleted 笔记")
      .setDesc("开启后只包含空 status 和下方允许列表中的 status。关闭后不按 status 过滤。")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.ignoreInactive).onChange(async (value) => {
          this.plugin.settings.ignoreInactive = value;
          await this.plugin.saveSettings();
          await this.plugin.refreshReviewData({ writeIndex: true, notice: false });
        })
      );

    new Setting(containerEl)
      .setName("允许纳入复习的 status")
      .setDesc("英文逗号分隔。空 status 始终允许。默认：active,published,draft。")
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
      .setName("忽略指定目录")
      .setDesc("开启后跳过下方目录列表中的笔记。关闭后不按目录过滤。")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.ignoreTemplateFolder).onChange(async (value) => {
          this.plugin.settings.ignoreTemplateFolder = value;
          await this.plugin.saveSettings();
          await this.plugin.refreshReviewData({ writeIndex: true, notice: false });
        })
      );

    new Setting(containerEl)
      .setName("忽略目录列表")
      .setDesc("英文逗号分隔，路径相对 Vault 根目录。默认：99-模板/。例如：Templates/, 00-模板/")
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
      .setName("导出范围")
      .setDesc("导出全部纳入扫描的笔记，或只导出逾期/今日/未来 7 天。")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("all", "全部任务")
          .addOption("due_only", "只导出待复习任务")
          .setValue(this.plugin.settings.exportScope)
          .onChange(async (value) => {
            this.plugin.settings.exportScope = value === "due_only" ? "due_only" : "all";
            await this.plugin.saveSettings();
            await this.plugin.refreshReviewData({ writeIndex: true, notice: false });
          })
      );

    new Setting(containerEl)
      .setName("纳入复习的笔记类型")
      .setDesc("按 frontmatter 的 type 字段过滤，英文逗号分隔。默认只纳入 article，避免 series / dashboard 导航页进入复习计划。留空表示不过滤。")
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
      .setName("Domain 过滤")
      .setDesc("可选，英文逗号分隔。留空表示不过滤。")
      .addText((text) =>
        text
          .setPlaceholder("基础设施与运维, 知识管理与工作流")
          .setValue(this.plugin.settings.domainFilter)
          .onChange(async (value) => {
            this.plugin.settings.domainFilter = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Tag 过滤")
      .setDesc("可选，英文逗号分隔。留空表示不过滤。")
      .addText((text) =>
        text
          .setPlaceholder("主题/Obsidian, 模块/云计算")
          .setValue(this.plugin.settings.tagFilter)
          .onChange(async (value) => {
            this.plugin.settings.tagFilter = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("review-history.jsonl 输出路径")
      .setDesc("追加写入的复习动作事件日志。默认：review-history.jsonl")
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
      .setName("启用复习历史记录")
      .setDesc("开启后每次复习反馈都会追加一行 JSONL。")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.enableReviewHistory).onChange(async (value) => {
          this.plugin.settings.enableReviewHistory = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("今日复习 Markdown 输出路径")
      .setDesc("覆盖写入的 Obsidian 原生复习中心。默认：00-总览/今日复习.md")
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
      .setName("AI 复习卡片 Payload 输出路径")
      .setDesc("覆盖写入的 prompt_payload 文件，不调用远程 AI API。默认：review-ai-cards.json")
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
      .setName("默认复习评分")
      .setDesc("Mark Current Note Reviewed 使用的默认评分。")
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
      .setName("初始复习间隔天数")
      .setDesc("新笔记没有复习历史时使用的基础间隔。")
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
      .setName("插件启动时自动扫描")
      .setDesc("启动 Obsidian 后自动扫描当前 Vault，并刷新状态栏。")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.scanOnStartup).onChange(async (value) => {
          this.plugin.settings.scanOnStartup = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("状态栏显示复习计数")
      .setDesc("在 Obsidian 底部状态栏显示今日和逾期数量，点击可打开 Review Center。")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.showStatusBarCount).onChange(async (value) => {
          this.plugin.settings.showStatusBarCount = value;
          await this.plugin.saveSettings();
          this.plugin.updateStatusBar();
        })
      );
  }
}

export function parseReviewIntervalDays(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return DEFAULT_SETTINGS.reviewIntervalDays;
  }

  return Math.min(parsed, 3650);
}
