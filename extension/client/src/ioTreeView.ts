import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

/**
 * Tree item для I/O элемента
 */
export class IOItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly ioType: "input" | "output" | "analog-in" | "analog-out",
    public readonly index: number,
    public readonly locations: vscode.Location[],
    public readonly alias: string | undefined, // Added alias
    public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode
      .TreeItemCollapsibleState.Collapsed,
  ) {
    super(alias ? `${alias} (${label})` : label, collapsibleState); // Update label

    this.tooltip = alias
      ? `${alias} = ${label}\n${locations.length} uses`
      : `${label} - ${locations.length} uses`;
    this.description = `${locations.length} uses`;
    this.contextValue = "ioItem";
  }
}

/**
 * Tree item для места использования I/O
 */
export class IOLocation extends vscode.TreeItem {
  constructor(
    public readonly location: vscode.Location,
    public readonly lineText: string,
  ) {
    super(
      path.basename(location.uri.fsPath),
      vscode.TreeItemCollapsibleState.None,
    );

    const line = location.range.start.line + 1;
    this.description = `Line ${line}`;
    this.tooltip = lineText.trim();

    this.command = {
      command: "vscode.open",
      title: "Go to location",
      arguments: [location.uri, { selection: location.range }],
    };
  }
}

/**
 * Tree item для категории I/O (Inputs, Outputs, etc.)
 */
export class IOCategory extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly ioType: "input" | "output" | "analog-in" | "analog-out",
    public readonly items: IOItem[],
  ) {
    super(
      label,
      items.length > 0
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.None,
    );
    this.description = `${items.length} signals`;
  }
}

/**
 * Провайдер Tree View для I/O сигналов
 */
export class IOTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    vscode.TreeItem | undefined | null
  > = new vscode.EventEmitter();
  readonly onDidChangeTreeData: vscode.Event<
    vscode.TreeItem | undefined | null
  > = this._onDidChangeTreeData.event;

  private inputs: Map<number, vscode.Location[]> = new Map();
  private outputs: Map<number, vscode.Location[]> = new Map();
  private analogInputs: Map<number, vscode.Location[]> = new Map();
  private analogOutputs: Map<number, vscode.Location[]> = new Map();
  private aliases: Map<string, string> = new Map(); // Key: "input:1", Value: "Vacuum_OK"
  private lineTexts: Map<string, string> = new Map();

  constructor() {
    this.refresh();
  }

  refresh(): void {
    this.scanWorkspace().then(() => {
      this._onDidChangeTreeData.fire(undefined);
    });
  }

  private async scanWorkspace(): Promise<void> {
    this.inputs.clear();
    this.outputs.clear();
    this.analogInputs.clear();
    this.analogOutputs.clear();
    this.aliases.clear();
    this.lineTexts.clear();

    const krlFiles = await vscode.workspace.findFiles(
      "**/*.{src,dat,sub}",
      "**/node_modules/**",
    );

    for (const fileUri of krlFiles) {
      try {
        const content = await fs.promises.readFile(fileUri.fsPath, "utf8");
        const lines = content.split(/\r?\n/);

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];

          // $IN[n]
          const inMatches = line.matchAll(/\$IN\[(\d+)\]/gi);
          for (const match of inMatches) {
            const index = parseInt(match[1]);
            const location = new vscode.Location(
              fileUri,
              new vscode.Range(
                i,
                match.index!,
                i,
                match.index! + match[0].length,
              ),
            );
            if (!this.inputs.has(index)) this.inputs.set(index, []);
            this.inputs.get(index)!.push(location);
            this.lineTexts.set(`${fileUri.fsPath}:${i}`, line);
          }

          // $OUT[n]
          const outMatches = line.matchAll(/\$OUT\[(\d+)\]/gi);
          for (const match of outMatches) {
            const index = parseInt(match[1]);
            const location = new vscode.Location(
              fileUri,
              new vscode.Range(
                i,
                match.index!,
                i,
                match.index! + match[0].length,
              ),
            );
            if (!this.outputs.has(index)) this.outputs.set(index, []);
            this.outputs.get(index)!.push(location);
            this.lineTexts.set(`${fileUri.fsPath}:${i}`, line);
          }

          // $ANIN[n]
          const anInMatches = line.matchAll(/\$ANIN\[(\d+)\]/gi);
          for (const match of anInMatches) {
            const index = parseInt(match[1]);
            const location = new vscode.Location(
              fileUri,
              new vscode.Range(
                i,
                match.index!,
                i,
                match.index! + match[0].length,
              ),
            );
            if (!this.analogInputs.has(index)) this.analogInputs.set(index, []);
            this.analogInputs.get(index)!.push(location);
            this.lineTexts.set(`${fileUri.fsPath}:${i}`, line);
          }

          // $ANOUT[n]
          const anOutMatches = line.matchAll(/\$ANOUT\[(\d+)\]/gi);
          for (const match of anOutMatches) {
            const index = parseInt(match[1]);
            const location = new vscode.Location(
              fileUri,
              new vscode.Range(
                i,
                match.index!,
                i,
                match.index! + match[0].length,
              ),
            );
            if (!this.analogOutputs.has(index))
              this.analogOutputs.set(index, []);
            this.analogOutputs.get(index)!.push(location);
            this.analogOutputs.get(index)!.push(location);
            this.lineTexts.set(`${fileUri.fsPath}:${i}`, line);
          }

          // SIGNAL Alias $IN[n] / $OUT[n] ...
          // Regex: SIGNAL\s+([a-zA-Z0-9_]+)\s+\$(IN|OUT|ANIN|ANOUT)\s*\[\s*(\d+)\s*\]
          const signalMatches = line.matchAll(
            /SIGNAL\s+([a-zA-Z0-9_]+)\s+\$(IN|OUT|ANIN|ANOUT)\s*\[\s*(\d+)\s*\]/gi,
          );
          for (const match of signalMatches) {
            const alias = match[1];
            const typeStr = match[2].toUpperCase();
            const index = parseInt(match[3]);

            let typeKey = "input";
            if (typeStr === "OUT") typeKey = "output";
            else if (typeStr === "ANIN") typeKey = "analog-in";
            else if (typeStr === "ANOUT") typeKey = "analog-out";

            this.aliases.set(`${typeKey}:${index}`, alias);
          }
        }
      } catch {
        // Error reading KRL file - silently ignored
      }
    }
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
    if (!element) {
      // Корневые элементы - категории
      const categories: IOCategory[] = [];

      const inputItems = this.createIOItems(this.inputs, "input");
      categories.push(
        new IOCategory("📥 Digital Inputs ($IN)", "input", inputItems),
      );

      const outputItems = this.createIOItems(this.outputs, "output");
      categories.push(
        new IOCategory("📤 Digital Outputs ($OUT)", "output", outputItems),
      );

      const anInItems = this.createIOItems(this.analogInputs, "analog-in");
      categories.push(
        new IOCategory("📊 Analog Inputs ($ANIN)", "analog-in", anInItems),
      );

      const anOutItems = this.createIOItems(this.analogOutputs, "analog-out");
      categories.push(
        new IOCategory("📈 Analog Outputs ($ANOUT)", "analog-out", anOutItems),
      );

      return Promise.resolve(categories);
    }

    if (element instanceof IOCategory) {
      return Promise.resolve(element.items);
    }

    if (element instanceof IOItem) {
      const locations = element.locations.map((loc) => {
        const key = `${loc.uri.fsPath}:${loc.range.start.line}`;
        const lineText = this.lineTexts.get(key) || "";
        return new IOLocation(loc, lineText);
      });
      return Promise.resolve(locations);
    }

    return Promise.resolve([]);
  }

  private createIOItems(
    map: Map<number, vscode.Location[]>,
    type: "input" | "output" | "analog-in" | "analog-out",
  ): IOItem[] {
    const items: IOItem[] = [];
    const prefix =
      type === "input"
        ? "$IN"
        : type === "output"
          ? "$OUT"
          : type === "analog-in"
            ? "$ANIN"
            : "$ANOUT";

    const sortedKeys = [...map.keys()].sort((a, b) => a - b);
    for (const index of sortedKeys) {
      const locations = map.get(index)!;
      const alias = this.aliases.get(`${type}:${index}`);
      items.push(
        new IOItem(`${prefix}[${index}]`, type, index, locations, alias),
      );
    }

    return items;
  }

  public async renameSignal(item: IOItem): Promise<void> {
    // 1. Ask for new name
    const newName = await vscode.window.showInputBox({
      prompt: `Enter alias for ${item.label}`,
      value: item.alias || "",
      placeHolder: "e.g. Vacuum_OK",
      validateInput: (text) => {
        if (!text) return null; // Allow empty to remove alias
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(text)) {
          return "Invalid KRL identifier (must start with letter/_ and contain only letters/numbers/_)";
        }
        return null;
      },
    });

    if (newName === undefined) return; // Cancelled

    // 2. Find $config.dat
    const configFiles = await vscode.workspace.findFiles(
      "**/*config.dat",
      "**/node_modules/**",
    );
    if (configFiles.length === 0) {
      vscode.window.showErrorMessage(
        "Could not find '$config.dat' in workspace. Cannot save alias.",
      );
      return;
    }

    let configUri = configFiles[0];
    if (configFiles.length > 1) {
      const picked = await vscode.window.showQuickPick(
        configFiles.map((f) => ({
          label: vscode.workspace.asRelativePath(f),
          uri: f,
        })),
        {
          placeHolder: "Select $config.dat to save alias",
        },
      );
      if (!picked) return;
      configUri = picked.uri;
    }

    // 3. Update file content
    try {
      const document = await vscode.workspace.openTextDocument(configUri);
      let text = document.getText();
      const signalType =
        item.ioType === "input"
          ? "$IN"
          : item.ioType === "output"
            ? "$OUT"
            : item.ioType === "analog-in"
              ? "$ANIN"
              : "$ANOUT";

      // Regex to find existing declaration: SIGNAL <Name> $IN[n]
      const existingRegex = new RegExp(
        `SIGNAL\\s+([a-zA-Z0-9_]+)\\s+\\${signalType}\\s*\\[\\s*${item.index}\\s*\\]`,
        "i",
      );
      const match = text.match(existingRegex);

      const newDecl = `SIGNAL ${newName} ${signalType}[${item.index}]`;

      if (match) {
        // Replace existing
        if (!newName) {
          // Remove line if alias cleared
          // But usually we just want to remove the declaration
          // Simple replace:
          text = text.replace(
            existingRegex,
            `; SIGNAL ${match[1]} ${signalType}[${item.index}] ; Removed`,
          );
        } else {
          text = text.replace(existingRegex, newDecl);
        }
      } else if (newName) {
        // Append new declaration
        // Try to find "USER GLOBALS" fold
        const userGlobalsRegex = /;\s*FOLD\s+USER\s+GLOBALS/i;
        const foldMatch = text.match(userGlobalsRegex);

        if (foldMatch && foldMatch.index !== undefined) {
          const insertPos = text.indexOf("\n", foldMatch.index) + 1;
          text =
            text.slice(0, insertPos) + newDecl + "\n" + text.slice(insertPos);
        } else {
          // Append to end if no fold found
          text += `\n${newDecl}`;
        }
      }

      // 4. Write back
      const edit = new vscode.WorkspaceEdit();
      edit.replace(
        configUri,
        new vscode.Range(0, 0, document.lineCount, 0),
        text,
      );
      await vscode.workspace.applyEdit(edit);
      await document.save();

      // 5. Refresh tree
      this.refresh();
      vscode.window.showInformationMessage(
        `Signal updated: ${signalType}[${item.index}] -> ${newName || "(removed)"}`,
      );
    } catch (e) {
      vscode.window.showErrorMessage(`Failed to update $config.dat: ${e}`);
    }
  }
}
