import {
    DocumentHighlight,
    DocumentHighlightKind,
    DocumentHighlightParams,
    TextDocuments,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";

const BLOCK_PAIRS: Record<string, string> = {
    IF: "ENDIF",
    FOR: "ENDFOR",
    WHILE: "ENDWHILE",
    LOOP: "ENDLOOP",
    REPEAT: "UNTIL",
    SWITCH: "ENDSWITCH",
    DEF: "END",
    DEFFCT: "ENDFCT",
    DEFDAT: "ENDDAT",
};

const CLOSE_TO_OPEN: Record<string, string> = {};
for (const [open, close] of Object.entries(BLOCK_PAIRS)) {
    CLOSE_TO_OPEN[close] = open;
}

export class HighlightProvider {
    public onDocumentHighlight(
        params: DocumentHighlightParams,
        documents: TextDocuments<TextDocument>
    ): DocumentHighlight[] {
        const document = documents.get(params.textDocument.uri);
        if (!document) return [];

        const text = document.getText();
        const lines = text.split(/\r?\n/);
        const pos = params.position;
        const line = lines[pos.line];

        // Find if current position is on a block keyword
        const wordRegex = /\b[A-Za-z]+\b/g;
        let match;
        let keyword = "";
        let keywordStart = -1;

        while ((match = wordRegex.exec(line)) !== null) {
            if (pos.character >= match.index && pos.character <= match.index + match[0].length) {
                keyword = match[0].toUpperCase();
                keywordStart = match.index;
                break;
            }
        }

        if (!keyword) return [];

        const highlights: DocumentHighlight[] = [];

        // If it's an opening keyword
        if (BLOCK_PAIRS[keyword]) {
            const closingKeyword = BLOCK_PAIRS[keyword];
            const closingLine = this.findClosingLine(lines, pos.line, keyword, closingKeyword);

            if (closingLine !== -1) {
                highlights.push({
                    range: {
                        start: { line: pos.line, character: keywordStart },
                        end: { line: pos.line, character: keywordStart + match![0].length }
                    },
                    kind: DocumentHighlightKind.Read
                });

                // Find char index in closing line
                const closingIndex = lines[closingLine].toUpperCase().indexOf(closingKeyword);
                highlights.push({
                    range: {
                        start: { line: closingLine, character: closingIndex },
                        end: { line: closingLine, character: closingIndex + closingKeyword.length }
                    },
                    kind: DocumentHighlightKind.Read
                });
            }
        }
        // If it's a closing keyword
        else if (CLOSE_TO_OPEN[keyword]) {
            const openingKeyword = CLOSE_TO_OPEN[keyword];
            const openingLine = this.findOpeningLine(lines, pos.line, keyword, openingKeyword);

            if (openingLine !== -1) {
                highlights.push({
                    range: {
                        start: { line: pos.line, character: keywordStart },
                        end: { line: pos.line, character: keywordStart + match![0].length }
                    },
                    kind: DocumentHighlightKind.Read
                });

                // Find char index in opening line
                const openingIndex = lines[openingLine].toUpperCase().indexOf(openingKeyword);
                highlights.push({
                    range: {
                        start: { line: openingLine, character: openingIndex },
                        end: { line: openingLine, character: openingIndex + openingKeyword.length }
                    },
                    kind: DocumentHighlightKind.Read
                });
            }
        }

        return highlights;
    }

    private findClosingLine(lines: string[], startLine: number, openKw: string, closeKw: string): number {
        let depth = 0;
        const openRegex = new RegExp(`\\b${openKw}\\b`, "i");
        const closeRegex = new RegExp(`\\b${closeKw}\\b`, "i");

        for (let i = startLine; i < lines.length; i++) {
            const line = this.stripComments(lines[i]);
            if (openRegex.test(line)) depth++;
            if (closeRegex.test(line)) {
                depth--;
                if (depth === 0) return i;
            }
        }
        return -1;
    }

    private findOpeningLine(lines: string[], startLine: number, closeKw: string, openKw: string): number {
        let depth = 0;
        const openRegex = new RegExp(`\\b${openKw}\\b`, "i");
        const closeRegex = new RegExp(`\\b${closeKw}\\b`, "i");

        for (let i = startLine; i >= 0; i--) {
            const line = this.stripComments(lines[i]);
            if (closeRegex.test(line)) depth++;
            if (openRegex.test(line)) {
                depth--;
                if (depth === 0) return i;
            }
        }
        return -1;
    }

    private stripComments(line: string): string {
        const idx = line.indexOf(";");
        return idx === -1 ? line : line.substring(0, idx);
    }
}
