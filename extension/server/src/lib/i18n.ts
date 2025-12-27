/**
 * Internationalization (i18n) module for KRL Language Server.
 * Provides localized strings for diagnostics, code actions, and hover info.
 */

// Supported locales
type Locale = "en" | "ru" | "tr";

// Message keys for server-side localization
interface ServerMessages {
  // Diagnostics
  "diag.notGlobalButPublic": string;
  "diag.globalButNotPublic": string;
  "diag.variableNotDefined": string;
  "diag.nonAsciiChar": string;
  "diag.unclosedString": string;
  "diag.nameTooLong": string;
  "diag.nameStartsWithDigit": string;

  // Code Actions
  "action.declareAs": string;
  "action.removeGlobal": string;
  "action.addGlobal": string;
  "action.wrapWithFold": string;

  // Hover info
  "hover.krlKeyword": string;
  "hover.systemVariable": string;
  "hover.userFunction": string;
  "hover.variable": string;
  "hover.struct": string;
  "hover.members": string;

  // Completion
  "completion.userFunction": string;
  "completion.systemVariable": string;
  "completion.variable": string;
  "completion.type": string;

  // Signature Help
  "signature.userDefined": string;
  "signature.parameter": string;

  // Code Lens
  "codeLens.metrics": string;

  // Safety Diagnostics
  "diag.velocityTooHigh": string;
  "diag.ptpVelocityTooHigh": string;
  "diag.toolNotInitialized": string;
  "diag.baseNotInitialized": string;

  // Extended Diagnostics
  "diag.unmatchedBlock": string;
  "diag.duplicateName": string;
  "diag.deadCode": string;
  "diag.emptyBlock": string;
  "diag.waitWithoutTimeout": string;
  "diag.dangerousHalt": string;

  // Type Diagnostics
  "diag.realInSwitch": string;
  "diag.typeMismatch": string;
  "diag.shouldBeReal": string;
  "action.changeToInt": string;
  "action.changeToReal": string;
  "action.wrapWithRound": string;
}

// English (default)
const en: ServerMessages = {
  "diag.notGlobalButPublic": "Declaration is not GLOBAL but DEFDAT is PUBLIC.",
  "diag.globalButNotPublic": "Declaration is GLOBAL but DEFDAT is not PUBLIC.",
  "diag.variableNotDefined": 'Variable "{0}" is not defined.',
  "diag.nonAsciiChar":
    'Non-ASCII character "{0}" may cause errors in KUKA controller.',
  "diag.unclosedString": "Unclosed string literal.",
  "diag.nameTooLong":
    'Name "{0}" exceeds KUKA 24-character limit ({1} characters).',
  "diag.nameStartsWithDigit": 'Name "{0}" cannot start with a digit.',

  "action.declareAs": "Declare '{0}' as {1}",
  "action.removeGlobal": "Remove 'GLOBAL' keyword",
  "action.addGlobal": "Add 'GLOBAL' keyword",
  "action.wrapWithFold": "Wrap with ;FOLD ... ;ENDFOLD",

  "hover.krlKeyword": "— KRL keyword",
  "hover.systemVariable": "— System variable (KSS 8.7)",
  "hover.userFunction": "*User-defined function*",
  "hover.variable": "*Variable*",
  "hover.struct": "STRUC",
  "hover.members": "Members",

  "completion.userFunction": "User-defined function",
  "completion.systemVariable": "System variable (KSS 8.7)",
  "completion.variable": "Variable",
  "completion.type": "Type: {0}",

  "signature.userDefined": "User-defined {0}",
  "signature.parameter": "Parameter: {0}",

  "codeLens.metrics": "▸ {0} lines | {1} references",

  "diag.velocityTooHigh":
    "Velocity {0} m/s exceeds maximum KUKA limit (3 m/s).",
  "diag.ptpVelocityTooHigh":
    "PTP velocity {0}% exceeds maximum allowed (100%).",
  "diag.toolNotInitialized":
    "Movement without $TOOL initialization. Use BAS(#INITMOV) or set $TOOL first.",
  "diag.baseNotInitialized":
    "Movement without $BASE initialization. Use BAS(#INITMOV) or set $BASE first.",

  "diag.unmatchedBlock": 'Unmatched "{0}" — missing "{1}".',
  "diag.duplicateName": 'Duplicate {0} name "{1}" (first defined at line {2}).',
  "diag.deadCode": 'Unreachable code after "{0}".',
  "diag.emptyBlock": 'Empty "{0}" block.',
  "diag.waitWithoutTimeout":
    "WAIT FOR without timeout may cause indefinite wait.",
  "diag.dangerousHalt": "HALT stops program execution. Use with caution.",

  "diag.realInSwitch":
    "REAL type cannot be used in SWITCH/CASE. Use INT or ENUM.",
  "diag.typeMismatch": 'Type mismatch: assigning {0} to {1} variable "{2}".',
  "diag.shouldBeReal":
    'Value {0} contains decimal. Variable "{1}" should be REAL, not INT.',
  "action.changeToInt": "Change type to INT",
  "action.changeToReal": "Change type to REAL",
  "action.wrapWithRound": "Wrap with ROUND() for INT conversion",
};

// Russian
const ru: ServerMessages = {
  "diag.notGlobalButPublic": "Объявление не GLOBAL, но DEFDAT является PUBLIC.",
  "diag.globalButNotPublic": "Объявление GLOBAL, но DEFDAT не является PUBLIC.",
  "diag.variableNotDefined": 'Переменная "{0}" не определена.',
  "diag.nonAsciiChar":
    'Не-ASCII символ "{0}" может вызвать ошибки в контроллере KUKA.',
  "diag.unclosedString": "Незакрытая строка.",
  "diag.nameTooLong":
    'Имя "{0}" превышает лимит KUKA в 24 символа ({1} символов).',
  "diag.nameStartsWithDigit": 'Имя "{0}" не может начинаться с цифры.',

  "action.declareAs": "Объявить '{0}' как {1}",
  "action.removeGlobal": "Удалить ключевое слово 'GLOBAL'",
  "action.addGlobal": "Добавить ключевое слово 'GLOBAL'",
  "action.wrapWithFold": "Обернуть в ;FOLD ... ;ENDFOLD",

  "hover.krlKeyword": "— Ключевое слово KRL",
  "hover.systemVariable": "— Системная переменная (KSS 8.7)",
  "hover.userFunction": "*Пользовательская функция*",
  "hover.variable": "*Переменная*",
  "hover.struct": "Структура",
  "hover.members": "Поля",

  "completion.userFunction": "Пользовательская функция",
  "completion.systemVariable": "Системная переменная (KSS 8.7)",
  "completion.variable": "Переменная",
  "completion.type": "Тип: {0}",

  "signature.userDefined": "Пользовательский {0}",
  "signature.parameter": "Параметр: {0}",

  "codeLens.metrics": "▸ {0} строк | {1} ссылок",

  "diag.velocityTooHigh": "Скорость {0} м/с превышает максимум KUKA (3 м/с).",
  "diag.ptpVelocityTooHigh": "Скорость PTP {0}% превышает максимум (100%).",
  "diag.toolNotInitialized":
    "Движение без инициализации $TOOL. Используйте BAS(#INITMOV) или установите $TOOL.",
  "diag.baseNotInitialized":
    "Движение без инициализации $BASE. Используйте BAS(#INITMOV) или установите $BASE.",

  "diag.unmatchedBlock": 'Незакрытый блок "{0}" — отсутствует "{1}".',
  "diag.duplicateName":
    'Дублирование {0} "{1}" (впервые определено в строке {2}).',
  "diag.deadCode": 'Недостижимый код после "{0}".',
  "diag.emptyBlock": 'Пустой блок "{0}".',
  "diag.waitWithoutTimeout":
    "WAIT FOR без таймаута может вызвать бесконечное ожидание.",
  "diag.dangerousHalt":
    "HALT останавливает выполнение программы. Используйте осторожно.",

  "diag.realInSwitch":
    "Тип REAL нельзя использовать в SWITCH/CASE. Используйте INT или ENUM.",
  "diag.typeMismatch":
    'Несовпадение типов: присваивание {0} переменной {1} "{2}".',
  "diag.shouldBeReal":
    'Значение {0} содержит десятичную часть. Переменная "{1}" должна быть REAL, а не INT.',
  "action.changeToInt": "Изменить тип на INT",
  "action.changeToReal": "Изменить тип на REAL",
  "action.wrapWithRound": "Обернуть в ROUND() для преобразования в INT",
};

// Turkish
const tr: ServerMessages = {
  "diag.notGlobalButPublic": "Bildirim GLOBAL değil ama DEFDAT PUBLIC.",
  "diag.globalButNotPublic": "Bildirim GLOBAL ama DEFDAT PUBLIC değil.",
  "diag.variableNotDefined": '"{0}" değişkeni tanımlı değil.',
  "diag.nonAsciiChar":
    'ASCII olmayan karakter "{0}" KUKA kontrolcüsünde hata oluşturabilir.',
  "diag.unclosedString": "Kapatılmamış string.",
  "diag.nameTooLong":
    '"{0}" adı KUKA 24 karakter sınırını aşıyor ({1} karakter).',
  "diag.nameStartsWithDigit": '"{0}" adı rakamla başlayamaz.',

  "action.declareAs": "'{0}' değişkenini {1} olarak tanımla",
  "action.removeGlobal": "'GLOBAL' anahtar kelimesini kaldır",
  "action.addGlobal": "'GLOBAL' anahtar kelimesini ekle",
  "action.wrapWithFold": ";FOLD ... ;ENDFOLD ile sar",

  "hover.krlKeyword": "— KRL anahtar kelimesi",
  "hover.systemVariable": "— Sistem değişkeni (KSS 8.7)",
  "hover.userFunction": "*Kullanıcı tanımlı fonksiyon*",
  "hover.variable": "*Değişken*",
  "hover.struct": "Yapı",
  "hover.members": "Üyeler",

  "completion.userFunction": "Kullanıcı tanımlı fonksiyon",
  "completion.systemVariable": "Sistem değişkeni (KSS 8.7)",
  "completion.variable": "Değişken",
  "completion.type": "Tip: {0}",

  "signature.userDefined": "Kullanıcı tanımlı {0}",
  "signature.parameter": "Parametre: {0}",

  "codeLens.metrics": "▸ {0} satır | {1} referans",

  "diag.velocityTooHigh": "{0} m/s hız KUKA maksimum sınırını aşıyor (3 m/s).",
  "diag.ptpVelocityTooHigh": "PTP hızı %{0} maksimumu aşıyor (%100).",
  "diag.toolNotInitialized":
    "$TOOL başlatılmadan hareket. BAS(#INITMOV) kullanın veya önce $TOOL ayarlayın.",
  "diag.baseNotInitialized":
    "$BASE başlatılmadan hareket. BAS(#INITMOV) kullanın veya önce $BASE ayarlayın.",

  "diag.unmatchedBlock": 'Eşleşmeyen "{0}" — "{1}" eksik.',
  "diag.duplicateName": 'Yinelenen {0} adı "{1}" (ilk tanım satır {2}).',
  "diag.deadCode": '"{0}" sonrası erişilemeyen kod.',
  "diag.emptyBlock": 'Boş "{0}" bloğu.',
  "diag.waitWithoutTimeout":
    "Zaman aşımı olmadan WAIT FOR sonsuz beklemeye neden olabilir.",
  "diag.dangerousHalt": "HALT program yürütmesini durdurur. Dikkatli kullanın.",

  "diag.realInSwitch":
    "REAL tipi SWITCH/CASE içinde kullanılamaz. INT veya ENUM kullanın.",
  "diag.typeMismatch":
    'Tip uyuşmazlığı: {0} değeri {1} tipindeki "{2}" değişkenine atanıyor.',
  "diag.shouldBeReal":
    '{0} değeri ondalık içeriyor. "{1}" değişkeni INT değil REAL olmalı.',
  "action.changeToInt": "Tipi INT olarak değiştir",
  "action.changeToReal": "Tipi REAL olarak değiştir",
  "action.wrapWithRound": "INT dönüşümü için ROUND() ile sar",
};

const locales: Record<Locale, ServerMessages> = { en, ru, tr };

// Current locale - will be set from client
let currentLocale: Locale = "en";

/**
 * Set current locale for server-side messages.
 * Called when client connects and sends its locale.
 */
export function setLocale(locale: string): void {
  if (locale.startsWith("ru")) {
    currentLocale = "ru";
  } else if (locale.startsWith("tr")) {
    currentLocale = "tr";
  } else {
    currentLocale = "en";
  }
}

/**
 * Get current locale.
 */
export function getLocale(): Locale {
  return currentLocale;
}

/**
 * Get localized message by key.
 * Supports placeholders: {0}, {1}, etc.
 */
export function t(
  key: keyof ServerMessages,
  ...args: (string | number)[]
): string {
  let message = locales[currentLocale][key] || locales.en[key] || key;

  // Replace placeholders
  args.forEach((arg, index) => {
    message = message.replace(`{${index}}`, String(arg));
  });

  return message;
}

/**
 * Check if a diagnostic message matches a pattern (for code actions).
 * Uses locale-independent pattern matching.
 */
export function matchesDiagnosticPattern(
  message: string,
  pattern: "variableNotDefined" | "globalPublicMismatch",
): boolean {
  switch (pattern) {
    case "variableNotDefined":
      // Check all locales for "variable not defined" pattern
      return (
        message.includes("is not defined") ||
        message.includes("не определена") ||
        message.includes("tanımlı değil")
      );
    case "globalPublicMismatch":
      return (
        (message.includes("GLOBAL") && message.includes("PUBLIC")) ||
        (message.includes("GLOBAL") && message.includes("PUBLIC"))
      );
    default:
      return false;
  }
}

/**
 * Extract variable name from diagnostic message (works across locales).
 */
export function extractVariableFromMessage(message: string): string | null {
  const match = message.match(/"(\w+)"/);
  return match ? match[1] : null;
}
