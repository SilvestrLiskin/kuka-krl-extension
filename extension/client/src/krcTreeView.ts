import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

/**
 * Элемент дерева для файла KRL.
 */
export class KRLFileItem extends vscode.TreeItem {
  constructor(
    public readonly uri: vscode.Uri,
    public readonly fileType: "src" | "dat" | "sub",
  ) {
    super(path.basename(uri.fsPath), vscode.TreeItemCollapsibleState.None);

    this.tooltip = uri.fsPath;
    this.resourceUri = uri;

    // Описания в зависимости от типа файла
    switch (fileType) {
      case "src":
        this.description = "📄 Program";
        break;
      case "dat":
        this.description = "💾 Data";
        break;
      case "sub":
        this.description = "⚙️ Submit";
        break;
    }

    this.command = {
      command: "vscode.open",
      title: "Open file",
      arguments: [uri],
    };

    this.contextValue = "krlFile";
  }
}

/**
 * Элемент дерева для папки.
 */
export class FolderItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly folderPath: string,
    public readonly children: (FolderItem | KRLFileItem)[],
  ) {
    super(
      label,
      children.length > 0
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.None,
    );

    this.tooltip = folderPath;
    this.contextValue = "krlFolder";
  }
}

/**
 * Провайдер Tree View для структуры проекта KRC.
 * Отображает структуру папок KRC/R1 или плоский список файлов.
 */
export class KRCTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    vscode.TreeItem | undefined | null
  > = new vscode.EventEmitter();
  readonly onDidChangeTreeData: vscode.Event<
    vscode.TreeItem | undefined | null
  > = this._onDidChangeTreeData.event;

  private rootItems: (FolderItem | KRLFileItem)[] = [];

  constructor() {
    this.refresh();
  }

  /**
   * Обновляет данные дерева.
   */
  refresh(): void {
    this.buildTree().then(() => {
      this._onDidChangeTreeData.fire(undefined);
    });
  }

  /**
   * Строит дерево файлов и папок.
   */
  private async buildTree(): Promise<void> {
    this.rootItems = [];

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) return;

    for (const folder of workspaceFolders) {
      const rootPath = folder.uri.fsPath;

      // Ищем KRC или R1 папку
      const krcPath = path.join(rootPath, "KRC");
      const r1Path = path.join(rootPath, "R1");

      if (fs.existsSync(krcPath)) {
        const krcFolder = await this.buildFolderItem("🤖 KRC", krcPath);
        if (krcFolder) this.rootItems.push(krcFolder);
      } else if (fs.existsSync(r1Path)) {
        const r1Folder = await this.buildFolderItem("🤖 R1", r1Path);
        if (r1Folder) this.rootItems.push(r1Folder);
      } else {
        // Просто показываем все KRL файлы в корне, если структура не распознана
        const items = await this.buildFolderItem(`📁 ${folder.name}`, rootPath);
        if (items) this.rootItems.push(items);
      }
    }
  }

  /**
   * Рекурсивно строит элементы папки.
   */
  private async buildFolderItem(
    name: string,
    folderPath: string,
  ): Promise<FolderItem | null> {
    try {
      const entries = await fs.promises.readdir(folderPath, {
        withFileTypes: true,
      });
      const children: (FolderItem | KRLFileItem)[] = [];

      // Сначала добавляем папки
      const folders = entries.filter((e) => e.isDirectory());
      for (const folder of folders.sort((a, b) =>
        a.name.localeCompare(b.name),
      )) {
        const subPath = path.join(folderPath, folder.name);
        const folderName = folder.name.toUpperCase();

        // Добавляем эмодзи для известных системных папок KUKA
        let displayName = folder.name;
        if (folderName === "PROGRAM") displayName = "📂 " + folder.name;
        else if (folderName === "SYSTEM") displayName = "⚙️ " + folder.name;
        else if (folderName === "TP") displayName = "📱 " + folder.name;
        else if (folderName === "STEU") displayName = "🔌 " + folder.name;
        else if (folderName.includes("MADA")) displayName = "🔧 " + folder.name;
        else if (folderName === "R1") displayName = "🤖 " + folder.name;

        const subItem = await this.buildFolderItem(displayName, subPath);
        if (
          subItem &&
          (subItem.children.length > 0 || this.isImportantFolder(folder.name))
        ) {
          children.push(subItem);
        }
      }

      // Затем добавляем KRL файлы
      const files = entries.filter((e) => e.isFile());
      for (const file of files.sort((a, b) => a.name.localeCompare(b.name))) {
        const ext = path.extname(file.name).toLowerCase();
        if (ext === ".src" || ext === ".dat" || ext === ".sub") {
          const fileUri = vscode.Uri.file(path.join(folderPath, file.name));
          const fileType = ext.slice(1) as "src" | "dat" | "sub";
          children.push(new KRLFileItem(fileUri, fileType));
        }
      }

      if (children.length === 0 && !this.isImportantFolder(name)) {
        return null;
      }

      return new FolderItem(name, folderPath, children);
    } catch {
      // Ошибка чтения папки игнорируется
      return null;
    }
  }

  /**
   * Проверяет, является ли папка важной (должна отображаться даже если пуста).
   */
  private isImportantFolder(name: string): boolean {
    const important = ["KRC", "R1", "PROGRAM", "SYSTEM", "TP", "STEU", "MADA"];
    // Удаляем эмодзи перед проверкой, если они есть
    const cleanName = name.replace(/^[^\w\s]+\s*/, "");
    return important.includes(cleanName.toUpperCase());
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
    if (!element) {
      return Promise.resolve(this.rootItems);
    }

    if (element instanceof FolderItem) {
      return Promise.resolve(element.children);
    }

    return Promise.resolve([]);
  }

  getParent(): vscode.TreeItem | null {
    return null;
  }
}
