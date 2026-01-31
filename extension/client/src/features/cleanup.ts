import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { t } from "../i18n";

/**
 * Parses a DECL line to extract variable names.
 * Example: "DECL INT a, b[5], c" -> ["a", "b", "c"]
 */
function extractVariableNames(declLine: string): string[] {
  // Remove DECL, types, GLOBAL, etc. to get the variable list
  // This is a simplified approach. A full parser would be better but regex suffices for KRL.
  // Regex from collector.ts:
  // /^\s*(?:(?:GLOBAL\s+)?(?:CONST\s+)?DECL\s+(?:GLOBAL\s+)?(?:CONST\s+)?(\w+)|(?:GLOBAL\s+)?(?:CONST\s+)?(INT|REAL|...))\s+([^\r\n;]+)/gim;

  const parts = declLine.split(";"); // Remove comments
  let content = parts[0].trim();

  // Remove keywords
  content = content.replace(
    /^(GLOBAL\s+)?(CONST\s+)?(DECL\s+)?(GLOBAL\s+)?(CONST\s+)?/i,
    "",
  );

  // Now we might have 'INT a, b' or just 'a, b' if type was removed differently?
  // Actually the previous regex matched the type and the rest.
  // Let's try to match the list part.
  const match = content.match(/^(?:(?:\w+|\[\])\s+)?(.+)$/);
  if (!match) return [];

  // If there is a type at the beginning (INT, REAL, etc), remove it
  // But struct types can be anything.
  // So we just take everything after the first space if it matches a type pattern?
  // This is risky.

  // Let's use the collector approach: Split by comma respecting brackets.
  // But we need to isolate the variable list first.

  // Easier: Just look for the variable list.
  // If the line starts with DECL/INT.., usually the first word is the type, the rest is vars.
  const firstSpace = content.indexOf(" ");
  if (firstSpace === -1) return []; // No variables? "DECL INT" ?

  const varListStr = content.substring(firstSpace).trim();

  const variables: string[] = [];
  let current = "";
  let bracketDepth = 0;

  for (let i = 0; i < varListStr.length; i++) {
    const char = varListStr[i];
    if (char === "[") bracketDepth++;
    if (char === "]") bracketDepth--;
    if (char === "," && bracketDepth === 0) {
      variables.push(cleanVarName(current));
      current = "";
    } else {
      current += char;
    }
  }
  if (current) variables.push(cleanVarName(current));

  return variables.filter((v) => !!v);
}

function cleanVarName(raw: string): string {
  let name = raw.trim();
  // Remove array dim: a[5] -> a
  name = name.replace(/\[.*?\]/g, "");
  // Remove initialization: a = 5 -> a
  name = name.split("=")[0].trim();
  return name;
}

export async function cleanupUnusedVariables() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const doc = editor.document;
  const ext = path.extname(doc.fileName).toLowerCase();

  let srcPath: string;
  let datPath: string;

  if (ext === ".src") {
    srcPath = doc.fileName;
    datPath = doc.fileName.replace(/\.src$/i, ".dat");
  } else if (ext === ".dat") {
    datPath = doc.fileName;
    srcPath = doc.fileName.replace(/\.dat$/i, ".src");
  } else {
    vscode.window.showWarningMessage(t("warning.noActiveKrlFile")); // You might need to add this key or use string
    return;
  }

  if (!fs.existsSync(datPath)) {
    vscode.window.showWarningMessage("No corresponding .dat file found.");
    return;
  }

  // If .src is missing, we can still clean .dat but we can't check usages!
  // Wait, if .src is missing, then ALL variables in .dat are unused? No, could be GLOBAL.
  if (!fs.existsSync(srcPath)) {
    vscode.window.showWarningMessage(
      "No corresponding .src file found to check usages.",
    );
    return;
  }

  const datDoc = await vscode.workspace.openTextDocument(datPath);
  const srcDoc = await vscode.workspace.openTextDocument(srcPath); // Might be same if opened? No, file system

  const datText = datDoc.getText();
  const srcText = srcDoc.getText();

  const lines = datText.split(/\r?\n/);
  const unusedDecls: { lineIndex: number; varNames: string[] }[] = [];

  // 1. Find all declarations in DAT
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimLine = line.trim();

    // Skip comments
    if (trimLine.startsWith(";")) continue;

    // Skip GLOBAL declarations - unsafe to remove as they might be used in other files
    if (/\bGLOBAL\b/i.test(trimLine)) continue;

    // Check if it is a DECL
    if (
      !/\b(DECL|INT|REAL|BOOL|CHAR|FRAME|POS|E6POS|E6AXIS|AXIS|LOAD|SIGNAL|STRING|STRUC|ENUM)\b/i.test(
        trimLine,
      )
    ) {
      continue;
    }

    // Exclude specific KUKA lines like "&ACCESS" or simple key-values if any
    if (trimLine.startsWith("&")) continue;

    const vars = extractVariableNames(trimLine);
    if (vars.length === 0) continue;

    // Check usages in SRC (and DAT itself!)
    // Simple string search.
    // We must ensure we match whole words.
    let isUsed = false;

    for (const v of vars) {
      const regex = new RegExp(`\\b${v}\\b`, "i"); // Case insensitive? KRL is case insensitive.

      // Check in SRC
      if (regex.test(srcText)) {
        isUsed = true;
        break;
      }

      // Check in DAT (excluding the declaration line itself)
      // We need to match in DAT carefully.
      // Issues: internal DAT references?
      // e.g. DECL INT a = 5
      // DECL INT b = a -- usage!

      // For simplicity, let's regex the WHOLE dat text.
      // But we need to exclude the current declaration instance.
      // If the variable appears MORE than once in DAT, it's used?
      // Or better: Remove the current line from DAT text, then check.

      const datWithoutLine = lines.filter((_, idx) => idx !== i).join("\n");
      if (regex.test(datWithoutLine)) {
        isUsed = true;
        break;
      }
    }

    if (!isUsed) {
      unusedDecls.push({ lineIndex: i, varNames: vars });
    }
  }

  if (unusedDecls.length === 0) {
    vscode.window.showInformationMessage("No unused variables found.");
    return;
  }

  // 1. Preview: Let user select variable lines to clean
  const items: vscode.QuickPickItem[] = unusedDecls.map((decl) => {
    const lineContent = lines[decl.lineIndex].trim();
    return {
      label: decl.varNames.join(", "),
      description: `Line ${decl.lineIndex + 1}: ${lineContent}`,
      detail: "Unused",
      picked: true, // Select all by default
      // Store index in 'data' if custom property allowed, but we can index by arrays
    };
  });

  const selectedItems = await vscode.window.showQuickPick(items, {
    placeHolder: `Found ${unusedDecls.length} unused lines. Select items to clean.`,
    canPickMany: true,
  });

  if (!selectedItems || selectedItems.length === 0) {
    return; // Cancelled or cleared
  }

  // Filter original list based on selection
  // Matching by description/label is risky if duplicates?
  // Proper way: map selected items back to indices.
  const selectedIndices = new Set<number>();
  selectedItems.forEach((item) => {
    // Find index in original 'items' array
    // Since map preserves order:
    const idx = items.indexOf(item);
    if (idx !== -1) selectedIndices.add(idx);
  });

  const finalDecls = unusedDecls.filter((_, idx) => selectedIndices.has(idx));

  // 2. Action: Delete or Comment
  const action = await vscode.window.showQuickPick(
    [
      { label: "$(trash) Delete", description: "Permanently remove lines" },
      {
        label: "$(comment) Comment Out",
        description: "Safe Mode: Comment lines (; DECL ...)",
      },
    ],
    { placeHolder: "Choose cleaning action" },
  );

  if (!action) return;

  const isDelete = action.label.includes("Delete");
  const edit = new vscode.WorkspaceEdit();

  for (const decl of finalDecls) {
    const line = datDoc.lineAt(decl.lineIndex);
    if (isDelete) {
      edit.delete(datDoc.uri, line.rangeIncludingLineBreak);
    } else {
      // Comment out: Insert ; at start of line (handling indentation?)
      // Or just replace text with "; " + text
      edit.replace(datDoc.uri, line.range, `; ${line.text}`);
    }
  }

  await vscode.workspace.applyEdit(edit);
  vscode.window.showInformationMessage(
    `${isDelete ? "Deleted" : "Commented out"} ${finalDecls.length} lines.`,
  );
}
