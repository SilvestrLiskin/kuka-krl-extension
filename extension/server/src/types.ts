// Değişken bilgisi arayüzü
export interface VariableInfo {
  name: string;
  type: string;
  value?: string;
  scope?: "GLOBAL" | "LOCAL";
}

// Struct haritası - struct adı => üye isimleri
export interface StructMap {
  [structName: string]: string[];
}

// Değişken-Struct tipi haritası
export interface VariableToStructMap {
  [varName: string]: string;
}

// Kelime bilgisi - pozisyondaki kelime ve alt değişken olup olmadığı
export interface WordInfo {
  word: string;
  isSubvariable: boolean;
}

// Kapsam satırları - fonksiyon/defdat bloğunun üst ve alt sınırları
export interface EnclosuresLines {
  upperLine: number;
  bottomLine: number;
}

// Fonksiyon tanımı bilgisi
export interface FunctionDeclaration {
  uri: string;
  line: number;
  startChar: number;
  endChar: number;
  params: string;
  name: string;
}

// Sunucu durumu - tüm global veriler burada tutulur
export interface ServerState {
  workspaceRoot: string | null;
  fileVariablesMap: Map<string, VariableInfo[]>;
  variableStructTypes: VariableToStructMap;
  structDefinitions: StructMap;
  functionsDeclared: FunctionDeclaration[];
  globalVariables: VariableInfo[];
}
