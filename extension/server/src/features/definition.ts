import { DefinitionParams, Location, Position } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { TextDocuments } from 'vscode-languageserver/node';
import { ServerState, EnclosuresLines, WordInfo } from '../types';
import { isSymbolDeclared, getWordAtPosition } from '../lib/parser';

export class SymbolResolver {
  /**
   * Tanım konumunu bulur - Go to Definition işlevi.
   */
  public async onDefinition(
    params: DefinitionParams,
    documents: TextDocuments<TextDocument>,
    state: ServerState,
  ): Promise<Location | undefined> {
    const doc = documents.get(params.textDocument.uri);
    if (!doc || !state.workspaceRoot) return;

    const lines = doc.getText().split(/\r?\n/);
    const lineText = lines[params.position.line];

    // Bildirim satırlarını atla
    if (/^\s*(GLOBAL\s+)?(DEF|DEFFCT|DECL\s+INT|DECL\s+REAL|DECL\s+BOOL|DECL\s+FRAME)\b/i.test(lineText))
      return;

    // Struct içindeki alt değişkenleri atla
    if (getWordAtPosition(lineText, params.position.character)?.isSubvariable) {
      return;
    }

    const functionName = getWordAtPosition(lineText, params.position.character)?.word;
    if (!functionName) return;

    // Önce fonksiyon olarak ara
    const resultFct = await isSymbolDeclared(state.workspaceRoot, functionName, 'function');
    if (resultFct != undefined) {
      return Location.create(resultFct.uri, {
        start: Position.create(resultFct.line, resultFct.startChar),
        end: Position.create(resultFct.line, resultFct.endChar),
      });
    }

    // Özel kullanıcı değişken tipi (Struct) olarak ara
    for (const key in state.structDefinitions) {
      if (key === functionName) {
        const resultStruc = await isSymbolDeclared(state.workspaceRoot, functionName, 'struc');
        if (resultStruc != undefined) {
          return Location.create(resultStruc.uri, {
            start: Position.create(resultStruc.line, resultStruc.startChar),
            end: Position.create(resultStruc.line, resultStruc.endChar),
          });
        }
      }
    }

    // Değişken olarak ara
    const enclosures = this.findEnclosuresLines(params.position.line, lines);

    // Önce mergedVariables listesinden kontrol et
    for (const element of state.mergedVariables) {
      if (element.name.toUpperCase() === functionName.toUpperCase()) {
        // İlk: yerel kapsamda ara (kapsam içinde)
        const scopedResult = await isSymbolDeclared(
          state.workspaceRoot,
          functionName,
          'variable',
          params.textDocument.uri,
          enclosures.upperLine,
          enclosures.bottomLine,
          lines.join('\n'),
        );

        if (scopedResult) {
          return Location.create(scopedResult.uri, {
            start: Position.create(scopedResult.line, scopedResult.startChar),
            end: Position.create(scopedResult.line, scopedResult.endChar),
          });
        }

        // Yerel olarak bulunamadıysa global arama yap
        const resultVar = await isSymbolDeclared(state.workspaceRoot, functionName, 'variable');

        if (resultVar) {
          return Location.create(resultVar.uri, {
            start: Position.create(resultVar.line, resultVar.startChar),
            end: Position.create(resultVar.line, resultVar.endChar),
          });
        }
      }
    }

    return;
  }

  /**
   * Kapsam satırlarını bulur - DEF/DEFFCT/DEFDAT bloğunun sınırları.
   * Düzeltildi: includes yerine \b regex kullanılarak kesin eşleşme sağlandı.
   */
  private findEnclosuresLines(lineNumber: number, lines: string[]): EnclosuresLines {
    let row = lineNumber;
    const result: EnclosuresLines = {
      upperLine: 0,
      bottomLine: lines.length - 1,
    };

    // Yukarı doğru ara - başlangıç sınırı
    while (row >= 0) {
      const line = lines[row];
      if (/^\s*(?:GLOBAL\s+)?(?:DEFFCT|DEFDAT)\b/i.test(line) ||
        /^\s*(?:GLOBAL\s+)?DEF\b(?!DAT|FCT)/i.test(line)) {
        result.upperLine = row + 1;
        break;
      }
      row--;
    }

    // Satırı sıfırla
    row = lineNumber;

    // Aşağı doğru ara - bitiş sınırı
    while (row < lines.length) {
      const line = lines[row];
      if (/^\s*ENDFCT\b/i.test(line) ||
        /^\s*ENDDAT\b/i.test(line) ||
        /^\s*END\b(?!FOR|IF|WHILE|LOOP|SWITCH|FCT|DAT)/i.test(line)) {
        result.bottomLine = row + 1;
        break;
      }
      row++;
    }

    return result;
  }
}
