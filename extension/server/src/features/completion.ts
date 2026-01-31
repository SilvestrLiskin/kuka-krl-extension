import {
  CompletionItem,
  CompletionItemKind,
  CompletionParams,
  InsertTextFormat,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { TextDocuments } from "vscode-languageserver/node";
import { ServerState } from "../types";
import { CODE_KEYWORDS } from "../lib/parser";
import { KSS_87_SYSTEM_VARS } from "../lib/systemVars";
import { t } from "../lib/i18n";
import { WONDERLIB_FUNCTIONS } from "../lib/wonderlibFunctions";

export class AutoCompleter {
  /**
   * Предоставляет предложения для автодополнения.
   */
  public onCompletion(
    params: CompletionParams,
    documents: TextDocuments<TextDocument>,
    state: ServerState,
  ): CompletionItem[] {
    const document = documents.get(params.textDocument.uri);
    if (!document) return [];

    const lines = document.getText().split(/\r?\n/);

    // Извлечение типов локальных переменных для контекстного дополнения
    const localVariableStructTypes: Record<string, string> = {};
    for (const line of lines) {
      const declRegex =
        /^(?:GLOBAL\s+)?(?:DECL\s+)?(?:GLOBAL\s+)?(\w+)\s+(\w+)/i;
      const match = declRegex.exec(line.trim());
      if (match) {
        const type = match[1];
        const varName = match[2];
        localVariableStructTypes[varName] = type;
      }
    }

    const line = lines[params.position.line];
    const textBefore = line.substring(0, params.position.character);

    // Дополнение после точки (члены структур)
    const dotMatch = textBefore.match(/(\w+)\.$/);
    if (dotMatch) {
      const varName = dotMatch[1];
      const structName = localVariableStructTypes[varName];
      // Здесь можно добавить поиск типа глобальной переменной, если локально не найдено
      const members = state.structDefinitions[structName];
      if (members) {
        return members.map((member) => ({
          label: member,
          kind: CompletionItemKind.Field,
        }));
      }
      return [];
    }

    // === 1. Пользовательские функции ===
    const functionItems: CompletionItem[] = state.functionsDeclared.map(
      (fn) => {
        const paramList = fn.params
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean);
        const snippetParams = paramList
          .map((p, i) => `\${${i + 1}:${p}}`)
          .join(", ");

        return {
          label: fn.name,
          kind: CompletionItemKind.Function,
          detail: `${fn.name}(${fn.params})`,
          insertText: `${fn.name}(${snippetParams})`,
          insertTextFormat: InsertTextFormat.Snippet,
          documentation: t("completion.userFunction"),
          commitCharacters: ["("],
          filterText: fn.name,
          sortText: fn.name,
        };
      },
    );

    // === 2. Ключевые слова ===
    // Возвращаем все ключевые слова, фильтрацию делает клиент
    const uniqueKeywordItems = CODE_KEYWORDS.map((kw) => ({
      label: kw,
      kind: CompletionItemKind.Keyword,
      data: kw,
      sortText: kw,
      filterText: kw,
    })).filter(
      (kwItem) =>
        !functionItems.some((fnItem) => fnItem.label === kwItem.label),
    );

    // === 3. Системные переменные KSS 8.7 ===
    const sysVarItems = KSS_87_SYSTEM_VARS.map((v) => ({
      label: v,
      kind: CompletionItemKind.Variable,
      detail: t("completion.systemVariable"),
      sortText: v,
      filterText: v,
    }));

    // === 4. Пользовательские переменные ===
    const varItems: CompletionItem[] = state.mergedVariables.map((v) => ({
      label: v.name,
      kind: CompletionItemKind.Variable,
      detail: v.type ? t("completion.type", v.type) : t("completion.variable"),
      sortText: v.name,
      filterText: v.name,
    }));

    // === 5. Функции Wonderlibrary ===
    const wonderlibItems: CompletionItem[] = WONDERLIB_FUNCTIONS.map((fn) => {
      const paramList = fn.params
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
      const snippetParams = paramList
        .map((p, i) => `\${${i + 1}:${p.split(":")[0]}}`)
        .join(", ");

      return {
        label: fn.name,
        kind: CompletionItemKind.Function,
        detail: `${fn.returnType} ${fn.name}(${fn.params}) [wonderlib:${fn.module}]`,
        insertText: `${fn.name}(${snippetParams})`,
        insertTextFormat: InsertTextFormat.Snippet,
        documentation: fn.description,
        commitCharacters: ["("],
        filterText: fn.name,
        sortText: `zz_${fn.name}`, // Сортировка после пользовательских функций
      };
    });

    // Фильтрация wonderlib функций, если они уже переопределены пользователем
    const uniqueWonderlibItems = wonderlibItems.filter(
      (wlItem) =>
        !functionItems.some(
          (fnItem) => fnItem.label.toUpperCase() === wlItem.label.toUpperCase(),
        ),
    );

    // === 6. Объединение результатов ===
    return [
      ...functionItems,
      ...uniqueWonderlibItems,
      ...uniqueKeywordItems,
      ...sysVarItems,
      ...varItems,
    ];
  }
}
