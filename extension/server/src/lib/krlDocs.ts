interface KeywordDoc {
  description: string;
  syntax?: string;
  example?: string;
}

type Locale = "en" | "ru" | "tr";

const docs: Record<string, Record<Locale, KeywordDoc>> = {
  // --- Motion Commands ---
  PTP: {
    en: {
      description:
        "Point-to-Point movement. Moves the robot to the target point via the fastest path.",
      syntax: "PTP TargetPoint [C_DIS|C_PTP]",
      example: "PTP P1 Vel=100% PDAT1",
    },
    ru: {
      description:
        "Движение из точки в точку. Робот движется к цели по кратчайшей траектории осей.",
      syntax: "PTP Точка [C_DIS|C_PTP]",
      example: "PTP P1 Vel=100% PDAT1",
    },
    tr: {
      description:
        "Noktadan noktaya hareket. Robot en hızlı yoldan hedefe gider.",
      syntax: "PTP Hedef [C_DIS|C_PTP]",
      example: "PTP P1 Vel=100% PDAT1",
    },
  },
  LIN: {
    en: {
      description: "Linear movement. Moves the robot in a straight line.",
      syntax: "LIN TargetPoint [C_DIS|C_VEL]",
      example: "LIN P2 Vel=2 m/s CPDAT1",
    },
    ru: {
      description: "Линейное движение. Строго по прямой линии.",
      syntax: "LIN Точка [C_DIS|C_VEL]",
      example: "LIN P2 Vel=2 m/s CPDAT1",
    },
    tr: {
      description: "Doğrusal hareket. Robot düz bir çizgide hareket eder.",
      syntax: "LIN Hedef [C_DIS|C_VEL]",
      example: "LIN P2 Vel=2 m/s CPDAT1",
    },
  },
  CIRC: {
    en: {
      description: "Circular movement via auxiliary point.",
      syntax: "CIRC AuxPoint, TargetPoint [C_DIS]",
      example: "CIRC PAux, PEnd",
    },
    ru: {
      description: "Круговое движение через вспомогательную точку.",
      syntax: "CIRC ВспомТочка, Цель [C_DIS]",
      example: "CIRC PAux, PEnd",
    },
    tr: {
      description: "Yardımcı nokta üzerinden dairesel hareket.",
      syntax: "CIRC AraNokta, Hedef [C_DIS]",
      example: "CIRC PAux, PEnd",
    },
  },
  SPTP: {
    en: {
      description: "Spline Point-to-Point movement (smoother PTP).",
      syntax: "SPTP TargetPoint [WITH Parameters]",
      example: "SPTP XP1 WITH $VEL_AXIS[1]=100",
    },
    ru: {
      description: "Сплайновое PTP движение (более плавное).",
      syntax: "SPTP Точка [WITH Параметры]",
      example: "SPTP XP1 WITH $VEL_AXIS[1]=100",
    },
    tr: {
      description: "Spline PTP hareketi (daha yumuşak).",
      syntax: "SPTP Hedef [WITH Parametreler]",
      example: "SPTP XP1 WITH $VEL_AXIS[1]=100",
    },
  },
  SLIN: {
    en: {
      description: "Spline Linear movement.",
      syntax: "SLIN TargetPoint",
      example: "SLIN XP2",
    },
    ru: {
      description: "Сплайновое линейное движение.",
      syntax: "SLIN Точка",
      example: "SLIN XP2",
    },
    tr: {
      description: "Spline doğrusal hareket.",
      syntax: "SLIN Hedef",
      example: "SLIN XP2",
    },
  },
  SCIRC: {
    en: {
      description: "Spline Circular movement.",
      syntax: "SCIRC AuxPoint, TargetPoint",
      example: "SCIRC XP3, XP4",
    },
    ru: {
      description: "Сплайновое круговое движение.",
      syntax: "SCIRC Вспом, Цель",
      example: "SCIRC XP3, XP4",
    },
    tr: {
      description: "Spline dairesel hareket.",
      syntax: "SCIRC Ara, Hedef",
      example: "SCIRC XP3, XP4",
    },
  },

  // --- Logic & Control Flow ---
  IF: {
    en: {
      description: "Conditional execution block.",
      syntax: "IF Condition THEN ... [ELSE ...] ENDIF",
      example: "IF $IN[1] THEN\n  PTP HOME\nENDIF",
    },
    ru: {
      description: "Условный оператор.",
      syntax: "IF Условие THEN ... [ELSE ...] ENDIF",
      example: "IF $IN[1] THEN\n  PTP HOME\nENDIF",
    },
    tr: {
      description: "Koşullu ifade.",
      syntax: "IF Kosul THEN ... [ELSE ...] ENDIF",
      example: "IF $IN[1] THEN\n  PTP HOME\nENDIF",
    },
  },
  THEN: {
    en: {
      description: "Starts the code block executed if IF condition is TRUE.",
    },
    ru: {
      description: "Начало блока кода, выполняемого если условие IF истинно.",
    },
    tr: { description: "IF koşulu doğruysa çalışacak bloğu başlatır." },
  },
  ELSE: {
    en: { description: "Alternative code block if IF condition is FALSE." },
    ru: { description: "Альтернативный блок кода, если условие IF ложно." },
    tr: { description: "IF koşulu yanlışsa çalışacak alternatif blok." },
  },
  ENDIF: {
    en: { description: "Ends an IF block." },
    ru: { description: "Конец блока IF." },
    tr: { description: "IF bloğunu bitirir." },
  },
  FOR: {
    en: {
      description: "Count-controlled loop.",
      syntax: "FOR Var = Start TO End [STEP Val]",
      example: "FOR I=1 TO 10 STEP 2\n ... \nENDFOR",
    },
    ru: {
      description: "Цикл со счетчиком.",
      syntax: "FOR Перем = Старт TO Конец [STEP Шаг]",
      example: "FOR I=1 TO 10 STEP 2\n ... \nENDFOR",
    },
    tr: {
      description: "Sayaçlı döngü.",
      syntax: "FOR Degisken = Bas TO Bit [STEP Adim]",
      example: "FOR I=1 TO 10 STEP 2\n ... \nENDFOR",
    },
  },
  WHILE: {
    en: {
      description: "Loop executed while condition is TRUE (checked at start).",
      syntax: "WHILE Condition ... ENDWHILE",
    },
    ru: {
      description:
        "Цикл 'Пока'. Выполняется, пока условие истинно (проверка в начале).",
      syntax: "WHILE Условие ... ENDWHILE",
    },
    tr: {
      description: "Koşul doğru olduğu sürece çalışan döngü (başta kontrol).",
      syntax: "WHILE Kosul ... ENDWHILE",
    },
  },
  LOOP: {
    en: { description: "Infinite loop.", syntax: "LOOP ... ENDLOOP" },
    ru: { description: "Бесконечный цикл.", syntax: "LOOP ... ENDLOOP" },
    tr: { description: "Sonsuz döngü.", syntax: "LOOP ... ENDLOOP" },
  },
  REPEAT: {
    en: {
      description:
        "Loop executed until condition becomes TRUE (checked at end).",
      syntax: "REPEAT ... UNTIL Condition",
    },
    ru: {
      description:
        "Цикл 'До'. Выполняется, пока условие не станет истинным (проверка в конце).",
      syntax: "REPEAT ... UNTIL Условие",
    },
    tr: {
      description: "Koşul doğru olana kadar çalışan döngü (sonda kontrol).",
      syntax: "REPEAT ... UNTIL Kosul",
    },
  },
  SWITCH: {
    en: {
      description: "Switch-case selection structure.",
      syntax: "SWITCH Var\n CASE 1\n ...\n DEFAULT\n ...\nENDSWITCH",
    },
    ru: {
      description: "Оператор выбора.",
      syntax: "SWITCH Перем\n CASE 1\n ...\n DEFAULT\n ...\nENDSWITCH",
    },
    tr: {
      description: "Seçim yapısı.",
      syntax: "SWITCH Degisken\n CASE 1\n ...\n DEFAULT\n ...\nENDSWITCH",
    },
  },
  WAIT: {
    en: {
      description: "Waits for a time or condition.",
      syntax: "WAIT SEC 0.5\nWAIT FOR $IN[1]",
    },
    ru: {
      description: "Ожидание времени или условия.",
      syntax: "WAIT SEC 0.5\nWAIT FOR $IN[1]",
    },
    tr: {
      description: "Bekleme komutu.",
      syntax: "WAIT SEC 0.5\nWAIT FOR $IN[1]",
    },
  },
  HALT: {
    en: { description: "Stops program execution safely." },
    ru: { description: "Останавливает выполнение программы (пауза)." },
    tr: { description: "Programı durdurur (pause)." },
  },

  // --- Logic Operators ---
  AND: {
    en: { description: "Logical AND" },
    ru: { description: "Логическое И (AND)" },
    tr: { description: "Mantıksal VE" },
  },
  OR: {
    en: { description: "Logical OR" },
    ru: { description: "Логическое ИЛИ (OR)" },
    tr: { description: "Mantıksal VEYA" },
  },
  NOT: {
    en: { description: "Logical NOT" },
    ru: { description: "Логическое НЕ (NOT)" },
    tr: { description: "Mantıksal DEĞİL" },
  },
  EXOR: {
    en: { description: "Exclusive OR" },
    ru: { description: "Исключающее ИЛИ (XOR)" },
    tr: { description: "Dışlamalı VEYA" },
  },

  // --- Bitwise Operators ---
  B_AND: {
    en: { description: "Bitwise AND" },
    ru: { description: "Побитовое И" },
    tr: { description: "Bit düzeyinde VE" },
  },
  B_OR: {
    en: { description: "Bitwise OR" },
    ru: { description: "Побитовое ИЛИ" },
    tr: { description: "Bit düzeyinde VEYA" },
  },
  B_NOT: {
    en: { description: "Bitwise NOT" },
    ru: { description: "Побитовое НЕ" },
    tr: { description: "Bit düzeyinde DEĞİL" },
  },
  B_EXOR: {
    // Correct KRL might be B_EXOR or B_XOR depending on version, parsing list says B_XOR but docs say EXOR usually
    en: { description: "Bitwise XOR" },
    ru: { description: "Побитовое Исключающее ИЛИ" },
    tr: { description: "Bit düzeyinde XOR" },
  },

  // --- Declarations ---
  DECL: {
    en: { description: "Variable declaration." },
    ru: { description: "Объявление переменной." },
    tr: { description: "Değişken tanımlama." },
  },
  GLOBAL: {
    en: { description: "Global scope modifier." },
    ru: { description: "Модификатор глобальной области видимости." },
    tr: { description: "Global kapsam değiştiricisi." },
  },
  CONST: {
    en: { description: "Constant declaration. Value cannot change." },
    ru: { description: "Объявление константы. Значение нельзя изменить." },
    tr: { description: "Sabit tanımlama." },
  },
  Signal: {
    // Case insensitive match handling needed or ensure key matches CODE_KEYWORDS
    en: {
      description: "I/O Signal declaration.",
      syntax: "SIGNAL Name $IN[1] TO $IN[8]",
    },
    ru: {
      description: "Объявление сигнала ввода/вывода.",
      syntax: "SIGNAL Имя $IN[1] TO $IN[8]",
    },
    tr: {
      description: "Giriş/Çıkış sinyali tanımlama.",
      syntax: "SIGNAL Isim $IN[1] TO $IN[8]",
    },
  },

  // --- Types ---
  INT: {
    en: { description: "Integer (32-bit)" },
    ru: { description: "Целое число (32-бит)" },
    tr: { description: "Tamsayı" },
  },
  REAL: {
    en: { description: "Float number" },
    ru: { description: "Вещественное число" },
    tr: { description: "Reel sayı" },
  },
  BOOL: {
    en: { description: "Boolean" },
    ru: { description: "Логический тип" },
    tr: { description: "Mantıksal tip" },
  },
  CHAR: {
    en: { description: "Character" },
    ru: { description: "Символ" },
    tr: { description: "Karakter" },
  },
  FRAME: {
    en: { description: "Coordinate Frame {X,Y,Z,A,B,C}" },
    ru: { description: "Фрейм координат {X,Y,Z,A,B,C}" },
    tr: { description: "Koordinat Çerçevesi" },
  },
  POS: {
    en: { description: "Position {X,Y,Z,A,B,C,S,T}" },
    ru: { description: "Позиция {X,Y,Z,A,B,C,S,T}" },
    tr: { description: "Pozisyon" },
  },
  E6POS: {
    en: { description: "Extended Position (includes external axes)" },
    ru: { description: "Расширенная позиция (+ внешние оси)" },
    tr: { description: "Genişletilmiş Pozisyon" },
  },
  AXIS: {
    en: { description: "Axis Angles {A1..A6}" },
    ru: { description: "Углы осей {A1..A6}" },
    tr: { description: "Eksen Açıları" },
  },
  E6AXIS: {
    en: { description: "Extended Axis Angles (+E1..E6)" },
    ru: { description: "Расширенные углы осей (+E1..E6)" },
    tr: { description: "Genişletilmiş Eksen Açıları" },
  },

  // --- System Functions ---
  BAS: {
    en: {
      description: "Basic Setup function (Initialize speeds, tools).",
      syntax: "BAS(#INITMOV, 0)",
    },
    ru: {
      description:
        "Функция базовой настройки (инициализация скоростей, инструментов).",
      syntax: "BAS(#INITMOV, 0)",
    },
    tr: {
      description: "Temel kurulum fonksiyonu.",
      syntax: "BAS(#INITMOV, 0)",
    },
  },
  INVERSE: {
    en: {
      description: "Calculates inverse kinematics (Cartesian -> Axis).",
      syntax: "E6AXIS = INVERSE(E6POS, E6AXIS_REF, ERR_STATUS)",
    },
    ru: {
      description: "Обратная кинематика (Декартовы -> Осевые).",
      syntax: "E6AXIS = INVERSE(E6POS, E6AXIS_REF, ERR_STATUS)",
    },
    tr: {
      description: "Ters kinematik hesaplar.",
      syntax: "E6AXIS = INVERSE(E6POS, E6AXIS_REF, ERR_STATUS)",
    },
  },
  FORWARD: {
    en: {
      description: "Calculates forward kinematics (Axis -> Cartesian).",
      syntax: "E6POS = FORWARD(E6AXIS, ERR_STATUS)",
    },
    ru: {
      description: "Прямая кинематика (Осевые -> Декартовы).",
      syntax: "E6POS = FORWARD(E6AXIS, ERR_STATUS)",
    },
    tr: {
      description: "İleri kinematik hesaplar.",
      syntax: "E6POS = FORWARD(E6AXIS, ERR_STATUS)",
    },
  },
  SWRITE: {
    en: {
      description: "Writes formatted data to string/channel.",
      syntax: "SWRITE(StrVar, State, Offset, Format, Var1...)",
    },
    ru: {
      description: "Запись форматированных данных в строку.",
      syntax: "SWRITE(Строка, Статус, Смещение, Формат, Перем...)",
    },
    tr: {
      description: "Biçimlendirilmiş veriyi dizeye yazar.",
      syntax: "SWRITE(StrVar, State, Offset, Format, Var1...)",
    },
  },
  // Math
  ABS: {
    en: { description: "Absolute value: |x|" },
    ru: { description: "Модуль числа: |x|" },
    tr: { description: "Mutlak değer" },
  },
  SIN: {
    en: { description: "Sine (deg)" },
    ru: { description: "Синус (в градусах)" },
    tr: { description: "Sinüs (derece)" },
  },
  COS: {
    en: { description: "Cosine (deg)" },
    ru: { description: "Косинус (в градусах)" },
    tr: { description: "Kosinüs (derece)" },
  },
  SQRT: {
    en: { description: "Square root" },
    ru: { description: "Квадратный корень" },
    tr: { description: "Karekök" },
  },

  // Interrupts
  INTERRUPT: {
    en: {
      description: "Interrupt declaration.",
      syntax: "INTERRUPT DECL 10 WHEN $IN[1]==TRUE DO SubProg()",
    },
    ru: {
      description: "Объявление прерывания.",
      syntax: "INTERRUPT DECL 10 WHEN $IN[1]==TRUE DO Подпрограмма()",
    },
    tr: {
      description: "Kesme tanımlama.",
      syntax: "INTERRUPT DECL 10 WHEN $IN[1]==TRUE DO AltProg()",
    },
  },
  BRAKE: {
    en: { description: "Brakes the robot movement within an interrupt." },
    ru: { description: "Торможение робота внутри прерывания." },
    tr: { description: "Kesme içinde robotu frenler." },
  },
  RESUME: {
    en: {
      description:
        "Aborts the current movement and resumes main program structure.",
    },
    ru: {
      description:
        "Прерывает текущее движение и возвращает управление в основную структуру (сбрасывает стек).",
    },
    tr: { description: "Mevcut hareketi iptal eder ve ana programa döner." },
  },
  TRIGGER: {
    en: {
      description: "Path triggers (synced with path).",
      syntax: "TRIGGER WHEN DISTANCE=0 DELAY=0 DO ...",
    },
    ru: {
      description: "Триггер на траектории.",
      syntax: "TRIGGER WHEN DISTANCE=0 DELAY=0 DO ...",
    },
    tr: {
      description: "Yörünge tetikleyicisi.",
      syntax: "TRIGGER WHEN DISTANCE=0 DELAY=0 DO ...",
    },
  },
};

/**
 * Gets localized documentation for a KRL keyword.
 */
export function getKeywordDoc(
  keyword: string,
  locale: string,
): string | undefined {
  const key = keyword.toUpperCase();
  // Safe locale access
  const safeLocale = (
    locale.startsWith("ru") ? "ru" : locale.startsWith("tr") ? "tr" : "en"
  ) as Locale;

  // Try direct match
  let doc = docs[key];

  // Try stripping "B_" for bitwise if not found
  if (!doc && key.startsWith("B_")) {
    // Maybe logic map covers it?
    // For now precise match preferred.
  }

  // Handle SIGNAL specially if needed, currently key is "SIGNAL" in parser
  if (!doc && key === "SIGNAL") doc = docs["Signal"]; // Case fix if needed

  if (!doc) return undefined;

  const locDoc = doc[safeLocale] || doc["en"];

  let md = `**${key}**\n\n${locDoc.description}`;
  if (locDoc.syntax) {
    md += `\n\n**Syntax:**\n\`${locDoc.syntax}\``;
  }
  if (locDoc.example) {
    md += `\n\n**Example:**\n\`\`\`krl\n${locDoc.example}\n\`\`\``;
  }

  return md;
}
