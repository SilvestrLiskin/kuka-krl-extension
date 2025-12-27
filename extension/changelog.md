# Changelog

All notable changes to this extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2025-12-27

### Added

- **kuka_krl_wonderlibrary Integration**: Added 50+ functions from the [kuka_krl_wonderlibrary](https://github.com/skilledAutomation/kuka_krl_wonderlibrary) project
  - **Math**: `IN_RANGE`, `IN_TOLERANCE`
  - **String**: `STOF`, `STOI`, `FTOS`, `ITOS`, `BTOS`, `PTOS`, `MID`, `SPRINTF`
  - **Logical**: `BOOL_CHOOSEI`, `BOOL_CHOOSEF`, `BOOL_CHOOSE_E6POS`, `BOOL_CHOOSESTR`, `INT_CHOOSEF`
  - **File I/O**: `fopen`, `fclose`, `fprintf`, `fgets`, `feof`, `LOG`, `LOGDEBUG`, `LOGERROR`
  - **Geometry 2D**: `LINE2D_FROM_2P`, `LINE2D_INTERSECTION`, `CIRC_FROM_CENTER_RADIUS`, `RADICAL_AXIS`, etc.
  - **Geometry 3D**: `PLANE_FROM_3p`, `LINE3D_FROM_PLANES`, `VECTOR3D_DIRECTOR_COSINE`, etc.
- **18 New Snippets**: File operations, string conversions, geometry primitives, ternary operators
- **Geometry Structs**: `STR_LINE2D`, `STR_CIRCUMFERENCE2D`, `STR_PLANE`, `STR_VECTOR3D`, `STR_LINE3D`

---

## [1.1.5] - 2025-12-27

### Fixed

- **False Positive Diagnostics**: Fixed race condition causing false "undefined variable" errors when opening files
  - Added `workspaceInitialized` flag to delay variable validation until workspace is fully loaded
  - Increased debounce delay from 500ms to 750ms for more stable diagnostics
- **Comment Index Mismatch**: Fixed bug where comment detection used original line indices instead of processed line indices, causing incorrect error positions when strings contain quotes
- **Windows Line Endings**: Fixed grammar regex for comments to properly handle `\r\n` line endings on Windows
- **System Variable Detection**: Fixed detection of `$`, `#`, and `.` prefixes to use processed line instead of original line

---

## [1.1.3] - 2025-12-27

### Added

- **FOLD/ENDFOLD Highlighting**: `;FOLD` and `;ENDFOLD` comments now have a distinct color from regular comments (muted gray, italic) across all 5 themes
- **New Keywords**: `TIMEOUT`, `CONFIRM`, `ANIN`, `ANOUT`, `PULSE`, `SUBMIT`, `STOP`
- **New Built-in Functions**: `ROUND`, `FLOOR`, `CEILING`, `EXP`, `LOG`, `POW`, `VARSTATE`, `VARINFO`, `TOOL_ADJ`, `INV`

### Fixed

- **WAIT FOR Recognition**: Fixed false positive lint errors for `WAIT FOR` being incorrectly recognized as a `FOR` loop
- **Diagnostic Delay**: Added debounce (500ms) to validation to prevent false "undefined variable" errors during fast typing
- **DEF...END Block**: Fixed incorrect "unmatched block" errors when valid DEF...END structure exists

### Changed

- **Auto-fold Disabled by Default**: `krl.autoFold` is now `false` by default

---

## [1.1.0] - 2025-12-20

### Added

- **5 Color Themes**:
  - KUKA WorkVisual (improved light)
  - KUKA WorkVisual Dark
  - KRL Modern Dark (GitHub Dark style)
  - KRL High Contrast (for bright environments)
  - KRL Monokai (classic Monokai)
- **System Variable Documentation**: Inline hover documentation for 50+ system variables (`$TOOL`, `$BASE`, `$VEL.CP`, etc.) in 3 languages (EN/RU/TR)
- **I/O Tree View**: New panel showing all `$IN`, `$OUT`, `$ANIN`, `$ANOUT` signals with navigation to usage locations
- **KRC Project Tree View**: Hierarchical view of KRC project structure (KRC/R1/Program folders)
- **Find System Variables**: Quick Pick command (`KRL: Find System Variables`) to search all `$`-prefixed variables in workspace

### Commands

- `KRL: Find System Variables` - Search system variables with navigation
- `KRL: Refresh I/O View` - Refresh I/O signals tree
- `KRL: Refresh KRC View` - Refresh project structure tree

---

## [1.0.1] - 2025-12-20

### Added

- **Code Lens**: Display function metrics (line count, references) above each function
- **Documentation Generator**: Generate Markdown documentation from KRL files (`KRL: Generate Documentation`)
- **Extended Diagnostics**:
  - Unmatched blocks (IF without ENDIF, FOR without ENDFOR, etc.)
  - Duplicate function/variable names
  - Unreachable code after RETURN/EXIT/GOTO/HALT
  - Empty IF/FOR/WHILE/LOOP blocks
  - WAIT FOR without timeout warning
  - HALT statement warning
  - REAL type in SWITCH/CASE error
  - Decimal value assigned to INT variable warning
- **Type-related Quick Fixes**:
  - Change variable type to INT
  - Change variable type to REAL
  - Wrap value with ROUND() for INT conversion
- **Safety Diagnostics**:
  - Velocity check ($VEL.CP > 3 m/s)
  - PTP velocity check ($VEL_PTP > 100%)
  - $TOOL/$BASE initialization before movement

### Changed

- Improved localization for EN/RU/TR

---

## [1.0.0] - 2025-12-19

### Added

- **Syntax Highlighting**: Full support for KRL syntax including keywords, data types, and system variables
- **Code Folding**: Automatic recognition and folding of `;FOLD` ... `;ENDFOLD` regions
- **IntelliSense**: Auto-completion for variables, functions, and keywords
- **Go to Definition**: Navigate to function and variable declarations
- **Hover Information**: Display function signatures, variable types, and keyword descriptions
- **Diagnostics**: Validation of variable declarations and GLOBAL/PUBLIC consistency
- **Formatter**: Automatic indentation and keyword uppercase conversion
- **Snippets**: 40+ code snippets for common KRL constructs
- **KUKA WorkVisual Theme**: Light theme matching the WorkVisual editor style
- **Document Symbols**: Outline panel showing functions, variables, and structures (Ctrl+Shift+O)
- **Workspace Symbols**: Global symbol search across all files (Ctrl+T)
- **Rename Symbol**: Rename variables and functions across all files (F2)
- **Find All References**: Find all usages of a symbol (Shift+F12)
- **Signature Help**: Parameter hints when calling functions
- **Code Actions / Quick Fixes**: Automatic fixes for common issues

### Supported Features

- Movement commands: `PTP`, `LIN`, `CIRC`, `SPTP`, `SLIN`, `SCIRC`
- Bitwise operators: `B_AND`, `B_OR`, `B_XOR`, `B_NOT`, `EXOR`
- All standard KRL data types: `E6POS`, `E6AXIS`, `FRAME`, `LOAD`, etc.
- Scientific notation for numbers (e.g., `1.5E+10`)
- 120+ KSS 8.7 system variables

### Commands

- `KRL: Check All Files` - Validate all KRL files in workspace
- `KRL: Fold All` / `KRL: Unfold All` - Toggle code folding
- `KRL: Format Document` - Format current document
- `KRL: Remove Trailing Whitespace` - Clean up trailing spaces
- `KRL: Sort Declarations` - Sort DECL statements by type
- `KRL: Insert FOLD Region` - Wrap selected code in FOLD block

---

**© 2025 Liskin Labs. MIT License.**
