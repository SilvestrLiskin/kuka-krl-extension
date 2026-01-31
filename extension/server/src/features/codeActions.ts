import {
  CodeAction,
  CodeActionParams,
  CodeActionKind,
  TextEdit,
  Range,
  Position,
  Diagnostic,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { TextDocuments } from "vscode-languageserver/node";
import { ServerState } from "../types";
import {
  t,
  matchesDiagnosticPattern,
  extractVariableFromMessage,
} from "../lib/i18n";

export class CodeActionsProvider {
  /**
   * Предоставляет Code Actions (быстрые исправления).
   */
  public onCodeAction(
    params: CodeActionParams,
    documents: TextDocuments<TextDocument>,
    _state: ServerState,
  ): CodeAction[] {
    const doc = documents.get(params.textDocument.uri);
    if (!doc) return [];

    const actions: CodeAction[] = [];
    const diagnostics = params.context.diagnostics;

    for (const diagnostic of diagnostics) {
      // Быстрое исправление для неопределенной переменной
      if (matchesDiagnosticPattern(diagnostic.message, "variableNotDefined")) {
        const varName = extractVariableFromMessage(diagnostic.message);
        if (varName) {
          // Объявить как INT
          actions.push(
            this.createDeclareVariableAction(doc, diagnostic, varName, "INT"),
          );
          // Объявить как REAL
          actions.push(
            this.createDeclareVariableAction(doc, diagnostic, varName, "REAL"),
          );
          // Объявить как BOOL
          actions.push(
            this.createDeclareVariableAction(doc, diagnostic, varName, "BOOL"),
          );
        }
      }

      // Исправление несоответствия GLOBAL / PUBLIC
      if (
        matchesDiagnosticPattern(diagnostic.message, "globalPublicMismatch")
      ) {
        const lines = doc.getText().split(/\r?\n/);
        const line = lines[diagnostic.range.start.line];

        if (
          diagnostic.message.includes("not PUBLIC") ||
          diagnostic.message.includes("PUBLIC değil") ||
          diagnostic.message.includes("не является PUBLIC")
        ) {
          // Удалить GLOBAL
          actions.push(this.createRemoveGlobalAction(doc, diagnostic, line));
        } else if (
          diagnostic.message.includes("not GLOBAL") ||
          diagnostic.message.includes("GLOBAL değil") ||
          diagnostic.message.includes("не GLOBAL")
        ) {
          // Добавить GLOBAL
          actions.push(this.createAddGlobalAction(doc, diagnostic, line));
        }
      }

      // Исправление типа REAL в SWITCH — изменить тип переменной на INT
      if (diagnostic.code === "realInSwitch") {
        actions.push(
          ...this.createChangeTypeActions(doc, diagnostic, "REAL", "INT"),
        );
      }

      // Исправление дробного числа в INT — изменить тип на REAL или обернуть в ROUND()
      if (diagnostic.code === "shouldBeReal") {
        actions.push(
          ...this.createChangeTypeActions(doc, diagnostic, "INT", "REAL"),
        );
        actions.push(this.createWrapWithRoundAction(doc, diagnostic));
      }
    }

    // Общие действия (рефакторинг)
    actions.push(...this.getGeneralActions(doc, params.range));

    return actions;
  }

  /**
   * Создает действие объявления переменной.
   */
  private createDeclareVariableAction(
    doc: TextDocument,
    diagnostic: Diagnostic,
    varName: string,
    varType: string,
  ): CodeAction {
    const lines = doc.getText().split(/\r?\n/);

    // Находим место для вставки
    let insertLine = 0;
    for (let i = 0; i < lines.length; i++) {
      // DEFDAT или DEF блок
      if (/^\s*(?:DEFDAT|DEF)\b/i.test(lines[i])) {
        insertLine = i + 1;
        break;
      }
      // После последнего DECL
      if (/^\s*(?:GLOBAL\s+)?DECL\b/i.test(lines[i])) {
        insertLine = i + 1;
      }
    }

    const indent = this.getIndent(lines[insertLine] || "");
    const newDecl = `${indent}DECL ${varType} ${varName}\n`;

    return {
      title: t("action.declareAs", varName, varType),
      kind: CodeActionKind.QuickFix,
      diagnostics: [diagnostic],
      edit: {
        changes: {
          [doc.uri]: [TextEdit.insert(Position.create(insertLine, 0), newDecl)],
        },
      },
    };
  }

  /**
   * Создает действие удаления GLOBAL.
   */
  private createRemoveGlobalAction(
    doc: TextDocument,
    diagnostic: Diagnostic,
    line: string,
  ): CodeAction {
    const newLine = line.replace(/\bGLOBAL\s+/i, "");

    return {
      title: t("action.removeGlobal"),
      kind: CodeActionKind.QuickFix,
      diagnostics: [diagnostic],
      edit: {
        changes: {
          [doc.uri]: [
            TextEdit.replace(
              Range.create(
                Position.create(diagnostic.range.start.line, 0),
                Position.create(diagnostic.range.start.line, line.length),
              ),
              newLine,
            ),
          ],
        },
      },
    };
  }

  /**
   * Создает действие добавления GLOBAL.
   */
  private createAddGlobalAction(
    doc: TextDocument,
    diagnostic: Diagnostic,
    line: string,
  ): CodeAction {
    // Добавить GLOBAL перед DECL или типом
    let newLine: string;
    if (/^\s*DECL\b/i.test(line)) {
      newLine = line.replace(/^(\s*)DECL\b/i, "$1GLOBAL DECL");
    } else {
      newLine = line.replace(/^(\s*)(\w)/, "$1GLOBAL $2");
    }

    return {
      title: t("action.addGlobal"),
      kind: CodeActionKind.QuickFix,
      diagnostics: [diagnostic],
      edit: {
        changes: {
          [doc.uri]: [
            TextEdit.replace(
              Range.create(
                Position.create(diagnostic.range.start.line, 0),
                Position.create(diagnostic.range.start.line, line.length),
              ),
              newLine,
            ),
          ],
        },
      },
    };
  }

  /**
   * Общие действия (например, обернуть в FOLD).
   */
  private getGeneralActions(doc: TextDocument, range: Range): CodeAction[] {
    const actions: CodeAction[] = [];
    const text = doc.getText(range);

    // Если выбран текст, предлагаем обернуть в FOLD
    if (text && text.trim().length > 0 && text.includes("\n")) {
      actions.push({
        title: t("action.wrapWithFold"),
        kind: CodeActionKind.RefactorExtract,
        edit: {
          changes: {
            [doc.uri]: [
              TextEdit.replace(range, `;FOLD Region\n${text}\n;ENDFOLD`),
            ],
          },
        },
      });
    }

    return actions;
  }

  /**
   * Получает отступ строки.
   */
  private getIndent(line: string): string {
    const match = line.match(/^(\s*)/);
    return match ? match[1] : "";
  }

  /**
   * Создает действия для изменения типа переменной.
   */
  private createChangeTypeActions(
    doc: TextDocument,
    diagnostic: Diagnostic,
    fromType: string,
    toType: string,
  ): CodeAction[] {
    const actions: CodeAction[] = [];
    const data = diagnostic.data as
      | { varName?: string; line?: number }
      | undefined;
    if (!data?.varName) return actions;

    const text = doc.getText();
    const lines = text.split(/\r?\n/);

    // Ищем объявление переменной
    const declRegex = new RegExp(
      `^(\\s*(?:GLOBAL\\s+)?(?:DECL\\s+)?)(${fromType})(\\s+${data.varName}\\b)`,
      "i",
    );

    for (let i = 0; i < lines.length; i++) {
      const match = declRegex.exec(lines[i]);
      if (match) {
        const newLine = lines[i].replace(declRegex, `$1${toType}$3`);

        const title =
          toType === "INT" ? t("action.changeToInt") : t("action.changeToReal");

        actions.push({
          title,
          kind: CodeActionKind.QuickFix,
          diagnostics: [diagnostic],
          edit: {
            changes: {
              [doc.uri]: [
                TextEdit.replace(
                  Range.create(
                    Position.create(i, 0),
                    Position.create(i, lines[i].length),
                  ),
                  newLine,
                ),
              ],
            },
          },
        });
        break;
      }
    }

    return actions;
  }

  /**
   * Создает действие для оборачивания значения в ROUND().
   */
  private createWrapWithRoundAction(
    doc: TextDocument,
    diagnostic: Diagnostic,
  ): CodeAction {
    const data = diagnostic.data as
      | { varName?: string; value?: string; line?: number }
      | undefined;
    const lines = doc.getText().split(/\r?\n/);
    const lineIndex = diagnostic.range.start.line;
    const line = lines[lineIndex] || "";

    // Находим присваивание и оборачиваем значение
    // Экранируем точку в значении (например 3.14 -> 3\.14)
    const valEscaped = data?.value?.replace(".", "\\.");
    const assignRegex = new RegExp(
      `(${data?.varName}\\s*=\\s*)(${valEscaped})`,
      "i",
    );
    const newLine = line.replace(assignRegex, `$1ROUND($2)`);

    return {
      title: t("action.wrapWithRound"),
      kind: CodeActionKind.QuickFix,
      diagnostics: [diagnostic],
      edit: {
        changes: {
          [doc.uri]: [
            TextEdit.replace(
              Range.create(
                Position.create(lineIndex, 0),
                Position.create(lineIndex, line.length),
              ),
              newLine,
            ),
          ],
        },
      },
    };
  }
}
