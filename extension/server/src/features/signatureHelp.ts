import {
  SignatureHelp,
  SignatureHelpParams,
  SignatureInformation,
  ParameterInformation,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { TextDocuments } from "vscode-languageserver/node";
import { ServerState } from "../types";
import { t } from "../lib/i18n";

export class SignatureHelpProvider {
  /**
   * Fonksiyon çağrısında parametre bilgisi sağlar.
   */
  public onSignatureHelp(
    params: SignatureHelpParams,
    documents: TextDocuments<TextDocument>,
    state: ServerState,
  ): SignatureHelp | null {
    const doc = documents.get(params.textDocument.uri);
    if (!doc) return null;

    const lines = doc.getText().split(/\r?\n/);
    const lineText = lines[params.position.line];
    const textBeforeCursor = lineText.substring(0, params.position.character);

    // Açık parantez bul
    const openParenIndex = this.findOpenParen(textBeforeCursor);
    if (openParenIndex === -1) return null;

    // Fonksiyon adını bul
    const textBeforeParen = textBeforeCursor
      .substring(0, openParenIndex)
      .trim();
    const funcMatch = textBeforeParen.match(/\b(\w+)\s*$/);
    if (!funcMatch) return null;

    const funcName = funcMatch[1];

    // Fonksiyon tanımını bul
    const funcInfo = state.functionsDeclared.find(
      (f) => f.name.toUpperCase() === funcName.toUpperCase(),
    );

    if (!funcInfo || !funcInfo.params) return null;

    // Parametreleri ayrıştır
    const params_list = this.parseParams(funcInfo.params);
    if (params_list.length === 0) return null;

    // Aktif parametre indeksini bul
    const textInParens = textBeforeCursor.substring(openParenIndex + 1);
    const activeParameter = this.countCommas(textInParens);

    const funcType = funcInfo.name.toLowerCase().includes("fct")
      ? "function"
      : "subroutine";
    const signature: SignatureInformation = {
      label: `${funcInfo.name}(${funcInfo.params})`,
      documentation: t("signature.userDefined", funcType),
      parameters: params_list.map(
        (p) =>
          ({
            label: p.trim(),
            documentation: t("signature.parameter", p.trim()),
          }) as ParameterInformation,
      ),
    };

    return {
      signatures: [signature],
      activeSignature: 0,
      activeParameter: Math.min(activeParameter, params_list.length - 1),
    };
  }

  /**
   * En son eşleşmemiş açık parantezi bulur.
   */
  private findOpenParen(text: string): number {
    let depth = 0;
    for (let i = text.length - 1; i >= 0; i--) {
      const char = text[i];
      if (char === ")") {
        depth++;
      } else if (char === "(") {
        if (depth === 0) {
          return i;
        }
        depth--;
      }
    }
    return -1;
  }

  /**
   * Parametre string'ini ayrıştırır.
   */
  private parseParams(paramsStr: string): string[] {
    if (!paramsStr.trim()) return [];

    const result: string[] = [];
    let current = "";
    let depth = 0;

    for (const char of paramsStr) {
      if (char === "(" || char === "[") {
        depth++;
        current += char;
      } else if (char === ")" || char === "]") {
        depth--;
        current += char;
      } else if (char === "," && depth === 0) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      result.push(current.trim());
    }

    return result;
  }

  /**
   * Parantez içindeki virgül sayısını sayar (nested parantezleri dikkate alarak).
   */
  private countCommas(text: string): number {
    let count = 0;
    let depth = 0;
    let inString = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      if (char === '"' && (i === 0 || text[i - 1] !== "\\")) {
        inString = !inString;
      }

      if (inString) continue;

      if (char === "(" || char === "[") {
        depth++;
      } else if (char === ")" || char === "]") {
        depth--;
      } else if (char === "," && depth === 0) {
        count++;
      }
    }

    return count;
  }
}
