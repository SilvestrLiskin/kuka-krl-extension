// Интерфейс информации о переменной
export interface VariableInfo {
  name: string;
  type: string;
  value?: string;
}

// Карта структур - имя структуры => список имен членов
export interface StructMap {
  [structName: string]: string[];
}

// Карта переменная-структура - имя переменной => тип структуры
export interface VariableToStructMap {
  [varName: string]: string;
}

// Информация о слове - само слово и является ли оно подпеременной (свойством)
export interface WordInfo {
  word: string;
  isSubvariable: boolean;
}

// Границы области видимости (функции или defdat блока)
export interface EnclosuresLines {
  upperLine: number;
  bottomLine: number;
}

// Информация об объявлении функции
export interface FunctionDeclaration {
  uri: string;
  line: number;
  startChar: number;
  endChar: number;
  params: string;
  name: string;
}

// Состояние сервера - хранит все глобальные данные
export interface ServerState {
  workspaceRoot: string | null;
  fileVariablesMap: Map<string, VariableInfo[]>;
  variableStructTypes: VariableToStructMap;
  structDefinitions: StructMap;
  functionsDeclared: FunctionDeclaration[];
  mergedVariables: VariableInfo[];
}
