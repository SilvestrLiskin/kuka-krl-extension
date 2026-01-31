/**
 * Утилиты для KRL Language Server.
 * Общие вспомогательные функции для предотвращения дублирования кода.
 */

/**
 * Проверяет, находится ли позиция в строке внутри строкового литерала.
 * KRL не поддерживает экранирование через обратный слэш, но поддерживает двойные кавычки ("").
 * Эта функция просто считает количество кавычек до позиции. Если их нечетное количество, то мы внутри строки.
 * @param line Строка текста
 * @param position Позиция курсора (индекс символа)
 * @returns true, если позиция внутри строки
 */
export function isInsideString(line: string, position: number): boolean {
  let inString = false;
  for (let i = 0; i < position && i < line.length; i++) {
    if (line[i] === '"') {
      inString = !inString;
    }
  }
  return inString;
}

/**
 * Экранирует специальные символы регулярных выражений в строке.
 * @param str Строка для экранирования
 * @returns Экранированная строка, безопасная для использования в RegExp
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Получает кодовую часть строки (до комментария).
 * @param line Строка текста
 * @returns Кодовая часть без комментария
 */
export function getCodePart(line: string): string {
  const commentIndex = line.indexOf(";");
  return commentIndex >= 0 ? line.substring(0, commentIndex) : line;
}
