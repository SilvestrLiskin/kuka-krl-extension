/**
 * Call Hierarchy Provider for KRL
 * Shows where functions are called from (incoming) and what they call (outgoing)
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
import { getAllSourceFiles } from "../lib/fileSystem";
import { URI } from "vscode-uri";
import * as fs from "fs";

export class CallHierarchyProvider {
  /**
   * Prepare call hierarchy - find the function at cursor position
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

    // Find word at cursor position
    const wordMatch = this.getWordAtPosition(line, position.character);
    if (!wordMatch) return null;

    const word = wordMatch.word;
    const startChar = wordMatch.start;
    const endChar = wordMatch.end;

    // Check if it's a function definition or call
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

    // If not found in declared functions, return current location
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
   * Find all incoming calls (who calls this function)
   */
  async incomingCalls(
    params: CallHierarchyIncomingCallsParams,
    documents: TextDocuments<TextDocument>,
    state: ServerState,
  ): Promise<CallHierarchyIncomingCall[]> {
    const item = params.item;
    const funcName = item.name;
    const results: CallHierarchyIncomingCall[] = [];

    // Search all documents for calls to this function
    const callPattern = new RegExp(
      `\\b${this.escapeRegex(funcName)}\\s*\\(`,
      "gi",
    );

    const files = state.workspaceRoot
      ? await getAllSourceFiles(state.workspaceRoot)
      : documents.all().map((d) => URI.parse(d.uri).fsPath);

    for (const filePath of files) {
      const uri = URI.file(filePath).toString();
      let text: string;
      const doc = documents.get(uri);

      if (doc) {
        text = doc.getText();
      } else {
        try {
          text = await fs.promises.readFile(filePath, "utf8");
        } catch {
          continue;
        }
      }

      const lines = text.split(/\r?\n/);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let match;

        // Reset regex
        callPattern.lastIndex = 0;

        while ((match = callPattern.exec(line)) !== null) {
          // Skip if it's the definition itself
          if (
            uri === item.uri &&
            i === item.range.start.line &&
            match.index === item.range.start.character
          ) {
            continue;
          }

          // Find the containing function
          const containingFunc = this.findContainingFunction(lines, i, state);

          if (containingFunc) {
            containingFunc.uri = uri; // Set correct URI
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
   * Find all outgoing calls (what functions does this function call)
   */
  async outgoingCalls(
    params: CallHierarchyOutgoingCallsParams,
    documents: TextDocuments<TextDocument>,
    state: ServerState,
  ): Promise<CallHierarchyOutgoingCall[]> {
    const item = params.item;
    let text: string;
    const document = documents.get(item.uri);

    if (document) {
      text = document.getText();
    } else {
      try {
        const filePath = URI.parse(item.uri).fsPath;
        text = await fs.promises.readFile(filePath, "utf8");
      } catch {
        return [];
      }
    }

    const results: CallHierarchyOutgoingCall[] = [];
    const lines = text.split(/\r?\n/);

    // Find the range of this function
    const funcRange = this.findFunctionRange(lines, item.range.start.line);
    if (!funcRange) return [];

    // Search for function calls within this function
    for (let i = funcRange.start; i <= funcRange.end; i++) {
      const line = lines[i];
      if (!line) continue;

      // Find function calls: word followed by (
      const callPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
      let match;

      while ((match = callPattern.exec(line)) !== null) {
        const calledName = match[1];

        // Skip if it's the current function
        if (calledName.toUpperCase() === item.name.toUpperCase()) continue;

        // Skip keywords that look like function calls
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

        // Find function definition
        const targetFunc = state.functionsDeclared.find(
          (f) => f.name.toUpperCase() === calledName.toUpperCase(),
        );

        if (targetFunc) {
          // Check if already added
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
   * Find word at position
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
   * Find the function containing a line
   */
  private findContainingFunction(
    lines: string[],
    lineNum: number,
    _state: ServerState,
  ): CallHierarchyItem | null {
    // Look backwards for DEF or DEFFCT
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
          uri: "", // Will be filled by caller
          range: Range.create(i, startChar, i, startChar + funcName.length),
          selectionRange: Range.create(
            i,
            startChar,
            i,
            startChar + funcName.length,
          ),
        };
      }

      // Stop if we hit END
      if (/^\s*END\b/i.test(lines[i]) && i < lineNum) {
        break;
      }
    }

    return null;
  }

  /**
   * Find the range of a function starting at a line
   */
  private findFunctionRange(
    lines: string[],
    startLine: number,
  ): { start: number; end: number } | null {
    // Look for END or ENDFCT
    for (let i = startLine + 1; i < lines.length; i++) {
      if (/^\s*(END|ENDFCT)\b/i.test(lines[i])) {
        return { start: startLine, end: i };
      }
    }
    return { start: startLine, end: lines.length - 1 };
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
