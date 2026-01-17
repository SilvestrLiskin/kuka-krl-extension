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

// DEBUG KAYIT - Hata ayıklama için log dosyası
// Sadece DEBUG ortam değişkeni ayarlandığında loglar
const DEBUG_ENABLED = process.env.KRL_DEBUG === "true";
const logFile = DEBUG_ENABLED
  ? path.join(os.tmpdir(), "krl-server-debug.log")
  : "";

function log(msg: string) {
  if (!DEBUG_ENABLED) return;
  try {
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
  } catch {
    // Log yazma hatası sessizce yok sayılır
  }
}

// Sunucu başlatılıyor
log(`Sunucu başlatılıyor. Node: ${process.version}, PID: ${process.pid}`);

// Hata yakalama
process.on("uncaughtException", (err) => {
  log("Yakalanmamış Hata: " + err.toString() + "\n" + (err.stack || ""));
  process.exit(1);
});
process.on("unhandledRejection", (err) => {
  log("İşlenmemiş Red: " + (err instanceof Error ? err.stack : err));
});

// Bağlantı oluştur
const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

// Global Durum
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

// Debounce механизм для валидации документов
// Это предотвращает ложные ошибки при быстром редактировании
const validationTimeouts = new Map<string, NodeJS.Timeout>();
const VALIDATION_DELAY_MS = 750; // Увеличена задержка для предотвращения ложных ошибок

// Флаг готовности инициализации workspace
// Пока workspace не загружен полностью, не показываем ошибки "переменная не определена"
let workspaceInitialized = false;

function scheduleValidation(uri: string, validationFn: () => void) {
  // Отменяем предыдущий таймаут для этого документа
  const existingTimeout = validationTimeouts.get(uri);
  if (existingTimeout) {
    clearTimeout(existingTimeout);
  }
  // Планируем новую валидацию
  const timeout = setTimeout(() => {
    validationTimeouts.delete(uri);
    validationFn();
  }, VALIDATION_DELAY_MS);
  validationTimeouts.set(uri, timeout);
}

// Özellikler
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
// Başlatma İşleyicileri
// =======================

connection.onInitialize((params: InitializeParams): InitializeResult => {
  log(`[Başlatma] Kök URI: ${params.rootUri}`);
  state.workspaceRoot = params.rootUri
    ? URI.parse(params.rootUri).fsPath
    : null;
  log(`[Başlatma] Çalışma alanı kökü ayarlandı: ${state.workspaceRoot}`);
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

  // .dat dosyalarından değişkenleri yükle
  const datFiles = await getAllDatFiles(state.workspaceRoot);
  for (const filePath of datFiles) {
    try {
      const content = await fs.promises.readFile(filePath, "utf8");
      const uri = URI.file(filePath).toString();

      const extractor = new SymbolExtractor();
      extractor.extractFromText(content);
      state.fileVariablesMap.set(uri, extractor.getVariables());

      // Struct tanımlarını güncelle
      const structs = extractStrucVariables(content);
      Object.assign(state.structDefinitions, structs);
    } catch (err) {
      connection.console.error(`Dosya okuma hatası ${filePath}: ${err}`);
    }
  }

  // .src ve .sub dosyalarından fonksiyonları yükle
  await extractFunctionsFromWorkspace(state.workspaceRoot);

  state.mergedVariables = mergeAllVariables(state.fileVariablesMap);

  // Fonksiyon önbelleğini güncelle
  diagnostics.updateFunctionCache(state.functionsDeclared.map((f) => f.name));

  // Workspace полностью инициализирован - теперь можно показывать ошибки
  workspaceInitialized = true;

  log(
    `[Başlatma] ${state.functionsDeclared.length} fonksiyon ve ${state.mergedVariables.length} değişken yüklendi.`,
  );
});

/**
 * Çalışma alanındaki tüm kaynak dosyalardan fonksiyon tanımlarını çıkarır.
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

          // Tekrar kontrolü
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
      log(`Fonksiyon çıkarma hatası ${filePath}: ${err}`);
    }
  }
}

// ==========================
// Belge Değişiklik Olayı
// ==========================

documents.onDidChangeContent(async (change) => {
  const { document } = change;

  // Örtülü Çalışma Alanı Çıkarımı
  if (!state.workspaceRoot) {
    let currentDir = path.dirname(URI.parse(document.uri).fsPath);
    // Kök bulmak için yukarı doğru ara
    while (currentDir.length > 1) {
      if (
        fs.existsSync(path.join(currentDir, "KRC")) ||
        fs.existsSync(path.join(currentDir, "R1")) ||
        path.basename(currentDir).toUpperCase() === "KRC"
      ) {
        break;
      }
      const parent = path.dirname(currentDir);
      if (parent === currentDir) break; // Köke ulaşıldı
      currentDir = parent;
    }
    state.workspaceRoot = currentDir;
    log(`[ÖrtülüKök] Çıkarılan kök: ${state.workspaceRoot}`);
    diagnostics.setWorkspaceRoot(state.workspaceRoot);

    // onInitialized atlandığı için ilk tarama
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
        log(`Dosya okuma hatası ${filePath}: ${err}`);
      }
    }

    // Fonksiyonları da yükle
    await extractFunctionsFromWorkspace(state.workspaceRoot);
    state.mergedVariables = mergeAllVariables(state.fileVariablesMap);

    // Fonksiyon önbelleğini güncelle
    diagnostics.updateFunctionCache(state.functionsDeclared.map((f) => f.name));

    // Workspace полностью инициализирован (неявное определение)
    workspaceInitialized = true;
  }

  if (document.uri.endsWith(".dat")) {
    diagnostics.validateDatFile(document);

    // Struct tanımlarını güncelle
    const structs = extractStrucVariables(document.getText());
    Object.assign(state.structDefinitions, structs);
  }

  // Değişkenleri güncelle
  const extractor = new SymbolExtractor();
  extractor.extractFromText(document.getText());
  state.fileVariablesMap.set(document.uri, extractor.getVariables());

  state.mergedVariables = mergeAllVariables(state.fileVariablesMap);

  // Fonksiyonları güncelle (mevcut dosyadan)
  updateFunctionsFromDocument(document);

  // Fonksiyon önbelleğini güncelle
  diagnostics.updateFunctionCache(state.functionsDeclared.map((f) => f.name));

  // Запланировать валидацию с задержкой (предотвращает ложные ошибки)
  // Сохраняем URI и версию документа для безопасного обращения в callback
  const docUri = document.uri;
  const docVersion = document.version;

  scheduleValidation(docUri, () => {
    // Получаем актуальный документ из коллекции
    const currentDoc = documents.get(docUri);
    // Если документ закрыт или версия изменилась — пропускаем валидацию
    if (!currentDoc || currentDoc.version !== docVersion) {
      return;
    }

    // Tüm teşhisleri topla ve tek seferde gönder
    let allDiagnostics: import("vscode-languageserver/node").Diagnostic[] = [];

    // Обновляем mergedVariables перед валидацией (могут быть загружены новые переменные)
    state.mergedVariables = mergeAllVariables(state.fileVariablesMap);

    // Kullanım doğrulaması - только если workspace полностью загружен
    // Это предотвращает ложные ошибки "переменная не определена" при открытии файлов
    if (workspaceInitialized) {
      const varDiags = diagnostics.validateVariablesUsage(
        currentDoc,
        state.mergedVariables,
      );
      allDiagnostics.push(...varDiags);
    }

    // Safety diagnostics для SRC файлов
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

    // Tüm teşhisleri tek seferde gönder
    connection.sendDiagnostics({
      uri: currentDoc.uri,
      diagnostics: allDiagnostics,
    });
  });
});

/**
 * Tek bir belgeden fonksiyon tanımlarını günceller.
 */
function updateFunctionsFromDocument(document: TextDocument): void {
  const uri = document.uri;
  const content = document.getText();
  const lines = content.split(/\r?\n/);
  const defRegex =
    /^\s*(?:GLOBAL\s+)?(DEF|DEFFCT)\s+(?:\w+\s+)?(\w+)\s*\(([^)]*)\)/gim;

  // Bu URI'ye ait eski fonksiyonları kaldır
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
// Özel İstekler
// =====================

connection.onNotification("custom/validateWorkspace", async () => {
  if (!state.workspaceRoot) return;

  log("[ÇalışmaAlanıDoğrulama] Tam tarama başlatılıyor...");
  const files = await getAllSourceFiles(state.workspaceRoot);

  for (const filePath of files) {
    try {
      const content = await fs.promises.readFile(filePath, "utf8");
      const uri = URI.file(filePath).toString();

      // Teşhis için TextDocument oluştur
      const doc = TextDocument.create(uri, "krl", 1, content);

      if (doc.uri.endsWith(".dat")) {
        diagnostics.validateDatFile(doc);
      }
      diagnostics.validateVariablesUsage(doc, state.mergedVariables);
    } catch (e) {
      log(`Doğrulama hatası ${filePath}: ${e}`);
    }
  }
  log(`[ÇalışmaAlanıDoğrulama] Tamamlandı. ${files.length} dosya tarandı.`);
});

// =====================
// İstek İşleyicileri
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
// Yardımcı Fonksiyonlar
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

// Sunucuyu Başlat
connection.listen();
documents.listen(connection);
