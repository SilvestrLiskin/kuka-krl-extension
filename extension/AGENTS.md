# AGENTS.md - AI Agent Guidelines for KUKA KRL Extension

This document provides guidelines and best practices for AI agents working on the KUKA Robot Language (KRL) VS Code extension.

## Mission Statement

Automate the development, refactoring, and verification of KUKA Robot Language (KRL) code using professional CLI tools and industry-standard VS Code extension practices.

## Project Overview

The KUKA KRL extension provides comprehensive language support for KRL, including syntax highlighting, IntelliSense, diagnostics, and formatting.

### Key Technologies

- **TypeScript** (CommonJS for extension)
- **Node.js**
- **VS Code Extension API**
- **Language Server Protocol (LSP)**
- **TextMate Grammars**

## Project Structure (Extension)

```
extension/
├── client/                     # Extension client (VS Code specific)
│   ├── src/                    # Client source code
│   ├── syntaxes/               # TextMate grammars (.tmLanguage.json)
│   ├── themes/                 # Color themes (including Bearded variations)
│   └── snippets/               # Code snippets
├── server/                     # Language Server (KRL logic)
│   ├── src/                    # LSP server source code
│   └── krl-ref.json            # KRL reference data
├── images/                     # Extension assets
└── package.json                # Manifest
```

## Coding Standards

### Localization

- System variables and hover information should support EN, RU, and TR.
- Use `package.nls.*.json` for UI strings.

### Source Code

- Use TypeScript for all logic.
- Ensure all movement commands (PTP, LIN, CIRC, etc.) are handled with high precision.
- Maintain consistency between `client` and `server` for shared KRL logic.

## Jules Orchestration Protocols

- **Batch Operations**: Use `jules_batch_create` for tasks affecting >3 files.
- **Verification**: Always run `npm run lint` and `npm run compile` to verify sessions.
- **Reporting**: Provide reports in Russian as requested by the Lead Engineer.

### Windows & PowerShell Protocol
>
> [!IMPORTANT]
> **Anti-Hanging & Encoding Rules**
> To prevent CLI freezes and encoding issues (e.g., `?????` instead of Cyrillic) on Windows:
>
> 1. **Prompt via File**: ALWAYS write long prompts to a text file (e.g., `prompt.txt`) instead of passing them as arguments.
> 2. **Force UTF-8**: Set PowerShell encoding before piping:
>
>    ```powershell
>    $OutputEncoding = [System.Console]::InputEncoding = [System.Console]::OutputEncoding = New-Object System.Text.UTF8Encoding;
>    Get-Content prompt.txt | jules new --repo <owner>/<repo>
>    ```
>
> 3. **Explicit Repo**: ALWAYS use the `--repo` flag if running outside the exact git root or if detection fails.
