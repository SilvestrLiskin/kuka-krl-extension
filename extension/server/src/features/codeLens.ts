import { CodeLens, CodeLensParams, Range } from "vscode-languageserver/node";
import { TextDocuments } from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { t } from "../lib/i18n";

/**
 * Code Lens Provider - показывает метрики над функциями
 * Уникальная функция: количество строк и ссылок
 */
export class CodeLensProvider {
  /**
   * Генерирует Code Lens для документа
   */
  public onCodeLens(
    params: CodeLensParams,
    documents: TextDocuments<TextDocument>,
    state: {
      functionsDeclared: Array<{ name: string; uri: string; line: number }>;
    },
  ): CodeLens[] {
    const document = documents.get(params.textDocument.uri);
    if (!document) return [];

    const codeLenses: CodeLens[] = [];
    const text = document.getText();
    const lines = text.split(/\r?\n/);

    // Найти все определения функций в текущем документе
    const defRegex = /^\s*(?:GLOBAL\s+)?(DEF|DEFFCT)\s+(?:\w+\s+)?(\w+)\s*\(/i;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = defRegex.exec(line);

      if (match) {
        const functionName = match[2];
        const functionType = match[1].toUpperCase();

        // Найти конец функции
        const endPattern =
          functionType === "DEFFCT" ? /^\s*ENDFCT\b/i : /^\s*END\b/i;
        let endLine = i + 1;
        for (let j = i + 1; j < lines.length; j++) {
          if (endPattern.test(lines[j])) {
            endLine = j;
            break;
          }
        }

        const lineCount = endLine - i + 1;

        // Подсчитать количество вызовов этой функции в workspace
        const referenceCount = this.countReferences(functionName, state);

        // Создать Code Lens
        const range: Range = {
          start: { line: i, character: 0 },
          end: { line: i, character: line.length },
        };

        codeLenses.push({
          range,
          data: {
            functionName,
            lineCount,
            referenceCount,
            uri: params.textDocument.uri,
          },
        });
      }
    }

    return codeLenses;
  }

  /**
   * Разрешает Code Lens (добавляет команду и заголовок)
   */
  public onCodeLensResolve(codeLens: CodeLens): CodeLens {
    const data = codeLens.data as {
      functionName: string;
      lineCount: number;
      referenceCount: number;
    };

    if (data) {
      codeLens.command = {
        title: t("codeLens.metrics", data.lineCount, data.referenceCount),
        command: "", // Нет команды - только информационный
        arguments: [],
      };
    }

    return codeLens;
  }

  /**
   * Подсчитывает количество вызовов функции в workspace
   */
  private countReferences(
    functionName: string,
    state: {
      functionsDeclared: Array<{ name: string; uri: string; line: number }>;
    },
  ): number {
    // Считаем количество функций с таким именем (упрощённо)
    // В реальности нужно искать все вызовы по всем файлам
    const count = state.functionsDeclared.filter(
      (f) => f.name.toUpperCase() === functionName.toUpperCase(),
    ).length;

    // Если функция объявлена, значит есть минимум 1 (само объявление)
    return Math.max(0, count);
  }
}
