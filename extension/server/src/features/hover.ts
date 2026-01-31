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
import * as krlData from "../data/krl-ref.json";

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

    // Check krl-ref.json for System Types (E6POS, FRAME, etc.)
    const typeData =
      (krlData.types as any)[symbolName.toUpperCase()] ||
      (krlData.types as any)[symbolName];
    if (typeData) {
      let md = `**${typeData.name}** (System Type)\n\n${typeData.description}`;
      if (typeData.fields) {
        let fieldNames: string[] = [];
        if (Array.isArray(typeData.fields)) {
          fieldNames = typeData.fields.map((f: any) => f.name);
        } else if (typeof typeData.fields === "object") {
          fieldNames = Object.keys(typeData.fields);
        }
        if (fieldNames.length > 0) {
          md += `\n\n**Fields:** \`${fieldNames.join("`, `")}\``;
        }
      }
      if (typeData.values) {
        // For Enums
        let valueNames: string[] = [];
        if (Array.isArray(typeData.values)) {
          valueNames = typeData.values.map((v: any) => v.name);
        } else if (typeof typeData.values === "object") {
          valueNames = Object.keys(typeData.values);
        }
        if (valueNames.length > 0) {
          md += `\n\n**Values:** \`${valueNames.join("`, `")}\``;
        }
      }
      return {
        contents: {
          kind: "markdown",
          value: md,
        },
      };
    }

    // Check krl-ref.json for commands/keywords
    const cmdData =
      (krlData.commands as any)[symbolName.toUpperCase()] ||
      (krlData.commands as any)[symbolName];
    if (cmdData) {
      let md = `**${cmdData.name}**\n\n${cmdData.description}`;
      if (cmdData.syntax) md += `\n\n\`\`\`krl\n${cmdData.syntax}\n\`\`\``;
      return {
        contents: {
          kind: "markdown",
          value: md,
        },
      };
    }

    // fallback to original static Docs if not in JSON
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

    // System Variable Lookup in krl-ref.json
    // Supports $POS_ACT and POS_ACT
    let sysVarName = symbolName.toUpperCase();
    if (!sysVarName.startsWith("$")) sysVarName = "$" + sysVarName;

    // Check both variations in JSON keys
    const sysData =
      (krlData.systemVariables as any)[sysVarName] ||
      (krlData.systemVariables as any)[symbolName];

    if (sysData) {
      let md = `**${sysData.name}** \`${sysData["data-type"] || sysData.type}\`\n\n${sysData.description}`;
      if (sysData.constraint) md += `\n\n*Constraint:* ${sysData.constraint}`;
      if (sysData.unit) md += ` (${sysData.unit})`;
      return {
        contents: {
          kind: "markdown",
          value: md,
        },
      };
    }

    // Fallback System Vars
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

    // Check krl-ref.json for Built-in Functions
    const funcData = (krlData.functions as any)[symbolName];
    if (funcData) {
      let md = `**${funcData.name}** -> \`${funcData["return-type"]}\`\n\n${funcData.description}`;
      if (funcData.comments) md += `\n\n${funcData.comments}`;
      if (funcData.parameters && Array.isArray(funcData.parameters)) {
        md += `\n\n**Parameters:**\n`;
        funcData.parameters.forEach((p: any) => {
          md += `- \`${p.name}\` (${p.type}): ${p.description || ""}\n`;
        });
      }
      return {
        contents: {
          kind: "markdown",
          value: md,
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
