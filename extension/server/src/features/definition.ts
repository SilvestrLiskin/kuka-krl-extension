import {
  DefinitionParams,
  Location,
  Position,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { TextDocuments } from "vscode-languageserver/node";
import { ServerState, EnclosuresLines } from "../types";
import { isSymbolDeclared, getWordAtPosition } from "../lib/parser";

export class SymbolResolver {
  /**
   * Находит определение символа (Go to Definition).
   */
  public async onDefinition(
    params: DefinitionParams,
    documents: TextDocuments<TextDocument>,
    state: ServerState,
  ): Promise<Location | undefined> {
    const doc = documents.get(params.textDocument.uri);
    if (!doc || !state.workspaceRoot) return;

    const lines = doc.getText().split(/\r?\n/);
    const lineText = lines[params.position.line];

    // Пропускаем строки объявления (чтобы не переходить на самого себя странным образом)
    if (
      /^\s*(GLOBAL\s+)?(DEF|DEFFCT|DECL\s+INT|DECL\s+REAL|DECL\s+BOOL|DECL\s+FRAME)\b/i.test(
        lineText,
      )
    )
      return;

    // Пропускаем подпеременные (свойства структур)
    if (getWordAtPosition(lineText, params.position.character)?.isSubvariable) {
      return;
    }

    const functionName = getWordAtPosition(
      lineText,
      params.position.character,
    )?.word;
    if (!functionName) return;

    // 1. Поиск функции
    const resultFct = await isSymbolDeclared(
      state.workspaceRoot,
      functionName,
      "function",
    );
    if (resultFct != undefined) {
      return Location.create(resultFct.uri, {
        start: Position.create(resultFct.line, resultFct.startChar),
        end: Position.create(resultFct.line, resultFct.endChar),
      });
    }

    // 2. Поиск структуры (типа)
    for (const key in state.structDefinitions) {
      if (key === functionName) {
        const resultStruc = await isSymbolDeclared(
          state.workspaceRoot,
          functionName,
          "struc",
        );
        if (resultStruc != undefined) {
          return Location.create(resultStruc.uri, {
            start: Position.create(resultStruc.line, resultStruc.startChar),
            end: Position.create(resultStruc.line, resultStruc.endChar),
          });
        }
      }
    }

    // 3. Поиск переменной
    const enclosures = this.findEnclosuresLines(params.position.line, lines);

    // Проверяем наличие в списке известных переменных
    for (const element of state.mergedVariables) {
      if (element.name.toUpperCase() === functionName.toUpperCase()) {
        // А. Локальный поиск (в текущей области видимости)
        const scopedResult = await isSymbolDeclared(
          state.workspaceRoot,
          functionName,
          "variable",
          params.textDocument.uri,
          enclosures.upperLine,
          enclosures.bottomLine,
          lines.join("\n"),
        );

        if (scopedResult) {
          return Location.create(scopedResult.uri, {
            start: Position.create(scopedResult.line, scopedResult.startChar),
            end: Position.create(scopedResult.line, scopedResult.endChar),
          });
        }

        // Б. Глобальный поиск
        const resultVar = await isSymbolDeclared(
          state.workspaceRoot,
          functionName,
          "variable",
        );

        if (resultVar) {
          return Location.create(resultVar.uri, {
            start: Position.create(resultVar.line, resultVar.startChar),
            end: Position.create(resultVar.line, resultVar.endChar),
          });
        }
      }
    }

    return;
  }

  /**
   * Находит границы текущей области видимости (функции или блока DEFDAT).
   */
  private findEnclosuresLines(
    lineNumber: number,
    lines: string[],
  ): EnclosuresLines {
    let row = lineNumber;
    const result: EnclosuresLines = {
      upperLine: 0,
      bottomLine: lines.length - 1,
    };

    // Поиск вверх - начало блока
    while (row >= 0) {
      const line = lines[row];
      if (
        /^\s*(?:GLOBAL\s+)?(?:DEFFCT|DEFDAT)\b/i.test(line) ||
        /^\s*(?:GLOBAL\s+)?DEF\b(?!DAT|FCT)/i.test(line)
      ) {
        result.upperLine = row + 1;
        break;
      }
      row--;
    }

    // Сброс строки
    row = lineNumber;

    // Поиск вниз - конец блока
    while (row < lines.length) {
      const line = lines[row];
      if (
        /^\s*ENDFCT\b/i.test(line) ||
        /^\s*ENDDAT\b/i.test(line) ||
        /^\s*END\b(?!FOR|IF|WHILE|LOOP|SWITCH|FCT|DAT)/i.test(line)
      ) {
        result.bottomLine = row + 1;
        break;
      }
      row++;
    }

    return result;
  }
}
