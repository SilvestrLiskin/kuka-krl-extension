import {
  DocumentSymbol,
  DocumentSymbolParams,
  SymbolKind,
  Range,
  Position,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { TextDocuments } from "vscode-languageserver/node";

export class DocumentSymbolsProvider {
  /**
   * Предоставляет символы документа для панели Outline (Структура).
   */
  public onDocumentSymbols(
    params: DocumentSymbolParams,
    documents: TextDocuments<TextDocument>,
  ): DocumentSymbol[] {
    const document = documents.get(params.textDocument.uri);
    if (!document) return [];

    const text = document.getText();
    const lines = text.split(/\r?\n/);
    const symbols: DocumentSymbol[] = [];

    // Стек для вложенных символов
    const symbolStack: { symbol: DocumentSymbol; endPattern: RegExp }[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // DEF - Процедура
      const defMatch = line.match(
        /^\s*(?:GLOBAL\s+)?DEF\s+(\w+)\s*\(([^)]*)\)/i,
      );
      if (defMatch) {
        const name = defMatch[1];
        const params = defMatch[2];
        const startPos = line.indexOf(name);

        const symbol: DocumentSymbol = {
          name: name,
          detail: `(${params})`,
          kind: SymbolKind.Function,
          range: Range.create(
            Position.create(i, 0),
            Position.create(i, line.length),
          ),
          selectionRange: Range.create(
            Position.create(i, startPos),
            Position.create(i, startPos + name.length),
          ),
          children: [],
        };

        symbolStack.push({ symbol, endPattern: /^\s*END\s*$/i });
        continue;
      }

      // DEFFCT - Функция с возвращаемым значением
      const deffctMatch = line.match(
        /^\s*(?:GLOBAL\s+)?DEFFCT\s+(\w+)\s+(\w+)\s*\(([^)]*)\)/i,
      );
      if (deffctMatch) {
        const returnType = deffctMatch[1];
        const name = deffctMatch[2];
        const params = deffctMatch[3];
        const startPos = line.indexOf(name);

        const symbol: DocumentSymbol = {
          name: name,
          detail: `${returnType}(${params})`,
          kind: SymbolKind.Function,
          range: Range.create(
            Position.create(i, 0),
            Position.create(i, line.length),
          ),
          selectionRange: Range.create(
            Position.create(i, startPos),
            Position.create(i, startPos + name.length),
          ),
          children: [],
        };

        symbolStack.push({ symbol, endPattern: /^\s*ENDFCT\s*$/i });
        continue;
      }

      // DEFDAT - Модуль данных
      const defdatMatch = line.match(/^\s*DEFDAT\s+(\w+)(?:\s+PUBLIC)?/i);
      if (defdatMatch) {
        const name = defdatMatch[1];
        const startPos = line.indexOf(name);
        const isPublic = /PUBLIC/i.test(line);

        const symbol: DocumentSymbol = {
          name: name,
          detail: isPublic ? "PUBLIC DATA" : "DATA",
          kind: SymbolKind.Module,
          range: Range.create(
            Position.create(i, 0),
            Position.create(i, line.length),
          ),
          selectionRange: Range.create(
            Position.create(i, startPos),
            Position.create(i, startPos + name.length),
          ),
          children: [],
        };

        symbolStack.push({ symbol, endPattern: /^\s*ENDDAT\s*$/i });
        continue;
      }

      // Проверка окончания блока
      for (let j = symbolStack.length - 1; j >= 0; j--) {
        if (symbolStack[j].endPattern.test(line)) {
          const completed = symbolStack.splice(j, 1)[0];
          completed.symbol.range = Range.create(
            completed.symbol.range.start,
            Position.create(i, line.length),
          );

          if (symbolStack.length > 0) {
            symbolStack[symbolStack.length - 1].symbol.children!.push(
              completed.symbol,
            );
          } else {
            symbols.push(completed.symbol);
          }
          break;
        }
      }

      // Объявление переменных
      const declMatch = line.match(
        /^\s*(?:GLOBAL\s+)?(?:DECL\s+)?(\w+)\s+(\w+)/i,
      );
      if (declMatch && !defMatch && !deffctMatch && !defdatMatch) {
        const typeName = declMatch[1].toUpperCase();
        const varName = declMatch[2];

        const keywords = [
          "DEF",
          "DEFFCT",
          "DEFDAT",
          "END",
          "ENDFCT",
          "ENDDAT",
          "IF",
          "FOR",
          "WHILE",
          "LOOP",
          "SWITCH",
        ];
        if (keywords.includes(typeName)) continue;

        const isDecl =
          /^\s*(?:GLOBAL\s+)?DECL\b/i.test(line) ||
          /^\s*(?:GLOBAL\s+)?(INT|REAL|BOOL|CHAR|STRING|FRAME|POS|E6POS|AXIS|E6AXIS|LOAD|SIGNAL)\s+\w+/i.test(
            line,
          );

        if (!isDecl) continue;

        const startPos = line.indexOf(varName);
        const varSymbol: DocumentSymbol = {
          name: varName,
          detail: typeName,
          kind: this.getSymbolKind(typeName),
          range: Range.create(
            Position.create(i, 0),
            Position.create(i, line.length),
          ),
          selectionRange: Range.create(
            Position.create(i, startPos),
            Position.create(i, startPos + varName.length),
          ),
        };

        if (symbolStack.length > 0) {
          symbolStack[symbolStack.length - 1].symbol.children!.push(varSymbol);
        } else {
          symbols.push(varSymbol);
        }
      }

      // SIGNAL
      const signalMatch = line.match(/^\s*(?:GLOBAL\s+)?SIGNAL\s+(\w+)/i);
      if (signalMatch) {
        const name = signalMatch[1];
        const startPos = line.indexOf(name);

        const signalSymbol: DocumentSymbol = {
          name: name,
          detail: "SIGNAL",
          kind: SymbolKind.Event,
          range: Range.create(
            Position.create(i, 0),
            Position.create(i, line.length),
          ),
          selectionRange: Range.create(
            Position.create(i, startPos),
            Position.create(i, startPos + name.length),
          ),
        };

        if (symbolStack.length > 0) {
          symbolStack[symbolStack.length - 1].symbol.children!.push(
            signalSymbol,
          );
        } else {
          symbols.push(signalSymbol);
        }
      }

      // STRUC
      const strucMatch = line.match(/^\s*(?:GLOBAL\s+)?STRUC\s+(\w+)/i);
      if (strucMatch) {
        const name = strucMatch[1];
        const startPos = line.indexOf(name);

        const strucSymbol: DocumentSymbol = {
          name: name,
          detail: "STRUC",
          kind: SymbolKind.Struct,
          range: Range.create(
            Position.create(i, 0),
            Position.create(i, line.length),
          ),
          selectionRange: Range.create(
            Position.create(i, startPos),
            Position.create(i, startPos + name.length),
          ),
        };

        if (symbolStack.length > 0) {
          symbolStack[symbolStack.length - 1].symbol.children!.push(
            strucSymbol,
          );
        } else {
          symbols.push(strucSymbol);
        }
      }

      // ENUM
      const enumMatch = line.match(/^\s*(?:GLOBAL\s+)?ENUM\s+(\w+)/i);
      if (enumMatch) {
        const name = enumMatch[1];
        const startPos = line.indexOf(name);

        const enumSymbol: DocumentSymbol = {
          name: name,
          detail: "ENUM",
          kind: SymbolKind.Enum,
          range: Range.create(
            Position.create(i, 0),
            Position.create(i, line.length),
          ),
          selectionRange: Range.create(
            Position.create(i, startPos),
            Position.create(i, startPos + name.length),
          ),
        };

        if (symbolStack.length > 0) {
          symbolStack[symbolStack.length - 1].symbol.children!.push(enumSymbol);
        } else {
          symbols.push(enumSymbol);
        }
      }
    }

    // Закрываем оставшиеся символы
    while (symbolStack.length > 0) {
      const unclosed = symbolStack.pop()!;
      if (symbolStack.length > 0) {
        symbolStack[symbolStack.length - 1].symbol.children!.push(
          unclosed.symbol,
        );
      } else {
        symbols.push(unclosed.symbol);
      }
    }

    return symbols;
  }

  private getSymbolKind(typeName: string): SymbolKind {
    switch (typeName.toUpperCase()) {
      case "INT":
      case "REAL":
        return SymbolKind.Number;
      case "BOOL":
        return SymbolKind.Boolean;
      case "CHAR":
      case "STRING":
        return SymbolKind.String;
      case "FRAME":
      case "POS":
      case "E6POS":
      case "AXIS":
      case "E6AXIS":
      case "LOAD":
        return SymbolKind.Struct;
      case "SIGNAL":
        return SymbolKind.Event;
      default:
        return SymbolKind.Variable;
    }
  }
}
