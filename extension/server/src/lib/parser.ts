import * as fs from "fs";
import { URI } from "vscode-uri";
import { getAllSourceFiles } from "./fileSystem";
import { WordInfo, FunctionDeclaration } from "../types";

export type ParseMode = "function" | "variable" | "struc";

/**
 * Проверяет, объявлен ли символ в рабочем пространстве.
 * Выполняет поиск по всем файлам с использованием регулярных выражений.
 */
export async function isSymbolDeclared(
  workspaceRoot: string | null,
  name: string,
  mode: ParseMode,
  scopedFilePath?: string,
  lineStart?: number,
  lineEnd?: number,
  fileContentOverride?: string,
): Promise<FunctionDeclaration | undefined> {
  if (!workspaceRoot) return undefined;

  const defRegex =
    mode === "struc"
      ? new RegExp(`\\b(?:GLOBAL\\s+)?(?:STRUC)\\s+${name}\\b`, "i")
      : mode === "variable"
        ? new RegExp(
            `\\b(?:GLOBAL\\s+)?(?:DECL|SIGNAL)\\b[^\\n]*\\b${name}\\b`,
            "i",
          )
        : mode === "function"
          ? new RegExp(
              `\\b(GLOBAL\\s+)?(DEF|DEFFCT)\\s+(\\w+\\s+)?${name}\\s*\\(([^)]*)\\)`,
              "i",
            )
          : undefined;

  if (!defRegex) return undefined;

  const files = scopedFilePath
    ? [scopedFilePath]
    : await getAllSourceFiles(workspaceRoot);

  for (const filePath of files) {
    let content: string;
    try {
      content =
        fileContentOverride ?? (await fs.promises.readFile(filePath, "utf8"));
    } catch {
      continue;
    }

    const fileLines = content.split(/\r?\n/);

    const start = lineStart ?? 0;
    const end = lineEnd ?? fileLines.length;

    for (let i = start; i < end && i < fileLines.length; i++) {
      const defLine = fileLines[i];
      const match = defLine.match(defRegex);
      if (match) {
        const uri = filePath.startsWith("file://")
          ? filePath
          : URI.file(filePath).toString();
        const startChar = defLine.indexOf(name);
        const params = mode === "function" && match[4] ? match[4].trim() : "";

        return {
          uri,
          line: i,
          startChar,
          endChar: startChar + name.length,
          params,
          name,
        };
      }
    }
  }

  return undefined;
}

/**
 * Получает слово в указанной позиции в строке.
 */
export function getWordAtPosition(
  lineText: string,
  character: number,
): WordInfo | undefined {
  const wordRegex = /\b(\w+)\b/g;
  let match;

  while ((match = wordRegex.exec(lineText)) !== null) {
    const start = match.index;
    const end = start + match[1].length;
    if (character >= start && character <= end) {
      const isSubvariable = start > 0 && lineText[start - 1] === ".";
      return {
        word: match[1],
        isSubvariable,
      };
    }
  }
  return undefined;
}

// Ключевые слова KRL
export const CODE_KEYWORDS = [
  // Структурные
  "GLOBAL",
  "DEF",
  "DEFFCT",
  "END",
  "ENDFCT",
  "RETURN",
  "DEFDAT",
  "ENDDAT",
  "PUBLIC",
  "CONST",
  // Управление потоком
  "IF",
  "THEN",
  "ELSE",
  "ENDIF",
  "FOR",
  "TO",
  "STEP",
  "ENDFOR",
  "WHILE",
  "ENDWHILE",
  "LOOP",
  "ENDLOOP",
  "REPEAT",
  "UNTIL",
  "SWITCH",
  "CASE",
  "DEFAULT",
  "ENDSWITCH",
  // Логические
  "AND",
  "OR",
  "NOT",
  "EXOR",
  "TRUE",
  "FALSE",
  // Битовые
  "B_AND",
  "B_OR",
  "B_NOT",
  "B_XOR",
  "B_NAND",
  "B_NOR",
  "B_XNOR",
  // Типы данных
  "DECL",
  "INT",
  "REAL",
  "BOOL",
  "CHAR",
  "STRING",
  "FRAME",
  "POS",
  "E6POS",
  "AXIS",
  "E6AXIS",
  "LOAD",
  "STRUC",
  "ENUM",
  "SIGNAL",
  // Движение
  "PTP",
  "LIN",
  "CIRC",
  "SPTP",
  "SLIN",
  "SCIRC",
  "PTP_SPLINE",
  "LIN_SPLINE",
  "CP_SPLINE",
  "C_PTP",
  "C_LIN",
  "C_VEL",
  "C_DIS",
  // Параметры сплайна
  "SVEL",
  "SVEL_JOINT",
  "SACC",
  "SACC_JOINT",
  "STOOL",
  "STOOL2",
  "SBASE",
  "SLOAD",
  "SIPO_MODE",
  "SAPO",
  "SAPO_PTP",
  "SAPO_LIN",
  "SGEAR_JERK",
  "STIME",
  "SCIRCTYPE",
  "SORI",
  "SORI_EX",
  "SJERK",
  "USE_CM_PRO_VALUES",
  // Прерывания и управление
  "INTERRUPT",
  "TRIGGER",
  "BRAKE",
  "RESUME",
  "HALT",
  "STOP",
  "EXIT",
  "GOTO",
  "CONTINUE",
  "BREAK",
  "WAIT",
  "SEC",
  "DELAY",
  // Константы прерываний
  "IR_STOPM",
  "IR_STOPMESS",
  // Системные функции
  "BAS",
  "BAS_COMMAND",
  "EXT",
  "DMY",
  "SWRITE",
  "SREAD",
  "CWRITE",
  "CREAD",
  "CAST_TO",
  "CAST_FROM",
  "ON_ERROR_PROCEED",
  "ERR_CLEAR",
  "ERR_RAISE",
  "MBX_REC",
  "VARSTATE",
  "PULSE",
  // Сообщения
  "MsgNotify",
  "MsgQuit",
  "MsgDialog",
  "MsgConfirm",
  "SET_KRLMSG",
  "EXISTS_KRLMSG",
  "CLEAR_KRLMSG",
  // Математика
  "ABS",
  "SIN",
  "COS",
  "TAN",
  "ASIN",
  "ACOS",
  "ATAN2",
  "SQRT",
  "MAX",
  "MIN",
  // Кинематика
  "INVERSE",
  "FORWARD",
  "BASE",
  "TOOL",
  "LOAD_DATA",
  "NULLFRAME",
  // Координаты
  "X",
  "Y",
  "Z",
  "A",
  "B",
  "C",
  "S",
  "T",
  "A1",
  "A2",
  "A3",
  "A4",
  "A5",
  "A6",
  "E1",
  "E2",
  "E3",
  "E4",
  "E5",
  "E6",
  // Триггеры
  "WHEN",
  "DO",
  "DISTANCE",
  "PRIO",
  "ON",
  "WITH",
  "IN",
  "OUT",
  // Параметры движения
  "PTP_PARAMS",
  "CP_PARAMS",
  "APO",
  "VEL",
  "ACC",
  "OV_PRO",
  // Режимы
  "T1",
  "T2",
  "AUT",
  "MANUAL",
  "TCP",
  // MASREF
  "R_GAP_BETWEEN",
  "R_TABLE_LENGTH",
  "MASREFG_GROUPSEQUENCE",
  // Обнаружение столкновений
  "SET_CD_PARAMS",
  // Инициализация
  "INIT_IO",
  "INI",
  "INIT",
  // === Функции kuka_krl_wonderlibrary ===
  // Математика (mathlib)
  "IN_RANGE",
  "IN_TOLERANCE",
  // Строки (stringlib)
  "STOF",
  "STOI",
  "FTOS",
  "ITOS",
  "BTOS",
  "PTOS",
  "MID",
  // Логика (logicallib)
  "BOOL_CHOOSEI",
  "BOOL_CHOOSEF",
  "BOOL_CHOOSE_E6POS",
  "BOOL_CHOOSESTR",
  "INT_CHOOSEF",
  // Файлы (fileslib)
  "fopen",
  "fclose",
  "fclose_all",
  "fgetc",
  "fgets",
  "feof",
  "fprint",
  "fprintf",
  "fscanf_int",
  "fscanf_real",
  "LOG",
  "LOGERROR",
  "LOGDEBUG",
  "WRITE_FILE",
  "MSG",
  // Геометрия 2D (geometrylib)
  "DISTANCE_POINT_POINT",
  "LINE2D_FROM_2P",
  "LINE2D_FROM_ABC",
  "LINE2D_DIST_FROM_POINT",
  "LINE2D_Y_GIVEN_X",
  "LINE2D_X_GIVEN_Y",
  "LINE2D_INTERSECTION",
  "LINE2D_CIRC_INTERSECTION",
  "CIRC_FROM_CENTER_RADIUS",
  "CIRC_FROM_3POINTS",
  "CIRCUMFERENCE_CENTER",
  "CIRCUMFERENCE_RADIUS",
  "RADICAL_AXIS",
  // Геометрия 3D (geometrylib)
  "PLANE_FROM_3p",
  "PLANE_X_GivenYZ",
  "PLANE_Y_GivenXZ",
  "PLANE_Z_GivenXY",
  "PLANE_DIST_TO_POINT",
  "LINE3D_FROM_PLANES",
  "LINE3D_FROM_PARAMETRIC",
  "LINE3D_POINT_FROM_ORIGIN",
  "LINE3D_TO_POLAR_COORD",
  "LINE3D_yzGivenX",
  "LINE3D_xzGivenY",
  "LINE3D_xyGivenZ",
  "VECTOR3D_DIRECTOR_COSINE",
  // Геометрические структуры
  "STR_LINE2D",
  "STR_CIRCUMFERENCE2D",
  "STR_PLANE",
  "STR_VECTOR3D",
  "STR_LINE3D",
  // Константы
  "M_PI",
];
