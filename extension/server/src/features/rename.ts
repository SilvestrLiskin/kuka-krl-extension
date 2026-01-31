import {
  RenameParams,
  WorkspaceEdit,
  TextEdit,
  PrepareRenameParams,
  Range,
  Position,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { TextDocuments } from "vscode-languageserver/node";
import { ServerState } from "../types";
import { getWordAtPosition } from "../lib/parser";
import { getAllSourceFiles } from "../lib/fileSystem";
import { isInsideString, escapeRegex, getCodePart } from "../lib/utils";
import { URI } from "vscode-uri";
import * as fs from "fs";

export class RenameProvider {
  /**
   * Подготовка переименования (проверка возможности).
   */
  public async prepareRename(
    params: PrepareRenameParams,
    documents: TextDocuments<TextDocument>,
    _state: ServerState,
  ): Promise<Range | null> {
    const doc = documents.get(params.textDocument.uri);
    if (!doc) return null;

    const lines = doc.getText().split(/\r?\n/);
    const lineText = lines[params.position.line];

    const wordInfo = getWordAtPosition(lineText, params.position.character);
    if (!wordInfo) return null;

    const word = wordInfo.word;
    const startChar = lineText.indexOf(
      word,
      Math.max(0, params.position.character - word.length),
    );

    if (startChar === -1) return null;

    // Запрещаем переименование ключевых слов
    const keywords = [
      "DEF",
      "DEFFCT",
      "END",
      "ENDFCT",
      "IF",
      "THEN",
      "ELSE",
      "ENDIF",
      "FOR",
      "ENDFOR",
      "WHILE",
      "ENDWHILE",
      "LOOP",
      "ENDLOOP",
      "SWITCH",
      "CASE",
      "DEFAULT",
      "ENDSWITCH",
      "DECL",
      "GLOBAL",
      "PUBLIC",
    ];
    if (keywords.includes(word.toUpperCase())) {
      return null;
    }

    return Range.create(
      Position.create(params.position.line, startChar),
      Position.create(params.position.line, startChar + word.length),
    );
  }

  /**
   * Выполнение переименования.
   */
  public async onRename(
    params: RenameParams,
    documents: TextDocuments<TextDocument>,
    state: ServerState,
  ): Promise<WorkspaceEdit | null> {
    const doc = documents.get(params.textDocument.uri);
    if (!doc || !state.workspaceRoot) return null;

    const lines = doc.getText().split(/\r?\n/);
    const lineText = lines[params.position.line];

    const wordInfo = getWordAtPosition(lineText, params.position.character);
    if (!wordInfo) return null;

    const oldName = wordInfo.word;
    const newName = params.newName;

    // Валидация нового имени
    if (!/^[a-zA-Z_]\w*$/.test(newName)) {
      return null;
    }

    const changes: { [uri: string]: TextEdit[] } = {};

    const files = await getAllSourceFiles(state.workspaceRoot);

    for (const filePath of files) {
      const uri = URI.file(filePath).toString();
      let content: string;

      const openDoc = documents.get(uri);
      if (openDoc) {
        content = openDoc.getText();
      } else {
        try {
          content = await fs.promises.readFile(filePath, "utf8");
        } catch {
          continue;
        }
      }

      const fileEdits = this.findAndReplaceInContent(content, oldName, newName);
      if (fileEdits.length > 0) {
        changes[uri] = fileEdits;
      }
    }

    return { changes };
  }

  /**
   * Поиск и замена в содержимом файла.
   */
  private findAndReplaceInContent(
    content: string,
    oldName: string,
    newName: string,
  ): TextEdit[] {
    const edits: TextEdit[] = [];
    const lines = content.split(/\r?\n/);

    const regex = new RegExp(`\\b${escapeRegex(oldName)}\\b`, "gi");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const codePart = getCodePart(line);

      let match;
      while ((match = regex.exec(codePart)) !== null) {
        if (isInsideString(codePart, match.index)) continue;

        edits.push(
          TextEdit.replace(
            Range.create(
              Position.create(i, match.index),
              Position.create(i, match.index + oldName.length),
            ),
            newName,
          ),
        );
      }
    }

    return edits;
  }
}
