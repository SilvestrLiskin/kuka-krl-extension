import {
  DocumentFormattingParams,
  TextDocuments,
  TextEdit,
  Range,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { CODE_KEYWORDS } from "../lib/parser";

// Набор ключевых слов для быстрого поиска
const KEYWORDS = new Set(CODE_KEYWORDS);

// Ключевые слова, уменьшающие отступ (перед строкой)
const DECREASE_INDENT =
  /^\s*(END|ENDFCT|ENDDAT|ENDIF|ENDFOR|ENDWHILE|ENDLOOP|UNTIL|ENDSWITCH|CASE|DEFAULT|ELSE)\b/i;

// Ключевые слова, увеличивающие отступ (после строки)
const INCREASE_INDENT =
  /^\s*(DEF|DEFFCT|DEFDAT|IF|ELSE|FOR|WHILE|LOOP|REPEAT|SWITCH|CASE|DEFAULT)\b/i;

// Блоки для добавления пустой строки перед ними
const BLOCK_START = /^\s*(FOR|IF|WHILE|LOOP|REPEAT|SWITCH)\b/i;

// Блоки для добавления пустой строки после них
const BLOCK_END = /^\s*(ENDFOR|ENDIF|ENDWHILE|ENDLOOP|UNTIL|ENDSWITCH)\b/i;

interface FormattingSettings {
  separateBeforeBlocks: boolean;
  separateAfterBlocks: boolean;
}

let formattingSettings: FormattingSettings = {
  separateBeforeBlocks: false,
  separateAfterBlocks: false,
};

/**
 * Установка настроек форматирования.
 */
export function setFormattingSettings(
  settings: Partial<FormattingSettings>,
): void {
  formattingSettings = { ...formattingSettings, ...settings };
}

export class KrlFormatter {
  /**
   * Форматирует документ (отступы, регистр ключевых слов).
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

      if (line.length === 0) {
        resultLines.push("");
        continue;
      }

      // Отделяем комментарий
      const commentIndex = line.indexOf(";");
      let codePart = commentIndex >= 0 ? line.substring(0, commentIndex) : line;

      // Приводим ключевые слова к верхнему регистру (исключая строки)
      codePart = this.uppercaseKeywords(codePart);

      // Собираем строку обратно
      const formattedLine =
        commentIndex >= 0 ? codePart + line.substring(commentIndex) : codePart;

      // Уменьшение отступа
      if (DECREASE_INDENT.test(codePart)) {
        indentLevel = Math.max(0, indentLevel - 1);
      }

      // Пустая строка перед блоком
      if (
        formattingSettings.separateBeforeBlocks &&
        BLOCK_START.test(codePart)
      ) {
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

      // Пустая строка после блока
      if (formattingSettings.separateAfterBlocks && BLOCK_END.test(codePart)) {
        if (i < lines.length - 1 && lines[i + 1].trim() !== "") {
          resultLines.push("");
        }
      }

      // Увеличение отступа
      if (INCREASE_INDENT.test(codePart)) {
        // Исключение для однострочного IF
        if (/^IF\b/i.test(codePart) && /\bENDIF\b/i.test(codePart)) {
          // Нет изменения отступа
        } else {
          indentLevel++;
        }
      }
    }

    // Замена всего текста
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
   * Преобразует ключевые слова в верхний регистр, игнорируя содержимое строк.
   */
  private uppercaseKeywords(text: string): string {
    let result = "";
    let i = 0;
    let inString = false;
    let wordStart = -1;

    while (i < text.length) {
      const char = text[i];

      if (char === '"') {
        if (inString) {
          // Конец строки (или экранированная кавычка "")
          // Проверяем следующую кавычку
          /*
          TODO: KRL использует "" для экранирования кавычки внутри строки.
          Но для форматирования нам важно просто пропустить содержимое.
          Если мы встретили ", это может быть конец или эскейп.
          Если следующий символ тоже ", то это эскейп, мы остаемся в строке.
          */
          if (i + 1 < text.length && text[i + 1] === '"') {
            result += '""';
            i += 2;
            continue;
          } else {
            inString = false;
          }
        } else {
          inString = true;
        }
        result += char;
        i++;
        continue;
      }

      if (inString) {
        result += char;
        i++;
        continue;
      }

      // Если не в строке, ищем слова
      if (/[a-zA-Z0-9_]/.test(char)) {
        if (wordStart === -1) wordStart = i;
      } else {
        if (wordStart !== -1) {
          // Конец слова
          const word = text.substring(wordStart, i);
          if (KEYWORDS.has(word.toUpperCase())) {
            result += word.toUpperCase();
          } else {
            result += word;
          }
          wordStart = -1;
        }
        result += char;
      }
      i++;
    }

    // Обработка последнего слова
    if (wordStart !== -1) {
      const word = text.substring(wordStart);
      if (KEYWORDS.has(word.toUpperCase())) {
        result += word.toUpperCase();
      } else {
        result += word;
      }
    }

    return result;
  }
}
