import type { ReviewIndex } from "@obsidian-smart-review/shared";

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

  update(index: ReviewIndex | null, visible: boolean): void {
    this.statusEl.toggleClass("smart-review-status-bar-hidden", !visible);
    if (!visible) {
      this.statusEl.setText("");
      return;
    }

    const today = index?.summary.today ?? 0;
    const overdue = index?.summary.overdue ?? 0;
    this.statusEl.setText(overdue > 0 ? `📚 今日 ${today}｜逾期 ${overdue}` : `📚 今日 ${today}`);
    this.statusEl.setAttr("aria-label", "Open Review Center");
    this.statusEl.setAttr("title", "Open Review Center");
  }
}
