/**
 * Internationalization (i18n) module for KRL Language Support extension.
 * Provides localized strings for the client-side (VS Code extension host).
 */

import * as vscode from "vscode";

// Supported locales
type Locale = "en" | "ru" | "tr";

// Message keys
interface Messages {
  // Information messages
  "info.checkingAllFiles": string;
  "info.documentFormatted": string;
  "info.trailingWhitespaceRemoved": string;
  "info.noTrailingWhitespace": string;
  "info.declarationsSorted": string;
  "info.noDeclarationsToSort": string;
  "info.noSystemVariablesFound": string;

  // Warning messages
  "warning.noActiveKrlFile": string;

  // Error messages
  "error.serverNotRunning": string;

  // Prompts
  "prompt.foldRegionName": string;
  "prompt.foldRegionPlaceholder": string;

  // Pickers
  "picker.systemVariables": string;
  "picker.selectSystemVariable": string;
}

// English (default)
const en: Messages = {
  "info.checkingAllFiles": "KRL: Checking all files...",
  "info.documentFormatted": "KRL: Document formatted.",
  "info.trailingWhitespaceRemoved":
    "KRL: Trailing whitespace removed from {0} lines.",
  "info.noTrailingWhitespace": "KRL: No trailing whitespace found.",
  "info.declarationsSorted": "KRL: {0} declarations sorted by type.",
  "info.noDeclarationsToSort": "KRL: No declarations to sort.",

  "warning.noActiveKrlFile": "No active KRL file.",

  "error.serverNotRunning": "KRL Server is not running.",

  "prompt.foldRegionName": "Enter name for FOLD region",
  "prompt.foldRegionPlaceholder": "e.g.: Initialization, Movement, Gripper",

  "info.noSystemVariablesFound": "No system variables found in workspace.",
  "picker.systemVariables": "System Variables",
  "picker.selectSystemVariable": "Select a system variable to find...",
};

// Russian
const ru: Messages = {
  "info.checkingAllFiles": "KRL: Проверка всех файлов...",
  "info.documentFormatted": "KRL: Документ отформатирован.",
  "info.trailingWhitespaceRemoved": "KRL: Удалены пробелы в конце {0} строк.",
  "info.noTrailingWhitespace": "KRL: Пробелы в конце строк не найдены.",
  "info.declarationsSorted": "KRL: {0} объявлений отсортировано по типу.",
  "info.noDeclarationsToSort": "KRL: Нет объявлений для сортировки.",

  "warning.noActiveKrlFile": "Нет активного KRL файла.",

  "error.serverNotRunning": "KRL сервер не запущен.",

  "prompt.foldRegionName": "Введите имя для FOLD-региона",
  "prompt.foldRegionPlaceholder": "например: Инициализация, Движение, Захват",

  "info.noSystemVariablesFound":
    "Системные переменные не найдены в рабочем пространстве.",
  "picker.systemVariables": "Системные переменные",
  "picker.selectSystemVariable": "Выберите системную переменную для поиска...",
};

// Turkish
const tr: Messages = {
  "info.checkingAllFiles": "KRL: Tüm dosyalar kontrol ediliyor...",
  "info.documentFormatted": "KRL: Belge biçimlendirildi.",
  "info.trailingWhitespaceRemoved":
    "KRL: {0} satırdan sondaki boşluklar kaldırıldı.",
  "info.noTrailingWhitespace": "KRL: Sondaki boşluk bulunamadı.",
  "info.declarationsSorted": "KRL: {0} bildirim türe göre sıralandı.",
  "info.noDeclarationsToSort": "KRL: Sıralanacak bildirim bulunamadı.",

  "warning.noActiveKrlFile": "Aktif bir KRL dosyası yok.",

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
 * Get current VS Code display language.
 */
function getCurrentLocale(): Locale {
  const vscodeLang = vscode.env.language;
  if (vscodeLang.startsWith("ru")) return "ru";
  if (vscodeLang.startsWith("tr")) return "tr";
  return "en";
}

/**
 * Get localized message by key.
 * Supports placeholders: {0}, {1}, etc.
 */
export function t(key: keyof Messages, ...args: (string | number)[]): string {
  const locale = getCurrentLocale();
  let message = locales[locale][key] || locales.en[key] || key;

  // Replace placeholders
  args.forEach((arg, index) => {
    message = message.replace(`{${index}}`, String(arg));
  });

  return message;
}

/**
 * Get all message keys for a specific locale.
 */
export function getMessages(locale: Locale = "en"): Messages {
  return locales[locale];
}
