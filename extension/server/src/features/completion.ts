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
import * as krlData from "../data/krl-ref.json";

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

    // === Context Detection ===
    const context = this.determineContext(lines, params.position.line);

    // === 1. User Functions ===
    // Only available inside DEF/DEFFCT blocks
    let functionItems: CompletionItem[] = [];
    if (context === Context.DEF) {
      functionItems = state.functionsDeclared.map((fn) => {
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
      });
    }

    // === 2. Keywords ===
    const currentWord =
      textBefore.trim().split(/\s+/).pop()?.toUpperCase() || "";

    const filteredKeywords = this.filterKeywordsByContext(
      CODE_KEYWORDS,
      context,
    )
      .filter((kw) => kw.includes(currentWord))
      .sort((a, b) => {
        const aStarts = a.startsWith(currentWord);
        const bStarts = b.startsWith(currentWord);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.localeCompare(b);
      });

    const keywordItems = filteredKeywords.map((kw) => {
      // Check if we have data for this keyword in krl-ref.json
      const cmdData = (krlData.commands as any)[kw];
      return {
        label: kw,
        kind: CompletionItemKind.Keyword,
        detail: cmdData ? cmdData.description : undefined,
        documentation: cmdData ? cmdData.syntax : undefined,
        data: kw,
        sortText: kw,
        filterText: kw,
      };
    });

    // Filter out keywords that conflict with functions (if any)
    const uniqueKeywordItems = keywordItems.filter(
      (kwItem) =>
        !functionItems.some((fnItem) => fnItem.label === kwItem.label),
    );

    // === 3. System Variables ===
    // Valid in DEF and DAT (assignments)
    let sysVarItems: CompletionItem[] = [];
    if (context !== Context.ROOT) {
      // Use krlData.systemVariables if available, fall back to KSS_87_SYSTEM_VARS list
      const definedSysVars = Object.keys(krlData.systemVariables);
      // Merge unique variables
      const allSysVars = Array.from(
        new Set([...KSS_87_SYSTEM_VARS, ...definedSysVars]),
      );

      sysVarItems = allSysVars.map((v) => {
        // Remove $ if present in key lookup
        const cleanName = v.startsWith("$") ? v : "$" + v;
        const lookupName = v.startsWith("$") ? v.substring(1) : v; // JSON keys usually don't have $ prefix based on my script?
        // Wait, script: result.systemVariables[item.name] = item; item.name Usually HAS $ prefix in YAML?
        // Let's check krl-ref.json content from view_file step 845...
        // "name": "$A4PAR" -> keys HAS $.

        const data =
          (krlData.systemVariables as any)[cleanName] ||
          (krlData.systemVariables as any)[lookupName];

        return {
          label: cleanName,
          kind: CompletionItemKind.Variable,
          detail: data ? data.description : t("completion.systemVariable"),
          documentation: data
            ? `Type: ${data["data-type"] || data.type}`
            : undefined,
          sortText: cleanName,
          filterText: cleanName,
        };
      });
    }

    // === 4. Variables ===
    // Valid in DEF (usage) and DAT (ref?) - simplified: allow in both, block in ROOT
    let varItems: CompletionItem[] = [];
    if (context !== Context.ROOT) {
      varItems = state.mergedVariables.map((v) => ({
        label: v.name,
        kind: CompletionItemKind.Variable,
        detail: v.type
          ? t("completion.type", v.type)
          : t("completion.variable"),
        sortText: v.name,
        filterText: v.name,
      }));
    }

    // === 5. Wonderlibrary Functions ===
    // Only in DEF
    let wonderlibItems: CompletionItem[] = [];
    if (context === Context.DEF) {
      wonderlibItems = WONDERLIB_FUNCTIONS.map((fn) => {
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
          sortText: `zz_${fn.name}`,
        };
      });
    }

    const uniqueWonderlibItems = wonderlibItems.filter(
      (wlItem) =>
        !functionItems.some(
          (fnItem) => fnItem.label.toUpperCase() === wlItem.label.toUpperCase(),
        ),
    );

    return [
      ...functionItems,
      ...uniqueWonderlibItems,
      ...uniqueKeywordItems,
      ...sysVarItems,
      ...varItems,
    ];
  }

  private determineContext(lines: string[], currentLineIdx: number): Context {
    for (let i = currentLineIdx - 1; i >= 0; i--) {
      const line = lines[i];
      // Check for closing keywords first (closest to cursor upwards)
      // If we hit END/ENDFCT/ENDDAT before a DEF, we are outside.
      if (/^\s*END(?:FCT|DAT)?\b/i.test(line)) return Context.ROOT;

      // Check for opening keywords
      if (/^\s*(?:GLOBAL\s+)?DEFDAT\b/i.test(line)) return Context.DAT;
      if (/^\s*(?:GLOBAL\s+)?(?:DEF|DEFFCT)\b/i.test(line)) return Context.DEF;
    }
    // Default to ROOT if nothing found
    return Context.ROOT;
  }

  private filterKeywordsByContext(
    keywords: string[],
    context: Context,
  ): string[] {
    const topLevel = ["DEF", "DEFFCT", "DEFDAT"];
    // Common declarations allowed in both DEF and DAT
    const declarations = [
      "DECL",
      "GLOBAL",
      "PUBLIC",
      "CONST",
      "STRUC",
      "ENUM",
      "SIGNAL",
    ];
    // Logic & Motion only in DEF
    const logic = [
      "IF",
      "THEN",
      "ELSE",
      "ENDIF",
      "FOR",
      "TO",
      "STEP",
      "ENDFOR",
      "WHILE",
      "ENDWHILE",
      "LOOP",
      "ENDLOOP",
      "REPEAT",
      "UNTIL",
      "SWITCH",
      "CASE",
      "DEFAULT",
      "ENDSWITCH",
      "WAIT",
      "HALT",
      "CONTINUE",
      "EXIT",
      "RETURN",
      "BRAKE",
      "PTP",
      "LIN",
      "CIRC",
      "SPTP",
      "SLIN",
      "SCIRC",
      "TRIGGER",
      "INTERRUPT",
      "ANOUT",
      "PULSE",
      "END",
      "ENDFCT",
    ];

    const datSpecific = ["ENDDAT"];

    if (context === Context.ROOT) {
      return topLevel;
    } else if (context === Context.DAT) {
      return [...declarations, ...datSpecific];
    } else {
      // Context.DEF
      // In DEF: Logic + Declarations + Closing keywords
      // Exclude top-level definition keywords (nested DEF not allowed)
      return [...logic, ...declarations];
    }
  }
}

enum Context {
  ROOT,
  DEF,
  DAT,
}
