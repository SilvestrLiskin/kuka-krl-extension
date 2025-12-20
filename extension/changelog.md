# Changelog

All notable changes to this extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
