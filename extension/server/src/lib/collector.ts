import { VariableInfo } from "../types";
import { Range, Position } from "vscode-languageserver/node";

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

  private computeLineOffsets(text: string): number[] {
    const lines = [0];
    for (let i = 0; i < text.length; i++) {
      if (text[i] === "\n") {
        lines.push(i + 1);
      }
    }
    return lines;
  }

  private getPosition(offset: number, lineOffsets: number[]): Position {
    let low = 0;
    let high = lineOffsets.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (lineOffsets[mid] > offset) {
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }
    const line = low - 1;
    return Position.create(line, offset - lineOffsets[line]);
  }

  extractFromText(documentText: string): void {
    const lineOffsets = this.computeLineOffsets(documentText);

    // DECL regex'i - CONST dahil
    const declRegex =
      /^\s*(?:(?:GLOBAL\s+)?(?:CONST\s+)?DECL\s+(?:GLOBAL\s+)?(?:CONST\s+)?(\w+)|(?:GLOBAL\s+)?(?:CONST\s+)?(INT|REAL|BOOL|CHAR|FRAME|POS|E6POS|E6AXIS|AXIS|LOAD|SIGNAL|STRING))\s+([^\r\n;]+)/gim;

    let match: RegExpExecArray | null;
    while ((match = declRegex.exec(documentText)) !== null) {
      let type = match[1] || match[2];
      const varList = match[3];

      const matchStart = match.index;
      const varListStartInMatch = match[0].lastIndexOf(varList);
      const varListStartAbs = matchStart + varListStartInMatch;

      // GLOBAL kontrolü
      const isGlobal = /\bGLOBAL\b/i.test(match[0]);

      const varParts = splitVarsRespectingBracketsWithOffsets(
        varList,
        varListStartAbs,
      );

      for (const partObj of varParts) {
        let part = partObj.text.trim();
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
            // Range hesaplama
            // partObj.offset, name'in başlangıcıdır (leading space hariç)
            // cleanName uzunluğu kadar range oluştur
            const startPos = this.getPosition(partObj.offset, lineOffsets);
            const endPos = this.getPosition(
              partObj.offset + cleanName.length,
              lineOffsets,
            );

            this.variables.set(cleanName.toUpperCase(), {
              name: cleanName,
              type: type,
              value: value,
              range: Range.create(startPos, endPos),
              isGlobal: isGlobal,
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

      // ENUM üyeleri için pozisyon hesaplama biraz daha zor çünkü splitVars kullanmıyoruz
      // Şimdilik sadece isimleri alıyoruz
      // İyileştirme: splitVarsRespectingBracketsWithOffsets benzeri bir şey yapılabilir
      
      for (const member of members) {
        if (
          /^[a-zA-Z_]\w*$/.test(member) &&
          !this.variables.has(member.toUpperCase())
        ) {
          this.variables.set(member.toUpperCase(), {
            name: member,
            type: "ENUM_MEMBER",
            // ENUM üyeleri için range hesaplamasını atlıyoruz veya geliştirebiliriz
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

      // Parametreler için de pozisyon hesaplaması eksik
      // Ancak "Unused Variable" genellikle local değişkenler için (DECL)
      // Parametreler kullanılmasa da kaldırılması zordur (API değişimi)
      
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
