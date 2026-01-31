/**
 * Error Lens - Отображает диагностические сообщения (ошибки) в конце строки редактора.
 * Встроенный аналог популярного расширения Error Lens, специально для KRL.
 */

import * as vscode from "vscode";

let errorLensDecorations: vscode.TextEditorDecorationType | undefined;
let warningLensDecorations: vscode.TextEditorDecorationType | undefined;
let infoLensDecorations: vscode.TextEditorDecorationType | undefined;

/**
 * Инициализация функции Error Lens.
 */
export function initErrorLens(context: vscode.ExtensionContext): void {
  // Создание типов декораций
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

  // Обновление декораций при изменении диагностики
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

  // Обновление декораций при смене активного редактора
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        updateErrorLensDecorations(editor);
      }
    }),
  );

  // Первичное обновление
  if (vscode.window.activeTextEditor) {
    updateErrorLensDecorations(vscode.window.activeTextEditor);
  }
}

/**
 * Обновляет декорации Error Lens для указанного редактора.
 */
function updateErrorLensDecorations(editor: vscode.TextEditor): void {
  // Проверяем, включен ли Error Lens
  const config = vscode.workspace.getConfiguration("krl");
  if (!config.get<boolean>("errorLens.enabled", true)) {
    clearDecorations(editor);
    return;
  }

  // Только для KRL файлов
  if (editor.document.languageId !== "krl") {
    return;
  }

  const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);

  const errors: vscode.DecorationOptions[] = [];
  const warnings: vscode.DecorationOptions[] = [];
  const infos: vscode.DecorationOptions[] = [];

  // Группируем по строкам (показываем только первую ошибку в строке)
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
 * Очищает все декорации Error Lens.
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
