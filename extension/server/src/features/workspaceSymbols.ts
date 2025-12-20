import {
    WorkspaceSymbol,
    WorkspaceSymbolParams,
    SymbolKind,
    Location,
    Position,
} from 'vscode-languageserver/node';
import { ServerState } from '../types';

export class WorkspaceSymbolsProvider {
    /**
     * Çalışma alanı sembollerini sağlar (Ctrl+T için).
     * Tüm fonksiyonları, değişkenleri ve struct tanımlarını listeler.
     */
    public onWorkspaceSymbol(
        params: WorkspaceSymbolParams,
        state: ServerState,
    ): WorkspaceSymbol[] {
        const query = params.query.toUpperCase();
        const symbols: WorkspaceSymbol[] = [];

        // Fonksiyonları ekle
        for (const func of state.functionsDeclared) {
            if (query === '' || func.name.toUpperCase().includes(query)) {
                symbols.push({
                    name: func.name,
                    kind: SymbolKind.Function,
                    location: Location.create(
                        func.uri,
                        {
                            start: Position.create(func.line, func.startChar),
                            end: Position.create(func.line, func.endChar),
                        }
                    ),
                    containerName: this.getContainerName(func.uri),
                });
            }
        }

        // Değişkenleri ekle
        for (const [uri, variables] of state.fileVariablesMap.entries()) {
            const containerName = this.getContainerName(uri);
            for (const variable of variables) {
                if (query === '' || variable.name.toUpperCase().includes(query)) {
                    symbols.push({
                        name: variable.name,
                        kind: this.getSymbolKind(variable.type),
                        location: Location.create(
                            uri,
                            {
                                start: Position.create(0, 0),
                                end: Position.create(0, variable.name.length),
                            }
                        ),
                        containerName: containerName,
                    });
                }
            }
        }

        // Struct tanımlarını ekle
        for (const structName of Object.keys(state.structDefinitions)) {
            if (query === '' || structName.toUpperCase().includes(query)) {
                symbols.push({
                    name: structName,
                    kind: SymbolKind.Struct,
                    location: Location.create(
                        '', // URI bilinmiyor, genel arama
                        {
                            start: Position.create(0, 0),
                            end: Position.create(0, structName.length),
                        }
                    ),
                    containerName: 'STRUC',
                });
            }
        }

        // Sonuçları sınırla (performans için)
        return symbols.slice(0, 100);
    }

    private getContainerName(uri: string): string {
        // URI'den dosya adını çıkar
        const parts = uri.split('/');
        return parts[parts.length - 1] || '';
    }

    private getSymbolKind(typeName: string): SymbolKind {
        switch (typeName?.toUpperCase()) {
            case 'INT':
            case 'REAL':
                return SymbolKind.Number;
            case 'BOOL':
                return SymbolKind.Boolean;
            case 'CHAR':
            case 'STRING':
                return SymbolKind.String;
            case 'FRAME':
            case 'POS':
            case 'E6POS':
            case 'AXIS':
            case 'E6AXIS':
            case 'LOAD':
                return SymbolKind.Struct;
            case 'SIGNAL':
                return SymbolKind.Event;
            case 'ENUM_MEMBER':
                return SymbolKind.EnumMember;
            default:
                return SymbolKind.Variable;
        }
    }
}
