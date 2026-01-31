import * as vscode from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
  State,
} from "vscode-languageclient/node";
import * as path from "path";
import { t } from "./i18n";
import { DocGenerator } from "./docGenerator";
import { IOTreeProvider } from "./ioTreeView";
import { KRCTreeProvider } from "./krcTreeView";
import { showSystemVariablesPicker } from "./systemVarFinder";
import { cleanupUnusedVariables } from "./features/cleanup";
import { deployToRobot } from "./features/deploy";
import { ZipFileSystemProvider } from "./features/zipFileSystem";
import { showCalculator } from "./features/calculator";
import { initErrorLens } from "./features/errorLens";

// Коллекция диагностики KRL
const krlDiagnostics = vscode.languages.createDiagnosticCollection("krl");
let lsClient: LanguageClient;

/**
 * Точка входа в расширение.
 * Активируется при открытии файлов .src, .dat, .sub или при запуске команд.
 */
export function activate(context: vscode.ExtensionContext) {
  // Инициализация Error Lens (отображение ошибок в строке)
  initErrorLens(context);

  // Определение пути к серверу
  const serverPath = context.asAbsolutePath(
    path.join("server", "out", "core.js"),
  );

  // Опции отладки сервера
  const debugOptions = { execArgv: ["--nolazy", "--inspect=6009"] };
  const serverOptions: ServerOptions = {
    run: { module: serverPath, transport: TransportKind.stdio },
    debug: {
      module: serverPath,
      transport: TransportKind.stdio,
      options: debugOptions,
    },
  };

  // Настройка правил отступов для KRL
  vscode.languages.setLanguageConfiguration("krl", {
    indentationRules: {
      decreaseIndentPattern:
        /^\s*(ENDFOR|ELSE|ENDIF|ENDLOOP|UNTIL.*|ENDWHILE|ENDSWITCH|CASE.*|DEFAULT.*)(\s*;.*)?$/i,
      increaseIndentPattern:
        /^\s*(FOR.*|IF.*|ELSE|LOOP|REPEAT|WHILE.*|SWITCH.*|CASE.*|DEFAULT.*)(\s*;.*)?$/i,
    },
  });

  /**
   * Отправляет настройки расширения на сервер.
   */
  function sendSettingsToServer() {
    if (lsClient.state === State.Running) {
      const config = vscode.workspace.getConfiguration("krl");
      lsClient.sendNotification("custom/updateSettings", {
        validateNonAscii: config.get<boolean>("validateNonAscii", true),
        separateBeforeBlocks: config.get<boolean>(
          "separateBeforeBlocks",
          false,
        ),
        separateAfterBlocks: config.get<boolean>("separateAfterBlocks", false),
      });
    }
  }

  // Слушаем изменения конфигурации
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("krl")) {
        sendSettingsToServer();
      }
    }),
  );

  // Конфигурация клиента
  const clientConfig: LanguageClientOptions = {
    documentSelector: [{ scheme: "file", language: "krl" }],
    synchronize: {
      fileEvents:
        vscode.workspace.createFileSystemWatcher("**/*.{dat,src,sub}"),
    },
  };

  // Создание клиента языка
  lsClient = new LanguageClient(
    "krlContext",
    "KRL Language Support",
    serverOptions,
    clientConfig,
  );

  // =====================
  // Регистрация команд
  // =====================

  // Команда проверки всего рабочего пространства
  context.subscriptions.push(
    vscode.commands.registerCommand("krl.validateWorkspace", () => {
      if (lsClient.state === State.Running) {
        lsClient.sendNotification("custom/validateWorkspace");
        vscode.window.showInformationMessage(t("info.checkingAllFiles"));
      } else {
        vscode.window.showErrorMessage(t("error.serverNotRunning"));
      }
    }),
  );

  // Команды сворачивания кода
  context.subscriptions.push(
    vscode.commands.registerCommand("krl.foldAll", () =>
      vscode.commands.executeCommand("editor.foldAll"),
    ),
    vscode.commands.registerCommand("krl.unfoldAll", () =>
      vscode.commands.executeCommand("editor.unfoldAll"),
    ),
  );

  // Команда форматирования документа
  context.subscriptions.push(
    vscode.commands.registerCommand("krl.formatDocument", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== "krl") {
        vscode.window.showWarningMessage(t("warning.noActiveKrlFile"));
        return;
      }
      await vscode.commands.executeCommand("editor.action.formatDocument");
      vscode.window.showInformationMessage(t("info.documentFormatted"));
    }),
  );

  // Команда удаления пробелов в конце строк
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "krl.removeTrailingWhitespace",
      async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== "krl") {
          vscode.window.showWarningMessage(t("warning.noActiveKrlFile"));
          return;
        }

        const document = editor.document;
        const edits: vscode.TextEdit[] = [];

        for (let i = 0; i < document.lineCount; i++) {
          const line = document.lineAt(i);
          const trimmedLength = line.text.trimEnd().length;
          if (trimmedLength < line.text.length) {
            edits.push(
              vscode.TextEdit.delete(
                new vscode.Range(i, trimmedLength, i, line.text.length),
              ),
            );
          }
        }

        if (edits.length > 0) {
          const edit = new vscode.WorkspaceEdit();
          edit.set(document.uri, edits);
          await vscode.workspace.applyEdit(edit);
          vscode.window.showInformationMessage(
            t("info.trailingWhitespaceRemoved", edits.length),
          );
        } else {
          vscode.window.showInformationMessage(t("info.noTrailingWhitespace"));
        }
      },
    ),
  );

  // Генератор документации
  const docGenerator = new DocGenerator();
  context.subscriptions.push(
    vscode.commands.registerCommand("krl.generateDocumentation", () => {
      docGenerator.generateDocumentation();
    }),
  );

  // =====================
  // Деревья просмотра (Tree Views)
  // =====================

  // I/O Signals Tree View
  const ioTreeProvider = new IOTreeProvider();
  vscode.window.registerTreeDataProvider("krlIO", ioTreeProvider);
  context.subscriptions.push(
    vscode.commands.registerCommand("krl.refreshIOView", () => {
      ioTreeProvider.refresh();
    }),
  );

  // KRC Project Tree View
  const krcTreeProvider = new KRCTreeProvider();
  vscode.window.registerTreeDataProvider("krlKRC", krcTreeProvider);
  context.subscriptions.push(
    vscode.commands.registerCommand("krl.refreshKRCView", () => {
      krcTreeProvider.refresh();
    }),
  );

  // Команда поиска системных переменных
  context.subscriptions.push(
    vscode.commands.registerCommand("krl.findSystemVariables", () => {
      showSystemVariablesPicker();
    }),
  );

  // Команда сортировки объявлений переменных
  context.subscriptions.push(
    vscode.commands.registerCommand("krl.sortDeclarations", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== "krl") {
        vscode.window.showWarningMessage(t("warning.noActiveKrlFile"));
        return;
      }

      const document = editor.document;
      const text = document.getText();
      const lines = text.split(/\r?\n/);

      // Поиск блока DEFDAT
      let defdatStart = -1;
      let defdatEnd = -1;
      const declarations: { type: string; line: string; index: number }[] = [];

      for (let i = 0; i < lines.length; i++) {
        if (/^\s*DEFDAT\b/i.test(lines[i])) {
          defdatStart = i;
        } else if (/^\s*ENDDAT\b/i.test(lines[i])) {
          defdatEnd = i;
          break;
        } else if (defdatStart !== -1 && defdatEnd === -1) {
          // Сбор строк DECL
          const match = lines[i].match(
            /^\s*(?:GLOBAL\s+)?(?:DECL\s+)?(?:GLOBAL\s+)?(\w+)\s+/i,
          );
          if (match) {
            declarations.push({
              type: match[1].toUpperCase(),
              line: lines[i],
              index: i,
            });
          }
        }
      }

      if (declarations.length === 0) {
        vscode.window.showInformationMessage(t("info.noDeclarationsToSort"));
        return;
      }

      // Сортировка по типу
      const typeOrder = [
        "INT",
        "REAL",
        "BOOL",
        "CHAR",
        "STRING",
        "FRAME",
        "POS",
        "E6POS",
        "AXIS",
        "E6AXIS",
        "LOAD",
      ];
      declarations.sort((a, b) => {
        const orderA = typeOrder.indexOf(a.type);
        const orderB = typeOrder.indexOf(b.type);
        const priorityA = orderA === -1 ? 999 : orderA;
        const priorityB = orderB === -1 ? 999 : orderB;
        if (priorityA !== priorityB) return priorityA - priorityB;
        return a.line.localeCompare(b.line);
      });

      // Применение сортировки
      const sortedLines = declarations.map((d) => d.line);
      const originalIndices = declarations
        .map((d) => d.index)
        .sort((a, b) => a - b);

      const edit = new vscode.WorkspaceEdit();
      for (let i = 0; i < originalIndices.length; i++) {
        const lineNum = originalIndices[i];
        const range = new vscode.Range(
          lineNum,
          0,
          lineNum,
          lines[lineNum].length,
        );
        edit.replace(document.uri, range, sortedLines[i]);
      }

      await vscode.workspace.applyEdit(edit);
      vscode.window.showInformationMessage(
        t("info.declarationsSorted", declarations.length),
      );
    }),
  );

  // Команда очистки неиспользуемых переменных
  context.subscriptions.push(
    vscode.commands.registerCommand("krl.cleanupUnusedVariables", () => {
      cleanupUnusedVariables();
    }),
  );

  // Команда деплоя (FTP)
  context.subscriptions.push(
    vscode.commands.registerCommand("krl.deploy", () => {
      deployToRobot();
    }),
  );

  // Поддержка ZIP архивов (просмотр)
  context.subscriptions.push(
    vscode.workspace.registerFileSystemProvider(
      "kuka-zip",
      new ZipFileSystemProvider(),
      { isCaseSensitive: true, isReadonly: true },
    ),
    vscode.commands.registerCommand("krl.openArchive", async () => {
      const uris = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        filters: { "KUKA Archives": ["zip"] },
      });
      if (uris && uris.length > 0) {
        const zipUri = uris[0];
        const zipPath = zipUri.fsPath.replace(/\\/g, "/");
        // Конструкция URI: kuka-zip:///path/to/zip/::/
        const cleanPath = zipPath.startsWith("/") ? zipPath : "/" + zipPath;
        const rootUri = vscode.Uri.parse(`kuka-zip://${cleanPath}/::/`);

        vscode.workspace.updateWorkspaceFolders(
          vscode.workspace.workspaceFolders
            ? vscode.workspace.workspaceFolders.length
            : 0,
          0,
          { uri: rootUri, name: path.basename(zipPath) },
        );
      }
    }),
    vscode.commands.registerCommand("krl.showCalculator", () => {
      showCalculator(context);
    }),
  );

  // Команда вставки региона FOLD
  context.subscriptions.push(
    vscode.commands.registerCommand("krl.insertFold", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== "krl") {
        vscode.window.showWarningMessage(t("warning.noActiveKrlFile"));
        return;
      }

      const name = await vscode.window.showInputBox({
        prompt: t("prompt.foldRegionName"),
        placeHolder: t("prompt.foldRegionPlaceholder"),
      });

      if (!name) return;

      const selection = editor.selection;
      const selectedText = editor.document.getText(selection);
      const indent =
        editor.document.lineAt(selection.start.line).text.match(/^\s*/)?.[0] ||
        "";

      const foldText = selectedText
        ? `${indent};FOLD ${name}\n${selectedText}\n${indent};ENDFOLD\n`
        : `${indent};FOLD ${name}\n${indent}\n${indent};ENDFOLD\n`;

      await editor.edit((editBuilder) => {
        if (selectedText) {
          editBuilder.replace(selection, foldText);
        } else {
          editBuilder.insert(selection.active, foldText);
        }
      });
    }),
  );

  // =====================
  // Автоматические действия
  // =====================

  // Обработчик автоматического сворачивания
  const handleAutoFold = () => {
    const config = vscode.workspace.getConfiguration("krl");
    if (config.get<boolean>("autoFold", true)) {
      setTimeout(() => {
        vscode.commands.executeCommand("editor.foldAll");
      }, 500);
    }
  };

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((doc) => {
      if (doc.languageId === "krl") {
        runSyntaxCheck(doc);
        handleAutoFold();
      }
    }),
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.languageId === "krl") {
        runSyntaxCheck(e.document);
        if (lsClient.state === State.Running) {
          lsClient.sendNotification("custom/validateFile", {
            uri: e.document.uri.toString(),
            text: e.document.getText(),
          });
        }
      }
    }),
  );

  // Действия перед сохранением
  context.subscriptions.push(
    vscode.workspace.onWillSaveTextDocument((e) => {
      if (e.document.languageId !== "krl") return;

      const config = vscode.workspace.getConfiguration("krl");

      // Автоматическое удаление пробелов в конце
      if (config.get<boolean>("removeTrailingWhitespaceOnFormat", true)) {
        const edits: vscode.TextEdit[] = [];
        for (let i = 0; i < e.document.lineCount; i++) {
          const line = e.document.lineAt(i);
          const trimmedLength = line.text.trimEnd().length;
          if (trimmedLength < line.text.length) {
            edits.push(
              vscode.TextEdit.delete(
                new vscode.Range(i, trimmedLength, i, line.text.length),
              ),
            );
          }
        }
        if (edits.length > 0) {
          e.waitUntil(Promise.resolve(edits));
        }
      }
    }),
  );

  // Запуск клиента
  lsClient.start().then(() => {
    // Отправляем локаль на сервер
    lsClient.sendNotification("custom/setLocale", vscode.env.language);

    // Отправляем настройки на сервер после запуска
    sendSettingsToServer();

    vscode.workspace.textDocuments.forEach((doc) => {
      if (doc.languageId === "krl") {
        runSyntaxCheck(doc);
      }
    });
  });

  context.subscriptions.push(krlDiagnostics);
}

/**
 * Деактивация расширения.
 */
export function deactivate(): Thenable<void> | undefined {
  krlDiagnostics.clear();
  krlDiagnostics.dispose();
  if (!lsClient) {
    return undefined;
  }
  return lsClient.stop();
}

/**
 * Легкая проверка синтаксиса на стороне клиента.
 * В основном дублируется сервером, но может быть полезно для быстрого отклика.
 */
function runSyntaxCheck(document: vscode.TextDocument): void {
  const issues: vscode.Diagnostic[] = [];

  for (let i = 0; i < document.lineCount; i++) {
    const line = document.lineAt(i);
    const text = line.text.split(";")[0].trim();

    if (!text) continue;

    // Проверка использования GLOBAL
    if (/\bGLOBAL\b/i.test(text)) {
      const validContext =
        /\b(DECL|DEF|DEFFCT|STRUC|SIGNAL|ENUM)\b/i.test(text) ||
        /\b(INT|REAL|FRAME|CHAR|BOOL|STRING|E6AXIS|E6POS|AXIS|LOAD|POS)\b/i.test(
          text,
        );
      if (!validContext) {
        const idx = line.text.toUpperCase().indexOf("GLOBAL");
        issues.push(
          new vscode.Diagnostic(
            new vscode.Range(i, idx, i, idx + 6),
            t("warning.invalidGlobalUsage"),
            vscode.DiagnosticSeverity.Warning,
          ),
        );
      }
    }
  }

  krlDiagnostics.set(document.uri, issues);
}
