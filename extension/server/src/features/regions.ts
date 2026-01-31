import {
  FoldingRange,
  FoldingRangeParams,
  FoldingRangeKind,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { TextDocuments } from "vscode-languageserver/node";

export class RegionProvider {
  /**
   * Предоставляет диапазоны сворачивания кода (Folding Ranges).
   * Поддерживает регионы FOLD/ENDFOLD и блоки функций DEF/END.
   */
  public onFoldingRanges(
    params: FoldingRangeParams,
    documents: TextDocuments<TextDocument>,
  ): FoldingRange[] {
    const document = documents.get(params.textDocument.uri);
    if (!document) return [];

    const lines = document.getText().split(/\r?\n/);
    const ranges: FoldingRange[] = [];

    const foldStack: number[] = [];
    const defStack: number[] = [];

    // FOLD/ENDFOLD (регистронезависимо)
    const foldStartRegex = /;\s*FOLD\b/i;
    const foldEndRegex = /;\s*ENDFOLD\b/i;

    // DEF/DEFFCT/DEFDAT
    const defStartRegex = /^\s*(?:GLOBAL\s+)?(?:DEF|DEFFCT|DEFDAT)\b/i;
    // END, ENDFCT, ENDDAT
    const defEndRegex = /^\s*(?:ENDFCT|ENDDAT)\b/i;
    const simpleEndRegex = /^\s*END\s*$/i;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Обработка FOLD
      if (foldStartRegex.test(line)) {
        foldStack.push(i);
      } else if (foldEndRegex.test(line)) {
        const startLine = foldStack.pop();
        if (startLine !== undefined) {
          ranges.push({
            startLine: startLine,
            endLine: i,
            kind: FoldingRangeKind.Region,
          });
        }
      }

      // Обработка DEF
      if (defStartRegex.test(line)) {
        defStack.push(i);
      } else if (defEndRegex.test(line) || simpleEndRegex.test(line)) {
        const startLine = defStack.pop();
        if (startLine !== undefined) {
          ranges.push({
            startLine: startLine,
            endLine: i,
            kind: FoldingRangeKind.Region,
          });
        }
      }
    }

    return ranges;
  }
}
