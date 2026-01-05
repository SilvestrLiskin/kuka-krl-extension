import { CodeLens, CodeLensParams, Range } from "vscode-languageserver/node";
import { TextDocuments } from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { t } from "../lib/i18n";

/**
 * Code Lens Provider - shows metrics above functions and inline forms
 */
export class CodeLensProvider {
  /**
   * Generates Code Lens for the document
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

    // 1. Find all function definitions in current document
    const defRegex = /^\s*(?:GLOBAL\s+)?(DEF|DEFFCT)\s+(?:\w+\s+)?(\w+)\s*\(/i;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = defRegex.exec(line);

      if (match) {
        const functionName = match[2];
        const functionType = match[1].toUpperCase();

        // Find end of function
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

        // Count references
        const referenceCount = this.countReferences(functionName, state);

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

    // 2. Find Motion Folds (PTP, LIN, etc.) - Visualization of Inline Forms
    const foldRegex =
      /^\s*;FOLD\s+(PTP|LIN|CIRC|SPTP|SLIN|SCIRC)\s+(.*);%{PE}%R/i;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = foldRegex.exec(line);
      if (match) {
        const command = match[1];
        // match[2] contains "P1 Vel=100 % PDAT1 Tool[1] Base[1]" usually
        const params = match[2].trim();

        const range: Range = {
          start: { line: i, character: 0 },
          end: { line: i, character: line.length },
        };

        codeLenses.push({
          range,
          data: {
            type: "motion",
            command,
            params,
          },
        });
      }
    }

    return codeLenses;
  }

  /**
   * Resolves Code Lens (adds command and title)
   */
  public onCodeLensResolve(codeLens: CodeLens): CodeLens {
    const data = codeLens.data as
      | {
          type?: string;
          command?: string;
          params?: string;
          functionName?: string;
          lineCount?: number;
          referenceCount?: number;
        }
      | undefined;

    if (!data) {
      return codeLens;
    }

    if (data.type === "motion") {
      const icon =
        data.command === "PTP" ? "🚀" : data.command === "LIN" ? "📏" : "↪️";
      codeLens.command = {
        title: `${icon} ${data.command} ${data.params}`,
        command: "",
        arguments: [],
      };
      return codeLens;
    }

    if (data.functionName) {
      codeLens.command = {
        title: t(
          "codeLens.metrics",
          data.lineCount ?? 0,
          data.referenceCount ?? 0,
        ),
        command: "",
        arguments: [],
      };
    }

    return codeLens;
  }

  /**
   * Counts references
   */
  private countReferences(
    functionName: string,
    state: {
      functionsDeclared: Array<{ name: string; uri: string; line: number }>;
    },
  ): number {
    const count = state.functionsDeclared.filter(
      (f) => f.name.toUpperCase() === functionName.toUpperCase(),
    ).length;
    return Math.max(0, count);
  }
}
