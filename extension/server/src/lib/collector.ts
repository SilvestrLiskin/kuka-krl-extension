import { VariableInfo } from "../types";

/**
 * Strips comments from a line, respecting strings.
 * "Hello; World" ; Comment -> "Hello; World"
 */
export function stripComments(text: string): string {
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '"') inString = !inString;
    if (text[i] === ";" && !inString) return text.substring(0, i).trim();
  }
  return text.trim();
}

/**
 * Splits variable declarations respecting brackets AND strings.
 * Example: "a[10], b, c[5,3], s=\"A,B\"" -> ["a[10]", "b", "c[5,3]", "s=\"A,B\""]
 */
export const splitVarsRespectingBrackets = (input: string): string[] => {
  const result: string[] = [];
  let current = "";
  let bracketDepth = 0;
  let inString = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (char === '"') {
      inString = !inString;
    }

    if (!inString) {
      if (char === "[") bracketDepth++;
      if (char === "]") bracketDepth--;
    }

    if (char === "," && bracketDepth === 0 && !inString) {
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
 * .dat dosyası içeriğinden struct ve enum üyelerini çıkarır.
 */
export function extractStrucVariables(
  datContent: string,
): Record<string, string[]> {
  // KRL'de STRUC tek satırda tanımlanır, ENDSTRUC yok
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

    // Yorum kısmını kaldır
    membersRaw = stripComments(membersRaw);

    const tokens = membersRaw
      .split(/[,\s]+/)
      .map((v) => v.trim())
      .filter(Boolean);

    const members = tokens.filter(
      (token) =>
        !knownTypes.includes(token.toUpperCase()) &&
        !["ENUM", "STRUC"].includes(token.toUpperCase()),
    );

    tempStructDefinitions[structName] = members;
  }

  // Tip isimlerini üye listesinden filtrele
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
 * Belge metninden bildirilen değişkenleri çıkaran yardımcı sınıf.
 */
export class SymbolExtractor {
  private variables: Map<string, VariableInfo> = new Map(); // isim -> info

  extractFromText(documentText: string): void {
    // DECL regex'i - CONST dahil
    // match[1]: Full prefix containing GLOBAL/CONST/DECL/Type
    // match[2]: Type if captured in first group (e.g. DECL INT) - Wait, regex is complex.
    // Let's simplify and use the previous logic but capture the whole line
    const declRegex =
      /^\s*((?:GLOBAL\s+)?(?:CONST\s+)?DECL\s+(?:GLOBAL\s+)?(?:CONST\s+)?(\w+)|(?:GLOBAL\s+)?(?:CONST\s+)?(INT|REAL|BOOL|CHAR|FRAME|POS|E6POS|E6AXIS|AXIS|LOAD|SIGNAL|STRING))\s+([^\r\n]+)/gim;

    let match: RegExpExecArray | null;
    while ((match = declRegex.exec(documentText)) !== null) {
      const fullPrefix = match[1];
      let type = match[2] || match[3];
      const rawLine = match[4];

      const isGlobal = /\bGLOBAL\b/i.test(fullPrefix);
      const scope: "GLOBAL" | "LOCAL" = isGlobal ? "GLOBAL" : "LOCAL";

      // Strip comments respecting strings
      const varList = stripComments(rawLine);

      const varParts = splitVarsRespectingBrackets(varList);

      for (const rawPart of varParts) {
        let part = rawPart.trim();
        if (!part) continue;

        let name = part;
        let value: string | undefined = undefined;

        // SIGNAL durumunu özel işle
        if (type.toUpperCase() === "SIGNAL") {
          // "SIGNAL Name $IN[1] ..."
          // Boşlukla ilk ayırıcıyı bul
          const firstSpace = part.search(/\s/);
          if (firstSpace > 0) {
            name = part.substring(0, firstSpace);
            value = part.substring(firstSpace).trim();
          }
        } else {
          // Normal DECL: "a=5" veya "a"
          const eqIndex = part.indexOf("=");
          if (eqIndex > 0) {
            name = part.substring(0, eqIndex).trim();
            value = part.substring(eqIndex + 1).trim();
          }
        }

        // Dizi indekslerini temizle: "arr[5]" -> "arr"
        const cleanName = name.replace(/\[.*?\]/g, "").trim();

        if (/^[a-zA-Z_]\w*$/.test(cleanName)) {
          if (!this.variables.has(cleanName.toUpperCase())) {
            this.variables.set(cleanName.toUpperCase(), {
              name: cleanName,
              type: type,
              value: value,
              scope: scope
            });
          }
        }
      }
    }

    // ENUM üyelerini çıkar
    const enumRegex = /^\s*((?:GLOBAL\s+)?ENUM\s+\w+\s+)([^\r\n]+)/gim;
    while ((match = enumRegex.exec(documentText)) !== null) {
      const prefix = match[1];
      const memberList = stripComments(match[2]);
      const members = memberList.split(",").map((m) => m.trim());

      const isGlobal = /\bGLOBAL\b/i.test(prefix);
      const scope: "GLOBAL" | "LOCAL" = isGlobal ? "GLOBAL" : "LOCAL";

      for (const member of members) {
        if (
          /^[a-zA-Z_]\w*$/.test(member) &&
          !this.variables.has(member.toUpperCase())
        ) {
          this.variables.set(member.toUpperCase(), {
            name: member,
            type: "ENUM_MEMBER",
            scope: scope
          });
        }
      }
    }

    // Fonksiyon parametrelerini yakala
    // Parametreler her zaman LOCAL dir
    const defRegex =
      /^\s*(?:GLOBAL\s+)?(?:DEF|DEFFCT)\s+(?:(?:\w+|\[\])\s+)?\w+\s*\(([^)]*)\)/gim;
    while ((match = defRegex.exec(documentText)) !== null) {
      const paramList = match[1];
      if (!paramList) continue;

      const params = splitVarsRespectingBrackets(paramList)
        .map((p) => p.replace(/:[A-Z]+/i, "").trim()) // :IN, :OUT kaldır
        .filter((p) => /^[a-zA-Z_]\w*$/.test(p));

      for (const p of params) {
        if (!this.variables.has(p.toUpperCase())) {
          this.variables.set(p.toUpperCase(), { name: p, type: "PARAM", scope: "LOCAL" });
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
