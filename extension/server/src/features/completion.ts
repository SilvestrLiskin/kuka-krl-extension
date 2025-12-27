import {
  CompletionItem,
  CompletionItemKind,
  CompletionParams,
  InsertTextFormat,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { TextDocuments } from 'vscode-languageserver/node';
import { ServerState } from '../types';
import { CODE_KEYWORDS } from '../lib/parser';
import { KSS_87_SYSTEM_VARS } from '../lib/systemVars';
import { t } from '../lib/i18n';
import { WONDERLIB_FUNCTIONS } from '../lib/wonderlibFunctions';

export class AutoCompleter {
  /**
   * Otomatik tamamlama önerileri sağlar.
   */
  public onCompletion(
    params: CompletionParams,
    documents: TextDocuments<TextDocument>,
    state: ServerState,
  ): CompletionItem[] {
    const document = documents.get(params.textDocument.uri);
    if (!document) return [];

    const lines = document.getText().split(/\r?\n/);

    // Yerel değişken tiplerini çıkar
    const localVariableStructTypes: Record<string, string> = {};
    for (const line of lines) {
      const declRegex = /^(?:GLOBAL\s+)?(?:DECL\s+)?(?:GLOBAL\s+)?(\w+)\s+(\w+)/i;
      const match = declRegex.exec(line.trim());
      if (match) {
        const type = match[1];
        const varName = match[2];
        localVariableStructTypes[varName] = type;
      }
    }

    const line = lines[params.position.line];
    const textBefore = line.substring(0, params.position.character);

    // Nokta sonrası - struct üyelerini öner
    const dotMatch = textBefore.match(/(\w+)\.$/);
    if (dotMatch) {
      const varName = dotMatch[1];
      const structName = localVariableStructTypes[varName];
      const members = state.structDefinitions[structName];
      if (members) {
        return members.map((member) => ({
          label: member,
          kind: CompletionItemKind.Field,
        }));
      }
      return [];
    }

    // === 1. Fonksiyon tamamlamaları ===
    const functionItems: CompletionItem[] = state.functionsDeclared.map((fn) => {
      const paramList = fn.params
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
      const snippetParams = paramList.map((p, i) => `\${${i + 1}:${p}}`).join(', ');

      return {
        label: fn.name,
        kind: CompletionItemKind.Function,
        detail: `${fn.name}(${fn.params})`,
        insertText: `${fn.name}(${snippetParams})`,
        insertTextFormat: InsertTextFormat.Snippet,
        documentation: t('completion.userFunction'),
        commitCharacters: ['('],
        filterText: fn.name,
        sortText: fn.name,
      };
    });

    // === 2. Anahtar kelime tamamlamaları ===
    const currentWord = textBefore.trim().split(/\s+/).pop()?.toUpperCase() || '';

    const filtered = CODE_KEYWORDS.filter((kw) => kw.includes(currentWord)).sort((a, b) => {
      const aStarts = a.startsWith(currentWord);
      const bStarts = b.startsWith(currentWord);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return a.localeCompare(b);
    });

    const keywordsFiltered = filtered.map((kw) => ({
      label: kw,
      kind: CompletionItemKind.Keyword,
      data: kw,
      sortText: kw,
      filterText: kw,
    }));

    // Fonksiyonlarla çakışan anahtar kelimeleri filtrele
    const uniqueKeywordItems = keywordsFiltered.filter(
      (kwItem) => !functionItems.some((fnItem) => fnItem.label === kwItem.label),
    );

    // === 3. KSS 8.7 Sistem Değişkenleri ===
    const sysVarItems = KSS_87_SYSTEM_VARS.map((v) => ({
      label: v,
      kind: CompletionItemKind.Variable,
      detail: t('completion.systemVariable'),
      sortText: v,
      filterText: v,
    }));

    // === 4. Değişken tamamlamaları ===
    const varItems: CompletionItem[] = state.mergedVariables.map((v) => ({
      label: v.name,
      kind: CompletionItemKind.Variable,
      detail: v.type ? t('completion.type', v.type) : t('completion.variable'),
      sortText: v.name,
      filterText: v.name,
    }));

    // === 5. Wonderlibrary Functions ===
    const wonderlibItems: CompletionItem[] = WONDERLIB_FUNCTIONS.map((fn) => {
      const paramList = fn.params
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
      const snippetParams = paramList.map((p, i) => `\${${i + 1}:${p.split(':')[0]}}`).join(', ');

      return {
        label: fn.name,
        kind: CompletionItemKind.Function,
        detail: `${fn.returnType} ${fn.name}(${fn.params}) [wonderlib:${fn.module}]`,
        insertText: `${fn.name}(${snippetParams})`,
        insertTextFormat: InsertTextFormat.Snippet,
        documentation: fn.description,
        commitCharacters: ['('],
        filterText: fn.name,
        sortText: `zz_${fn.name}`, // Sort after user functions
      };
    });

    // Filter out wonderlib functions that are already declared by user
    const uniqueWonderlibItems = wonderlibItems.filter(
      (wlItem) => !functionItems.some((fnItem) => fnItem.label.toUpperCase() === wlItem.label.toUpperCase()),
    );

    // === 6. Tüm tamamlamaları döndür ===
    return [...functionItems, ...uniqueWonderlibItems, ...uniqueKeywordItems, ...sysVarItems, ...varItems];
  }
}
