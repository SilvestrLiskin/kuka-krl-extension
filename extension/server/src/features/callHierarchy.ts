/**
 * Call Hierarchy Provider для KRL.
 * Показывает, откуда вызвана функция (incoming) и какие функции вызывает она (outgoing).
 */

import {
  CallHierarchyItem,
  CallHierarchyIncomingCall,
  CallHierarchyOutgoingCall,
  CallHierarchyIncomingCallsParams,
  CallHierarchyOutgoingCallsParams,
  CallHierarchyPrepareParams,
  Range,
  SymbolKind,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { TextDocuments } from "vscode-languageserver/node";
import { ServerState } from "../types";

export class CallHierarchyProvider {
  /**
   * Подготовка иерархии вызовов - находит функцию под курсором.
   */
  prepareCallHierarchy(
    params: CallHierarchyPrepareParams,
    documents: TextDocuments<TextDocument>,
    state: ServerState,
  ): CallHierarchyItem[] | null {
    const document = documents.get(params.textDocument.uri);
    if (!document) return null;

    const position = params.position;
    const line = document.getText().split(/\r?\n/)[position.line];

    if (!line) return null;

    // Находим слово под курсором
    const wordMatch = this.getWordAtPosition(line, position.character);
    if (!wordMatch) return null;

    const word = wordMatch.word;
    const startChar = wordMatch.start;
    const endChar = wordMatch.end;

    // Проверяем, является ли это объявлением функции или вызовом
    const func = state.functionsDeclared.find(
      (f) => f.name.toUpperCase() === word.toUpperCase(),
    );

    if (func) {
      return [
        {
          name: func.name,
          kind: SymbolKind.Function,
          uri: func.uri,
          range: Range.create(
            func.line,
            func.startChar,
            func.line,
            func.endChar,
          ),
          selectionRange: Range.create(
            func.line,
            func.startChar,
            func.line,
            func.endChar,
          ),
          detail: func.params ? `(${func.params})` : "()",
        },
      ];
    }

    // Если не найдено в объявленных функциях, возвращаем текущее местоположение
    return [
      {
        name: word,
        kind: SymbolKind.Function,
        uri: params.textDocument.uri,
        range: Range.create(position.line, startChar, position.line, endChar),
        selectionRange: Range.create(
          position.line,
          startChar,
          position.line,
          endChar,
        ),
      },
    ];
  }

  /**
   * Находит все входящие вызовы (кто вызывает эту функцию).
   */
  incomingCalls(
    params: CallHierarchyIncomingCallsParams,
    documents: TextDocuments<TextDocument>,
    state: ServerState,
  ): CallHierarchyIncomingCall[] {
    const item = params.item;
    const funcName = item.name;
    const results: CallHierarchyIncomingCall[] = [];

    // Регулярное выражение для поиска вызова функции
    const callPattern = new RegExp(
      `\\b${this.escapeRegex(funcName)}\\s*\\(`,
      "gi",
    );

    // Ищем во всех открытых документах
    for (const doc of documents.all()) {
      const text = doc.getText();
      const lines = text.split(/\r?\n/);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let match;

        // Сброс regex
        callPattern.lastIndex = 0;

        while ((match = callPattern.exec(line)) !== null) {
          // Пропускаем, если это само определение
          if (
            doc.uri === item.uri &&
            i === item.range.start.line &&
            match.index === item.range.start.character
          ) {
            continue;
          }

          // Находим содержащую функцию
          const containingFunc = this.findContainingFunction(
            lines,
            i,
            state,
            doc.uri,
          );

          if (containingFunc) {
            results.push({
              from: containingFunc,
              fromRanges: [
                Range.create(i, match.index, i, match.index + funcName.length),
              ],
            });
          }
        }
      }
    }

    return results;
  }

  /**
   * Находит все исходящие вызовы (какие функции вызывает эта функция).
   */
  outgoingCalls(
    params: CallHierarchyOutgoingCallsParams,
    documents: TextDocuments<TextDocument>,
    state: ServerState,
  ): CallHierarchyOutgoingCall[] {
    const item = params.item;
    const document = documents.get(item.uri);
    if (!document) return [];

    const results: CallHierarchyOutgoingCall[] = [];
    const text = document.getText();
    const lines = text.split(/\r?\n/);

    // Находим диапазон текущей функции
    const funcRange = this.findFunctionRange(lines, item.range.start.line);
    if (!funcRange) return [];

    // Ищем вызовы функций внутри этой функции
    for (let i = funcRange.start; i <= funcRange.end; i++) {
      const line = lines[i];
      if (!line) continue;

      // Поиск вызовов: слово, за которым следует (
      const callPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
      let match;

      while ((match = callPattern.exec(line)) !== null) {
        const calledName = match[1];

        // Пропускаем рекурсивные вызовы (или это баг логики?)
        if (calledName.toUpperCase() === item.name.toUpperCase()) continue;

        // Пропускаем ключевые слова
        const keywords = [
          "IF",
          "WHILE",
          "FOR",
          "SWITCH",
          "WAIT",
          "LOOP",
          "REPEAT",
        ];
        if (keywords.includes(calledName.toUpperCase())) continue;

        // Находим определение вызываемой функции
        const targetFunc = state.functionsDeclared.find(
          (f) => f.name.toUpperCase() === calledName.toUpperCase(),
        );

        if (targetFunc) {
          // Проверяем, добавлена ли уже
          const existing = results.find(
            (r) => r.to.name.toUpperCase() === calledName.toUpperCase(),
          );

          if (existing) {
            existing.fromRanges.push(
              Range.create(i, match.index, i, match.index + calledName.length),
            );
          } else {
            results.push({
              to: {
                name: targetFunc.name,
                kind: SymbolKind.Function,
                uri: targetFunc.uri,
                range: Range.create(
                  targetFunc.line,
                  targetFunc.startChar,
                  targetFunc.line,
                  targetFunc.endChar,
                ),
                selectionRange: Range.create(
                  targetFunc.line,
                  targetFunc.startChar,
                  targetFunc.line,
                  targetFunc.endChar,
                ),
                detail: targetFunc.params ? `(${targetFunc.params})` : "()",
              },
              fromRanges: [
                Range.create(
                  i,
                  match.index,
                  i,
                  match.index + calledName.length,
                ),
              ],
            });
          }
        }
      }
    }

    return results;
  }

  /**
   * Находит слово в позиции.
   */
  private getWordAtPosition(
    line: string,
    position: number,
  ): { word: string; start: number; end: number } | null {
    const wordPattern = /[a-zA-Z_][a-zA-Z0-9_]*/g;
    let match;

    while ((match = wordPattern.exec(line)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      if (position >= start && position <= end) {
        return { word: match[0], start, end };
      }
    }

    return null;
  }

  /**
   * Находит функцию, содержащую указанную строку.
   */
  private findContainingFunction(
    lines: string[],
    lineNum: number,
    _state: ServerState,
    uri: string,
  ): CallHierarchyItem | null {
    // Ищем вверх DEF или DEFFCT
    const defPattern =
      /^\s*(?:GLOBAL\s+)?(DEF|DEFFCT)\s+(?:\w+\s+)?(\w+)\s*\(/i;

    for (let i = lineNum; i >= 0; i--) {
      const match = defPattern.exec(lines[i]);
      if (match) {
        const funcName = match[2];
        const startChar = lines[i].indexOf(funcName);

        return {
          name: funcName,
          kind: SymbolKind.Function,
          uri: uri, // Исправлено: передаем URI
          range: Range.create(i, startChar, i, startChar + funcName.length),
          selectionRange: Range.create(
            i,
            startChar,
            i,
            startChar + funcName.length,
          ),
        };
      }

      // Если встретили END, значит мы не внутри функции (или вышли из предыдущей)
      // Это примитивная логика, не учитывающая вложенность, но для KRL подходит (плоская структура)
      if (/^\s*END\b/i.test(lines[i]) && i < lineNum) {
        break;
      }
    }

    return null;
  }

  /**
   * Находит границы функции (от startLine до END).
   */
  private findFunctionRange(
    lines: string[],
    startLine: number,
  ): { start: number; end: number } | null {
    // Ищем END или ENDFCT
    for (let i = startLine + 1; i < lines.length; i++) {
      if (/^\s*(END|ENDFCT)\b/i.test(lines[i])) {
        return { start: startLine, end: i };
      }
    }
    return { start: startLine, end: lines.length - 1 };
  }

  /**
   * Экранирование спецсимволов regex.
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
