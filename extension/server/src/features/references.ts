import {
  ReferenceParams,
  Location,
  Position,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { TextDocuments } from "vscode-languageserver/node";
import { ServerState } from "../types";
import { getWordAtPosition } from "../lib/parser";
import { getAllSourceFiles } from "../lib/fileSystem";
import { isInsideString, escapeRegex, getCodePart } from "../lib/utils";
import { URI } from "vscode-uri";
import * as fs from "fs";

export class ReferencesProvider {
  /**
   * Находит все ссылки на символ в рабочем пространстве.
   */
  public async onReferences(
    params: ReferenceParams,
    documents: TextDocuments<TextDocument>,
    state: ServerState,
  ): Promise<Location[]> {
    const doc = documents.get(params.textDocument.uri);
    if (!doc || !state.workspaceRoot) return [];

    const lines = doc.getText().split(/\r?\n/);
    const lineText = lines[params.position.line];

    const wordInfo = getWordAtPosition(lineText, params.position.character);
    if (!wordInfo) return [];

    const symbolName = wordInfo.word;
    const locations: Location[] = [];

    // Поиск во всех файлах
    const files = await getAllSourceFiles(state.workspaceRoot);

    for (const filePath of files) {
      const uri = URI.file(filePath).toString();
      let content: string;

      const openDoc = documents.get(uri);
      if (openDoc) {
        content = openDoc.getText();
      } else {
        try {
          content = await fs.promises.readFile(filePath, "utf8");
        } catch {
          continue;
        }
      }

      const fileLocations = this.findReferencesInContent(
        uri,
        content,
        symbolName,
        params.context.includeDeclaration,
      );
      locations.push(...fileLocations);
    }

    return locations;
  }

  /**
   * Ищет вхождения в тексте файла.
   */
  private findReferencesInContent(
    uri: string,
    content: string,
    symbolName: string,
    includeDeclaration: boolean,
  ): Location[] {
    const locations: Location[] = [];
    const lines = content.split(/\r?\n/);

    const regex = new RegExp(`\\b${escapeRegex(symbolName)}\\b`, "gi");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const codePart = getCodePart(line);

      // Проверка строки объявления
      const isDeclarationLine =
        /^\s*(?:GLOBAL\s+)?(?:DECL|DEF|DEFFCT|SIGNAL|STRUC|ENUM)\b/i.test(line);

      let match;
      regex.lastIndex = 0;

      while ((match = regex.exec(codePart)) !== null) {
        if (isInsideString(codePart, match.index)) continue;

        // Если это строка объявления, нужно проверить, является ли найденное слово
        // объявляемой переменной или используется в инициализации.
        if (isDeclarationLine) {
          // Упрощенная проверка: если слово стоит сразу после типа или ключевого слова, это объявление.
          // Если есть знак '=', и слово после него - это использование.
          const beforeMatch = codePart.substring(0, match.index);
          const afterMatch = codePart.substring(match.index + symbolName.length);

          const isInitialization = beforeMatch.includes("=");
          // Также может быть использование в массиве: DECL INT arr[N]

          // Если это объявление и мы не должны включать декларации -> пропускаем
          // Но если это использование в строке декларации (например a = b), то включаем.
          // Сложно надежно определить без парсера.
          // Эвристика: если перед словом есть '=' -> использование.
          if (!includeDeclaration && !isInitialization) {
            // Вероятно, это само объявление.
            // Но может быть DECL INT a[N], где N - константа (использование).
            // Оставим пропуск только для первого вхождения в строке DECL, если нет '='
            // Это не идеально, но лучше чем было.
            continue;
          }
        }

        locations.push(
          Location.create(uri, {
            start: Position.create(i, match.index),
            end: Position.create(i, match.index + symbolName.length),
          }),
        );
      }
    }

    return locations;
  }
}
