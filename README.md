<div align="center">

<img src="extension/logo.png" alt="KUKA KRL Extension Logo" width="200"/>

# KUKA KRL: The Ultimate Edition

[![Version](https://img.shields.io/visual-studio-marketplace/v/LiskinLabs.kuka-krl-extension?style=flat-square&color=blue)](https://marketplace.visualstudio.com/items?itemName=LiskinLabs.kuka-krl-extension)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/LiskinLabs.kuka-krl-extension?style=flat-square&color=green)](https://marketplace.visualstudio.com/items?itemName=LiskinLabs.kuka-krl-extension)
[![License](https://img.shields.io/github/license/SilvestrLiskin/kuka-krl-extension?style=flat-square&color=orange)](LICENSE.txt)
[![Sponsor](https://img.shields.io/badge/Sponsor-%E2%9D%A4-ea4aaa?style=flat-square)](https://github.com/sponsors/SilvestrLiskin)

### Transform VS Code into a KRC4/KRC5 Powerhouse

</div>

---

## 🛑 The "Why"

* **Stop suffering in Notepad++.** You are an engineer, not a typewriter.
* **WorkVisual is clunky.** It wasn't built for speed or eyes-on-code ergonomics.
* **Your eyes deserve better.** 8 hours a day in a bad environment is a health hazard.

**"We didn't just port themes; we *engineered* them for Industrial Robotics."**

---

## 💎 Feature Showcase

<table>
  <tr>
    <td width="50%" valign="top">
      <h3>🎨 Engineered Aesthetics</h3>
      <ul>
        <li>We integrated the legendary <b><a href="https://github.com/BeardedBear/bearded-theme">Bearded Theme</a></b> collection.</li>
        <li><b>Critical Mod:</b> We manually tuned all <b>67 themes</b>.</li>
        <li>Optimized contrast for factory floor lighting conditions.</li>
      </ul>
    </td>
    <td width="50%" valign="top">
      <h3>🛡️ Industrial-Grade Validation</h3>
      <ul>
        <li><b>Zero-Error Policy.</b></li>
        <li>Checks max name lengths (24 chars).</li>
        <li>Validates Message keys (26 chars).</li>
        <li>Enforces strict Type Safety.</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <h3>⚡ Intelligent Tools</h3>
      <ul>
        <li><b>I/O Signal Monitor</b> (Side Panel).</li>
        <li>Snippets for <code>Interrupts</code>, <code>SPS</code>, <code>EKI</code>.</li>
        <li><b>Snippet Generator</b>: Custom tool to create code templates.</li>
        <li><b>120+ System Variables</b> auto-complete.</li>
        <li>Inline "Error Lens" diagnostics.</li>
      </ul>
    </td>
    <td width="50%" valign="top">
      <h3>🔧 Smart Refactoring</h3>
      <ul>
        <li><b>F2 Rename</b> across all files (`.src` & `.dat`).</li>
        <li>Auto-Cleanup unused variables.</li>
        <li>Sort declarations instantly.</li>
        <li><b>Insert FOLD</b>: Wrap code in standard KUKA styling.</li>
        <li><b>Analysis Report</b>: Generate a full project health summary.</li>
        <li>KRL Frame Calculator included.</li>
      </ul>
    </td>
  </tr>
</table>
<br>

## 💻 Code Preview

```krl
&ACCESS RVP
&REL 1
DEF Palletizing()
  ;FOLD INI
  BAS (#INITMOV, 0)
  ;ENDFOLD

  ; Check Current Tool
  IF ($ACT_TOOL < 0) THEN
    MsgNotify("No tool selected!", "Error")
    HALT
  ENDIF

  ; Move to Home
  PTP HOME Vel=100% DEFAULT

  ; Calculate Approach Position
  TargetPos = XP1
  TargetPos.Z = TargetPos.Z + 200.0

  ; Linear Movement
  LIN TargetPos C_DIS
END
```

---

## 📜 License & Credits

This project stands on the shoulders of giants.

* **OpenKuka**: Built on the knowledge of the [OpenKuka Community](https://github.com/OpenKuka/openkuka.github.io).
* **Bearded Theme**: Themes adapted from [Bearded Theme](https://github.com/BeardedBear/bearded-theme) by BeardedBear (GPL-3.0). **Usage rights preserved.**

---

## 📥 Installation

1. Open **VS Code**.
2. Press `Ctrl+P`, type `ext install LiskinLabs.kuka-krl-extension`.
3. **Done.**

---

## ⚙️ Settings

Customize your experience in `settings.json`.

| Setting | Default | Description |
| :--- | :--- | :--- |
| `krl.autoFold` | `false` | Automatically collapse `;FOLD` regions on open. |
| `krl.validateNonAscii` | `true` | Warn about non-Latin characters (Critical for older KRCs). |
| `krl.errorLens.enabled` | `true` | Show errors inline at the end of the line. |
| `krl.indentFolds` | `true` | Indent code inside generic `;FOLD` blocks. |
| `krl.alignAssignments` | `true` | Vertically align `=` signs for readability. |

        <li><code>krl.formatOnSave</code> | <code>false</code> | Auto-format KRL files when saving.</li>
        <li><code>krl.removeTrailingWhitespaceOnFormat</code> | <code>true</code> | Trim whitespace when formatting.</li>
        <li><code>krl.separateBeforeBlocks</code> | <code>false</code> | Add empty lines before blocks (IF/FOR).</li>
        <li><code>krl.indentWidth</code> | <code>3</code> | Indentation size (Standard KUKA is 2 or 3).</li>

---

<div align="center">

**Made with ❤️ for the Robotics Community.**

</div>
