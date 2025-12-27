import { VariableInfo } from "../types";

/**
 * Parantezleri dikkate alarak değişken bildirimlerini böler.
 * Örnek: "a[10], b, c[5,3]" -> ["a[10]", "b", "c[5,3]"]
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
    membersRaw = membersRaw.split(";")[0].trim();

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
  private variables: Map<string, string> = new Map(); // isim -> tip

  extractFromText(documentText: string): void {
    // DECL regex'i - CONST dahil
    const declRegex =
      /^\s*(?:(?:GLOBAL\s+)?(?:CONST\s+)?DECL\s+(?:GLOBAL\s+)?(?:CONST\s+)?(\w+)|(?:GLOBAL\s+)?(?:CONST\s+)?(INT|REAL|BOOL|CHAR|FRAME|POS|E6POS|E6AXIS|AXIS|LOAD|SIGNAL|STRING))\s+([^\r\n;]+)/gim;

    let match: RegExpExecArray | null;
    while ((match = declRegex.exec(documentText)) !== null) {
      const type = match[1] || match[2];
      const varList = match[3];

      const varNames = splitVarsRespectingBrackets(varList)
        .map((name) => name.trim())
        .map((name) => name.replace(/\[.*?\]/g, "").trim())
        .map((name) => name.replace(/\s*=\s*.+$/, ""))
        .map((name) => name.split(/\s+/)[0]) // "SIGNAL s $IN..." durumunu işle
        .filter((name) => /^[a-zA-Z_]\w*$/.test(name));

      for (const name of varNames) {
        if (!this.variables.has(name.toUpperCase())) {
          this.variables.set(name.toUpperCase(), type);
        }
      }
    }

    // ENUM üyelerini çıkar
    const enumRegex = /^\s*(?:GLOBAL\s+)?ENUM\s+\w+\s+([^\r\n;]+)/gim;
    while ((match = enumRegex.exec(documentText)) !== null) {
      const memberList = match[1];
      const members = memberList.split(",").map((m) => m.trim());
      for (const member of members) {
        if (
          /^[a-zA-Z_]\w*$/.test(member) &&
          !this.variables.has(member.toUpperCase())
        ) {
          this.variables.set(member.toUpperCase(), "ENUM_MEMBER");
        }
      }
    }

    // Fonksiyon parametrelerini yakala
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
          this.variables.set(p.toUpperCase(), "PARAM");
        }
      }
    }
  }

  getVariables(): VariableInfo[] {
    return Array.from(this.variables.entries()).map(([name, type]) => ({
      name,
      type,
    }));
  }

  clear(): void {
    this.variables.clear();
  }
}
