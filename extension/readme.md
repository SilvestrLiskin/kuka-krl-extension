# KUKA KRL Extension

<p align="center">
  <img src="./logo.png" alt="KUKA KRL Extension Logo" width="300">
</p>

<p align="center">
  <strong>Professional language support for KUKA Robot Language (KRL) in Visual Studio Code</strong>
</p>

<p align="center">
  <a href="#english">English</a> •
  <a href="#русский">Русский</a> •
  <a href="#türkçe">Türkçe</a>
</p>

---

## English

### Overview

**KUKA KRL Extension** provides comprehensive language support for KUKA Robot Language (KRL) files (`.src`, `.dat`, `.sub`) in Visual Studio Code. Designed by robot programmers for robot programmers.

### Features

#### 🎨 Syntax Highlighting

Full syntax highlighting for all KRL constructs including keywords, data types, system variables, and comments.

```krl
DEF MyProgram()
  DECL INT counter
  DECL E6POS targetPos
  
  ;FOLD Initialization
  counter = 0
  targetPos = {X 100, Y 200, Z 300, A 0, B 90, C 0}
  ;ENDFOLD
  
  FOR counter = 1 TO 10
    PTP targetPos
  ENDFOR
END
```

#### 📦 Code Folding

Native support for `;FOLD ... ;ENDFOLD` regions with automatic folding on file open.

- **Fold All** — collapse all regions
- **Unfold All** — expand all regions  
- **Insert FOLD Region** — quickly wrap selected code

#### ✅ Real-time Diagnostics

Instant error detection while you type:

- **Undefined variables** — highlights undeclared identifiers
- **GLOBAL/PUBLIC consistency** — verifies DEFDAT declarations match
- **Unmatched blocks** — IF without ENDIF, FOR without ENDFOR
- **Dead code** — unreachable code after RETURN/EXIT/GOTO
- **Type errors** — REAL in SWITCH/CASE, decimal in INT variable
- **Safety checks** — $VEL.CP > 3m/s, $TOOL/$BASE not initialized

#### 🔧 Quick Fixes

One-click solutions for common issues:

- Declare undefined variable as INT, REAL, or BOOL
- Add or remove GLOBAL keyword
- Change variable type (INT ↔ REAL)
- Wrap value with ROUND() for INT conversion
- Wrap code with ;FOLD region

#### 💡 IntelliSense

Smart code completion for:

- All KRL keywords and data types
- User-defined functions and variables
- KSS 8.7 system variables ($AXIS_ACT, $POS_ACT, etc.)
- Struct member access

#### 📍 Navigation

| Feature | Shortcut | Description |
|---------|----------|-------------|
| Go to Definition | `F12` | Jump to function/variable declaration |
| Find All References | `Shift+F12` | Locate all usages |
| Document Symbols | `Ctrl+Shift+O` | Outline view of current file |
| Workspace Symbols | `Ctrl+T` | Search across all project files |

#### ✏️ Refactoring

- **Rename Symbol** (`F2`) — rename across all files
- **Format Document** — standardize indentation
- **Remove Trailing Whitespace** — clean up code
- **Sort Declarations** — organize by type (INT, REAL, BOOL, FRAME, etc.)

#### 🎨 WorkVisual Theme

5 included color themes:

- **KUKA WorkVisual** — light theme matching KUKA WorkVisual IDE
- **KUKA WorkVisual Dark** — dark version with KUKA orange accents
- **KRL Modern Dark** — modern GitHub Dark style
- **KRL High Contrast** — for bright environments
- **KRL Monokai** — classic Monokai adaptation

#### 📊 I/O Signal Tree View

New sidebar panel showing all digital and analog I/O signals used in your project:

- `$IN[n]` / `$OUT[n]` — digital inputs/outputs
- `$ANIN[n]` / `$ANOUT[n]` — analog signals
- Click to navigate to usage location

#### 🤖 KRC Project Tree View

Hierarchical view of your KUKA project structure:

- KRC / R1 robot folders
- Program, System, MADA directories
- Grouped by file type (.src / .dat / .sub)

#### 🔍 Find System Variables

`Ctrl+Shift+P` → `KRL: Find System Variables`

Quick Pick search for all `$`-prefixed variables in workspace with navigation.

### Installation

1. Download `.vsix` from [Releases](https://github.com/SilvestrLiskin/kuka-krl-extension/releases)
2. In VS Code: `Extensions` → `...` → `Install from VSIX...`
3. Select the downloaded file

### Supported File Types

| Extension | Description |
|-----------|-------------|
| `.src` | KRL source files |
| `.dat` | Data files (DEFDAT) |
| `.sub` | Subprogram files |

---

## Русский

### Обзор

**KUKA KRL Extension** — профессиональная поддержка языка KUKA Robot Language (KRL) для файлов `.src`, `.dat`, `.sub` в Visual Studio Code. Создано программистами роботов для программистов роботов.

### Возможности

#### 🎨 Подсветка синтаксиса

Полная подсветка всех конструкций KRL: ключевые слова, типы данных, системные переменные, комментарии.

#### 📦 Сворачивание кода

Встроенная поддержка регионов `;FOLD ... ;ENDFOLD` с автоматическим сворачиванием при открытии файла.

- **Свернуть всё** — сворачивает все регионы
- **Развернуть всё** — разворачивает все регионы
- **Вставить FOLD-регион** — быстро обернуть выделенный код

#### ✅ Диагностика в реальном времени

Мгновенное обнаружение ошибок:

- **Неопределённые переменные** — подсвечивает необъявленные идентификаторы
- **Соответствие GLOBAL/PUBLIC** — проверяет согласованность объявлений DEFDAT
- **Незакрытые блоки** — IF без ENDIF, FOR без ENDFOR
- **Недостижимый код** — код после RETURN/EXIT/GOTO
- **Ошибки типов** — REAL в SWITCH/CASE, дробные числа в INT
- **Проверки безопасности** — $VEL.CP > 3м/с, $TOOL/$BASE не инициализированы

#### 🔧 Быстрые исправления

Решение проблем одним кликом:

- Объявить переменную как INT, REAL или BOOL
- Добавить или удалить ключевое слово GLOBAL
- Изменить тип переменной (INT ↔ REAL)
- Обернуть значение в ROUND()
- Обернуть код в ;FOLD регион

#### 💡 IntelliSense

Умное автодополнение:

- Все ключевые слова и типы данных KRL
- Пользовательские функции и переменные
- Системные переменные KSS 8.7 ($AXIS_ACT, $POS_ACT и др.)
- Доступ к полям структур

#### 📍 Навигация

| Функция | Сочетание | Описание |
|---------|-----------|----------|
| Перейти к определению | `F12` | Переход к объявлению функции/переменной |
| Найти все ссылки | `Shift+F12` | Поиск всех использований |
| Символы документа | `Ctrl+Shift+O` | Структура текущего файла |
| Символы рабочей области | `Ctrl+T` | Поиск по всем файлам проекта |

#### ✏️ Рефакторинг

- **Переименовать символ** (`F2`) — переименование во всех файлах
- **Форматировать документ** — стандартизация отступов
- **Удалить пробелы в конце строк** — очистка кода
- **Сортировать объявления** — упорядочить по типу

#### 🎨 Тема WorkVisual

Включена светлая тема, соответствующая цветам KUKA WorkVisual IDE.

### Установка

1. Скачайте `.vsix` из [Releases](https://github.com/SilvestrLiskin/kuka-krl-extension/releases)
2. В VS Code: `Extensions` → `...` → `Install from VSIX...`
3. Выберите загруженный файл

---

## Türkçe

### Genel Bakış

**KUKA KRL Extension** — Visual Studio Code'da KUKA Robot Dili (KRL) dosyaları (`.src`, `.dat`, `.sub`) için profesyonel dil desteği. Robot programcıları tarafından robot programcıları için tasarlandı.

### Özellikler

#### 🎨 Sözdizimi Vurgulama

Tüm KRL yapıları için tam sözdizimi vurgulama: anahtar kelimeler, veri türleri, sistem değişkenleri, yorumlar.

#### 📦 Kod Katlama

`;FOLD ... ;ENDFOLD` bölgeleri için yerel destek ve dosya açıldığında otomatik katlama.

- **Tümünü Katla** — tüm bölgeleri katla
- **Tümünü Aç** — tüm bölgeleri aç
- **FOLD Bölgesi Ekle** — seçili kodu hızlıca sar

#### ✅ Gerçek Zamanlı Tanılama

Yazarken anında hata tespiti:

- **Tanımsız değişkenler** — bildirilmemiş tanımlayıcıları vurgular
- **GLOBAL/PUBLIC uyumu** — DEFDAT bildirimlerinin eşleştiğini doğrular
- **Geçersiz değiştiriciler** — yanlış GLOBAL kullanımını yakalar

#### 🔧 Hızlı Düzeltmeler

Tek tıklamayla sorun çözümleri:

- Değişkeni INT, REAL veya BOOL olarak tanımla
- GLOBAL anahtar kelimesini ekle veya kaldır
- Kodu ;FOLD bölgesiyle sar

#### 💡 IntelliSense

Akıllı kod tamamlama:

- Tüm KRL anahtar kelimeleri ve veri türleri
- Kullanıcı tanımlı fonksiyonlar ve değişkenler
- KSS 8.7 sistem değişkenleri ($AXIS_ACT, $POS_ACT, vb.)
- Yapı üye erişimi

#### 📍 Gezinme

| Özellik | Kısayol | Açıklama |
|---------|---------|----------|
| Tanıma Git | `F12` | Fonksiyon/değişken bildirimine atla |
| Tüm Referansları Bul | `Shift+F12` | Tüm kullanımları bul |
| Belge Sembolleri | `Ctrl+Shift+O` | Mevcut dosyanın ana hatları |
| Çalışma Alanı Sembolleri | `Ctrl+T` | Tüm proje dosyalarında ara |

#### ✏️ Yeniden Düzenleme

- **Sembolü Yeniden Adlandır** (`F2`) — tüm dosyalarda yeniden adlandır
- **Belgeyi Biçimlendir** — girintileri standartlaştır
- **Sondaki Boşlukları Kaldır** — kodu temizle
- **Bildirimleri Sırala** — türe göre düzenle

#### 🎨 WorkVisual Teması

KUKA WorkVisual IDE renklerine uygun açık tema dahildir.

### Kurulum

1. `.vsix` dosyasını [Releases](https://github.com/SilvestrLiskin/kuka-krl-extension/releases) sayfasından indirin
2. VS Code'da: `Extensions` → `...` → `Install from VSIX...`
3. İndirilen dosyayı seçin

---

## License

MIT License — see [LICENSE](LICENSE.txt) for details.

## Author

**Liskin Labs**  
📧 <silvlis@outlook.com>  
🔗 [github.com/SilvestrLiskin](https://github.com/SilvestrLiskin)

---

<p align="center">
  Made with ❤️ for the robotics community
</p>
