import { TextDocument } from "vscode-languageserver-textdocument";
import {
  Connection,
  Diagnostic,
  DiagnosticSeverity,
  DiagnosticTag,
  Range,
} from "vscode-languageserver/node";
import { CODE_KEYWORDS } from "../lib/parser";
import { splitVarsRespectingBracketsWithOffsets } from "../lib/collector";
import { VariableInfo } from "../types";
import { t } from "../lib/i18n";

// =============================================================================
// Pre-compiled Regular Expressions for Performance
// =============================================================================

const REGEX_INVISIBLE_CHARS = /[\u200B-\u200F\uFEFF\u00AD\u2060]/g;
const REGEX_NON_ASCII = /[^\x00-\x7F]/g;
const REGEX_DEFDAT_START = /^DEFDAT\s+(\w+)(?:\s+PUBLIC)?/i;
const REGEX_PUBLIC = /PUBLIC/i;
const REGEX_ENDDAT = /^ENDDAT\b/i;
const REGEX_IS_DECL_LINE = /^(?:DECL\s+)?(?:GLOBAL\s+)?(?:DECL\s+)?\w+\s+(?:\$?[a-zA-Z0-9_]+)/i;
const REGEX_SIGNAL = /^\s*SIGNAL\b/i;
const REGEX_STRUC = /^STRUC\b/i;
const REGEX_GLOBAL = /\bGLOBAL\b/i;
const REGEX_DECL_SIGNAL_STRUC = /^(?:DECL|SIGNAL|STRUC)\b/i;
const REGEX_VAR_NAME_DECL = /^(?:GLOBAL\s+)?(?:DECL\s+)?(?:GLOBAL\s+)?\w+\s+(\w+)/i;
const REGEX_STARTS_WITH_DIGIT = /^\d/;

const REGEX_VARIABLE = /\b([a-zA-Z_]\w*)\b/g;
const REGEX_LOCAL_DECL = /^\s*(?:GLOBAL\s+)?(?:DECL\s+)?\w+\s+([a-zA-Z_]\w*(?:\s*\[[^\]]*\])?(?:\s*,\s*[a-zA-Z_]\w*(?:\s*\[[^\]]*\])?)*)/gim;
const REGEX_ARRAY_BRACKETS = /\[.*?\]/g;
const REGEX_VALID_VAR_NAME = /^[a-zA-Z_]\w*$/;
const REGEX_SKIP_DECL_STRUC_SIGNAL = /^\s*(?:GLOBAL\s+)?(?:DECL|STRUC|SIGNAL)\b/i;
const REGEX_SKIP_DEF = /^\s*(?:GLOBAL\s+)?(?:DEF|DEFFCT)\b/i;
const REGEX_STRING_CONTENT = /"[^"]*"/g;
const REGEX_SCIENTIFIC_NOTATION = /\d+\.?\d*[eE][+-]?\d+/g;

const REGEX_VEL_CP = /\$VEL\.CP\s*=\s*(\d+(?:\.\d+)?)/gi;
const REGEX_VEL_PTP = /\$VEL_PTP\s*=\s*(\d+(?:\.\d+)?)/gi;

const REGEX_TOOL_INIT = /\$TOOL\s*=|BAS\s*\(\s*#INITMOV/i;
const REGEX_BASE_INIT = /\$BASE\s*=|BAS\s*\(\s*#INITMOV/i;
const REGEX_MOVEMENT = /^\s*(?:PTP|LIN|CIRC|SPTP|SLIN|SCIRC)\s+/i;
const REGEX_DEF_RESET = /^\s*(?:DEF|DEFFCT)\s+/i;

const REGEX_FUNC_DEF = /^\s*(?:GLOBAL\s+)?(DEF|DEFFCT)\s+(?:\w+\s+)?(\w+)\s*\(/i;

const REGEX_LABEL = /^\w+\s*:\s*$/i;
const REGEX_BLOCK_END = /^(END|ENDIF|ENDFOR|ENDWHILE|ENDLOOP|ENDFCT|UNTIL|CASE|DEFAULT|ELSE|ENDDAT|ENDSUB|ENDSPS)\b/i;

// Pre-compiled regexes for optimization
const REGEX_LABEL_DECL = /^\s*([a-zA-Z_]\w*)\s*:/gim;

const EXIT_KEYWORDS = ["RETURN", "EXIT", "HALT"];
const EXIT_KEYWORD_REGEXES = EXIT_KEYWORDS.map((kw) => ({
  keyword: kw,
  regex: new RegExp(`^${kw}\\b`, "i"),
}));

const BLOCK_PAIRS: Record<string, string> = {
  IF: "ENDIF",
  FOR: "ENDFOR",
  WHILE: "ENDWHILE",
  LOOP: "ENDLOOP",
  REPEAT: "UNTIL",
  SWITCH: "ENDSWITCH",
  DEF: "END",
  DEFFCT: "ENDFCT",
  DEFDAT: "ENDDAT",
};

const CLOSE_TO_OPEN: Record<string, string> = {};
for (const [open, close] of Object.entries(BLOCK_PAIRS)) {
  CLOSE_TO_OPEN[close] = open;
}

const BLOCK_OPEN_REGEXES: Record<string, RegExp> = {};
for (const kw of Object.keys(BLOCK_PAIRS)) {
  BLOCK_OPEN_REGEXES[kw] = new RegExp(`\\b${kw}\\b`, "i");
}

const BLOCK_CLOSE_REGEXES: Record<string, RegExp> = {};
for (const kw of Object.keys(CLOSE_TO_OPEN)) {
  BLOCK_CLOSE_REGEXES[kw] = new RegExp(`\\b${kw}\\b`, "i");
}


/**
 * Удаляет невидимые Unicode-символы.
 * Эти символы могут появляться при копировании из веб-страниц или документов
 * и вызывают ошибки, разрывая ключевые слова (например, "WAIT" превращается в "W" и "it").
 */
function stripInvisibleChars(text: string): string {
  // Zero-width characters ve diğer görünmez karakterleri kaldır
  // U+200B (Zero Width Space)
  // U+200C (Zero Width Non-Joiner)
  // U+200D (Zero Width Joiner)
  // U+200E (Left-to-Right Mark)
  // U+200F (Right-to-Left Mark)
  // U+FEFF (Byte Order Mark / Zero Width No-Break Space)
  // U+00AD (Soft Hyphen)
  // U+2060 (Word Joiner)
  return text.replace(REGEX_INVISIBLE_CHARS, "");
}

// Önbellek - fonksiyon isimleri için hızlı arama
let functionNamesCache: Set<string> = new Set();

export class DiagnosticsProvider {
  private connection: Connection;
  private workspaceRoot: string | null = null;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  public setWorkspaceRoot(root: string | null) {
    this.workspaceRoot = root;
    // Kök değiştiğinde önbelleği sıfırla
    functionNamesCache.clear();
  }

  /**
   * Fonksiyon önbelleğini günceller.
   */
  public updateFunctionCache(functionNames: string[]) {
    functionNamesCache = new Set(functionNames.map((n) => n.toUpperCase()));
  }

  /**
   * Helper to check variable declaration constraints (length, invalid chars)
   */
  private checkVariableDeclaration(
    lineText: string,
    lineIndex: number,
    diagnostics: Diagnostic[]
  ) {
    // Regex matches the whole line structure (assuming it's a declaration)
    const declRegex =
      /^\s*(?:GLOBAL\s+)?(?:DECL\s+)?(?:GLOBAL\s+)?(STRUC|ENUM|SIGNAL|\w+)\s+([^\r\n;]+)/i;
    const declMatch = lineText.match(declRegex);

    if (declMatch) {
      const type = declMatch[1].toUpperCase();
      const rest = declMatch[2];

      // Skip procedure calls like BAS (#INITMOV, 0)
      if (rest.trimStart().startsWith("(")) return;
      // is the correct index in lineText.
      const restIndex = declMatch[0].lastIndexOf(rest);
      const restStartOffset = restIndex;

      if (type === "STRUC" || type === "ENUM") {
        // STRUC/ENUM: Only check struct/enum name
        const nameMatch = rest.match(/^([a-zA-Z0-9_$]+)/);
        if (nameMatch) {
          const name = nameMatch[1];
          if (name.length > 24) {
            diagnostics.push({
              severity: DiagnosticSeverity.Error,
              range: {
                start: { line: lineIndex, character: restStartOffset },
                end: { line: lineIndex, character: restStartOffset + name.length },
              },
              message: t("diag.nameTooLong", name, name.length),
              source: "krl-language-support",
            });
          }
        }
      } else {
        // DECL or SIGNAL: Check all variables
        const vars = splitVarsRespectingBracketsWithOffsets(
          rest,
          restStartOffset,
        );

        for (const v of vars) {
          let name = v.text;
          const nameOffset = v.offset;

          if (type === "SIGNAL") {
            // SIGNAL Name $IN[1] -> take Name
            const parts = name.split(/\s+/);
            if (parts.length > 0) name = parts[0];
          } else {
            // DECL INT Name=Val -> take Name
            const delimiters = ["=", "[", " "];
            let endIndex = name.length;
            for (const d of delimiters) {
              const idx = name.indexOf(d);
              if (idx !== -1 && idx < endIndex) endIndex = idx;
            }
            name = name.substring(0, endIndex);
          }
          name = name.trim();

          if (name.length > 24) {
            diagnostics.push({
              severity: DiagnosticSeverity.Error,
              range: {
                start: { line: lineIndex, character: nameOffset },
                end: { line: lineIndex, character: nameOffset + name.length },
              },
              message: t("diag.nameTooLong", name, name.length),
              source: "krl-language-support",
            });
          }

          const invalidCharMatch = name.match(/[^a-zA-Z0-9_$]/);
          if (invalidCharMatch) {
            diagnostics.push({
              severity: DiagnosticSeverity.Error,
              range: {
                start: { line: lineIndex, character: nameOffset },
                end: { line: lineIndex, character: nameOffset + name.length },
              },
              message: t("diag.invalidCharInName", invalidCharMatch[0]),
              source: "krl-language-support",
            });
          }
          if (REGEX_STARTS_WITH_DIGIT.test(name)) {
            diagnostics.push({
              severity: DiagnosticSeverity.Error,
              range: {
                start: { line: lineIndex, character: nameOffset },
                end: { line: lineIndex, character: nameOffset + name.length },
              },
              message: t("diag.nameStartsWithDigit", name),
              source: "krl-language-support",
            });
          }
        }
      }
    }
  }

  /**
   * Проверяет .dat файл на соответствие правилам GLOBAL/PUBLIC.
   * Также ищет символы вне ASCII и незакрытые кавычки в строках.
   */
  public validateDatFile(
    document: TextDocument,
    validateNonAscii: boolean = true,
  ): Diagnostic[] {
    // SİSTEM DOSYALARINI ATLA (büyük/küçük harf duyarsız)
    const lowerUri = document.uri.toLowerCase().replace(/\\/g, "/");
    if (
      lowerUri.includes("/mada/") ||
      lowerUri.includes("/system/") ||
      lowerUri.includes("/tp/")
    ) {
      return [];
    }

    const diagnostics: Diagnostic[] = [];
    const lines = document.getText().split(/\r?\n/);

    let insideDefdat = false;
    let insidePublicDefdat = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // ASCII olmayan karakterleri kontrol et (validateNonAscii ayarı etkinse)
      if (validateNonAscii) {
        // Yorum satırlarını veya satır içi yorumları hariç tut
        const commentIndex = line.indexOf(";");
        const checkPart =
          commentIndex >= 0 ? line.substring(0, commentIndex) : line;

        const nonAsciiMatch = checkPart.match(REGEX_NON_ASCII);
        if (nonAsciiMatch) {
          // Her bir non-ASCII karakteri bul ve işaretle
          for (let j = 0; j < checkPart.length; j++) {
            const charCode = checkPart.charCodeAt(j);
            if (charCode > 127) {
              // BOM (Byte Order Mark) karakterini yoksay (U+FEFF = 65279)
              if (charCode === 0xfeff) continue;


              const char = checkPart[j];
              diagnostics.push({
                severity: DiagnosticSeverity.Error,
                tags: [DiagnosticTag.Deprecated],
                code: "nonAscii",
                range: {
                  start: { line: i, character: j },
                  end: { line: i, character: j + 1 },
                },
                message: t("diag.nonAsciiChar", char),
                source: "krl-language-support",
              });
            }
          }
        }
      }

      // Kapatılmamış stringleri kontrol et
      // Düzeltildi: String içindeki noktalı virgülleri yorum olarak algılama

      let inString = false;
      let quoteCount = 0;
      let effectiveLineLength = line.length;

      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          inString = !inString;
          quoteCount++;
        } else if (char === ";" && !inString) {
          // String dışındaysak, bu bir yorum başlangıcıdır
          effectiveLineLength = j;
          break;
        }
      }

      // Yorum kısmını at
      const codePart = line.substring(0, effectiveLineLength);
      // Sayılan tırnaklar yorum öncesi kısımdakilerdir

      // Eğer tırnak sayısı tekse, string kapatılmamıştır
      if (quoteCount % 2 !== 0) {
        const firstQuote = codePart.indexOf('"');
        diagnostics.push({
          severity: DiagnosticSeverity.Error,
          range: {
            start: { line: i, character: firstQuote >= 0 ? firstQuote : 0 },
            end: { line: i, character: codePart.length },
          },
          message: t("diag.unclosedString"),
          source: "krl-language-support",
        });
      }

      // DEFDAT başlangıcını algıla
      const defdatMatch = trimmedLine.match(REGEX_DEFDAT_START);
      if (defdatMatch) {
        insideDefdat = true;
        insidePublicDefdat = REGEX_PUBLIC.test(trimmedLine);
        continue;
      }

      // DEFDAT sonunu algıla
      if (REGEX_ENDDAT.test(trimmedLine)) {
        insideDefdat = false;
        insidePublicDefdat = false;
        continue;
      }

      if (insideDefdat) {
        // Bildirim satırı mı kontrol et
        const isDeclLine =
          REGEX_IS_DECL_LINE.test(trimmedLine) ||
          REGEX_SIGNAL.test(trimmedLine) ||
          REGEX_STRUC.test(trimmedLine);

        if (!isDeclLine) continue;

        // GLOBAL anahtar kelimesi var mı?
        const hasGlobal = REGEX_GLOBAL.test(trimmedLine);

        if (insidePublicDefdat) {
          // PUBLIC DEFDAT içinde GLOBAL olmalı
          if (!hasGlobal && REGEX_DECL_SIGNAL_STRUC.test(trimmedLine)) {
            const newDiagnostic: Diagnostic = {
              severity: DiagnosticSeverity.Warning,
              range: {
                start: { line: i, character: 0 },
                end: { line: i, character: trimmedLine.length },
              },
              message: t("diag.notGlobalButPublic"),
              source: "krl-language-support",
            };
            diagnostics.push(newDiagnostic);
          }
        } else {
          // PUBLIC olmayan DEFDAT içinde GLOBAL olmamalı
          if (hasGlobal) {
            const newDiagnostic: Diagnostic = {
              severity: DiagnosticSeverity.Error,
              range: {
                start: { line: i, character: 0 },
                end: { line: i, character: trimmedLine.length },
              },
              message: t("diag.globalButNotPublic"),
              source: "krl-language-support",
            };
            diagnostics.push(newDiagnostic);
          }
        }

        // KUKA 24-karakter değişken isim limitini kontrol et (Robust Check)
        // Use codePart (ignores comments) but preserves indentation
        this.checkVariableDeclaration(codePart, i, diagnostics);
      } else {
        // Blocks outside DEFDAT: Still check for Name Length and ASCII
        this.checkVariableDeclaration(codePart, i, diagnostics);
      }
    }
    return diagnostics;
  }

  /**
   * Kullanılmayan değişkenleri tespit eder.
   */
  public validateUnusedVariables(
    document: TextDocument,
    declaredVariables: VariableInfo[],
  ): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const uri = document.uri.toLowerCase();

    // Sadece .src ve .sub dosyalarını kontrol et (global olmayan değişkenler için)
    // .dat dosyalarındaki değişkenler genellikle .src dosyasında kullanılır, bu yüzden burada kontrol edilmez.
    if (!uri.endsWith(".src") && !uri.endsWith(".sub")) {
      return [];
    }

    const text = document.getText();

    // Sadece range bilgisi olan (yerel/parsed) ve GLOBAL OLMAYAN değişkenleri kontrol et
    const varsToCheck = declaredVariables.filter(
      (v) => v.range !== undefined && !v.isGlobal,
    );

    if (varsToCheck.length === 0) return [];

    // Kullanım sayılarını başlat
    const usageCounts = new Map<string, number>();
    const varMap = new Map<string, VariableInfo>();

    for (const v of varsToCheck) {
      usageCounts.set(v.name.toUpperCase(), 0);
      varMap.set(v.name.toUpperCase(), v);
    }

    const lines = text.split(/\r?\n/);
    const variableRegex = REGEX_VARIABLE;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Yorumları atla
      const commentIdx = line.indexOf(";");
      let codePart = commentIdx >= 0 ? line.substring(0, commentIdx) : line;

      // String ve bilimsel gösterimi temizle
      codePart = codePart.replace(REGEX_STRING_CONTENT, '""');
      codePart = codePart.replace(REGEX_SCIENTIFIC_NOTATION, "0");
      codePart = stripInvisibleChars(codePart);

      let match;
      variableRegex.lastIndex = 0;
      while ((match = variableRegex.exec(codePart)) !== null) {
        const varName = match[1].toUpperCase();

        if (usageCounts.has(varName)) {
          const info = varMap.get(varName);
          if (info && info.range) {
            // Bildirim yerini kontrol et
            // Eğer eşleşme bildirim range'i içindeyse, bu bir kullanım değil bildirimdir.
            if (
              info.range.start.line === i &&
              match.index >= info.range.start.character &&
              match.index < info.range.end.character
            ) {
              // Bildirimin kendisi, yoksay
            } else {
              // Kullanım bulundu
              usageCounts.set(varName, (usageCounts.get(varName) || 0) + 1);
            }
          }
        }
      }
    }

    // Hiç kullanılmayanları raporla
    for (const [name, count] of usageCounts) {
      if (count === 0) {
        const info = varMap.get(name);
        if (info && info.range) {
          diagnostics.push({
            severity: DiagnosticSeverity.Hint,
            tags: [DiagnosticTag.Unnecessary],
            range: info.range,
            message: t("diag.unusedVariable", info.name),
            source: "krl-language-support",
            code: "unusedVariable",
            data: { varName: info.name },
          });
        }
      }
    }

    return diagnostics;
  }

  /**
   * Değişken kullanımlarını doğrular - tanımsız değişkenleri tespit eder.
   * Optimize edildi: async çağrılar önbellekle değiştirildi.
   */
  public validateVariablesUsage(
    document: TextDocument,
    declaredVariables: VariableInfo[],
  ): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const text = document.getText();
    const lines = text.split(/\r?\n/);
    const variableRegex = REGEX_VARIABLE;

    // MAKİNA DAT DOSYALARINI VE SİSTEM KONFİGÜRASYONUNU ATLA
    const lowerUri = document.uri.toLowerCase().replace(/\\/g, "/");
    if (
      lowerUri.includes("/mada/") ||
      lowerUri.includes("/system/") ||
      lowerUri.includes("/tp/") ||
      lowerUri.includes("machine.dat") ||
      lowerUri.includes("config.dat")
    ) {
      return [];
    }

    // Dizi'den Set'e dönüştür - O(1) arama için (büyük/küçük harf duyarsız)
    const validatedNames = new Set(
      declaredVariables.map((v) => v.name.toUpperCase()),
    );

    // Mevcut belgeden YEREL değişkenleri de çıkar
    const localDeclRegex = REGEX_LOCAL_DECL;
    let localMatch;
    while ((localMatch = localDeclRegex.exec(text)) !== null) {
      const varList = localMatch[1];
      const vars = varList
        .split(",")
        .map((v) => v.replace(REGEX_ARRAY_BRACKETS, "").trim());
      for (const v of vars) {
        if (REGEX_VALID_VAR_NAME.test(v)) {
          validatedNames.add(v.toUpperCase());
        }
      }
    }

    // ETIKETLERI BUL (Labels) - GOTO hedefleri için
    // Örn: "MyLabel:" veya " MyLabel :"
    REGEX_LABEL_DECL.lastIndex = 0;
    let labelMatch;
    while ((labelMatch = REGEX_LABEL_DECL.exec(text)) !== null) {
      validatedNames.add(labelMatch[1].toUpperCase());
    }

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];

      // Bildirim veya struct veya sinyal satırlarını atla
      if (REGEX_SKIP_DECL_STRUC_SIGNAL.test(line)) {
        continue;
      }

      // DEF/DEFFCT satırlarını atla
      if (REGEX_SKIP_DEF.test(line)) {
        continue;
      }

      // Tırnak içindeki stringleri gizle
      let processedLine = line.replace(REGEX_STRING_CONTENT, '""');
      // Bilimsel gösterimi gizle (örn: 1.0E+02)
      processedLine = processedLine.replace(REGEX_SCIENTIFIC_NOTATION, "0");
      // Görünmez Unicode karakterlerini kaldır (zero-width space vb.)
      processedLine = stripInvisibleChars(processedLine);

      let match;
      while ((match = variableRegex.exec(processedLine)) !== null) {
        const varName = match[1];

        // ';' ile başlayan yorumları atla
        // NOT: processedLine üzerinde arama yapılmalı, orijinal line değil!
        // Çünkü match.index processedLine'a aittir.
        const commentIndex = processedLine.indexOf(";");
        if (commentIndex !== -1 && match.index >= commentIndex) continue;

        // '&' ile başlayan parametreleri atla
        const lineBeforeMatch = processedLine.substring(0, match.index);
        if (lineBeforeMatch.includes("&")) continue;

        // '$' veya '#' ile başlayan sistem değişkenlerini atla
        // NOT: processedLine üzerinde kontrol yapılmalı!
        if (
          match.index !== undefined &&
          match.index > 0 &&
          (processedLine[match.index - 1] === "$" ||
            processedLine[match.index - 1] === "#" ||
            processedLine[match.index - 1] === ".")
        )
          continue;

        // Anahtar kelimeleri atla
        if (CODE_KEYWORDS.includes(varName.toUpperCase())) continue;

        // Değişken listesinde tanımlı mı kontrol et
        if (validatedNames.has(varName.toUpperCase())) continue;

        // Fonksiyon mu kontrol et (önbellekten)
        if (functionNamesCache.has(varName.toUpperCase())) continue;

        // Bilinmeyen sembol ise hata bildir
        let message = t("diag.variableNotDefined", varName);

        // Поиск похожего имени (Spellchecking)
        let bestMatch = "";
        let minDistance = 3; // Порог схожести

        for (const name of validatedNames) {
          const distance = levenshteinDistance(varName.toUpperCase(), name);
          if (distance < minDistance) {
            minDistance = distance;
            bestMatch = name;
          }
        }

        if (bestMatch) {
          message += ` ${t("diag.didYouMean", bestMatch)}`;
        }

        const newDiagnostic: Diagnostic = {
          severity: DiagnosticSeverity.Error,
          code: bestMatch ? "variableTypo" : "variableNotDefined",
          data: bestMatch ? { replacement: bestMatch } : undefined,
          message: message,
          range: {
            start: { line: lineIndex, character: match.index },
            end: { line: lineIndex, character: match.index + varName.length },
          },
          source: "krl-language-support",
        };

        if (!this.isDuplicateDiagnostic(newDiagnostic, diagnostics)) {
          diagnostics.push(newDiagnostic);
        }
      }
    }
    return diagnostics;
  }

  private isDuplicateDiagnostic(
    newDiag: Diagnostic,
    existingDiagnostics: Diagnostic[],
  ): boolean {
    return existingDiagnostics.some(
      (diag) =>
        diag.range.start.line === newDiag.range.start.line &&
        diag.range.start.character === newDiag.range.start.character &&
        diag.range.end.line === newDiag.range.end.line &&
        diag.range.end.character === newDiag.range.end.character &&
        diag.message === newDiag.message &&
        diag.severity === newDiag.severity,
    );
  }

  /**
   * Проверяет безопасные скорости в SRC файлах.
   * Warning для $VEL.CP > 2 m/s и $VEL_PTP > 100%
   */
  public validateSafetySpeeds(document: TextDocument): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const text = document.getText();
    const lines = text.split(/\r?\n/);

    const velCpRegex = REGEX_VEL_CP;
    const velPtpRegex = REGEX_VEL_PTP;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Пропустить комментарии
      const commentIdx = line.indexOf(";");
      const codePart = commentIdx >= 0 ? line.substring(0, commentIdx) : line;

      // Проверка $VEL.CP
      let match;
      velCpRegex.lastIndex = 0;
      while ((match = velCpRegex.exec(codePart)) !== null) {
        const velocity = parseFloat(match[1]);
        if (velocity > 3) {
          diagnostics.push({
            severity: DiagnosticSeverity.Warning,
            range: {
              start: { line: i, character: match.index },
              end: { line: i, character: match.index + match[0].length },
            },
            message: t("diag.velocityTooHigh", velocity.toString()),
            source: "krl-language-support",
          });
        }
      }

      // Проверка $VEL_PTP
      velPtpRegex.lastIndex = 0;
      while ((match = velPtpRegex.exec(codePart)) !== null) {
        const velocity = parseFloat(match[1]);
        if (velocity > 100) {
          diagnostics.push({
            severity: DiagnosticSeverity.Warning,
            range: {
              start: { line: i, character: match.index },
              end: { line: i, character: match.index + match[0].length },
            },
            message: t("diag.ptpVelocityTooHigh", velocity.toString()),
            source: "krl-language-support",
          });
        }
      }
    }

    return diagnostics;
  }

  /**
   * Проверяет инициализацию TOOL/BASE перед движением.
   * Warning для PTP/LIN без предшествующей установки $TOOL/$BASE или BAS(#INITMOV)
   */
  public validateToolBaseInit(document: TextDocument): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const text = document.getText();
    const lines = text.split(/\r?\n/);

    let toolInitialized = false;
    let baseInitialized = false;

    // Паттерны инициализации
    const toolInitPattern = REGEX_TOOL_INIT;
    const baseInitPattern = REGEX_BASE_INIT;
    const movementPattern = REGEX_MOVEMENT;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Пропустить комментарии
      const commentIdx = line.indexOf(";");
      const codePart = commentIdx >= 0 ? line.substring(0, commentIdx) : line;

      // Проверить инициализацию TOOL
      if (toolInitPattern.test(codePart)) {
        toolInitialized = true;
      }
      // Проверить инициализацию BASE
      if (baseInitPattern.test(codePart)) {
        baseInitialized = true;
      }

      // Проверить команды движения
      const movementMatch = movementPattern.exec(codePart);
      if (movementMatch) {
        if (!toolInitialized) {
          diagnostics.push({
            severity: DiagnosticSeverity.Warning,
            range: {
              start: { line: i, character: movementMatch.index },
              end: {
                line: i,
                character: movementMatch.index + movementMatch[0].length,
              },
            },
            message: t("diag.toolNotInitialized"),
            source: "krl-language-support",
          });
        }
        if (!baseInitialized) {
          diagnostics.push({
            severity: DiagnosticSeverity.Warning,
            range: {
              start: { line: i, character: movementMatch.index },
              end: {
                line: i,
                character: movementMatch.index + movementMatch[0].length,
              },
            },
            message: t("diag.baseNotInitialized"),
            source: "krl-language-support",
          });
        }
      }

      // Сброс при новом DEF
      if (REGEX_DEF_RESET.test(codePart)) {
        toolInitialized = false;
        baseInitialized = false;
      }
    }

    return diagnostics;
  }

  /**
   * Проверяет баланс блоков: IF/ENDIF, FOR/ENDFOR, WHILE/ENDWHILE и т.д.
   */
  public validateBlockBalance(document: TextDocument): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const text = document.getText();
    const lines = text.split(/\r?\n/);

    // Стек для отслеживания открытых блоков
    interface BlockInfo {
      type: string;
      line: number;
      character: number;
    }

    const blockStack: BlockInfo[] = [];
    const internalKeywords = ["ELSE", "CASE", "DEFAULT"];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const commentIdx = line.indexOf(";");
      const codePart = commentIdx >= 0 ? line.substring(0, commentIdx) : line;
      // const upperCode = codePart.toUpperCase(); // Reserved for future use

      // Проверка открывающих блоков
      for (const openKeyword of Object.keys(BLOCK_PAIRS)) {
        const regex = BLOCK_OPEN_REGEXES[openKeyword];
        const match = regex.exec(codePart);
        if (match) {
          // Пропустить "WAIT FOR" — это команда ожидания условия, а не цикл FOR
          if (openKeyword === "FOR") {
            const beforeFor = codePart.substring(0, match.index);
            if (/\bWAIT\s*$/i.test(beforeFor)) {
              continue; // Это WAIT FOR, пропускаем
            }
          }
          // Пропустить DEFFCT внутри DEF (они закрываются отдельно)
          blockStack.push({
            type: openKeyword,
            line: i,
            character: match.index,
          });
        }
      }

      // Check for ELSE, CASE, DEFAULT (Context check)
      for (const kw of internalKeywords) {
        const regex = new RegExp(`\\b${kw}\\b`, "i");
        const match = regex.exec(codePart);
        if (match) {
          let expectedParent = "";
          if (kw === "ELSE") expectedParent = "IF";
          if (kw === "CASE" || kw === "DEFAULT") expectedParent = "SWITCH";

          if (
            blockStack.length === 0 ||
            blockStack[blockStack.length - 1].type !== expectedParent
          ) {
            diagnostics.push({
              severity: DiagnosticSeverity.Error,
              range: {
                start: { line: i, character: match.index },
                end: { line: i, character: match.index + kw.length },
              },
              message: t("diag.orphanBlock", kw, expectedParent),
              source: "krl-language-support",
            });
          }
        }
      }

      // Проверка закрывающих блоков
      for (const closeKeyword of Object.keys(CLOSE_TO_OPEN)) {
        const regex = BLOCK_CLOSE_REGEXES[closeKeyword];
        const match = regex.exec(codePart);
        if (match) {
          const expectedOpen = CLOSE_TO_OPEN[closeKeyword];

          // Standard Match
          if (
            blockStack.length > 0 &&
            blockStack[blockStack.length - 1].type === expectedOpen
          ) {
            blockStack.pop();
            continue;
          }

          // Recovery Logic
          let foundIndex = -1;
          for (let k = blockStack.length - 1; k >= 0; k--) {
            if (blockStack[k].type === expectedOpen) {
              foundIndex = k;
              break;
            }
          }

          if (foundIndex !== -1) {
            // Found matching open block deeper in stack.
            // All blocks above it are unclosed.
            while (blockStack.length > foundIndex + 1) {
              const missedBlock = blockStack.pop()!;
              const missedClose = BLOCK_PAIRS[missedBlock.type];
              diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: {
                  start: {
                    line: missedBlock.line,
                    character: missedBlock.character,
                  },
                  end: {
                    line: missedBlock.line,
                    character:
                      missedBlock.character + missedBlock.type.length,
                  },
                },
                message: t(
                  "diag.unmatchedBlock",
                  missedBlock.type,
                  missedClose,
                ),
                source: "krl-language-support",
              });
            }
            // Now top is matched. Pop it.
            blockStack.pop();
          } else {
            // Not found in stack - Spurious Close
            diagnostics.push({
              severity: DiagnosticSeverity.Error,
              range: {
                start: { line: i, character: match.index },
                end: {
                  line: i,
                  character: match.index + closeKeyword.length,
                },
              },
              message: t("diag.mismatchedBlock", closeKeyword, expectedOpen),
              source: "krl-language-support",
            });
          }
        }
      }
    }

    // Незакрытые блоки
    for (const block of blockStack) {
      const expectedClose = BLOCK_PAIRS[block.type];
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        range: {
          start: { line: block.line, character: block.character },
          end: {
            line: block.line,
            character: block.character + block.type.length,
          },
        },
        message: t("diag.unmatchedBlock", block.type, expectedClose),
        source: "krl-language-support",
      });
    }

    return diagnostics;
  }

  /**
   * Проверяет дублирование имён функций и переменных.
   */
  public validateDuplicateNames(document: TextDocument): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const text = document.getText();
    const lines = text.split(/\r?\n/);

    // Хранилище найденных имён: name -> {type, line}
    const foundNames = new Map<string, { type: string; line: number }>();

    // Регулярки
    const funcRegex = REGEX_FUNC_DEF;
    // const varRegex = /^\s*(?:GLOBAL\s+)?(?:DECL\s+)?(\w+)\s+(\w+)/i; // Reserved for future use

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const commentIdx = line.indexOf(";");
      const codePart = commentIdx >= 0 ? line.substring(0, commentIdx) : line;

      // Проверка функций
      const funcMatch = funcRegex.exec(codePart);
      if (funcMatch) {
        const funcName = funcMatch[2].toUpperCase();
        const existing = foundNames.get(funcName);
        if (existing) {
          diagnostics.push({
            severity: DiagnosticSeverity.Error,
            range: {
              start: { line: i, character: codePart.indexOf(funcMatch[2]) },
              end: {
                line: i,
                character: codePart.indexOf(funcMatch[2]) + funcMatch[2].length,
              },
            },
            message: t(
              "diag.duplicateName",
              "function",
              funcMatch[2],
              existing.line + 1,
            ),
            source: "krl-language-support",
          });
        } else {
          foundNames.set(funcName, { type: "function", line: i });
        }
      }
    }

    return diagnostics;
  }

  /**
   * Проверяет недостижимый код после RETURN, EXIT, GOTO.
   * Также учитывает метки (label:) как точки входа.
   */
  public validateDeadCode(document: TextDocument): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const text = document.getText();
    const lines = text.split(/\r?\n/);

    // Не включаем GOTO в exit keywords, т.к. код после GOTO может быть достижим через метки
    let skipUntilBlockEnd = false;
    let lastExitKeyword = "";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const commentIdx = line.indexOf(";");
      const codePart = commentIdx >= 0 ? line.substring(0, commentIdx) : line;
      const trimmed = codePart.trim();
      const upperTrimmed = trimmed.toUpperCase();

      // Пропускаем пустые строки и комментарии
      if (trimmed === "") continue;

      // Проверка метки (label:) - метка делает код достижимым через GOTO
      if (REGEX_LABEL.test(trimmed)) {
        skipUntilBlockEnd = false;
        continue;
      }

      // Проверка конца блока - снимаем флаг
      if (REGEX_BLOCK_END.test(upperTrimmed)) {
        skipUntilBlockEnd = false;
        continue;
      }

      // Если мы в режиме пропуска - это мёртвый код
      if (skipUntilBlockEnd) {
        diagnostics.push({
          severity: DiagnosticSeverity.Warning,
          range: {
            start: { line: i, character: 0 },
            end: { line: i, character: trimmed.length },
          },
          message: t("diag.deadCode", lastExitKeyword),
          source: "krl-language-support",
        });
        continue;
      }

      // Проверка exit-ключевых слов
      for (const { keyword, regex } of EXIT_KEYWORD_REGEXES) {
        if (regex.test(upperTrimmed)) {
          skipUntilBlockEnd = true;
          lastExitKeyword = keyword;
          break;
        }
      }
    }

    return diagnostics;
  }

  /**
   * Проверяет пустые блоки IF/FOR/WHILE.
   */
  public validateEmptyBlocks(document: TextDocument): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const text = document.getText();
    const lines = text.split(/\r?\n/);

    const blockPatterns = [
      {
        start: /^\s*IF\b.*\bTHEN\b/i,
        end: /^\s*(ELSE|ENDIF)\b/i,
        name: "IF",
        excludePattern: null as RegExp | null,
      },
      {
        start: /^\s*FOR\b/i,
        end: /^\s*ENDFOR\b/i,
        name: "FOR",
        excludePattern: /\bWAIT\s+FOR\b/i,
      },
      {
        start: /^\s*WHILE\b/i,
        end: /^\s*ENDWHILE\b/i,
        name: "WHILE",
        excludePattern: null as RegExp | null,
      },
      {
        start: /^\s*LOOP\b/i,
        end: /^\s*ENDLOOP\b/i,
        name: "LOOP",
        excludePattern: null as RegExp | null,
      },
    ];

    for (const pattern of blockPatterns) {
      let blockStartLine = -1;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const commentIdx = line.indexOf(";");
        const codePart = commentIdx >= 0 ? line.substring(0, commentIdx) : line;

        // Проверяем начало блока, но исключаем паттерны вроде WAIT FOR
        if (
          pattern.start.test(codePart) &&
          !(pattern.excludePattern && pattern.excludePattern.test(codePart))
        ) {
          blockStartLine = i;
        } else if (pattern.end.test(codePart) && blockStartLine >= 0) {
          // Проверяем есть ли код между началом и концом
          let hasCode = false;
          for (let j = blockStartLine + 1; j < i; j++) {
            const innerLine = lines[j];
            const innerComment = innerLine.indexOf(";");
            const innerCode =
              innerComment >= 0
                ? innerLine.substring(0, innerComment)
                : innerLine;
            if (innerCode.trim() !== "") {
              hasCode = true;
              break;
            }
          }

          if (!hasCode) {
            diagnostics.push({
              severity: DiagnosticSeverity.Warning,
              range: {
                start: { line: blockStartLine, character: 0 },
                end: {
                  line: blockStartLine,
                  character: lines[blockStartLine].length,
                },
              },
              message: t("diag.emptyBlock", pattern.name),
              source: "krl-language-support",
            });
          }

          blockStartLine = -1;
        }
      }
    }

    return diagnostics;
  }

  /**
   * Проверяет WAIT FOR без timeout и опасные HALT.
   */
  public validateDangerousStatements(document: TextDocument): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const text = document.getText();
    const lines = text.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const commentIdx = line.indexOf(";");
      const codePart = commentIdx >= 0 ? line.substring(0, commentIdx) : line;

      // WAIT FOR без TIMEOUT
      if (/\bWAIT\s+FOR\b/i.test(codePart) && !/\bTIMEOUT\b/i.test(codePart)) {
        const match = codePart.match(/\bWAIT\s+FOR\b/i);
        if (match) {
          diagnostics.push({
            severity: DiagnosticSeverity.Information,
            range: {
              start: { line: i, character: match.index || 0 },
              end: { line: i, character: (match.index || 0) + match[0].length },
            },
            message: t("diag.waitWithoutTimeout"),
            source: "krl-language-support",
          });
        }
      }

      // HALT
      if (/^\s*HALT\b/i.test(codePart)) {
        const match = codePart.match(/\bHALT\b/i);
        if (match) {
          diagnostics.push({
            severity: DiagnosticSeverity.Information,
            range: {
              start: { line: i, character: match.index || 0 },
              end: { line: i, character: (match.index || 0) + 4 },
            },
            message: t("diag.dangerousHalt"),
            source: "krl-language-support",
          });
        }
      }
    }

    return diagnostics;
  }

  /**
   * Проверяет использование типов: REAL в SWITCH, дробные числа в INT переменных.
   */
  public validateTypeUsage(
    document: TextDocument,
    declaredVariables: Array<{ name: string; type: string }>,
  ): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const text = document.getText();
    const lines = text.split(/\r?\n/);

    // Создаём карту переменных для быстрого поиска
    const varTypeMap = new Map<string, string>();
    for (const v of declaredVariables) {
      varTypeMap.set(v.name.toUpperCase(), v.type.toUpperCase());
    }

    // Также извлекаем локальные переменные из текущего документа
    const localDeclRegex = /^\s*(?:GLOBAL\s+)?(?:DECL\s+)?(\w+)\s+(\w+)/gim;
    let localMatch;
    while ((localMatch = localDeclRegex.exec(text)) !== null) {
      const varType = localMatch[1].toUpperCase();
      const varName = localMatch[2].toUpperCase();
      if (!varTypeMap.has(varName)) {
        varTypeMap.set(varName, varType);
      }
    }

    // Switch tracking variables - reserved for future use
    // let insideSwitch = false;
    // let switchVarName = "";
    // let switchLine = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const commentIdx = line.indexOf(";");
      const codePart = commentIdx >= 0 ? line.substring(0, commentIdx) : line;

      // Проверка SWITCH с REAL переменной
      const switchMatch = codePart.match(/\bSWITCH\s+(\w+)/i);
      if (switchMatch) {
        const varName = switchMatch[1].toUpperCase();
        const varType = varTypeMap.get(varName);

        if (varType === "REAL") {
          const matchIndex = codePart.indexOf(switchMatch[1]);
          diagnostics.push({
            severity: DiagnosticSeverity.Error,
            range: {
              start: { line: i, character: matchIndex },
              end: { line: i, character: matchIndex + switchMatch[1].length },
            },
            message: t("diag.realInSwitch"),
            source: "krl-language-support",
            code: "realInSwitch",
            data: { varName: switchMatch[1], line: i },
          });
        }
        // insideSwitch = true;
        // switchVarName = varName;
        // switchLine = i;
      }

      if (/\bENDSWITCH\b/i.test(codePart)) {
        // insideSwitch = false;
      }

      // General Assignment Type Check
      // Matches: Var = Value (ignoring ==)
      const assignRegex = /\b([a-zA-Z_]\w*)(?:\[.*?\])?\s*=(?!=)\s*([^;]+)/g;

      let assignMatch;
      while ((assignMatch = assignRegex.exec(codePart)) !== null) {
        const varName = assignMatch[1].toUpperCase();
        const expr = assignMatch[2].trim();
        const varType = varTypeMap.get(varName);

        if (!varType) continue;

        // 1. Check: INT variable assigned a REAL value
        if (varType === "INT") {
          // If value looks like a float (digits.digits)
          if (/^-?\d+\.\d+(?:[eE][+-]?\d+)?/.test(expr)) {
            diagnostics.push({
              severity: DiagnosticSeverity.Warning,
              range: {
                start: { line: i, character: assignMatch.index },
                end: {
                  line: i,
                  character: assignMatch.index + assignMatch[0].length,
                },
              },
              message: t("diag.shouldBeReal", expr, assignMatch[1]),
              source: "krl-language-support",
              code: "shouldBeReal",
              data: { varName: assignMatch[1], value: expr, line: i },
            });
            continue;
          }
          // If value is boolean
          if (/^(TRUE|FALSE)$/i.test(expr)) {
            diagnostics.push({
              severity: DiagnosticSeverity.Error,
              range: {
                start: { line: i, character: assignMatch.index },
                end: {
                  line: i,
                  character: assignMatch.index + assignMatch[0].length,
                },
              },
              message: t("diag.typeMismatch", "BOOL", "INT", assignMatch[1]),
              source: "krl-language-support",
            });
            continue;
          }
        }

        // 2. Check: BOOL variable assigned a Number or String
        if (varType === "BOOL") {
          // If number
          if (/^-?\d+/.test(expr)) {
            diagnostics.push({
              severity: DiagnosticSeverity.Error,
              range: {
                start: { line: i, character: assignMatch.index },
                end: {
                  line: i,
                  character: assignMatch.index + assignMatch[0].length,
                },
              },
              message: t("diag.typeMismatch", "NUMBER", "BOOL", assignMatch[1]),
              source: "krl-language-support",
            });
            continue;
          }
          // If string
          if (expr.startsWith('"') || expr.startsWith("'")) {
            diagnostics.push({
              severity: DiagnosticSeverity.Error,
              range: {
                start: { line: i, character: assignMatch.index },
                end: {
                  line: i,
                  character: assignMatch.index + assignMatch[0].length,
                },
              },
              message: t("diag.typeMismatch", "STRING", "BOOL", assignMatch[1]),
              source: "krl-language-support",
            });
            continue;
          }
        }

        // 3. Check: REAL variable assigned a BOOL
        if (varType === "REAL") {
          if (/^(TRUE|FALSE)$/i.test(expr)) {
            diagnostics.push({
              severity: DiagnosticSeverity.Error,
              range: {
                start: { line: i, character: assignMatch.index },
                end: {
                  line: i,
                  character: assignMatch.index + assignMatch[0].length,
                },
              },
              message: t("diag.typeMismatch", "BOOL", "REAL", assignMatch[1]),
              source: "krl-language-support",
            });
          }
        }
      }
    }

    return diagnostics;
  }

  /**
   * Проверяет строгие ограничения KRL:
   * 1. Имена переменных/сигналов <= 24 символов.
   * 2. Имена не содержат недопустимых символов (-, @, !).
   * 3. Ключи сообщений (KEY[]) <= 26 символов.
   * 4. Имя отправителя (MODUL[]) <= 24 символов.
   */
  public validateKrlConstraints(document: TextDocument): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const text = document.getText();
    const lines = text.split(/\r?\n/);

    // Regex для присваивания сообщений
    // Группа 1: Поле (KEY или MODUL)
    // Группа 2: Значение (строка)
    const msgPattern =
      /\.?(KEY|MODUL|ORIGINATOR)\[\]\s*=\s*("|')([^"']*)("|')/i;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const commentIdx = line.indexOf(";");
      const codePart = commentIdx >= 0 ? line.substring(0, commentIdx) : line;

      // 0. Check Non-ASCII (Strict Mode: Warn on any non-ASCII in code)
      const nonAsciiMatch = codePart.match(REGEX_NON_ASCII);
      if (nonAsciiMatch) {
        for (let j = 0; j < codePart.length; j++) {
          const charCode = codePart.charCodeAt(j);
          if (charCode > 127) {
            if (charCode === 0xfeff) continue;
            diagnostics.push({
              severity: DiagnosticSeverity.Error,
              tags: [DiagnosticTag.Deprecated],
              code: "nonAscii",
              range: {
                start: { line: i, character: j },
                end: { line: i, character: j + 1 },
              },
              message: t("diag.nonAsciiChar", codePart[j]),
              source: "krl-language-support",
            });
          }
        }
      }

      // 1. Проверка имен переменных (Length & Invalid Chars) - Robust
      this.checkVariableDeclaration(codePart, i, diagnostics);

      // 2. Проверка сообщений (KEY[] <= 26, MODUL[] <= 24)
      const msgMatch = msgPattern.exec(codePart);
      if (msgMatch) {
        const field = msgMatch[1].toUpperCase(); // KEY, MODUL, ORIGINATOR
        const content = msgMatch[3]; // Строка внутри кавычек
        const valueStartIndex =
          matchStartIndex(codePart, msgMatch[0]) + msgMatch[0].indexOf(content);

        // KEY[] limit: 26 chars
        if (field === "KEY" && content.length > 26) {
          diagnostics.push({
            severity: DiagnosticSeverity.Warning,
            range: {
              start: { line: i, character: valueStartIndex },
              end: { line: i, character: valueStartIndex + content.length },
            },
            message: t("diag.msgKeyTooLong", content.length), // Требует обновления i18n
            source: "krl-language-support",
          });
        }

        // MODUL[] / ORIGINATOR[] limit: 24 chars
        if (
          (field === "MODUL" || field === "ORIGINATOR") &&
          content.length > 24
        ) {
          diagnostics.push({
            severity: DiagnosticSeverity.Warning,
            range: {
              start: { line: i, character: valueStartIndex },
              end: { line: i, character: valueStartIndex + content.length },
            },
            message: t("diag.msgOriginatorTooLong", content.length), // Требует обновления i18n
            source: "krl-language-support",
          });
        }
      }
    }

    return diagnostics;
  }

  /**
   * Проверяет общую структуру синтаксиса.
   * Флагует строки, которые не соответствуют ни одному известному паттерну KRL.
   */
  public validateGeneralSyntax(document: TextDocument): Diagnostic[] {
    const text = document.getText();
    const lines = text.split(/\r?\n/);
    const diagnostics: Diagnostic[] = [];

    // Паттерны для "легальных" строк
    const REGEX_HEADER_CTRL = /^\s*&/i; // &ACCESS, &REL, &PARAM
    // Allow system variables starting with $ on LHS of assignment
    const REGEX_ASSIGNMENT = /^\s*(?:\$?[a-zA-Z0-9_]+)(?:\[[^\]]*\])?(?:\.\w+)*\s*=\s*/i;
    const REGEX_PROC_CALL = /^\s*(?:\$|\w+)\s*\(.*\)/i;
    const REGEX_WAIT = /^\s*WAIT\s+(?:FOR\s+|SEC\s+)/i;
    const REGEX_INTERRUPT = /^\s*(?:GLOBAL\s+)?INTERRUPT\s+(?:DECL|ON|OFF|ENABLE|DISABLE)/i;
    const REGEX_BRAKE = /^\s*BRAKE\b/i;
    const REGEX_RESUME = /^\s*RESUME\b/i;
    const REGEX_CONFIRM = /^\s*CONFIRM\b/i;
    const REGEX_PULSE = /^\s*PULSE\b/i;
    const REGEX_CONTINUE = /^\s*CONTINUE\b/i;
    const REGEX_EXIT_CTRL = /^\s*(?:EXIT|HALT|RETURN|GOTO)\b/i;
    const REGEX_TRIGGER = /^\s*TRIGGER\b/i;
    const REGEX_COMM = /^\s*(?:CWRITE|CREAD|SWRITE|SREAD|CAST_TO|CAST_FROM)\b/i;
    const REGEX_ANIN = /^\s*(?:ANIN|DIGIN)\b/i;
    const REGEX_ERR_HANDLE = /^\s*(?:ON_ERROR_PROCEED|ERR_CLEAR|ERR_RAISE)\b/i;
    const REGEX_IF_INLINE = /^\s*IF\s+.*THEN\s+\w+/i;
    const REGEX_FOLD_B = /^\s*;FOLD\b/i;
    const REGEX_FOLD_E = /^\s*;ENDFOLD\b/i;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Пропускаем пустые строки и комментарии
      if (!trimmed || trimmed.startsWith(";")) continue;

      const codePart = line.split(";")[0];
      const trimmedCode = codePart.trim();

      if (!trimmedCode) continue;

      // Проверка по списку известных паттернов
      const isLegal =
        REGEX_HEADER_CTRL.test(trimmedCode) ||
        REGEX_IS_DECL_LINE.test(trimmedCode) ||
        REGEX_SIGNAL.test(trimmedCode) ||
        REGEX_STRUC.test(trimmedCode) ||
        REGEX_MOVEMENT.test(trimmedCode) ||
        REGEX_DEF_RESET.test(trimmedCode) ||
        REGEX_BLOCK_END.test(trimmedCode) ||
        REGEX_FUNC_DEF.test(trimmedCode) ||
        REGEX_LABEL.test(trimmedCode) ||
        REGEX_ASSIGNMENT.test(trimmedCode) ||
        REGEX_PROC_CALL.test(trimmedCode) ||
        REGEX_WAIT.test(trimmedCode) ||
        REGEX_INTERRUPT.test(trimmedCode) ||
        REGEX_BRAKE.test(trimmedCode) ||
        REGEX_RESUME.test(trimmedCode) ||
        REGEX_CONFIRM.test(trimmedCode) ||
        REGEX_PULSE.test(trimmedCode) ||
        REGEX_CONTINUE.test(trimmedCode) ||
        REGEX_EXIT_CTRL.test(trimmedCode) ||
        REGEX_TRIGGER.test(trimmedCode) ||
        REGEX_COMM.test(trimmedCode) ||
        REGEX_ANIN.test(trimmedCode) ||
        REGEX_ERR_HANDLE.test(trimmedCode) ||
        REGEX_IF_INLINE.test(trimmedCode) ||
        REGEX_FOLD_B.test(trimmedCode) ||
        REGEX_FOLD_E.test(trimmedCode) ||
        /^\s*(?:IF|FOR|WHILE|LOOP|SWITCH|REPEAT)\b/i.test(trimmedCode) ||
        /^\s*DEFDAT\b/i.test(trimmedCode) ||
        /^\s*ANOUT\b/i.test(trimmedCode) ||
        /^\s*LIN_REL|PTP_REL/i.test(trimmedCode);

      if (!isLegal) {
        diagnostics.push({
          severity: DiagnosticSeverity.Error,
          range: {
            start: { line: i, character: line.indexOf(trimmedCode) },
            end: {
              line: i,
              character: line.indexOf(trimmedCode) + trimmedCode.length,
            },
          },
          message: t("diag.syntaxError", trimmedCode),
          source: "krl-language-support",
        });
      }
    }

    return diagnostics;
  }
}

// Вспомогательная функция для поиска индекса (если нет в классе)
function matchStartIndex(text: string, substring: string): number {
  return text.indexOf(substring);
}

/**
 * Расстояние Левенштейна для поиска похожих имен.
 */
function levenshteinDistance(s1: string, s2: string): number {
  const len1 = s1.length;
  const len2 = s2.length;
  const matrix: number[][] = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[len1][len2];
}
