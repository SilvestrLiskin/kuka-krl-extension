import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { t } from "../i18n";

/**
 * Парсит строку DECL для извлечения имен переменных.
 * Пример: "DECL INT a, b[5], c" -> ["a", "b", "c"]
 */
function extractVariableNames(declLine: string): string[] {
  // Удаляем DECL, типы, GLOBAL и т.д. чтобы получить список переменных
  const parts = declLine.split(";"); // Удаляем комментарии
  let content = parts[0].trim();

  // Удаляем ключевые слова
  content = content.replace(
    /^(GLOBAL\s+)?(CONST\s+)?(DECL\s+)?(GLOBAL\s+)?(CONST\s+)?/i,
    "",
  );

  // Пытаемся найти список переменных
  // Обычно первое слово - это тип, остальное - переменные.
  const firstSpace = content.indexOf(" ");
  if (firstSpace === -1) return []; // Нет переменных? "DECL INT" ?

  const varListStr = content.substring(firstSpace).trim();

  const variables: string[] = [];
  let current = "";
  let bracketDepth = 0;

  for (let i = 0; i < varListStr.length; i++) {
    const char = varListStr[i];
    if (char === "[") bracketDepth++;
    if (char === "]") bracketDepth--;
    if (char === "," && bracketDepth === 0) {
      variables.push(cleanVarName(current));
      current = "";
    } else {
      current += char;
    }
  }
  if (current) variables.push(cleanVarName(current));

  return variables.filter((v) => !!v);
}

function cleanVarName(raw: string): string {
  let name = raw.trim();
  // Удаляем размерность массива: a[5] -> a
  name = name.replace(/\[.*?\]/g, "");
  // Удаляем инициализацию: a = 5 -> a
  name = name.split("=")[0].trim();
  return name;
}

/**
 * Очищает неиспользуемые переменные в .dat файле.
 */
export async function cleanupUnusedVariables() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const doc = editor.document;
  const ext = path.extname(doc.fileName).toLowerCase();

  let srcPath: string;
  let datPath: string;

  if (ext === ".src") {
    srcPath = doc.fileName;
    datPath = doc.fileName.replace(/\.src$/i, ".dat");
  } else if (ext === ".dat") {
    datPath = doc.fileName;
    srcPath = doc.fileName.replace(/\.dat$/i, ".src");
  } else {
    vscode.window.showWarningMessage(t("warning.noActiveKrlFile"));
    return;
  }

  if (!fs.existsSync(datPath)) {
    vscode.window.showWarningMessage("Не найден соответствующий .dat файл.");
    return;
  }

  if (!fs.existsSync(srcPath)) {
    vscode.window.showWarningMessage(
      "Не найден соответствующий .src файл для проверки использования.",
    );
    return;
  }

  const datDoc = await vscode.workspace.openTextDocument(datPath);
  const srcDoc = await vscode.workspace.openTextDocument(srcPath);

  const datText = datDoc.getText();
  const srcText = srcDoc.getText();

  const lines = datText.split(/\r?\n/);
  const unusedDecls: { lineIndex: number; varNames: string[] }[] = [];

  // 1. Находим все объявления в DAT
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimLine = line.trim();

    // Пропускаем комментарии
    if (trimLine.startsWith(";")) continue;

    // Пропускаем GLOBAL объявления - их небезопасно удалять, так как они могут использоваться в других файлах
    if (/\bGLOBAL\b/i.test(trimLine)) continue;

    // Проверяем, является ли это DECL
    if (
      !/\b(DECL|INT|REAL|BOOL|CHAR|FRAME|POS|E6POS|E6AXIS|AXIS|LOAD|SIGNAL|STRING|STRUC|ENUM)\b/i.test(
        trimLine,
      )
    ) {
      continue;
    }

    // Исключаем специфические строки KUKA, например "&ACCESS"
    if (trimLine.startsWith("&")) continue;

    const vars = extractVariableNames(trimLine);
    if (vars.length === 0) continue;

    // Проверяем использование в SRC (и в самом DAT!)
    // Простой поиск подстроки.
    let isUsed = false;

    for (const v of vars) {
      const regex = new RegExp(`\\b${v}\\b`, "i");

      // Проверка в SRC
      if (regex.test(srcText)) {
        isUsed = true;
        break;
      }

      // Проверка в DAT (исключая саму строку объявления)
      // Если переменная появляется в DAT более одного раза (например, используется для инициализации другой), она используется.
      const datWithoutLine = lines.filter((_, idx) => idx !== i).join("\n");
      if (regex.test(datWithoutLine)) {
        isUsed = true;
        break;
      }
    }

    if (!isUsed) {
      unusedDecls.push({ lineIndex: i, varNames: vars });
    }
  }

  if (unusedDecls.length === 0) {
    vscode.window.showInformationMessage("Неиспользуемые переменные не найдены.");
    return;
  }

  // Запрос пользователю
  const result = await vscode.window.showInformationMessage(
    `Найдено ${unusedDecls.length} строк с неиспользуемыми переменными. Удалить их?`,
    "Да",
    "Нет",
  );

  if (result === "Да") {
    const edit = new vscode.WorkspaceEdit();

    // Удаление строк
    for (const decl of unusedDecls) {
      const line = datDoc.lineAt(decl.lineIndex);
      edit.delete(datDoc.uri, line.rangeIncludingLineBreak);
    }

    await vscode.workspace.applyEdit(edit);
    vscode.window.showInformationMessage(
      `Удалено ${unusedDecls.length} строк.`,
    );
  }
}
