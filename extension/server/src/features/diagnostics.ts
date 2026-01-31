import { TextDocument } from "vscode-languageserver-textdocument";
import {
  Connection,
  Diagnostic,
  DiagnosticSeverity,
} from "vscode-languageserver/node";
import { CODE_KEYWORDS } from "../lib/parser";
import { VariableInfo } from "../types";
import { t } from "../lib/i18n";

/**
 * Görünmez Unicode karakterlerini kaldırır.
 * Bu karakterler bazen web sayfalarından veya belgelerden kopyalama sırasında eklenir
 * ve kelimeleri parçaladıkları için hatalara neden olabilir (örn: "WAIT" -> "W", "it").
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
  return text.replace(/[\u200B-\u200F\uFEFF\u00AD\u2060]/g, "");
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
   * .dat dosyasını doğrular - GLOBAL/PUBLIC tutarlılığını kontrol eder.
   * Ayrıca ASCII olmayan karakterleri ve kapatılmamış stringleri kontrol eder.
   */
  public async validateDatFile(
    document: TextDocument,
    validateNonAscii: boolean = true,
  ) {
    // SİSTEM DOSYALARINI ATLA (büyük/küçük harf duyarsız)
    const lowerUri = document.uri.toLowerCase().replace(/\\/g, "/");
    if (
      lowerUri.includes("/mada/") ||
      lowerUri.includes("/system/") ||
      lowerUri.includes("/tp/")
    ) {
      this.connection.sendDiagnostics({ uri: document.uri, diagnostics: [] });
      return;
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

        const nonAsciiMatch = checkPart.match(/[^\x00-\x7F]/g);
        if (nonAsciiMatch) {
          // Her bir non-ASCII karakteri bul ve işaretle
          for (let j = 0; j < checkPart.length; j++) {
            const charCode = checkPart.charCodeAt(j);
            if (charCode > 127) {
              // BOM (Byte Order Mark) karakterini yoksay (U+FEFF = 65279)
              if (charCode === 0xfeff) continue;

              const char = checkPart[j];
              diagnostics.push({
                severity: DiagnosticSeverity.Warning,
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
      const defdatMatch = trimmedLine.match(/^DEFDAT\s+(\w+)(?:\s+PUBLIC)?/i);
      if (defdatMatch) {
        insideDefdat = true;
        insidePublicDefdat = /PUBLIC/i.test(trimmedLine);
        continue;
      }

      // DEFDAT sonunu algıla
      if (/^ENDDAT\b/i.test(trimmedLine)) {
        insideDefdat = false;
        insidePublicDefdat = false;
        continue;
      }

      if (insideDefdat) {
        // Bildirim satırı mı kontrol et
        const isDeclLine =
          /^(?:DECL\s+)?(?:GLOBAL\s+)?(?:DECL\s+)?\w+\s+\w+/i.test(
            trimmedLine,
          ) ||
          /^SIGNAL\b/i.test(trimmedLine) ||
          /^STRUC\b/i.test(trimmedLine);

        if (!isDeclLine) continue;

        // GLOBAL anahtar kelimesi var mı?
        const hasGlobal = /\bGLOBAL\b/i.test(trimmedLine);

        if (insidePublicDefdat) {
          // PUBLIC DEFDAT içinde GLOBAL olmalı
          if (!hasGlobal && /^(?:DECL|SIGNAL|STRUC)\b/i.test(trimmedLine)) {
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

        // KUKA 24-karakter değişken isim limitini kontrol et
        const declMatch = trimmedLine.match(
          /^(?:GLOBAL\s+)?(?:DECL\s+)?(?:GLOBAL\s+)?\w+\s+(\w+)/i,
        );
        if (declMatch) {
          const varName = declMatch[1];
          // 24-karakter limiti
          if (varName.length > 24) {
            diagnostics.push({
              severity: DiagnosticSeverity.Error,
              range: {
                start: { line: i, character: trimmedLine.indexOf(varName) },
                end: {
                  line: i,
                  character: trimmedLine.indexOf(varName) + varName.length,
                },
              },
              message: t("diag.nameTooLong", varName, varName.length),
              source: "krl-language-support",
            });
          }
          // Rakamla başlayan isimler
          if (/^\d/.test(varName)) {
            diagnostics.push({
              severity: DiagnosticSeverity.Error,
              range: {
                start: { line: i, character: trimmedLine.indexOf(varName) },
                end: {
                  line: i,
                  character: trimmedLine.indexOf(varName) + varName.length,
                },
              },
              message: t("diag.nameStartsWithDigit", varName),
              source: "krl-language-support",
            });
          }
        }
      }
    }
    this.connection.sendDiagnostics({ uri: document.uri, diagnostics });
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
    const variableRegex = /\b([a-zA-Z_]\w*)\b/g;

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
    const localDeclRegex =
      /^\s*(?:GLOBAL\s+)?(?:DECL\s+)?\w+\s+([a-zA-Z_]\w*(?:\s*\[[^\]]*\])?(?:\s*,\s*[a-zA-Z_]\w*(?:\s*\[[^\]]*\])?)*)/gim;
    let localMatch;
    while ((localMatch = localDeclRegex.exec(text)) !== null) {
      const varList = localMatch[1];
      const vars = varList
        .split(",")
        .map((v) => v.replace(/\[.*?\]/g, "").trim());
      for (const v of vars) {
        if (/^[a-zA-Z_]\w*$/.test(v)) {
          validatedNames.add(v.toUpperCase());
        }
      }
    }

    // ETIKETLERI BUL (Labels) - GOTO hedefleri için
    // Örn: "MyLabel:" veya " MyLabel :"
    const labelRegex = /^\s*([a-zA-Z_]\w*)\s*:/gim;
    let labelMatch;
    while ((labelMatch = labelRegex.exec(text)) !== null) {
      validatedNames.add(labelMatch[1].toUpperCase());
    }

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];

      // Bildirim veya struct veya sinyal satırlarını atla
      if (/^\s*(?:GLOBAL\s+)?(?:DECL|STRUC|SIGNAL)\b/i.test(line)) {
        continue;
      }

      // DEF/DEFFCT satırlarını atla
      if (/^\s*(?:GLOBAL\s+)?(?:DEF|DEFFCT)\b/i.test(line)) {
        continue;
      }

      // Tırnak içindeki stringleri gizle
      let processedLine = line.replace(/"[^"]*"/g, '""');
      // Bilimsel gösterimi gizle (örn: 1.0E+02)
      processedLine = processedLine.replace(/\d+\.?\d*[eE][+-]?\d+/g, "0");
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
        const newDiagnostic: Diagnostic = {
          severity: DiagnosticSeverity.Error,
          message: t("diag.variableNotDefined", varName),
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

    // Regex для $VEL.CP = значение
    const velCpRegex = /\$VEL\.CP\s*=\s*(\d+(?:\.\d+)?)/gi;
    // Regex для $VEL_PTP = значение
    const velPtpRegex = /\$VEL_PTP\s*=\s*(\d+(?:\.\d+)?)/gi;

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
    const toolInitPattern = /\$TOOL\s*=|BAS\s*\(\s*#INITMOV/i;
    const baseInitPattern = /\$BASE\s*=|BAS\s*\(\s*#INITMOV/i;
    // Паттерны движения
    const movementPattern = /^\s*(?:PTP|LIN|CIRC|SPTP|SLIN|SCIRC)\s+/i;

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
      if (/^\s*(?:DEF|DEFFCT)\s+/i.test(codePart)) {
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

    // Маппинг открывающих на закрывающие
    const blockPairs: Record<string, string> = {
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

    // Обратный маппинг
    const closeToOpen: Record<string, string> = {};
    for (const [open, close] of Object.entries(blockPairs)) {
      closeToOpen[close] = open;
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const commentIdx = line.indexOf(";");
      const codePart = commentIdx >= 0 ? line.substring(0, commentIdx) : line;
      // const upperCode = codePart.toUpperCase(); // Reserved for future use

      // Проверка открывающих блоков
      for (const openKeyword of Object.keys(blockPairs)) {
        const regex = new RegExp(`\\b${openKeyword}\\b`, "i");
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

      // Проверка закрывающих блоков
      for (const closeKeyword of Object.keys(closeToOpen)) {
        const regex = new RegExp(`\\b${closeKeyword}\\b`, "i");
        const match = regex.exec(codePart);
        if (match) {
          const expectedOpen = closeToOpen[closeKeyword];
          if (blockStack.length === 0) {
            diagnostics.push({
              severity: DiagnosticSeverity.Error,
              range: {
                start: { line: i, character: match.index },
                end: { line: i, character: match.index + closeKeyword.length },
              },
              message: t("diag.unmatchedBlock", closeKeyword, expectedOpen),
              source: "krl-language-support",
            });
          } else {
            const lastBlock = blockStack[blockStack.length - 1];
            if (lastBlock.type === expectedOpen) {
              blockStack.pop();
            }
          }
        }
      }
    }

    // Незакрытые блоки
    for (const block of blockStack) {
      const expectedClose = blockPairs[block.type];
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
    const funcRegex = /^\s*(?:GLOBAL\s+)?(DEF|DEFFCT)\s+(?:\w+\s+)?(\w+)\s*\(/i;
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
    const exitKeywords = ["RETURN", "EXIT", "HALT"];
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
      if (/^\w+\s*:\s*$/i.test(trimmed)) {
        skipUntilBlockEnd = false;
        continue;
      }

      // Проверка конца блока - снимаем флаг
      if (
        /^(END|ENDIF|ENDFOR|ENDWHILE|ENDLOOP|ENDFCT|UNTIL|CASE|DEFAULT|ELSE)\b/i.test(
          upperTrimmed,
        )
      ) {
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
      for (const kw of exitKeywords) {
        if (new RegExp(`^${kw}\\b`, "i").test(upperTrimmed)) {
          skipUntilBlockEnd = true;
          lastExitKeyword = kw;
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

    // Regex для деклараций: DECL TYPE NAME или SIGNAL NAME
    // Группа 1: Имя переменной
    const declPattern =
      /^\s*(?:GLOBAL\s+)?(?:DECL\s+\w+|SIGNAL)\s+([a-zA-Z0-9_$@!-]+)/i;

    // Regex для присваивания сообщений
    // Группа 1: Поле (KEY или MODUL)
    // Группа 2: Значение (строка)
    const msgPattern =
      /\.?(KEY|MODUL|ORIGINATOR)\[\]\s*=\s*("|')([^"']*)("|')/i;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const commentIdx = line.indexOf(";");
      const codePart = commentIdx >= 0 ? line.substring(0, commentIdx) : line;

      // 1. Проверка имен переменных (Length & Invalid Chars)
      const declMatch = declPattern.exec(codePart);
      if (declMatch) {
        const varName = declMatch[1];
        const matchIndex = codePart.indexOf(varName);

        // Проверка длины (24 символа)
        if (varName.length > 24) {
          diagnostics.push({
            severity: DiagnosticSeverity.Error,
            range: {
              start: { line: i, character: matchIndex },
              end: { line: i, character: matchIndex + varName.length },
            },
            message: t("diag.nameTooLong", varName, varName.length),
            source: "krl-language-support",
          });
        }

        // Проверка недопустимых символов (-, @, !)
        // KRL разрешает только A-Z, 0-9, _, $
        const invalidCharMatch = varName.match(/[^a-zA-Z0-9_$]/);
        if (invalidCharMatch) {
          diagnostics.push({
            severity: DiagnosticSeverity.Error,
            range: {
              start: { line: i, character: matchIndex },
              end: { line: i, character: matchIndex + varName.length },
            },
            message: t("diag.invalidCharInName", invalidCharMatch[0]),
            source: "krl-language-support",
          });
        }
      }

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
}

// Вспомогательная функция для поиска индекса (если нет в классе)
function matchStartIndex(text: string, substring: string): number {
  return text.indexOf(substring);
}
