import { Hover, HoverParams } from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { TextDocuments } from "vscode-languageserver/node";
import { ServerState } from "../types";
import {
  isSymbolDeclared,
  getWordAtPosition,
  CODE_KEYWORDS,
} from "../lib/parser";
import { KSS_87_SYSTEM_VARS } from "../lib/systemVars";
import { getSystemVarDoc } from "../lib/systemVarDocs";
import { t, getLocale } from "../lib/i18n";
import { getKeywordDoc } from "../lib/krlDocs";

export class InfoProvider {
  /**
   * Fare ile üzerine gelindiğinde bilgi gösterir.
   * Fonksiyonlar için imza, değişkenler için tip bilgisi gösterir.
   */
  public async onHover(
    params: HoverParams,
    documents: TextDocuments<TextDocument>,
    state: ServerState,
  ): Promise<Hover | undefined> {
    const doc = documents.get(params.textDocument.uri);
    if (!doc || !state.workspaceRoot) return;

    const lines = doc.getText().split(/\r?\n/);
    const lineText = lines[params.position.line];

    // Bildirim satırlarını atla
    if (/^\s*(GLOBAL\s+)?(DEF|DEFFCT|DECL|SIGNAL|STRUC)\b/i.test(lineText))
      return;

    const wordInfo = getWordAtPosition(lineText, params.position.character);
    if (!wordInfo) return;
    const symbolName = wordInfo.word;

    // Anahtar kelime mi kontrol et
    if (CODE_KEYWORDS.includes(symbolName.toUpperCase())) {
      const lang = getLocale();
      const detailedDoc = getKeywordDoc(symbolName, lang);

      if (detailedDoc) {
        return {
          contents: {
            kind: "markdown",
            value: detailedDoc,
          },
        };
      }

      return {
        contents: {
          kind: "markdown",
          value: `**${symbolName.toUpperCase()}** ${t("hover.krlKeyword")}`,
        },
      };
    }

    // Sistem değişkeni mi kontrol et - önce dokümantasyonu ara
    const lang = getLocale();
    const sysVarDoc = getSystemVarDoc(symbolName, lang);
    if (sysVarDoc) {
      return {
        contents: {
          kind: "markdown",
          value: sysVarDoc,
        },
      };
    }

    // Fallback: dokümantasyonu olmayan sistem değişkenleri için
    const sysVar = KSS_87_SYSTEM_VARS.find(
      (v) =>
        v.toUpperCase() === `$${symbolName}`.toUpperCase() ||
        v.toUpperCase() === symbolName.toUpperCase(),
    );
    if (sysVar) {
      return {
        contents: {
          kind: "markdown",
          value: `**${sysVar}** ${t("hover.systemVariable")}`,
        },
      };
    }

    // Önce fonksiyon listesinden ara
    const cachedFunc = state.functionsDeclared.find(
      (f) => f.name.toUpperCase() === symbolName.toUpperCase(),
    );
    if (cachedFunc) {
      return {
        contents: {
          kind: "markdown",
          value: `**${cachedFunc.name}**(${cachedFunc.params})\n\n${t("hover.userFunction")}`,
        },
      };
    }

    // Değişken listesinden ara
    const variable = state.mergedVariables.find(
      (v) => v.name.toUpperCase() === symbolName.toUpperCase(),
    );
    if (variable) {
      const typeDisplay = variable.type || "Unknown";
      let hoverText = `**${symbolName}**: \`${typeDisplay}\``;

      if (variable.value) {
        hoverText += ` = \`${variable.value}\``;
      }

      hoverText += `\n\n${t("hover.variable")}`;

      return {
        contents: {
          kind: "markdown",
          value: hoverText,
        },
      };
    }

    // Struct tanımlarından ara
    for (const structName of Object.keys(state.structDefinitions)) {
      if (structName.toUpperCase() === symbolName.toUpperCase()) {
        const members = state.structDefinitions[structName];
        return {
          contents: {
            kind: "markdown",
            value: `**${t("hover.struct")} ${structName}**\n\n${t("hover.members")}: \`${members.join("`, `")}\``,
          },
        };
      }
    }

    // Önbellekte yoksa dosyalardan fonksiyon ara
    const result = await isSymbolDeclared(
      state.workspaceRoot,
      symbolName,
      "function",
    );
    if (result) {
      return {
        contents: {
          kind: "markdown",
          value: `**${symbolName}**(${result.params})`,
        },
      };
    }

    return undefined;
  }
}
