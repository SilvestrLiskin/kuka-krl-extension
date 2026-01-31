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
 * Заменяет невидимые символы Unicode пробелами для сохранения длины строки и корректности индексов.
 */
function stripInvisibleChars(text: string): string {
  // Заменяем невидимые символы на пробелы той же длины (обычно 1)
  // U+200B (Zero Width Space)
  // U+200C (Zero Width Non-Joiner)
  // U+200D (Zero Width Joiner)
  // U+200E (Left-to-Right Mark)
  // U+200F (Right-to-Left Mark)
  // U+FEFF (Byte Order Mark)
  // U+00AD (Soft Hyphen)
  // U+2060 (Word Joiner)
  return text.replace(/[\u200B-\u200F\uFEFF\u00AD\u2060]/g, " ");
}

// Кэш имен функций
let functionNamesCache: Set<string> = new Set();

export class DiagnosticsProvider {
  private connection: Connection;
  private workspaceRoot: string | null = null;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  public setWorkspaceRoot(root: string | null) {
    this.workspaceRoot = root;
    functionNamesCache.clear();
  }

  public updateFunctionCache(functionNames: string[]) {
    functionNamesCache = new Set(functionNames.map((n) => n.toUpperCase()));
  }

  /**
   * Валидация .dat файлов (GLOBAL/PUBLIC, кодировка).
   */
  public async validateDatFile(
    document: TextDocument,
    validateNonAscii: boolean = true,
  ) {
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

      // Проверка ASCII
      if (validateNonAscii) {
        const nonAsciiMatch = line.match(/[^\x00-\x7F]/g);
        if (nonAsciiMatch) {
          for (let j = 0; j < line.length; j++) {
            if (line.charCodeAt(j) > 127) {
              const char = line[j];
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

      // Проверка незакрытых строк
      let inString = false;
      let quoteCount = 0;
      let effectiveLineLength = line.length;

      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          inString = !inString;
          quoteCount++;
        } else if (char === ";" && !inString) {
          effectiveLineLength = j;
          break;
        }
      }

      const codePart = line.substring(0, effectiveLineLength);

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

      // DEFDAT логика
      const defdatMatch = trimmedLine.match(/^DEFDAT\s+(\w+)(?:\s+PUBLIC)?/i);
      if (defdatMatch) {
        insideDefdat = true;
        insidePublicDefdat = /PUBLIC/i.test(trimmedLine);
        continue;
      }

      if (/^ENDDAT\b/i.test(trimmedLine)) {
        insideDefdat = false;
        insidePublicDefdat = false;
        continue;
      }

      if (insideDefdat) {
        const isDeclLine =
          /^(?:DECL\s+)?(?:GLOBAL\s+)?(?:DECL\s+)?\w+\s+\w+/i.test(
            trimmedLine,
          ) ||
          /^SIGNAL\b/i.test(trimmedLine) ||
          /^STRUC\b/i.test(trimmedLine);

        if (!isDeclLine) continue;

        const hasGlobal = /\bGLOBAL\b/i.test(trimmedLine);

        if (insidePublicDefdat) {
          if (!hasGlobal && /^(?:DECL|SIGNAL|STRUC)\b/i.test(trimmedLine)) {
            const newDiagnostic: Diagnostic = {
              severity: DiagnosticSeverity.Warning,
              range: {
                start: { line: i, character: 0 },
                end: { line: i, character: trimmedLine.length },
              },
              message: t("diag.notGlobalButPublic"),
              source: "krl-language-support",
              code: "globalPublicMismatch",
            };
            diagnostics.push(newDiagnostic);
          }
        } else {
          if (hasGlobal) {
            const newDiagnostic: Diagnostic = {
              severity: DiagnosticSeverity.Error,
              range: {
                start: { line: i, character: 0 },
                end: { line: i, character: trimmedLine.length },
              },
              message: t("diag.globalButNotPublic"),
              source: "krl-language-support",
              code: "globalPublicMismatch",
            };
            diagnostics.push(newDiagnostic);
          }
        }

        // Проверка длины имени переменной
        const declMatch = trimmedLine.match(
          /^(?:GLOBAL\s+)?(?:DECL\s+)?(?:GLOBAL\s+)?\w+\s+(\w+)/i,
        );
        if (declMatch) {
          const varName = declMatch[1];
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
   * Проверяет использование переменных (undefined check).
   */
  public validateVariablesUsage(
    document: TextDocument,
    declaredVariables: VariableInfo[],
  ): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const text = document.getText();
    const lines = text.split(/\r?\n/);
    const variableRegex = /\b([a-zA-Z_]\w*)\b/g;

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

    const validatedNames = new Set(
      declaredVariables.map((v) => v.name.toUpperCase()),
    );

    // Локальные переменные
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

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];

      if (/^\s*(?:GLOBAL\s+)?(?:DECL|STRUC|SIGNAL)\b/i.test(line)) {
        continue;
      }

      if (/^\s*(?:GLOBAL\s+)?(?:DEF|DEFFCT)\b/i.test(line)) {
        continue;
      }

      let processedLine = line.replace(/"[^"]*"/g, '""');
      processedLine = processedLine.replace(/\d+\.?\d*[eE][+-]?\d+/g, "0");
      processedLine = stripInvisibleChars(processedLine);

      let match;
      while ((match = variableRegex.exec(processedLine)) !== null) {
        const varName = match[1];

        const commentIndex = processedLine.indexOf(";");
        if (commentIndex !== -1 && match.index >= commentIndex) continue;

        const lineBeforeMatch = processedLine.substring(0, match.index);
        if (lineBeforeMatch.includes("&")) continue;

        if (
          match.index !== undefined &&
          match.index > 0 &&
          (processedLine[match.index - 1] === "$" ||
            processedLine[match.index - 1] === "#" ||
            processedLine[match.index - 1] === ".")
        )
          continue;

        if (CODE_KEYWORDS.includes(varName.toUpperCase())) continue;
        if (validatedNames.has(varName.toUpperCase())) continue;
        if (functionNamesCache.has(varName.toUpperCase())) continue;

        const newDiagnostic: Diagnostic = {
          severity: DiagnosticSeverity.Error,
          message: t("diag.variableNotDefined", varName),
          range: {
            start: { line: lineIndex, character: match.index },
            end: { line: lineIndex, character: match.index + varName.length },
          },
          source: "krl-language-support",
          code: "variableNotDefined",
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
   * Проверка безопасных скоростей ($VEL.CP, $VEL_PTP).
   */
  public validateSafetySpeeds(document: TextDocument): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const text = document.getText();
    const lines = text.split(/\r?\n/);

    const velCpRegex = /\$VEL\.CP\s*=\s*(\d+(?:\.\d+)?)/gi;
    const velPtpRegex = /\$VEL_PTP\s*=\s*(\d+(?:\.\d+)?)/gi;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const commentIdx = line.indexOf(";");
      const codePart = commentIdx >= 0 ? line.substring(0, commentIdx) : line;

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
   * Проверка инициализации $TOOL и $BASE.
   */
  public validateToolBaseInit(document: TextDocument): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const lines = document.getText().split(/\r?\n/);

    let toolInitialized = false;
    let baseInitialized = false;

    const toolInitPattern = /\$TOOL\s*=|BAS\s*\(\s*#INITMOV/i;
    const baseInitPattern = /\$BASE\s*=|BAS\s*\(\s*#INITMOV/i;
    const movementPattern = /^\s*(?:PTP|LIN|CIRC|SPTP|SLIN|SCIRC)\s+/i;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const commentIdx = line.indexOf(";");
      const codePart = commentIdx >= 0 ? line.substring(0, commentIdx) : line;

      if (toolInitPattern.test(codePart)) toolInitialized = true;
      if (baseInitPattern.test(codePart)) baseInitialized = true;

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

      if (/^\s*(?:DEF|DEFFCT)\s+/i.test(codePart)) {
        toolInitialized = false;
        baseInitialized = false;
      }
    }

    return diagnostics;
  }

  /**
   * Проверка баланса блоков (IF-ENDIF и т.д.).
   */
  public validateBlockBalance(document: TextDocument): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const lines = document.getText().split(/\r?\n/);

    interface BlockInfo {
      type: string;
      line: number;
      character: number;
    }

    const blockStack: BlockInfo[] = [];
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

    const closeToOpen: Record<string, string> = {};
    for (const [open, close] of Object.entries(blockPairs)) {
      closeToOpen[close] = open;
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const commentIdx = line.indexOf(";");
      const codePart = commentIdx >= 0 ? line.substring(0, commentIdx) : line;

      for (const openKeyword of Object.keys(blockPairs)) {
        const regex = new RegExp(`\\b${openKeyword}\\b`, "i");
        const match = regex.exec(codePart);
        if (match) {
          if (openKeyword === "FOR") {
            const beforeFor = codePart.substring(0, match.index);
            if (/\bWAIT\s*$/i.test(beforeFor)) continue;
          }
          blockStack.push({
            type: openKeyword,
            line: i,
            character: match.index,
          });
        }
      }

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
   * Проверка дубликатов имен функций.
   */
  public validateDuplicateNames(document: TextDocument): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const lines = document.getText().split(/\r?\n/);
    const foundNames = new Map<string, { type: string; line: number }>();
    const funcRegex = /^\s*(?:GLOBAL\s+)?(DEF|DEFFCT)\s+(?:\w+\s+)?(\w+)\s*\(/i;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const commentIdx = line.indexOf(";");
      const codePart = commentIdx >= 0 ? line.substring(0, commentIdx) : line;

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
   * Проверка мертвого кода (после RETURN, EXIT и т.д.).
   */
  public validateDeadCode(document: TextDocument): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const lines = document.getText().split(/\r?\n/);
    const exitKeywords = ["RETURN", "EXIT", "HALT"];
    let skipUntilBlockEnd = false;
    let lastExitKeyword = "";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const commentIdx = line.indexOf(";");
      const codePart = commentIdx >= 0 ? line.substring(0, commentIdx) : line;
      const trimmed = codePart.trim();
      const upperTrimmed = trimmed.toUpperCase();

      if (trimmed === "") continue;

      if (/^\w+\s*:\s*$/i.test(trimmed)) {
        skipUntilBlockEnd = false;
        continue;
      }

      if (
        /^(END|ENDIF|ENDFOR|ENDWHILE|ENDLOOP|ENDFCT|UNTIL|CASE|DEFAULT|ELSE)\b/i.test(
          upperTrimmed,
        )
      ) {
        skipUntilBlockEnd = false;
        continue;
      }

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
   * Проверка пустых блоков.
   */
  public validateEmptyBlocks(document: TextDocument): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const lines = document.getText().split(/\r?\n/);

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

        if (
          pattern.start.test(codePart) &&
          !(pattern.excludePattern && pattern.excludePattern.test(codePart))
        ) {
          blockStartLine = i;
        } else if (pattern.end.test(codePart) && blockStartLine >= 0) {
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
   * Проверка потенциально опасных инструкций (WAIT без таймаута, HALT).
   */
  public validateDangerousStatements(document: TextDocument): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const lines = document.getText().split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const commentIdx = line.indexOf(";");
      const codePart = commentIdx >= 0 ? line.substring(0, commentIdx) : line;

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
   * Проверка типов (REAL в SWITCH, INT/REAL присваивание).
   */
  public validateTypeUsage(
    document: TextDocument,
    declaredVariables: Array<{ name: string; type: string }>,
  ): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const text = document.getText();
    const lines = text.split(/\r?\n/);

    const varTypeMap = new Map<string, string>();
    for (const v of declaredVariables) {
      varTypeMap.set(v.name.toUpperCase(), v.type.toUpperCase());
    }

    const localDeclRegex = /^\s*(?:GLOBAL\s+)?(?:DECL\s+)?(\w+)\s+(\w+)/gim;
    let localMatch;
    while ((localMatch = localDeclRegex.exec(text)) !== null) {
      const varType = localMatch[1].toUpperCase();
      const varName = localMatch[2].toUpperCase();
      if (!varTypeMap.has(varName)) {
        varTypeMap.set(varName, varType);
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const commentIdx = line.indexOf(";");
      const codePart = commentIdx >= 0 ? line.substring(0, commentIdx) : line;

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
      }

      const assignMatch = codePart.match(/(\w+)\s*=\s*(-?\d+\.\d+)/);
      if (assignMatch) {
        const varName = assignMatch[1].toUpperCase();
        const value = assignMatch[2];
        const varType = varTypeMap.get(varName);

        if (varType === "INT") {
          const matchIndex = codePart.indexOf(assignMatch[0]);
          diagnostics.push({
            severity: DiagnosticSeverity.Warning,
            range: {
              start: { line: i, character: matchIndex },
              end: { line: i, character: matchIndex + assignMatch[0].length },
            },
            message: t("diag.shouldBeReal", value, assignMatch[1]),
            source: "krl-language-support",
            code: "shouldBeReal",
            data: { varName: assignMatch[1], value, line: i },
          });
        }
      }
    }

    return diagnostics;
  }
}
