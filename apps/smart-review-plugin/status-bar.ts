import type { ReviewIndex } from "@smart-review/shared";
import { t, type SmartReviewLocale } from "./i18n";

export class SmartReviewStatusBar {
  constructor(
    private readonly statusEl: HTMLElement,
    private readonly openReviewCenter: () => void
  ) {
    this.statusEl.addClass("smart-review-status-bar");
    this.statusEl.onclick = () => {
      this.openReviewCenter();
    };
  }

  update(index: ReviewIndex | null, visible: boolean, locale: SmartReviewLocale): void {
    this.statusEl.toggleClass("smart-review-status-bar-hidden", !visible);
    if (!visible) {
      this.statusEl.setText("");
      return;
    }

    const today = index?.summary.today ?? 0;
    const overdue = index?.summary.overdue ?? 0;
    this.statusEl.setText(overdue > 0 ? t(locale, "statusBarOverdue", { today, overdue }) : t(locale, "statusBarToday", { today }));
    this.statusEl.setAttr("aria-label", t(locale, "openCenter"));
    this.statusEl.setAttr("title", t(locale, "openCenter"));
  }
}
