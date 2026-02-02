import { VariableInfo } from "../types";

/**
 * Parantezleri dikkate alarak değişken bildirimlerini böler.
 * Örnek: "a[10], b, c[5,3]" -> ["a[10]", "b", "c[5,3]"]
 */
export const splitVarsRespectingBrackets = (input: string): string[] => {
  return splitVarsRespectingBracketsWithOffsets(input).map((v) => v.text);
};

/**
 * Parantezleri, süslü parantezleri ve tırnak işaretlerini dikkate alarak
 * değişken bildirimlerini böler ve ofsetleri döndürür.
 * @param input İşlenecek dize
 * @param startOffset Dizenin dosya/satır içindeki başlangıç ofseti
 */
export const splitVarsRespectingBracketsWithOffsets = (
  input: string,
  startOffset: number = 0,
): { text: string; offset: number }[] => {
  const result: { text: string; offset: number }[] = [];
  let current = "";
  let bracketDepth = 0; // [], {}
  let inString = false;
  let currentStart = 0;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (char === '"') {
      inString = !inString;
    }

    if (!inString) {
      if (char === "[" || char === "{") bracketDepth++;
      if (char === "]" || char === "}") bracketDepth--;
    }

    if (char === "," && bracketDepth === 0 && !inString) {
      if (current.trim()) {
        const trimmed = current.trimStart();
        const leadingSpaces = current.length - trimmed.length;
        result.push({
          text: current.trim(),
          offset: startOffset + currentStart + leadingSpaces,
        });
      }
      current = "";
      currentStart = i + 1;
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    const trimmed = current.trimStart();
    const leadingSpaces = current.length - trimmed.length;
    result.push({
      text: current.trim(),
      offset: startOffset + currentStart + leadingSpaces,
    });
  }

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
  private variables: Map<string, VariableInfo> = new Map(); // isim -> info

  extractFromText(documentText: string): void {
    // DECL regex'i - CONST dahil
    const declRegex =
      /^\s*(?:(?:GLOBAL\s+)?(?:CONST\s+)?DECL\s+(?:GLOBAL\s+)?(?:CONST\s+)?(\w+)|(?:GLOBAL\s+)?(?:CONST\s+)?(INT|REAL|BOOL|CHAR|FRAME|POS|E6POS|E6AXIS|AXIS|LOAD|SIGNAL|STRING))\s+([^\r\n;]+)/gim;

    let match: RegExpExecArray | null;
    while ((match = declRegex.exec(documentText)) !== null) {
      let type = match[1] || match[2];
      const varList = match[3];

      const varParts = splitVarsRespectingBrackets(varList);

      for (const rawPart of varParts) {
        let part = rawPart.trim();
        // Yorumları temizle
        part = part.split(";")[0].trim();
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
            });
          }
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
          this.variables.set(member.toUpperCase(), {
            name: member,
            type: "ENUM_MEMBER",
          });
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
