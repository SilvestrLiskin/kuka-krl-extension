# KUKA KRL Extension vs. Python Ecosystem: Feature Gap Analysis

This document analyzes the feature set of the KUKA KRL extension compared to top-tier Python extensions (e.g., Pylance, Black, isort) and suggests high-impact features to implement.

## 1. Feature Gap Analysis

| Feature Category | Top Python Extensions (Pylance/Black) | Current KRL Extension | Gap Severity |
| :--- | :--- | :--- | :--- |
| **Static Analysis** | Deep type inference, unreachable code, **unused variables**, type mismatch. | Basic syntax checks, some type checks (REAL in SWITCH), unreachable code. **Unused variables are not detected.** | **High** |
| **IntelliSense** | Auto-completion, signature help, **Go to Definition for Standard Library** (built-ins). | Auto-completion for user variables. **No definition/help for System Variables** (e.g., `$VEL`, `$IN`). | **High** |
| **Refactoring** | Rename Symbol, **Extract Method**, **Extract Variable**, Move Symbol, Sort Imports. | Rename Symbol. **No Extract Method** or advanced refactoring. | Medium |
| **Code Hygiene** | **Auto-Import**, Remove Unused Imports, Sort Imports (isort). | N/A (KRL uses `.dat` files). **No "Add to .dat" quick fix.** | Medium |
| **Formatting** | Opinionated formatter (Black), format on save. | Configurable formatter exists. | Low |
| **Debugging** | Step-through debugging, variable inspection. | None (Code runs on robot). | N/A (Hard to implement) |

## 2. Top 3 High-Impact Features to Copy

Based on the analysis, the following three features would provide the highest value to KRL developers:

### 1. Unused Variable Detection (Linter)
**Why:** KRL codebases often accumulate "dead" variables over years of modifications. Python extensions grey out unused variables, providing immediate feedback on code cleanliness.
**Implementation:**
- Track variable declarations (already done in `SymbolExtractor`).
- Scan usages in the scope (local `DEF` or global).
- Flag variables declared but never read/written.
- **Quick Fix:** "Remove unused variable".

### 2. "Go to Definition" for System Variables (IntelliSense)
**Why:** Developers frequently use system variables like `$VEL.CP`, `$POS_ACT`, `$IN[]`. Currently, "Go to Definition" on these does nothing, breaking the flow.
**Implementation:**
- Create a virtual provider or map system variables to `krl-ref.json`.
- Display documentation (Hover) and type information when navigating to them.

### 3. Extract Function (Refactoring)
**Why:** KRL `.src` files can grow to thousands of lines. Python's "Extract Method" allows developers to select a block of code and automatically move it to a new function, passing necessary parameters.
**Implementation:**
- Analyze selected code for local variable dependencies.
- Create a new `DEF` or `DEFFCT` at the end of the file.
- Replace selection with the function call.

## 3. Bug Validation: Length Check (>24 chars)

**Issue:** Users report that variable names longer than 24 characters are not correctly flagged in `.dat` files.
**Findings:**
- The current regex `REGEX_VAR_NAME_DECL` only matches the **first** variable in a declaration line (e.g., `DECL INT a, b`).
- If the second variable (`b`) exceeds the limit, it is ignored.
- **Fix:** Refactor `validateDatFile` to parse the entire variable list using logic similar to `SymbolExtractor`, iterating through all declared variables on the line.
