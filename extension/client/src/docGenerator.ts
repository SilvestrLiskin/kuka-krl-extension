import * as vscode from "vscode";
import * as path from "path";

/**
 * Генератор документации для KRL файлов.
 * Создаёт Markdown документацию из комментариев в коде.
 */
export class DocGenerator {
  /**
   * Генерирует документацию для текущего файла.
   */
  public async generateDocumentation(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage(
        "Нет открытого файла для генерации документации.",
      );
      return;
    }

    const document = editor.document;
    const text = document.getText();
    const lines = text.split(/\r?\n/);
    const fileName = path.basename(
      document.fileName,
      path.extname(document.fileName),
    );

    const docContent: string[] = [];

    // Заголовок
    docContent.push(`# ${fileName} Documentation`);
    docContent.push("");
    docContent.push(
      `> Auto-generated from \`${path.basename(document.fileName)}\``,
    );
    docContent.push("");
    docContent.push("---");
    docContent.push("");

    // Метаданные файла
    const fileInfo = this.extractFileInfo(lines);
    if (Object.keys(fileInfo).length > 0) {
      docContent.push("## File Information");
      docContent.push("");
      for (const [key, value] of Object.entries(fileInfo)) {
        docContent.push(`- **${key}**: ${value}`);
      }
      docContent.push("");
    }

    // Функции
    const functions = this.extractFunctions(lines);
    if (functions.length > 0) {
      docContent.push("## Functions");
      docContent.push("");
      docContent.push("| Name | Type | Parameters | Line |");
      docContent.push("|------|------|------------|------|");
      for (const func of functions) {
        docContent.push(
          `| \`${func.name}\` | ${func.type} | ${func.params || "-"} | ${func.line + 1} |`,
        );
      }
      docContent.push("");

      // Детальное описание функций
      docContent.push("### Function Details");
      docContent.push("");
      for (const func of functions) {
        docContent.push(`#### ${func.name}`);
        docContent.push("");
        docContent.push(`- **Type**: ${func.type}`);
        docContent.push(`- **Line**: ${func.line + 1}`);
        if (func.params) {
          docContent.push(`- **Parameters**: \`${func.params}\``);
        }
        if (func.description) {
          docContent.push(`- **Description**: ${func.description}`);
        }
        docContent.push("");
      }
    }

    // Переменные GLOBAL
    const globalVars = this.extractGlobalVariables(lines);
    if (globalVars.length > 0) {
      docContent.push("## Global Variables");
      docContent.push("");
      docContent.push("| Name | Type | Line |");
      docContent.push("|------|------|------|");
      for (const v of globalVars) {
        docContent.push(`| \`${v.name}\` | ${v.type} | ${v.line + 1} |`);
      }
      docContent.push("");
    }

    // Сохранить файл (используя VS Code API)
    const docPathStr = document.fileName.replace(
      /\.(src|dat|sub)$/i,
      "_DOC.md",
    );
    const docUri = vscode.Uri.file(docPathStr);
    const contentBuffer = Buffer.from(docContent.join("\n"), "utf8");

    try {
      await vscode.workspace.fs.writeFile(docUri, contentBuffer);

      // Открыть документ
      const doc = await vscode.workspace.openTextDocument(docUri);
      await vscode.window.showTextDocument(doc, { preview: false });

      vscode.window.showInformationMessage(
        `Документация создана: ${path.basename(docPathStr)}`,
      );
    } catch (err) {
      vscode.window.showErrorMessage(
        `Ошибка при сохранении документации: ${err}`,
      );
    }
  }

  /**
   * Извлекает метаданные файла из комментариев.
   */
  private extractFileInfo(lines: string[]): Record<string, string> {
    const info: Record<string, string> = {};
    const patterns: Record<string, RegExp> = {
      Author: /;\s*(?:Author|Автор|Yazar):\s*(.+)/i,
      Date: /;\s*(?:Date|Дата|Tarih):\s*(.+)/i,
      Version: /;\s*(?:Version|Версия|Versiyon):\s*(.+)/i,
      Description: /;\s*(?:Description|Описание|Açıklama):\s*(.+)/i,
    };

    // Ищем только в первых 50 строках
    for (let i = 0; i < Math.min(50, lines.length); i++) {
      for (const [key, regex] of Object.entries(patterns)) {
        const match = lines[i].match(regex);
        if (match && !info[key]) {
          info[key] = match[1].trim();
        }
      }
    }

    return info;
  }

  /**
   * Извлекает функции из кода.
   */
  private extractFunctions(lines: string[]): Array<{
    name: string;
    type: string;
    params: string;
    line: number;
    description: string;
  }> {
    const functions: Array<{
      name: string;
      type: string;
      params: string;
      line: number;
      description: string;
    }> = [];

    const defRegex =
      /^\s*(?:GLOBAL\s+)?(DEF|DEFFCT)\s+(?:(\w+)\s+)?(\w+)\s*\(([^)]*)\)/i;

    for (let i = 0; i < lines.length; i++) {
      const match = defRegex.exec(lines[i]);
      if (match) {
        const type =
          match[1].toUpperCase() === "DEFFCT" ? "Function" : "Module";
        const returnType = match[2] || "";
        const name = match[3];
        const params = match[4].trim();

        // Ищем описание в предыдущих комментариях
        let description = "";
        for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
          const commentMatch = lines[j].match(/;\s*(.+)/);
          if (commentMatch && !lines[j].match(/;(FOLD|ENDFOLD)/i)) {
            description = commentMatch[1].trim();
            break;
          }
        }

        functions.push({
          name,
          type: returnType ? `${type} (returns ${returnType})` : type,
          params,
          line: i,
          description,
        });
      }
    }

    return functions;
  }

  /**
   * Извлекает глобальные переменные.
   */
  private extractGlobalVariables(lines: string[]): Array<{
    name: string;
    type: string;
    line: number;
  }> {
    const variables: Array<{ name: string; type: string; line: number }> = [];
    const declRegex = /^\s*GLOBAL\s+(?:DECL\s+)?(\w+)\s+(\w+)/i;

    for (let i = 0; i < lines.length; i++) {
      const match = declRegex.exec(lines[i]);
      if (match) {
        variables.push({
          type: match[1],
          name: match[2],
          line: i,
        });
      }
    }

    return variables;
  }
}
