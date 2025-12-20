import * as vscode from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
  State,
} from 'vscode-languageclient/node';
import * as path from 'path';
import { t } from './i18n';
import { DocGenerator } from './docGenerator';
import { IOTreeProvider } from './ioTreeView';
import { KRCTreeProvider } from './krcTreeView';
import { showSystemVariablesPicker } from './systemVarFinder';

// KRL tanılama koleksiyonu
const krlDiagnostics = vscode.languages.createDiagnosticCollection('krl');
let lsClient: LanguageClient;

export function activate(context: vscode.ExtensionContext) {
  // Sunucu yolunu belirle
  const serverPath = context.asAbsolutePath(path.join('server', 'out', 'core.js'));

  const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };
  const serverOptions: ServerOptions = {
    run: { module: serverPath, transport: TransportKind.stdio },
    debug: { module: serverPath, transport: TransportKind.stdio, options: debugOptions },
  };

  // KRL için girinti kuralları
  vscode.languages.setLanguageConfiguration('krl', {
    indentationRules: {
      decreaseIndentPattern: /^\s*(ENDFOR|ELSE|ENDIF|ENDLOOP|UNTIL.*|ENDWHILE|ENDSWITCH|CASE.*|DEFAULT.*)(\s*;.*)?$/i,
      increaseIndentPattern: /^\s*(FOR.*|IF.*|ELSE|LOOP|REPEAT|WHILE.*|SWITCH.*|CASE.*|DEFAULT.*)(\s*;.*)?$/i,
    },
  });

  /**
   * Отправляет настройки на сервер.
   */
  function sendSettingsToServer() {
    if (lsClient.state === State.Running) {
      const config = vscode.workspace.getConfiguration('krl');
      lsClient.sendNotification('custom/updateSettings', {
        validateNonAscii: config.get<boolean>('validateNonAscii', true),
        separateBeforeBlocks: config.get<boolean>('separateBeforeBlocks', false),
        separateAfterBlocks: config.get<boolean>('separateAfterBlocks', false),
      });
    }
  }

  // Слушаем изменения конфигурации
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('krl')) {
        sendSettingsToServer();
      }
    })
  );

  const clientConfig: LanguageClientOptions = {
    documentSelector: [{ scheme: 'file', language: 'krl' }],
    synchronize: {
      fileEvents: vscode.workspace.createFileSystemWatcher('**/*.{dat,src,sub}'),
    },
  };

  lsClient = new LanguageClient('krlContext', 'KRL Language Support', serverOptions, clientConfig);

  // =====================
  // Komut Kayıtları
  // =====================

  // Çalışma alanını doğrulama komutu
  context.subscriptions.push(
    vscode.commands.registerCommand('krl.validateWorkspace', () => {
      if (lsClient.state === State.Running) {
        lsClient.sendNotification('custom/validateWorkspace');
        vscode.window.showInformationMessage(t('info.checkingAllFiles'));
      } else {
        vscode.window.showErrorMessage(t('error.serverNotRunning'));
      }
    })
  );

  // Katlama komutları
  context.subscriptions.push(
    vscode.commands.registerCommand('krl.foldAll', () => vscode.commands.executeCommand('editor.foldAll')),
    vscode.commands.registerCommand('krl.unfoldAll', () => vscode.commands.executeCommand('editor.unfoldAll'))
  );

  // Belgeyi biçimlendir komutu
  context.subscriptions.push(
    vscode.commands.registerCommand('krl.formatDocument', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== 'krl') {
        vscode.window.showWarningMessage(t('warning.noActiveKrlFile'));
        return;
      }
      await vscode.commands.executeCommand('editor.action.formatDocument');
      vscode.window.showInformationMessage(t('info.documentFormatted'));
    })
  );

  // Sondaki boşlukları kaldır komutu
  context.subscriptions.push(
    vscode.commands.registerCommand('krl.removeTrailingWhitespace', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== 'krl') {
        vscode.window.showWarningMessage(t('warning.noActiveKrlFile'));
        return;
      }

      const document = editor.document;
      const edits: vscode.TextEdit[] = [];

      for (let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i);
        const trimmedLength = line.text.trimEnd().length;
        if (trimmedLength < line.text.length) {
          edits.push(vscode.TextEdit.delete(
            new vscode.Range(i, trimmedLength, i, line.text.length)
          ));
        }
      }

      if (edits.length > 0) {
        const edit = new vscode.WorkspaceEdit();
        edit.set(document.uri, edits);
        await vscode.workspace.applyEdit(edit);
        vscode.window.showInformationMessage(t('info.trailingWhitespaceRemoved', edits.length));
      } else {
        vscode.window.showInformationMessage(t('info.noTrailingWhitespace'));
      }
    })
  );

  // Документация генератор
  const docGenerator = new DocGenerator();
  context.subscriptions.push(
    vscode.commands.registerCommand('krl.generateDocumentation', () => {
      docGenerator.generateDocumentation();
    })
  );

  // =====================
  // Tree Views
  // =====================

  // I/O Tree View
  const ioTreeProvider = new IOTreeProvider();
  vscode.window.registerTreeDataProvider('krlIO', ioTreeProvider);
  context.subscriptions.push(
    vscode.commands.registerCommand('krl.refreshIOView', () => {
      ioTreeProvider.refresh();
    })
  );

  // KRC Project Tree View
  const krcTreeProvider = new KRCTreeProvider();
  vscode.window.registerTreeDataProvider('krlKRC', krcTreeProvider);
  context.subscriptions.push(
    vscode.commands.registerCommand('krl.refreshKRCView', () => {
      krcTreeProvider.refresh();
    })
  );

  // Find System Variables command
  context.subscriptions.push(
    vscode.commands.registerCommand('krl.findSystemVariables', () => {
      showSystemVariablesPicker();
    })
  );

  // Bildirimleri sırala komutu
  context.subscriptions.push(
    vscode.commands.registerCommand('krl.sortDeclarations', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== 'krl') {
        vscode.window.showWarningMessage(t('warning.noActiveKrlFile'));
        return;
      }

      const document = editor.document;
      const text = document.getText();
      const lines = text.split(/\r?\n/);

      // DEFDAT bloğunu bul
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
          // DECL satırlarını topla
          const match = lines[i].match(/^\s*(?:GLOBAL\s+)?(?:DECL\s+)?(?:GLOBAL\s+)?(\w+)\s+/i);
          if (match) {
            declarations.push({ type: match[1].toUpperCase(), line: lines[i], index: i });
          }
        }
      }

      if (declarations.length === 0) {
        vscode.window.showInformationMessage(t('info.noDeclarationsToSort'));
        return;
      }

      // Tür önceliğine göre sırala
      const typeOrder = ['INT', 'REAL', 'BOOL', 'CHAR', 'STRING', 'FRAME', 'POS', 'E6POS', 'AXIS', 'E6AXIS', 'LOAD'];
      declarations.sort((a, b) => {
        const orderA = typeOrder.indexOf(a.type);
        const orderB = typeOrder.indexOf(b.type);
        const priorityA = orderA === -1 ? 999 : orderA;
        const priorityB = orderB === -1 ? 999 : orderB;
        if (priorityA !== priorityB) return priorityA - priorityB;
        return a.line.localeCompare(b.line);
      });

      // Sıralanmış satırları uygula
      const sortedLines = declarations.map(d => d.line);
      const originalIndices = declarations.map(d => d.index).sort((a, b) => a - b);

      const edit = new vscode.WorkspaceEdit();
      for (let i = 0; i < originalIndices.length; i++) {
        const lineNum = originalIndices[i];
        const range = new vscode.Range(lineNum, 0, lineNum, lines[lineNum].length);
        edit.replace(document.uri, range, sortedLines[i]);
      }

      await vscode.workspace.applyEdit(edit);
      vscode.window.showInformationMessage(t('info.declarationsSorted', declarations.length));
    })
  );

  // FOLD bölgesi ekle komutu
  context.subscriptions.push(
    vscode.commands.registerCommand('krl.insertFold', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== 'krl') {
        vscode.window.showWarningMessage(t('warning.noActiveKrlFile'));
        return;
      }

      const name = await vscode.window.showInputBox({
        prompt: t('prompt.foldRegionName'),
        placeHolder: t('prompt.foldRegionPlaceholder'),
      });

      if (!name) return;

      const selection = editor.selection;
      const selectedText = editor.document.getText(selection);
      const indent = editor.document.lineAt(selection.start.line).text.match(/^\s*/)?.[0] || '';

      const foldText = selectedText
        ? `${indent};FOLD ${name}\n${selectedText}\n${indent};ENDFOLD\n`
        : `${indent};FOLD ${name}\n${indent}\n${indent};ENDFOLD\n`;

      await editor.edit(editBuilder => {
        if (selectedText) {
          editBuilder.replace(selection, foldText);
        } else {
          editBuilder.insert(selection.active, foldText);
        }
      });
    })
  );

  // =====================
  // Otomatik İşlemler
  // =====================

  // Otomatik katlama işleyicisi
  const handleAutoFold = () => {
    const config = vscode.workspace.getConfiguration('krl');
    if (config.get<boolean>('autoFold', true)) {
      setTimeout(() => {
        vscode.commands.executeCommand('editor.foldAll');
      }, 500);
    }
  };

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((doc) => {
      if (doc.languageId === 'krl') {
        runSyntaxCheck(doc);
        handleAutoFold();
      }
    }),
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.languageId === 'krl') {
        runSyntaxCheck(e.document);
        if (lsClient.state === State.Running) {
          lsClient.sendNotification('custom/validateFile', {
            uri: e.document.uri.toString(),
            text: e.document.getText(),
          });
        }
      }
    }),
  );

  // Kaydetme öncesi işlemler
  context.subscriptions.push(
    vscode.workspace.onWillSaveTextDocument((e) => {
      if (e.document.languageId !== 'krl') return;

      const config = vscode.workspace.getConfiguration('krl');

      // Sondaki boşlukları otomatik kaldır
      if (config.get<boolean>('removeTrailingWhitespaceOnFormat', true)) {
        const edits: vscode.TextEdit[] = [];
        for (let i = 0; i < e.document.lineCount; i++) {
          const line = e.document.lineAt(i);
          const trimmedLength = line.text.trimEnd().length;
          if (trimmedLength < line.text.length) {
            edits.push(vscode.TextEdit.delete(
              new vscode.Range(i, trimmedLength, i, line.text.length)
            ));
          }
        }
        if (edits.length > 0) {
          e.waitUntil(Promise.resolve(edits));
        }
      }
    }),
  );

  lsClient.start().then(() => {
    // Отправляем локаль на сервер
    lsClient.sendNotification('custom/setLocale', vscode.env.language);

    // Отправляем настройки на сервер после запуска
    sendSettingsToServer();

    vscode.workspace.textDocuments.forEach((doc) => {
      if (doc.languageId === 'krl') {
        runSyntaxCheck(doc);
      }
    });
  });

  context.subscriptions.push(krlDiagnostics);
}

export function deactivate(): Thenable<void> | undefined {
  krlDiagnostics.clear();
  krlDiagnostics.dispose();
  if (!lsClient) {
    return undefined;
  }
  return lsClient.stop();
}

/**
 * İstemci tarafında hafif sözdizimi kontrolü.
 */
function runSyntaxCheck(document: vscode.TextDocument): void {
  const issues: vscode.Diagnostic[] = [];

  for (let i = 0; i < document.lineCount; i++) {
    const line = document.lineAt(i);
    const text = line.text.split(';')[0].trim();

    if (!text) continue;

    // GLOBAL kullanımını kontrol et
    if (/\bGLOBAL\b/i.test(text)) {
      const validContext = /\b(DECL|DEF|DEFFCT|STRUC|SIGNAL|ENUM)\b/i.test(text) ||
        /\b(INT|REAL|FRAME|CHAR|BOOL|STRING|E6AXIS|E6POS|AXIS|LOAD|POS)\b/i.test(text);
      if (!validContext) {
        const idx = line.text.toUpperCase().indexOf('GLOBAL');
        issues.push(new vscode.Diagnostic(
          new vscode.Range(i, idx, i, idx + 6),
          t('warning.invalidGlobalUsage'),
          vscode.DiagnosticSeverity.Warning
        ));
      }
    }
  }

  krlDiagnostics.set(document.uri, issues);
}
