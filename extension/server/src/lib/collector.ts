import { VariableInfo } from "../types";

/**
 * Разделяет строку с объявлениями переменных, учитывая скобки (массивы).
 * Пример: "a[10], b, c[5,3]" -> ["a[10]", "b", "c[5,3]"]
 */
export const splitVarsRespectingBrackets = (input: string): string[] => {
  const result: string[] = [];
  let current = "";
  let bracketDepth = 0;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === "[") bracketDepth++;
    if (char === "]") bracketDepth--;
    if (char === "," && bracketDepth === 0) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current) result.push(current.trim());
  return result;
};

/**
 * Извлекает определения структур (STRUC) и перечислений (ENUM) из содержимого .dat файла.
 */
export function extractStrucVariables(
  datContent: string,
): Record<string, string[]> {
  // STRUC в KRL объявляется в одну строку, ENDSTRUC отсутствует
  const structRegex =
    /^\s*(?:GLOBAL\s+)?(?:DECL\s+)?(?:GLOBAL\s+)?(STRUC|ENUM)\s+(\w+)\s+(.+)$/gim;

  const knownTypes = [
    "INT",
    "REAL",
    "BOOL",
    "CHAR",
    "STRING",
    "FRAME",
    "ENUM",
    "POS",
    "E6POS",
    "AXIS",
    "E6AXIS",
    "LOAD",
    "SIGNAL",
  ];
  const tempStructDefinitions: Record<string, string[]> = {};

  let match;
  while ((match = structRegex.exec(datContent)) !== null) {
    const structName = match[2];
    let membersRaw = match[3];

    // Удаление комментариев
    membersRaw = membersRaw.split(";")[0].trim();

    // Разбиение на токены
    const tokens = membersRaw
      .split(/[,\s]+/)
      .map((v) => v.trim())
      .filter(Boolean);

    // Фильтрация известных типов, чтобы оставить только имена членов
    // (Это эвристика, может быть неточной для сложных структур)
    const members = tokens.filter(
      (token) =>
        !knownTypes.includes(token.toUpperCase()) &&
        !["ENUM", "STRUC"].includes(token.toUpperCase()),
    );

    tempStructDefinitions[structName] = members;
  }

  // Второй проход: фильтрация имен других структур
  const structDefinitions: Record<string, string[]> = {};
  for (const [structName, members] of Object.entries(tempStructDefinitions)) {
    const filtered = members.filter(
      (member) =>
        !knownTypes.includes(member.toUpperCase()) &&
        !Object.keys(tempStructDefinitions).includes(member),
    );
    structDefinitions[structName] = filtered;
  }
  return structDefinitions;
}

/**
 * Класс для извлечения переменных из текста документа.
 */
export class SymbolExtractor {
  private variables: Map<string, VariableInfo> = new Map(); // имя -> инфо

  /**
   * Извлекает переменные из текста.
   */
  extractFromText(documentText: string): void {
    // Regex для DECL (включая CONST)
    const declRegex =
      /^\s*(?:(?:GLOBAL\s+)?(?:CONST\s+)?DECL\s+(?:GLOBAL\s+)?(?:CONST\s+)?(\w+)|(?:GLOBAL\s+)?(?:CONST\s+)?(INT|REAL|BOOL|CHAR|FRAME|POS|E6POS|E6AXIS|AXIS|LOAD|SIGNAL|STRING))\s+([^\r\n;]+)/gim;

    let match: RegExpExecArray | null;
    while ((match = declRegex.exec(documentText)) !== null) {
      let type = match[1] || match[2];
      const varList = match[3];

      const varParts = splitVarsRespectingBrackets(varList);

      for (const rawPart of varParts) {
        let part = rawPart.trim();
        // Удаление комментариев
        part = part.split(";")[0].trim();
        if (!part) continue;

        let name = part;
        let value: string | undefined = undefined;

        // Обработка SIGNAL
        if (type.toUpperCase() === "SIGNAL") {
          // "SIGNAL Name $IN[1] ..."
          const firstSpace = part.search(/\s/);
          if (firstSpace > 0) {
            name = part.substring(0, firstSpace);
            value = part.substring(firstSpace).trim();
          }
        } else {
          // Обычный DECL: "a=5" или "a"
          const eqIndex = part.indexOf("=");
          if (eqIndex > 0) {
            name = part.substring(0, eqIndex).trim();
            value = part.substring(eqIndex + 1).trim();
          }
        }

        // Очистка имени от индексов массива: "arr[5]" -> "arr"
        const cleanName = name.replace(/\[.*?\]/g, "").trim();

        if (/^[a-zA-Z_]\w*$/.test(cleanName)) {
          if (!this.variables.has(cleanName.toUpperCase())) {
            this.variables.set(cleanName.toUpperCase(), {
              name: cleanName,
              type: type,
              value: value,
            });
          }
        }
      }
    }

    // Извлечение ENUM
    const enumRegex = /^\s*(?:GLOBAL\s+)?ENUM\s+\w+\s+([^\r\n;]+)/gim;
    while ((match = enumRegex.exec(documentText)) !== null) {
      const memberList = match[1];
      const members = memberList.split(",").map((m) => m.trim());
      for (const member of members) {
        if (
          /^[a-zA-Z_]\w*$/.test(member) &&
          !this.variables.has(member.toUpperCase())
        ) {
          this.variables.set(member.toUpperCase(), {
            name: member,
            type: "ENUM_MEMBER",
          });
        }
      }
    }

    // Извлечение параметров функций (DEF/DEFFCT)
    const defRegex =
      /^\s*(?:GLOBAL\s+)?(?:DEF|DEFFCT)\s+(?:(?:\w+|\[\])\s+)?\w+\s*\(([^)]*)\)/gim;
    while ((match = defRegex.exec(documentText)) !== null) {
      const paramList = match[1];
      if (!paramList) continue;

      const params = splitVarsRespectingBrackets(paramList)
        .map((p) => p.replace(/:[A-Z]+/i, "").trim()) // удаляем модификаторы :IN, :OUT
        .filter((p) => /^[a-zA-Z_]\w*$/.test(p));

      for (const p of params) {
        if (!this.variables.has(p.toUpperCase())) {
          this.variables.set(p.toUpperCase(), { name: p, type: "PARAM" });
        }
      }
    }
  }

  getVariables(): VariableInfo[] {
    return Array.from(this.variables.values());
  }

  clear(): void {
    this.variables.clear();
  }
}
