import { FuzzySuggestModal, type App } from "obsidian";

export class ModelPickerModal extends FuzzySuggestModal<string> {
  constructor(app: App, private readonly models: string[], private readonly onChoose: (model: string) => void) {
    super(app);
  }

  getItems(): string[] {
    return this.models;
  }

  getItemText(item: string): string {
    return item;
  }

  onChooseItem(item: string): void {
    this.onChoose(item);
  }
}
