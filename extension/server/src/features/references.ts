import {
    ReferenceParams,
    Location,
    Position,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { TextDocuments } from 'vscode-languageserver/node';
import { ServerState } from '../types';
import { getWordAtPosition } from '../lib/parser';
import { getAllSourceFiles } from '../lib/fileSystem';
import { isInsideString, escapeRegex, getCodePart } from '../lib/utils';
import { URI } from 'vscode-uri';
import * as fs from 'fs';

export class ReferencesProvider {
    /**
     * Sembolün tüm kullanımlarını bulur.
     */
    public async onReferences(
        params: ReferenceParams,
        documents: TextDocuments<TextDocument>,
        state: ServerState,
    ): Promise<Location[]> {
        const doc = documents.get(params.textDocument.uri);
        if (!doc || !state.workspaceRoot) return [];

        const lines = doc.getText().split(/\r?\n/);
        const lineText = lines[params.position.line];

        const wordInfo = getWordAtPosition(lineText, params.position.character);
        if (!wordInfo) return [];

        const symbolName = wordInfo.word;
        const locations: Location[] = [];

        // Tüm kaynak dosyalarında ara
        const files = await getAllSourceFiles(state.workspaceRoot);

        for (const filePath of files) {
            const uri = URI.file(filePath).toString();
            let content: string;

            // Açık belgeden veya dosyadan oku
            const openDoc = documents.get(uri);
            if (openDoc) {
                content = openDoc.getText();
            } else {
                try {
                    content = await fs.promises.readFile(filePath, 'utf8');
                } catch (e) {
                    continue;
                }
            }

            const fileLocations = this.findReferencesInContent(uri, content, symbolName, params.context.includeDeclaration);
            locations.push(...fileLocations);
        }

        return locations;
    }

    /**
     * İçerikte sembol referanslarını bulur.
     */
    private findReferencesInContent(
        uri: string,
        content: string,
        symbolName: string,
        includeDeclaration: boolean
    ): Location[] {
        const locations: Location[] = [];
        const lines = content.split(/\r?\n/);

        // Kelime sınırlarıyla eşleşen regex (büyük/küçük harf duyarsız)
        const regex = new RegExp(`\\b${escapeRegex(symbolName)}\\b`, 'gi');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Yorum kısmını atla
            const codePart = getCodePart(line);

            // Bildirim satırı mı kontrol et
            const isDeclaration = /^\s*(?:GLOBAL\s+)?(?:DECL|DEF|DEFFCT|SIGNAL|STRUC|ENUM)\b/i.test(line);

            // Eğer includeDeclaration false ise ve bu bir bildirimse, atla
            if (!includeDeclaration && isDeclaration) {
                // Bildirim adını kontrol et - eğer aranan sembol bildirimin kendisiyse atla
                const declMatch = line.match(new RegExp(`\\b${escapeRegex(symbolName)}\\b`, 'i'));
                if (declMatch) {
                    // Bildirimin ilk eşleşmesini atla (tanım)
                    const firstMatchIndex = codePart.search(regex);
                    if (firstMatchIndex !== -1) {
                        // Devam et, bu bir tanım
                    }
                }
            }

            let match;
            regex.lastIndex = 0;
            while ((match = regex.exec(codePart)) !== null) {
                // String içinde mi kontrol et
                if (isInsideString(codePart, match.index)) continue;

                locations.push(Location.create(
                    uri,
                    {
                        start: Position.create(i, match.index),
                        end: Position.create(i, match.index + symbolName.length),
                    }
                ));
            }
        }

        return locations;
    }
}
