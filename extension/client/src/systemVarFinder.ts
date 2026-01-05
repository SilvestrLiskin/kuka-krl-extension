import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { t } from "./i18n";

// SystemVarInfo interface removed - not used

/**
 * Ищет все системные переменные ($...) в workspace
 */
export async function findSystemVariables(): Promise<
  Map<string, vscode.Location[]>
> {
  const results = new Map<string, vscode.Location[]>();

  const krlFiles = await vscode.workspace.findFiles(
    "**/*.{src,dat,sub}",
    "**/node_modules/**",
  );

  // Паттерн для системных переменных: $WORD или $WORD.SUBWORD или $WORD[n]
  const sysVarPattern =
    /\$[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)?(?:\[\d+\])?/g;

  for (const fileUri of krlFiles) {
    try {
      const content = await fs.promises.readFile(fileUri.fsPath, "utf8");
      const lines = content.split(/\r?\n/);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Пропускаем комментарии
        const commentIndex = line.indexOf(";");
        const codePart =
          commentIndex >= 0 ? line.substring(0, commentIndex) : line;

        const matches = codePart.matchAll(sysVarPattern);
        for (const match of matches) {
          const varName = match[0].toUpperCase();
          const location = new vscode.Location(
            fileUri,
            new vscode.Range(
              i,
              match.index!,
              i,
              match.index! + match[0].length,
            ),
          );

          if (!results.has(varName)) {
            results.set(varName, []);
          }
          results.get(varName)!.push(location);
        }
      }
    } catch {
      // Игнорируем ошибки чтения
    }
  }

  return results;
}

/**
 * Показывает Quick Pick со списком найденных системных переменных
 */
export async function showSystemVariablesPicker(): Promise<void> {
  const statusBar = vscode.window.setStatusBarMessage(
    "$(sync~spin) Scanning for system variables...",
  );

  try {
    const sysVars = await findSystemVariables();

    if (sysVars.size === 0) {
      vscode.window.showInformationMessage(t("info.noSystemVariablesFound"));
      return;
    }

    // Создаём элементы для Quick Pick
    interface QuickPickItemWithData extends vscode.QuickPickItem {
      varName: string;
    }

    const items: QuickPickItemWithData[] = [];
    const sortedVars = [...sysVars.entries()].sort((a, b) =>
      a[0].localeCompare(b[0]),
    );

    for (const [varName, locations] of sortedVars) {
      items.push({
        label: varName,
        description: `${locations.length} ${locations.length === 1 ? "use" : "uses"}`,
        detail: getUniqueFiles(locations),
        varName: varName,
      });
    }

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: t("picker.selectSystemVariable"),
      matchOnDescription: true,
      matchOnDetail: true,
    });

    if (selected) {
      const locations = sysVars.get(selected.varName)!;

      if (locations.length === 1) {
        // Если только одно использование - открываем сразу
        await vscode.commands.executeCommand("vscode.open", locations[0].uri, {
          selection: locations[0].range,
        });
      } else {
        // Если несколько - показываем Peek References
        const firstLoc = locations[0];
        await vscode.commands.executeCommand(
          "editor.action.peekLocations",
          firstLoc.uri,
          firstLoc.range.start,
          locations,
          "peek",
        );
      }
    }
  } finally {
    statusBar.dispose();
  }
}

/**
 * Возвращает строку с уникальными файлами
 */
function getUniqueFiles(locations: vscode.Location[]): string {
  const files = new Set(locations.map((l) => path.basename(l.uri.fsPath)));
  const arr = [...files];
  if (arr.length <= 3) {
    return arr.join(", ");
  }
  return `${arr.slice(0, 3).join(", ")} +${arr.length - 3} more`;
}
