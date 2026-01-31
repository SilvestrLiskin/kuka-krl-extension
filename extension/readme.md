<div align="center">

# KUKA KRL (The Ultimate Extension)

**Professional development environment for KUKA Robot Language in VS Code.**
<br>
Build, validate, and refactor KRL code with confidence.

[![Version](https://img.shields.io/visual-studio-marketplace/v/LiskinLabs.kuka-krl-extension)](https://marketplace.visualstudio.com/items?itemName=LiskinLabs.kuka-krl-extension)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/LiskinLabs.kuka-krl-extension)](https://marketplace.visualstudio.com/items?itemName=LiskinLabs.kuka-krl-extension)
[![License](https://img.shields.io/github/license/SilvestrLiskin/kuka-krl-extension)](LICENSE.txt)

</div>

---

## 🚀 Why this extension?

Writing KRL code in Notepad++ or WorkVisual is a pain. We fixed that.
This extension transforms VS Code into a **full-IDE experience** for KUKA robots (KRC4 / KRC5), offering features that even the official tools lack.

---

## ✨ Key Features

### 🎨 18 Professional Themes

Forget the boring default colors. We included **18 hand-crafted themes** specifically tuned for KRL syntax visibility.

* **Classic**: `KRL Monokai`, `KRL High Contrast`
* **Modern**: `KRL Dracula`, `KRL Nord`, `KRL One Dark Pro`
* **GitHub**: `Dark`, `Light`, `High Contrast`
* **Ayu**: `Mirage`, `Dark`, `Light`
* **Solarized**: `Dark`, `Light`
* **VS Code**: `Dark`, `Light`, `Dark+` (Enhanced)
* **Retro**: `Gruvbox`, `Tomorrow Night Blue`

### 🛡️ Strict Validation (The "Safety Net")

Prevent downtime by catching errors *before* you deploy to the robot.

* **Name Limits**: Automatically warns if variables/signals exceed **24 characters**.
* **Message Keys**: Warns if `KEY[]` exceeds **26 characters**. in KrlMsg.
* **Type Safety**: Detects `REAL` usage in `SWITCH` or decimal values in `INT` variables.
* **Safety Checks**: Alerts on dangerous speeds (`$VEL.CP > 3.0`) or uninitialized tools/bases.

### 🧠 Intelligent Coding

* **Smart Completion**: 120+ System Variables, KRL Keywords, and your own functions.
* **Snippets**: Industry-standard patterns like `Interrupt_Lifecycle`, `EKI_Init`, `REPEAT..UNTIL`.
* **Docs**: Built-in documentation for all system variables (hover to see descriptions).

### 🛠️ Power Tools

* **I/O Signal Viewer**: Dedicated sidebar to see all `$IN` / `$OUT` signals used in your project.
* **Project Explorer**: Tree view organized by function (.src) and data (.dat).
* **Refactoring**: Rename symbols (`F2`) across multiple files instantly.
* **Cleanup**: One-click command to remove unused variables and sort declarations.

---

## ⚙️ Configuration

Customize the extension to fit your workflow in `settings.json`:

| Setting | Default | Description |
| :--- | :--- | :--- |
| `krl.errorLens.enabled` | `true` | Show errors inline at the end of the line. |
| `krl.validateNonAscii` | `true` | Warn about Cyrillic or non-Latin characters (safer for old KRC). |
| `krl.autoFold` | `false` | Automatically collapse `;FOLD` regions when opening a file. |
| `krl.indentFolds` | `true` | Indent code inside generic `;FOLD` blocks. |
| `krl.alignAssignments` | `true` | Align `=` signs vertically for cleaner code. |
| `krl.formatOnSave` | `false` | Automatically format KRL files on save. |
| `krl.removeTrailingWhitespaceOnFormat` | `true` | Trim whitespace when formatting. |
| `krl.indentWidth` | `3` | Number of spaces for indentation (KUKA standard is 2 or 3). |

---

## ⌨️ Commands Palette

Press `Ctrl+Shift+P` and type `KRL` to access:

* **KRL: Validate Workspace** - Run a full check on all files.
* **KRL: Sort Declarations** - Organize `DECL` statements by type (INT, REAL, etc.).
* **KRL: Clean Up Unused Variables** - Remove dead code instantly.
* **KRL: Insert FOLD Region** - Wrap selected code in a standard KUKA Fold.
* **KRL: Frame Calculator** - Helper tool for geometric calculations.
* **KRL: Refresh I/O View** - Update the signal list sidebar.

---

## 📥 Installation

1. Open **VS Code**.
2. Press `Ctrl+Shift+X` or click the Extensions icon.
3. Search for **"KUKA KRL"**.
4. Click **Install**.

---

## 🤝 Contributing & Support

Found a bug? Have a feature request?

* [Report an Issue](https://github.com/SilvestrLiskin/kuka-krl-extension/issues)
* [Sponsor the Project](https://github.com/sponsors/SilvestrLiskin)

**Author**: [Liskin Labs](https://github.com/SilvestrLiskin)  
*Made with ❤️ for the robotics community.*
