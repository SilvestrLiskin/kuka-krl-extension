# KUKA KRL Extension

Professional language support for **KUKA Robot Language (KRL)** in Visual Studio Code.

Designed by robot programmers, for robot programmers.

[![Version](https://img.shields.io/visual-studio-marketplace/v/LiskinLabs.kuka-krl-extension)](https://marketplace.visualstudio.com/items?itemName=LiskinLabs.kuka-krl-extension)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/LiskinLabs.kuka-krl-extension)](https://marketplace.visualstudio.com/items?itemName=LiskinLabs.kuka-krl-extension)
[![License](https://img.shields.io/github/license/SilvestrLiskin/kuka-krl-extension)](LICENSE.txt)
[![Sponsor](https://img.shields.io/badge/Sponsor-❤-ea4aaa)](https://github.com/sponsors/SilvestrLiskin)

---

## Features

### 🎨 Syntax Highlighting

Full syntax highlighting for all KRL constructs:

- **Keywords**: `DEF`, `END`, `IF`, `THEN`, `ELSE`, `FOR`, `WHILE`, `SWITCH`, `CASE`, `LOOP`, `REPEAT`
- **Data types**: `INT`, `REAL`, `BOOL`, `CHAR`, `E6POS`, `E6AXIS`, `FRAME`, `LOAD`, `POS`, `AXIS`
- **Motion commands**: `PTP`, `LIN`, `CIRC`, `SPTP`, `SLIN`, `SCIRC`
- **System variables**: `$TOOL`, `$BASE`, `$VEL.CP`, `$AXIS_ACT`, `$POS_ACT`
- **FOLD regions**: `;FOLD ... ;ENDFOLD` with automatic folding

---

### 📦 Code Folding

Native support for KUKA FOLD regions:

```krl
;FOLD PTP HOME Vel=100% DEFAULT
  PTP XHOME
;ENDFOLD

;FOLD Main movement sequence
  LIN point1
  LIN point2
  CIRC aux, point3
;ENDFOLD
```

Commands:

- **Fold All** / **Unfold All** — toggle all regions
- **Insert FOLD Region** — wrap selected code

---

### ✅ Real-time Diagnostics

Instant error detection while you type:

| Category | Examples |
|----------|----------|
| Undefined variables | Highlights undeclared identifiers |
| Unmatched blocks | `IF` without `ENDIF`, `FOR` without `ENDFOR` |
| Type errors | `REAL` in `SWITCH/CASE`, decimal in `INT` variable |
| Safety warnings | `$VEL.CP > 3 m/s`, `$TOOL/$BASE` not initialized |
| Dead code | Unreachable code after `RETURN`, `EXIT`, `GOTO` |

---

### 🔧 Quick Fixes

One-click solutions (Ctrl+.):

- Declare undefined variable as `INT`, `REAL`, or `BOOL`
- Add or remove `GLOBAL` keyword
- Change variable type (`INT` ↔ `REAL`)
- Wrap value with `ROUND()` for INT conversion
- Wrap code with `;FOLD` region

---

### 💡 IntelliSense

Smart code completion for:

- All KRL keywords and data types
- User-defined functions and variables
- 120+ KSS 8.7 system variables
- Struct member access (E6POS, FRAME, etc.)
- 50+ functions from kuka_krl_wonderlibrary

---

### 📍 Navigation

| Feature | Shortcut | Description |
|---------|----------|-------------|
| Go to Definition | `F12` | Jump to function/variable declaration |
| Find All References | `Shift+F12` | Locate all usages |
| Document Symbols | `Ctrl+Shift+O` | Outline view of current file |
| Workspace Symbols | `Ctrl+T` | Search across all project files |
| Call Hierarchy | `Shift+Alt+H` | View incoming/outgoing calls |

---

### ✏️ Refactoring

- **Rename Symbol** (`F2`) — rename across all files with preview
- **Format Document** — standardize indentation
- **Remove Trailing Whitespace** — clean up code
- **Sort Declarations** — organize by type (INT, REAL, BOOL, FRAME, etc.)

---

### 📊 I/O Signal Tree View

Sidebar panel showing all I/O signals in your project:

- `$IN[n]` / `$OUT[n]` — digital inputs/outputs
- `$ANIN[n]` / `$ANOUT[n]` — analog signals
- Click to navigate to usage location
- Shows usage count for each signal

---

### 🤖 KRC Project Tree View

Hierarchical view of your KUKA project:

- KRC / R1 robot folders
- Program, System, MADA directories
- Grouped by file type (.src / .dat / .sub)

---

### 🎨 Color Themes

67 included themes, featuring the full **Bearded Theme** collection:

- **KUKA WorkVisual** — light theme matching WorkVisual IDE
- **KUKA WorkVisual Dark** — dark version with orange accents
- **KRL Modern Dark** — GitHub Dark style
- **KRL High Contrast** — for bright environments
- **KRL Monokai** — classic Monokai adaptation
- **KRL Tao** — elegant dark theme
- **KRL Tao Dark** — darker variant

---

### 🔍 Error Lens

Inline diagnostic messages displayed at the end of lines. Toggle via setting:

```json
"krl.errorLens.enabled": true
```

---

### 📁 File Icons

Custom file icons for KRL files:

- `.src` — Source files (orange)
- `.dat` — Data files (blue)
- `.sub` — Subprogram files (green)

---

## Installation

### From Marketplace

1. Open VS Code
2. Press `Ctrl+Shift+X` to open Extensions
3. Search for "KUKA KRL"
4. Click **Install**

### From VSIX

1. Download `.vsix` from [Releases](https://github.com/SilvestrLiskin/kuka-krl-extension/releases)
2. In VS Code: `Extensions` → `...` → `Install from VSIX...`
3. Select the downloaded file

---

## Supported File Types

| Extension | Description |
|-----------|-------------|
| `.src` | KRL source files |
| `.dat` | Data files (DEFDAT) |
| `.sub` | Subprogram files |

---

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `krl.autoFold` | `false` | Auto-fold regions on file open |
| `krl.formatOnSave` | `false` | Format document on save |
| `krl.indentWidth` | `3` | Indentation width (1-8) |
| `krl.removeTrailingWhitespaceOnFormat` | `true` | Remove trailing spaces |
| `krl.errorLens.enabled` | `true` | Show inline diagnostics |
| `krl.validateNonAscii` | `true` | Warn about non-ASCII characters |

---

## Commands

| Command | Description |
|---------|-------------|
| `KRL: Check All Files` | Validate all KRL files in workspace |
| `KRL: Fold All` | Collapse all FOLD regions |
| `KRL: Unfold All` | Expand all FOLD regions |
| `KRL: Format Document` | Format current document |
| `KRL: Remove Trailing Whitespace` | Clean up trailing spaces |
| `KRL: Sort Declarations` | Sort DECL statements by type |
| `KRL: Insert FOLD Region` | Wrap selected code in FOLD |
| `KRL: Find System Variables` | Search $-prefixed variables |
| `KRL: Generate Documentation` | Generate Markdown docs |

---

## Code Examples

### Basic Program Structure

```krl
DEF MyProgram()
   ; Variable declarations
   DECL INT counter
   DECL REAL speed
   DECL E6POS target
   
   ; Initialize
   counter = 0
   speed = 0.5
   
   ; Main loop
   FOR counter = 1 TO 10
      LIN target
      WAIT SEC 0.1
   ENDFOR
END
```

### Motion Commands

```krl
; Point-to-point motion
PTP {X 100, Y 200, Z 300, A 0, B 90, C 0}

; Linear motion with velocity
$VEL.CP = 0.5
LIN {X 150, Y 250, Z 350, A 0, B 90, C 0}

; Circular motion
CIRC {X 120, Y 220}, {X 100, Y 240, Z 300}
```

### FOLD Regions

```krl
;FOLD INI
   BAS(#INITMOV, 0)
   $TOOL = TOOL_DATA[1]
   $BASE = BASE_DATA[1]
;ENDFOLD

;FOLD SPTP HOME Vel=100% DEFAULT
   $BWDSTART = FALSE
   SPTP XHOME
;ENDFOLD
```

---

## Requirements

- VS Code 1.85.0 or higher

---

## License

MIT License — see [LICENSE.txt](LICENSE.txt) for details.

---

## Author

**Liskin Labs**  
📧 <silvlis@outlook.com>  
🔗 [github.com/SilvestrLiskin](https://github.com/SilvestrLiskin)  
💖 [Sponsor this project](https://github.com/sponsors/SilvestrLiskin)

---

Made with ❤️ for the robotics community
