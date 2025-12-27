import {
  FoldingRange,
  FoldingRangeParams,
  FoldingRangeKind,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { TextDocuments } from "vscode-languageserver/node";

export class RegionProvider {
  /**
   * Katlanabilir bölgeleri sağlar - FOLD/ENDFOLD ve DEF/END blokları.
   */
  public onFoldingRanges(
    params: FoldingRangeParams,
    documents: TextDocuments<TextDocument>,
  ): FoldingRange[] {
    const document = documents.get(params.textDocument.uri);
    if (!document) return [];

    const lines = document.getText().split(/\r?\n/);
    const ranges: FoldingRange[] = [];

    // FOLD/ENDFOLD yığını
    const foldStack: number[] = [];
    // DEF/DEFFCT/DEFDAT yığını
    const defStack: number[] = [];

    // FOLD ve ENDFOLD için regex (büyük/küçük harf duyarsız, boşluklara izin verir)
    const foldStartRegex = /;\s*FOLD\b/i;
    const foldEndRegex = /;\s*ENDFOLD\b/i;

    // DEF/DEFFCT/DEFDAT için regex - kesin eşleşme
    const defStartRegex = /^\s*(?:GLOBAL\s+)?(?:DEF|DEFFCT|DEFDAT)\b/i;
    // END için regex - END, ENDFCT, ENDDAT - diğer END* ile karışmasın
    const defEndRegex = /^\s*(?:ENDFCT|ENDDAT)\b/i;
    const simpleEndRegex = /^\s*END\s*$/i; // Sadece "END" kelimesi

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // FOLD katlama
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

      // DEF/DEFFCT/DEFDAT katlama
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
