import * as vscode from "vscode";
import { t } from "./i18n";

export class CommandsTreeProvider implements vscode.TreeDataProvider<CommandItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    CommandItem | undefined | null | void
  > = new vscode.EventEmitter<CommandItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    CommandItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: CommandItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: CommandItem): Thenable<CommandItem[]> {
    if (element) {
      return Promise.resolve([]);
    } else {
      return Promise.resolve(this.getCommands());
    }
  }

  private getCommands(): CommandItem[] {
    return [
      new CommandItem(
        "KRL Calculator",
        "krl.showCalculator",
        "calculator",
        t("command.calculator") || "Open Frame Calculator",
      ),
      new CommandItem(
        "Clean Up Variables",
        "krl.cleanupUnusedVariables",
        "trash",
        t("command.cleanup") || "Remove unused variables",
      ),
      new CommandItem(
        "Format Document",
        "krl.formatDocument",
        "json",
        t("command.formatDocument") || "Format current file",
      ),
      new CommandItem(
        "Sort Declarations",
        "krl.sortDeclarations",
        "list-ordered",
        t("command.sortDeclarations") || "Sort variables by type",
      ),
      new CommandItem(
        "Fold All",
        "krl.foldAll",
        "fold",
        t("command.foldAll") || "Collapse all regions",
      ),
      new CommandItem(
        "Unfold All",
        "krl.unfoldAll",
        "unfold",
        t("command.unfoldAll") || "Expand all regions",
      ),
      new CommandItem(
        "Refresh I/O",
        "krl.refreshIOView",
        "refresh",
        t("command.refreshIOView") || "Refresh I/O List",
      ),
    ];
  }
}

class CommandItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly commandId: string,
    public readonly icon: string,
    public readonly tooltip: string,
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.tooltip = tooltip;
    this.iconPath = new vscode.ThemeIcon(icon);
    this.command = {
      command: commandId,
      title: label,
      tooltip: tooltip,
    };
  }
}
