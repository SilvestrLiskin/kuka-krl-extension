import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  InitializeResult,
  TextDocumentSyncKind,
  DefinitionParams,
  CompletionParams,
  HoverParams,
  FoldingRangeParams,
  DocumentSymbolParams,
  WorkspaceSymbolParams,
  RenameParams,
  PrepareRenameParams,
  ReferenceParams,
  SignatureHelpParams,
  CodeActionParams,
  CodeLensParams,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { URI } from "vscode-uri";
import { ServerState, VariableInfo } from "./types";
import { SymbolResolver } from "./features/definition";
import { AutoCompleter } from "./features/completion";
import { DiagnosticsProvider } from "./features/diagnostics";
import { InfoProvider } from "./features/hover";
import { RegionProvider } from "./features/regions";
import { KrlFormatter, setFormattingSettings } from "./features/formatter";
import { DocumentSymbolsProvider } from "./features/symbols";
import { WorkspaceSymbolsProvider } from "./features/workspaceSymbols";
import { RenameProvider } from "./features/rename";
import { ReferencesProvider } from "./features/references";
import { SignatureHelpProvider } from "./features/signatureHelp";
import { CodeActionsProvider } from "./features/codeActions";
import { CodeLensProvider } from "./features/codeLens";
import { CallHierarchyProvider } from "./features/callHierarchy";
import { SymbolExtractor, extractStrucVariables } from "./lib/collector";
import { getAllDatFiles, getAllSourceFiles } from "./lib/fileSystem";
import { setLocale } from "./lib/i18n";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// DEBUG LOG - Файл лога для отладки
// Логирует только если установлена переменная окружения
const DEBUG_ENABLED = process.env.KRL_DEBUG === "true";
const logFile = DEBUG_ENABLED
  ? path.join(os.tmpdir(), "krl-server-debug.log")
  : "";

function log(msg: string) {
  if (!DEBUG_ENABLED) return;
  try {
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
  } catch {
    // Игнорируем ошибки записи лога
  }
}

// Запуск сервера
log(`Запуск сервера. Node: ${process.version}, PID: ${process.pid}`);

// Перехват исключений
process.on("uncaughtException", (err) => {
  log("Неперехваченная ошибка: " + err.toString() + "\n" + (err.stack || ""));
  process.exit(1);
});
process.on("unhandledRejection", (err) => {
  log("Необработанный отказ: " + (err instanceof Error ? err.stack : err));
});

// Создание соединения
const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

// Глобальное состояние
const state: ServerState = {
  workspaceRoot: null,
  fileVariablesMap: new Map(),
  variableStructTypes: {},
  structDefinitions: {},
  functionsDeclared: [],
  mergedVariables: [],
};

// Конфигурация (получаемая от клиента)
let serverConfig = {
  validateNonAscii: true,
  separateBeforeBlocks: false,
  separateAfterBlocks: false,
};

// Механизм debounce для валидации документов
// Предотвращает ложные срабатывания при быстром вводе
const validationTimeouts = new Map<string, NodeJS.Timeout>();
const VALIDATION_DELAY_MS = 750;

// Флаг инициализации рабочего пространства
// Пока не загружено, ошибки "переменная не определена" не показываются
let workspaceInitialized = false;

function scheduleValidation(uri: string, validationFn: () => void) {
  // Отменяем предыдущий таймаут
  const existingTimeout = validationTimeouts.get(uri);
  if (existingTimeout) {
    clearTimeout(existingTimeout);
  }
  // Планируем новый
  const timeout = setTimeout(() => {
    validationTimeouts.delete(uri);
    validationFn();
  }, VALIDATION_DELAY_MS);
  validationTimeouts.set(uri, timeout);
}

// Инициализация провайдеров функций
const definitions = new SymbolResolver();
const completions = new AutoCompleter();
const hoverInfo = new InfoProvider();
const regions = new RegionProvider();
const formatter = new KrlFormatter();
const documentSymbols = new DocumentSymbolsProvider();
const workspaceSymbols = new WorkspaceSymbolsProvider();
const renameProvider = new RenameProvider();
const referencesProvider = new ReferencesProvider();
const signatureHelp = new SignatureHelpProvider();
const codeActions = new CodeActionsProvider();
const codeLens = new CodeLensProvider();
const callHierarchy = new CallHierarchyProvider();
const diagnostics = new DiagnosticsProvider(connection);

// =======================
// Обработчики инициализации
// =======================

connection.onInitialize((params: InitializeParams): InitializeResult => {
  log(`[Инициализация] Root URI: ${params.rootUri}`);
  state.workspaceRoot = params.rootUri
    ? URI.parse(params.rootUri).fsPath
    : null;
  log(`[Инициализация] Рабочая директория: ${state.workspaceRoot}`);
  diagnostics.setWorkspaceRoot(state.workspaceRoot);

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      definitionProvider: true,
      hoverProvider: true,
      foldingRangeProvider: true,
      documentFormattingProvider: true,
      documentSymbolProvider: true,
      workspaceSymbolProvider: true,
      renameProvider: {
        prepareProvider: true,
      },
      referencesProvider: true,
      signatureHelpProvider: {
        triggerCharacters: ["(", ","],
        retriggerCharacters: [","],
      },
      codeActionProvider: {
        codeActionKinds: ["quickfix", "refactor.extract"],
      },
      completionProvider: {
        triggerCharacters: [
          ".",
          "(",
          ",",
          " ",
          "=",
          "+",
          "-",
          "*",
          "/",
          "<",
          ">",
          "!",
          ..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_",
        ],
      },
      codeLensProvider: {
        resolveProvider: true,
      },
      callHierarchyProvider: true,
    },
  };
});

// Получение настроек конфигурации от клиента
connection.onNotification(
  "custom/updateSettings",
  (settings: typeof serverConfig) => {
    serverConfig = { ...serverConfig, ...settings };
    setFormattingSettings({
      separateBeforeBlocks: serverConfig.separateBeforeBlocks,
      separateAfterBlocks: serverConfig.separateAfterBlocks,
    });
    log(`[Настройки] Обновлены: ${JSON.stringify(serverConfig)}`);
  },
);

// Получение локали от клиента
connection.onNotification("custom/setLocale", (locale: string) => {
  setLocale(locale);
  log(`[Локаль] Установлена: ${locale}`);
});

connection.onInitialized(async () => {
  if (!state.workspaceRoot) return;

  // Загрузка переменных из .dat файлов
  const datFiles = await getAllDatFiles(state.workspaceRoot);
  for (const filePath of datFiles) {
    try {
      const content = await fs.promises.readFile(filePath, "utf8");
      const uri = URI.file(filePath).toString();

      const extractor = new SymbolExtractor();
      extractor.extractFromText(content);
      state.fileVariablesMap.set(uri, extractor.getVariables());

      // Обновление определений структур
      const structs = extractStrucVariables(content);
      Object.assign(state.structDefinitions, structs);
    } catch (err) {
      connection.console.error(`Ошибка чтения файла ${filePath}: ${err}`);
    }
  }

  // Загрузка функций из .src и .sub файлов
  await extractFunctionsFromWorkspace(state.workspaceRoot);

  state.mergedVariables = mergeAllVariables(state.fileVariablesMap);

  // Обновление кэша функций
  diagnostics.updateFunctionCache(state.functionsDeclared.map((f) => f.name));

  // Workspace полностью инициализирован
  workspaceInitialized = true;

  log(
    `[Инициализация] Загружено ${state.functionsDeclared.length} функций и ${state.mergedVariables.length} переменных.`,
  );
});

/**
 * Извлекает определения функций из всех исходных файлов рабочего пространства.
 */
async function extractFunctionsFromWorkspace(
  workspaceRoot: string,
): Promise<void> {
  const sourceFiles = await getAllSourceFiles(workspaceRoot);
  const defRegex =
    /^\s*(?:GLOBAL\s+)?(DEF|DEFFCT)\s+(?:\w+\s+)?(\w+)\s*\(([^)]*)\)/gim;

  for (const filePath of sourceFiles) {
    try {
      const content = await fs.promises.readFile(filePath, "utf8");
      const uri = URI.file(filePath).toString();
      const lines = content.split(/\r?\n/);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let match;
        defRegex.lastIndex = 0;

        while ((match = defRegex.exec(line)) !== null) {
          const funcName = match[2];
          const params = match[3] ? match[3].trim() : "";
          const startChar = line.indexOf(funcName);

          // Проверка на дубликаты
          if (
            !state.functionsDeclared.some(
              (f) => f.name.toUpperCase() === funcName.toUpperCase(),
            )
          ) {
            state.functionsDeclared.push({
              uri,
              line: i,
              startChar,
              endChar: startChar + funcName.length,
              params,
              name: funcName,
            });
          }
        }
      }
    } catch (err) {
      log(`Ошибка извлечения функций из ${filePath}: ${err}`);
    }
  }
}

// ==========================
// Обработка изменений документа
// ==========================

documents.onDidChangeContent(async (change) => {
  const { document } = change;

  // Неявное определение корня, если не задан
  if (!state.workspaceRoot) {
    let currentDir = path.dirname(URI.parse(document.uri).fsPath);
    // Ищем вверх по дереву папки KRC или R1
    while (currentDir.length > 1) {
      if (
        fs.existsSync(path.join(currentDir, "KRC")) ||
        fs.existsSync(path.join(currentDir, "R1")) ||
        path.basename(currentDir).toUpperCase() === "KRC"
      ) {
        break;
      }
      const parent = path.dirname(currentDir);
      if (parent === currentDir) break; // Достигнут корень диска
      currentDir = parent;
    }
    state.workspaceRoot = currentDir;
    log(`[НеявныйКорень] Определен корень: ${state.workspaceRoot}`);
    diagnostics.setWorkspaceRoot(state.workspaceRoot);

    // Первичное сканирование (так как onInitialized был пропущен/не сработал корректно без корня)
    const datFiles = await getAllDatFiles(state.workspaceRoot);
    for (const filePath of datFiles) {
      try {
        const content = await fs.promises.readFile(filePath, "utf8");
        const uri = URI.file(filePath).toString();
        const extractor = new SymbolExtractor();
        extractor.extractFromText(content);
        state.fileVariablesMap.set(uri, extractor.getVariables());

        const structs = extractStrucVariables(content);
        Object.assign(state.structDefinitions, structs);
      } catch (err) {
        log(`Ошибка чтения файла ${filePath}: ${err}`);
      }
    }

    await extractFunctionsFromWorkspace(state.workspaceRoot);
    state.mergedVariables = mergeAllVariables(state.fileVariablesMap);
    diagnostics.updateFunctionCache(state.functionsDeclared.map((f) => f.name));
    workspaceInitialized = true;
  }

  if (document.uri.endsWith(".dat")) {
    diagnostics.validateDatFile(document);

    // Обновление структур
    const structs = extractStrucVariables(document.getText());
    Object.assign(state.structDefinitions, structs);
  }

  // Обновление переменных
  const extractor = new SymbolExtractor();
  extractor.extractFromText(document.getText());
  state.fileVariablesMap.set(document.uri, extractor.getVariables());

  state.mergedVariables = mergeAllVariables(state.fileVariablesMap);

  // Обновление функций из текущего документа
  updateFunctionsFromDocument(document);

  // Обновление кэша
  diagnostics.updateFunctionCache(state.functionsDeclared.map((f) => f.name));

  // Планирование валидации с задержкой
  const docUri = document.uri;
  const docVersion = document.version;

  scheduleValidation(docUri, () => {
    const currentDoc = documents.get(docUri);
    // Если документ закрыт или версия изменилась — пропускаем
    if (!currentDoc || currentDoc.version !== docVersion) {
      return;
    }

    let allDiagnostics: import("vscode-languageserver/node").Diagnostic[] = [];

    state.mergedVariables = mergeAllVariables(state.fileVariablesMap);

    // Валидация использования переменных (только если workspace загружен)
    if (workspaceInitialized) {
      const varDiags = diagnostics.validateVariablesUsage(
        currentDoc,
        state.mergedVariables,
      );
      allDiagnostics.push(...varDiags);
    }

    // Дополнительные проверки для SRC файлов
    if (currentDoc.uri.toLowerCase().endsWith(".src")) {
      allDiagnostics.push(
        ...diagnostics.validateSafetySpeeds(currentDoc),
        ...diagnostics.validateToolBaseInit(currentDoc),
        ...diagnostics.validateBlockBalance(currentDoc),
        ...diagnostics.validateDuplicateNames(currentDoc),
        ...diagnostics.validateDeadCode(currentDoc),
        ...diagnostics.validateEmptyBlocks(currentDoc),
        ...diagnostics.validateDangerousStatements(currentDoc),
        ...diagnostics.validateTypeUsage(currentDoc, state.mergedVariables),
      );
    }

    connection.sendDiagnostics({
      uri: currentDoc.uri,
      diagnostics: allDiagnostics,
    });
  });
});

/**
 * Обновляет определения функций из одного документа.
 */
function updateFunctionsFromDocument(document: TextDocument): void {
  const uri = document.uri;
  const content = document.getText();
  const lines = content.split(/\r?\n/);
  const defRegex =
    /^\s*(?:GLOBAL\s+)?(DEF|DEFFCT)\s+(?:\w+\s+)?(\w+)\s*\(([^)]*)\)/gim;

  // Удаляем старые функции этого файла
  state.functionsDeclared = state.functionsDeclared.filter(
    (f) => f.uri !== uri,
  );

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match;
    defRegex.lastIndex = 0;

    while ((match = defRegex.exec(line)) !== null) {
      const funcName = match[2];
      const params = match[3] ? match[3].trim() : "";
      const startChar = line.indexOf(funcName);

      state.functionsDeclared.push({
        uri,
        line: i,
        startChar,
        endChar: startChar + funcName.length,
        params,
        name: funcName,
      });
    }
  }
}

// =====================
// Пользовательские запросы
// =====================

connection.onNotification("custom/validateWorkspace", async () => {
  if (!state.workspaceRoot) return;

  log("[ВалидацияРабочегоПространства] Начало полного сканирования...");
  const files = await getAllSourceFiles(state.workspaceRoot);

  for (const filePath of files) {
    try {
      const content = await fs.promises.readFile(filePath, "utf8");
      const uri = URI.file(filePath).toString();

      const doc = TextDocument.create(uri, "krl", 1, content);

      if (doc.uri.endsWith(".dat")) {
        diagnostics.validateDatFile(doc);
      }
      diagnostics.validateVariablesUsage(doc, state.mergedVariables);
    } catch (e) {
      log(`Ошибка валидации ${filePath}: ${e}`);
    }
  }
  log(
    `[ВалидацияРабочегоПространства] Завершено. Сканировано файлов: ${files.length}.`,
  );
});

// =====================
// Обработчики LSP запросов
// =====================

connection.onDefinition((params: DefinitionParams) => {
  return definitions.onDefinition(params, documents, state);
});

connection.onCompletion((params: CompletionParams) => {
  return completions.onCompletion(params, documents, state);
});

connection.onHover((params: HoverParams) => {
  return hoverInfo.onHover(params, documents, state);
});

connection.onFoldingRanges((params: FoldingRangeParams) => {
  return regions.onFoldingRanges(params, documents);
});

connection.onDocumentFormatting((params) => {
  return formatter.provideFormatting(params, documents);
});

connection.onDocumentSymbol((params: DocumentSymbolParams) => {
  return documentSymbols.onDocumentSymbols(params, documents);
});

connection.onWorkspaceSymbol((params: WorkspaceSymbolParams) => {
  return workspaceSymbols.onWorkspaceSymbol(params, state);
});

connection.onPrepareRename((params: PrepareRenameParams) => {
  return renameProvider.prepareRename(params, documents, state);
});

connection.onRenameRequest((params: RenameParams) => {
  return renameProvider.onRename(params, documents, state);
});

connection.onReferences((params: ReferenceParams) => {
  return referencesProvider.onReferences(params, documents, state);
});

connection.onSignatureHelp((params: SignatureHelpParams) => {
  return signatureHelp.onSignatureHelp(params, documents, state);
});

connection.onCodeAction((params: CodeActionParams) => {
  return codeActions.onCodeAction(params, documents, state);
});

connection.onCodeLens((params: CodeLensParams) => {
  return codeLens.onCodeLens(params, documents, state);
});

connection.onCodeLensResolve((lens) => {
  return codeLens.onCodeLensResolve(lens);
});

connection.languages.callHierarchy.onPrepare((params) => {
  return callHierarchy.prepareCallHierarchy(params, documents, state);
});

connection.languages.callHierarchy.onIncomingCalls((params) => {
  return callHierarchy.incomingCalls(params, documents, state);
});

connection.languages.callHierarchy.onOutgoingCalls((params) => {
  return callHierarchy.outgoingCalls(params, documents, state);
});

// =====================
// Вспомогательные функции
// =====================

function mergeAllVariables(map: Map<string, VariableInfo[]>): VariableInfo[] {
  const result: VariableInfo[] = [];
  const seen = new Set<string>();

  for (const vars of map.values()) {
    for (const v of vars) {
      const upperName = v.name.toUpperCase();
      if (!seen.has(upperName)) {
        seen.add(upperName);
        result.push({ name: v.name, type: v.type || "" });
      }
    }
  }
  return result;
}

// Запуск прослушивания
connection.listen();
documents.listen(connection);
