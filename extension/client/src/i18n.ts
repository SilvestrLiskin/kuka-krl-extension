/**
 * Модуль интернационализации (i18n) для расширения KRL Language Support.
 * Предоставляет локализованные строки для клиентской части (расширения VS Code).
 */

import * as vscode from "vscode";

// Поддерживаемые локали
type Locale = "en" | "ru" | "tr";

// Ключи сообщений
interface Messages {
  // Информационные сообщения
  "info.checkingAllFiles": string;
  "info.documentFormatted": string;
  "info.trailingWhitespaceRemoved": string;
  "info.noTrailingWhitespace": string;
  "info.declarationsSorted": string;
  "info.noDeclarationsToSort": string;
  "info.noSystemVariablesFound": string;

  // Предупреждения
  "warning.noActiveKrlFile": string;
  "warning.invalidGlobalUsage": string;

  // Ошибки
  "error.serverNotRunning": string;

  // Приглашения ввода (prompts)
  "prompt.foldRegionName": string;
  "prompt.foldRegionPlaceholder": string;

  // Выбор (pickers)
  "picker.systemVariables": string;
  "picker.selectSystemVariable": string;
}

// Английский (по умолчанию)
const en: Messages = {
  "info.checkingAllFiles": "KRL: Checking all files...",
  "info.documentFormatted": "KRL: Document formatted.",
  "info.trailingWhitespaceRemoved":
    "KRL: Trailing whitespace removed from {0} lines.",
  "info.noTrailingWhitespace": "KRL: No trailing whitespace found.",
  "info.declarationsSorted": "KRL: {0} declarations sorted by type.",
  "info.noDeclarationsToSort": "KRL: No declarations to sort.",

  "warning.noActiveKrlFile": "No active KRL file.",
  "warning.invalidGlobalUsage": "Invalid 'GLOBAL' modifier usage.",

  "error.serverNotRunning": "KRL Server is not running.",

  "prompt.foldRegionName": "Enter name for FOLD region",
  "prompt.foldRegionPlaceholder": "e.g.: Initialization, Movement, Gripper",

  "info.noSystemVariablesFound": "No system variables found in workspace.",
  "picker.systemVariables": "System Variables",
  "picker.selectSystemVariable": "Select a system variable to find...",
};

// Русский
const ru: Messages = {
  "info.checkingAllFiles": "KRL: Проверка всех файлов...",
  "info.documentFormatted": "KRL: Документ отформатирован.",
  "info.trailingWhitespaceRemoved": "KRL: Удалены пробелы в конце {0} строк.",
  "info.noTrailingWhitespace": "KRL: Пробелы в конце строк не найдены.",
  "info.declarationsSorted": "KRL: {0} объявлений отсортировано по типу.",
  "info.noDeclarationsToSort": "KRL: Нет объявлений для сортировки.",

  "warning.noActiveKrlFile": "Нет активного KRL файла.",
  "warning.invalidGlobalUsage": "Неверное использование модификатора 'GLOBAL'.",

  "error.serverNotRunning": "KRL сервер не запущен.",

  "prompt.foldRegionName": "Введите имя для FOLD-региона",
  "prompt.foldRegionPlaceholder": "например: Инициализация, Движение, Захват",

  "info.noSystemVariablesFound":
    "Системные переменные не найдены в рабочем пространстве.",
  "picker.systemVariables": "Системные переменные",
  "picker.selectSystemVariable": "Выберите системную переменную для поиска...",
};

// Турецкий
const tr: Messages = {
  "info.checkingAllFiles": "KRL: Tüm dosyalar kontrol ediliyor...",
  "info.documentFormatted": "KRL: Belge biçimlendirildi.",
  "info.trailingWhitespaceRemoved":
    "KRL: {0} satırdan sondaki boşluklar kaldırıldı.",
  "info.noTrailingWhitespace": "KRL: Sondaki boşluk bulunamadı.",
  "info.declarationsSorted": "KRL: {0} bildirim türe göre sıralandı.",
  "info.noDeclarationsToSort": "KRL: Sıralanacak bildirim bulunamadı.",

  "warning.noActiveKrlFile": "Aktif bir KRL dosyası yok.",
  "warning.invalidGlobalUsage": "Geçersiz 'GLOBAL' değiştirici kullanımı.",

  "error.serverNotRunning": "KRL Sunucusu çalışmıyor.",

  "prompt.foldRegionName": "FOLD bölgesi için isim girin",
  "prompt.foldRegionPlaceholder": "örn: Başlatma, Hareket, Gripper",

  "info.noSystemVariablesFound":
    "Çalışma alanında sistem değişkeni bulunamadı.",
  "picker.systemVariables": "Sistem Değişkenleri",
  "picker.selectSystemVariable": "Aramak için bir sistem değişkeni seçin...",
};

const locales: Record<Locale, Messages> = { en, ru, tr };

/**
 * Получает текущий язык интерфейса VS Code.
 */
function getCurrentLocale(): Locale {
  const vscodeLang = vscode.env.language;
  if (vscodeLang.startsWith("ru")) return "ru";
  if (vscodeLang.startsWith("tr")) return "tr";
  return "en";
}

/**
 * Получает локализованное сообщение по ключу.
 * Поддерживает заполнители: {0}, {1} и т.д.
 */
export function t(key: keyof Messages, ...args: (string | number)[]): string {
  const locale = getCurrentLocale();
  let message = locales[locale][key] || locales.en[key] || key;

  // Замена заполнителей
  args.forEach((arg, index) => {
    message = message.replace(`{${index}}`, String(arg));
  });

  return message;
}

/**
 * Получает все ключи сообщений для указанной локали.
 */
export function getMessages(locale: Locale = "en"): Messages {
  return locales[locale];
}
