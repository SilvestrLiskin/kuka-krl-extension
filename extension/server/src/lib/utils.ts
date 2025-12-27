/**
 * Utility functions for KRL Language Server.
 * Shared helpers to avoid code duplication across features.
 */

/**
 * Check if a position in a line is inside a string literal.
 * KRL does not support escape sequences inside strings.
 * @param line The line of text
 * @param position The character position to check
 * @returns true if the position is inside a string
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
 * Escape special regex characters in a string.
 * @param str The string to escape
 * @returns The escaped string safe for use in RegExp
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Get the code part of a line (before any comment).
 * @param line The line of text
 * @returns The code part without the comment
 */
export function getCodePart(line: string): string {
  const commentIndex = line.indexOf(";");
  return commentIndex >= 0 ? line.substring(0, commentIndex) : line;
}
