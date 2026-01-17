/**
 * Error Lens - Display diagnostic messages inline at the end of lines
 * Similar to the popular Error Lens extension but built-in for KRL
 */

import * as vscode from "vscode";

let errorLensDecorations: vscode.TextEditorDecorationType | undefined;
let warningLensDecorations: vscode.TextEditorDecorationType | undefined;
let infoLensDecorations: vscode.TextEditorDecorationType | undefined;

/**
 * Initialize Error Lens feature
 */
export function initErrorLens(context: vscode.ExtensionContext): void {
  // Create decoration types
  errorLensDecorations = vscode.window.createTextEditorDecorationType({
    after: {
      margin: "0 0 0 2em",
      color: "#ff6b6b",
      fontStyle: "italic",
    },
    isWholeLine: true,
  });

  warningLensDecorations = vscode.window.createTextEditorDecorationType({
    after: {
      margin: "0 0 0 2em",
      color: "#ffa502",
      fontStyle: "italic",
    },
    isWholeLine: true,
  });

  infoLensDecorations = vscode.window.createTextEditorDecorationType({
    after: {
      margin: "0 0 0 2em",
      color: "#70a1ff",
      fontStyle: "italic",
    },
    isWholeLine: true,
  });

  context.subscriptions.push(
    errorLensDecorations,
    warningLensDecorations,
    infoLensDecorations,
  );

  // Update decorations when diagnostics change
  context.subscriptions.push(
    vscode.languages.onDidChangeDiagnostics((e) => {
      const editor = vscode.window.activeTextEditor;
      if (
        editor &&
        e.uris.some((uri) => uri.toString() === editor.document.uri.toString())
      ) {
        updateErrorLensDecorations(editor);
      }
    }),
  );

  // Update decorations when active editor changes
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        updateErrorLensDecorations(editor);
      }
    }),
  );

  // Initial update
  if (vscode.window.activeTextEditor) {
    updateErrorLensDecorations(vscode.window.activeTextEditor);
  }
}

/**
 * Update Error Lens decorations for the given editor
 */
function updateErrorLensDecorations(editor: vscode.TextEditor): void {
  // Check if Error Lens is enabled
  const config = vscode.workspace.getConfiguration("krl");
  if (!config.get<boolean>("errorLens.enabled", true)) {
    clearDecorations(editor);
    return;
  }

  // Only for KRL files
  if (editor.document.languageId !== "krl") {
    return;
  }

  const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);

  const errors: vscode.DecorationOptions[] = [];
  const warnings: vscode.DecorationOptions[] = [];
  const infos: vscode.DecorationOptions[] = [];

  // Group diagnostics by line (show only first per line)
  const seenLines = new Set<number>();

  for (const diagnostic of diagnostics) {
    const line = diagnostic.range.start.line;
    if (seenLines.has(line)) continue;
    seenLines.add(line);

    const decoration: vscode.DecorationOptions = {
      range: new vscode.Range(line, 0, line, 0),
      renderOptions: {
        after: {
          contentText: `  ← ${diagnostic.message}`,
        },
      },
    };

    switch (diagnostic.severity) {
      case vscode.DiagnosticSeverity.Error:
        errors.push(decoration);
        break;
      case vscode.DiagnosticSeverity.Warning:
        warnings.push(decoration);
        break;
      case vscode.DiagnosticSeverity.Information:
      case vscode.DiagnosticSeverity.Hint:
        infos.push(decoration);
        break;
    }
  }

  if (errorLensDecorations) {
    editor.setDecorations(errorLensDecorations, errors);
  }
  if (warningLensDecorations) {
    editor.setDecorations(warningLensDecorations, warnings);
  }
  if (infoLensDecorations) {
    editor.setDecorations(infoLensDecorations, infos);
  }
}

/**
 * Clear all Error Lens decorations
 */
function clearDecorations(editor: vscode.TextEditor): void {
  if (errorLensDecorations) {
    editor.setDecorations(errorLensDecorations, []);
  }
  if (warningLensDecorations) {
    editor.setDecorations(warningLensDecorations, []);
  }
  if (infoLensDecorations) {
    editor.setDecorations(infoLensDecorations, []);
  }
}
