import {
  DocumentFormattingParams,
  TextDocuments,
  TextEdit,
  Range,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { CODE_KEYWORDS } from "../lib/parser";

// Преобразуем массив ключевых слов в Set для O(1) поиска
const KEYWORDS = new Set(CODE_KEYWORDS);

// Girinti azaltan anahtar kelimeler - satır yazdırılmadan ÖNCE
const DECREASE_INDENT =
  /^\s*(END|ENDFCT|ENDDAT|ENDIF|ENDFOR|ENDWHILE|ENDLOOP|UNTIL|ENDSWITCH|CASE|DEFAULT|ELSE)\b/i;

// Girinti artıran anahtar kelimeler - satır yazdırıldıktan SONRA
const INCREASE_INDENT =
  /^\s*(DEF|DEFFCT|DEFDAT|IF|ELSE|FOR|WHILE|LOOP|REPEAT|SWITCH|CASE|DEFAULT)\b/i;

// Блоки, перед которыми можно добавить пустую строку
const BLOCK_START = /^\s*(FOR|IF|WHILE|LOOP|REPEAT|SWITCH)\b/i;

// Блоки, после которых можно добавить пустую строку
const BLOCK_END = /^\s*(ENDFOR|ENDIF|ENDWHILE|ENDLOOP|UNTIL|ENDSWITCH)\b/i;

// Настройки форматирования (получаются из клиента)
interface FormattingSettings {
  separateBeforeBlocks: boolean;
  separateAfterBlocks: boolean;
  indentFolds: boolean;
  alignAssignments: boolean;
}

// Хранилище настроек
let formattingSettings: FormattingSettings = {
  separateBeforeBlocks: false,
  separateAfterBlocks: false,
  indentFolds: true,
  alignAssignments: true,
};

/**
 * Устанавливает настройки форматирования.
 */
export function setFormattingSettings(
  settings: Partial<FormattingSettings>,
): void {
  formattingSettings = { ...formattingSettings, ...settings };
}

export class KrlFormatter {
  /**
   * Belge biçimlendirmesi sağlar - girinti ve anahtar kelime büyük harfleştirme.
   */
  provideFormatting(
    params: DocumentFormattingParams,
    documents: TextDocuments<TextDocument>,
  ): TextEdit[] {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return [];
    }

    const edits: TextEdit[] = [];
    const text = document.getText();
    const lines = text.split(/\r?\n/);
    const resultLines: string[] = [];

    let indentLevel = 0;
    const tabSize = params.options.tabSize || 2;
    const insertSpaces = params.options.insertSpaces;
    const indentChar = insertSpaces ? " ".repeat(tabSize) : "\t";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // const originalLine = lines[i]; // Not used

      if (line.length === 0) {
        // Boş satır - sadece boşlukları temizle
        resultLines.push("");
        continue;
      }

      // Yorum kısmını ayır
      const commentIndex = line.indexOf(";");
      let codePart = commentIndex >= 0 ? line.substring(0, commentIndex) : line;

      // Anahtar kelimeleri büyük harfe dönüştür
      codePart = this.uppercaseKeywords(codePart);

      // Satırı yeniden oluştur
      const formattedLine =
        commentIndex >= 0 ? codePart + line.substring(commentIndex) : codePart;

      // Girinti hesapla
      // 1. Bu satır için azaltma gerekiyor mu?
      if (DECREASE_INDENT.test(codePart)) {
        indentLevel = Math.max(0, indentLevel - 1);
      }

      // FOLD Logic
      if (formattingSettings.indentFolds && /^\s*;?ENDFOLD\b/i.test(codePart)) {
        indentLevel = Math.max(0, indentLevel - 1);
      }

      // Добавить пустую строку перед блоком (если включено)
      if (
        formattingSettings.separateBeforeBlocks &&
        BLOCK_START.test(codePart)
      ) {
        // Проверяем, что предыдущая строка не пустая
        if (
          resultLines.length > 0 &&
          resultLines[resultLines.length - 1].trim() !== ""
        ) {
          resultLines.push("");
        }
      }

      const indentString = indentChar.repeat(indentLevel);
      const newLineContent = indentString + formattedLine;

      resultLines.push(newLineContent);

      // Добавить пустую строку после блока (если включено)
      if (formattingSettings.separateAfterBlocks && BLOCK_END.test(codePart)) {
        // Пустая строка будет добавлена в следующей итерации, если следующая строка не пустая
        // Добавляем только если это не последняя строка
        if (i < lines.length - 1 && lines[i + 1].trim() !== "") {
          resultLines.push("");
        }
      }

      // 2. Sonraki satır için artırma gerekiyor mu?
      if (INCREASE_INDENT.test(codePart)) {
        // Özel kontrol: IF ... ENDIF aynı satırda artırma yapmamalı
        if (/^IF\b/i.test(codePart) && /\bENDIF\b/i.test(codePart)) {
          // Değişiklik yok
        } else {
          indentLevel++;
        }
      }

      // FOLD Logic
      if (formattingSettings.indentFolds && /^\s*;?FOLD\b/i.test(codePart)) {
        indentLevel++;
      }
    }

    // Align assignments if enabled
    if (formattingSettings.alignAssignments) {
      this.alignAssignments(resultLines);
    }

    // Формируем единый TextEdit для всего документа
    const newText = resultLines.join("\n");
    if (newText !== text.replace(/\r\n/g, "\n")) {
      edits.push(
        TextEdit.replace(
          Range.create(
            0,
            0,
            lines.length,
            lines[lines.length - 1]?.length || 0,
          ),
          newText,
        ),
      );
    }

    return edits;
  }

  /**
   * Aligns consecutive variable assignments.
   */
  private alignAssignments(lines: string[]): void {
    const assignmentRegex = /^(\s*)([\w\[\]\.\$]+)\s*=(?!=)\s*(.+)$/;

    let i = 0;
    while (i < lines.length) {
      const group: {
        index: number;
        indent: string;
        lhs: string;
        rhs: string;
      }[] = [];

      while (i < lines.length) {
        const line = lines[i];
        // Skip empty lines? No, empty lines break the group.
        // Also check for FOLDs or comments that are not assignments
        const match = assignmentRegex.exec(line);

        if (match) {
          // If group is not empty, check indentation match
          if (group.length > 0 && group[0].indent !== match[1]) {
            break; // Indentation changed
          }
          group.push({
            index: i,
            indent: match[1],
            lhs: match[2].trim(),
            rhs: match[3].trim(),
          });
          i++;
        } else {
          break; // Not an assignment
        }
      }

      // Process group
      if (group.length > 1) {
        const maxLhs = Math.max(...group.map((g) => g.lhs.length));

        for (const item of group) {
          lines[item.index] =
            `${item.indent}${item.lhs.padEnd(maxLhs)} = ${item.rhs}`;
        }
      }

      if (group.length === 0) i++;
    }
  }

  /**
   * Kod içindeki anahtar kelimeleri büyük harfe dönüştürür.
   */
  private uppercaseKeywords(text: string): string {
    return text.replace(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g, (match) => {
      if (KEYWORDS.has(match.toUpperCase())) {
        return match.toUpperCase();
      }
      return match;
    });
  }
}
