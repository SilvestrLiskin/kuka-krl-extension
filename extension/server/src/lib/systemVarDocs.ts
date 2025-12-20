/**
 * Документация системных переменных KUKA KSS 8.7
 * Documentation for KUKA system variables with descriptions in multiple languages
 */

export interface SystemVarDoc {
  name: string;
  type: string;
  description: {
    en: string;
    ru: string;
    tr: string;
  };
  example?: string;
  range?: string;
}

export const SYSTEM_VAR_DOCS: SystemVarDoc[] = [
  // Coordinate Systems
  {
    name: '$TOOL',
    type: 'FRAME',
    description: {
      en: 'Current tool coordinate system. Defines the TCP (Tool Center Point) relative to the flange.',
      ru: 'Текущая система координат инструмента. Определяет TCP (Tool Center Point) относительно фланца.',
      tr: 'Mevcut alet koordinat sistemi. TCP (Alet Merkez Noktası) flanşa göre tanımlar.',
    },
    example: '$TOOL = TOOL_DATA[1]',
  },
  {
    name: '$BASE',
    type: 'FRAME',
    description: {
      en: 'Current base coordinate system. Defines the workpiece coordinate system.',
      ru: 'Текущая система координат базы. Определяет систему координат заготовки.',
      tr: 'Mevcut taban koordinat sistemi. İş parçası koordinat sistemini tanımlar.',
    },
    example: '$BASE = BASE_DATA[1]',
  },
  {
    name: '$LOAD',
    type: 'LOAD',
    description: {
      en: 'Current load data (mass, center of gravity, inertia).',
      ru: 'Текущие данные нагрузки (масса, центр тяжести, инерция).',
      tr: 'Mevcut yük verileri (kütle, ağırlık merkezi, atalet).',
    },
    example: '$LOAD = LOAD_DATA[1]',
  },
  {
    name: '$NULLFRAME',
    type: 'FRAME',
    description: {
      en: 'Zero frame with all values set to 0.',
      ru: 'Нулевой фрейм со всеми значениями 0.',
      tr: 'Tüm değerleri 0 olan sıfır çerçeve.',
    },
  },
  {
    name: '$WORLD',
    type: 'FRAME',
    description: {
      en: 'World coordinate system. Fixed reference frame.',
      ru: 'Мировая система координат. Фиксированная система отсчёта.',
      tr: 'Dünya koordinat sistemi. Sabit referans çerçevesi.',
    },
  },
  {
    name: '$ROBROOT',
    type: 'FRAME',
    description: {
      en: 'Robot root (base) coordinate system.',
      ru: 'Координатная система корня (основания) робота.',
      tr: 'Robot kök (taban) koordinat sistemi.',
    },
  },

  // Data Arrays
  {
    name: '$TOOL_DATA',
    type: 'FRAME[16]',
    description: {
      en: 'Array of 16 tool coordinate systems. Use $TOOL = TOOL_DATA[n] to activate.',
      ru: 'Массив из 16 систем координат инструмента. Используйте $TOOL = TOOL_DATA[n] для активации.',
      tr: '16 alet koordinat sistemi dizisi. Etkinleştirmek için $TOOL = TOOL_DATA[n] kullanın.',
    },
    example: 'TOOL_DATA[1] = {X 100, Y 0, Z 150, A 0, B 90, C 0}',
  },
  {
    name: '$BASE_DATA',
    type: 'FRAME[32]',
    description: {
      en: 'Array of 32 base coordinate systems. Use $BASE = BASE_DATA[n] to activate.',
      ru: 'Массив из 32 систем координат базы. Используйте $BASE = BASE_DATA[n] для активации.',
      tr: '32 taban koordinat sistemi dizisi. Etkinleştirmek için $BASE = BASE_DATA[n] kullanın.',
    },
    example: 'BASE_DATA[1] = {X 500, Y 200, Z 0, A 0, B 0, C 90}',
  },
  {
    name: '$LOAD_DATA',
    type: 'LOAD[16]',
    description: {
      en: 'Array of 16 load data sets. Contains mass, center of gravity, inertia values.',
      ru: 'Массив из 16 наборов данных нагрузки. Содержит массу, центр тяжести, значения инерции.',
      tr: '16 yük veri seti dizisi. Kütle, ağırlık merkezi, atalet değerlerini içerir.',
    },
  },
  {
    name: '$EX_AX_DATA',
    type: 'EX_AX[6]',
    description: {
      en: 'External axis data array. Configuration for additional axes E1-E6.',
      ru: 'Массив данных внешних осей. Конфигурация для дополнительных осей E1-E6.',
      tr: 'Dış eksen veri dizisi. Ek eksenler E1-E6 yapılandırması.',
    },
  },

  // Velocity Settings
  {
    name: '$VEL',
    type: 'VEL_STRUC',
    description: {
      en: 'Velocity settings structure with CP, ORI1, ORI2 components.',
      ru: 'Структура настроек скорости с компонентами CP, ORI1, ORI2.',
      tr: 'CP, ORI1, ORI2 bileşenleriyle hız ayarları yapısı.',
    },
  },
  {
    name: '$VEL.CP',
    type: 'REAL',
    description: {
      en: 'Cartesian path velocity in m/s. Maximum 2 m/s for safety.',
      ru: 'Скорость по траектории в м/с. Максимум 2 м/с для безопасности.',
      tr: 'Kartezyen yol hızı m/s cinsinden. Güvenlik için maksimum 2 m/s.',
    },
    example: '$VEL.CP = 0.5',
    range: '0.0 - 2.0 m/s (recommended)',
  },
  {
    name: '$VEL.ORI1',
    type: 'REAL',
    description: {
      en: 'Swivel velocity (ABC rotation) in degrees/s.',
      ru: 'Скорость поворота (вращение ABC) в градусах/с.',
      tr: 'Dönme hızı (ABC döndürme) derece/s cinsinden.',
    },
    example: '$VEL.ORI1 = 100',
  },
  {
    name: '$VEL.ORI2',
    type: 'REAL',
    description: {
      en: 'Rotation velocity around tool axis in degrees/s.',
      ru: 'Скорость вращения вокруг оси инструмента в градусах/с.',
      tr: 'Alet ekseni etrafında dönme hızı derece/s cinsinden.',
    },
    example: '$VEL.ORI2 = 100',
  },
  {
    name: '$VEL_AXIS',
    type: 'REAL[12]',
    description: {
      en: 'Axis-specific velocity in % for PTP motions (A1-A6, E1-E6).',
      ru: 'Скорость осей в % для PTP движений (A1-A6, E1-E6).',
      tr: 'PTP hareketleri için eksen-spesifik hız % (A1-A6, E1-E6).',
    },
    range: '0 - 100%',
  },

  // Acceleration Settings
  {
    name: '$ACC',
    type: 'ACC_STRUC',
    description: {
      en: 'Acceleration settings structure with CP, ORI1, ORI2 components.',
      ru: 'Структура настроек ускорения с компонентами CP, ORI1, ORI2.',
      tr: 'CP, ORI1, ORI2 bileşenleriyle ivme ayarları yapısı.',
    },
  },
  {
    name: '$ACC.CP',
    type: 'REAL',
    description: {
      en: 'Cartesian path acceleration in m/s².',
      ru: 'Ускорение по траектории в м/с².',
      tr: 'Kartezyen yol ivmesi m/s² cinsinden.',
    },
    example: '$ACC.CP = 1.0',
  },
  {
    name: '$ACC_AXIS',
    type: 'REAL[12]',
    description: {
      en: 'Axis-specific acceleration in % for PTP motions.',
      ru: 'Ускорение осей в % для PTP движений.',
      tr: 'PTP hareketleri için eksen-spesifik ivme %.',
    },
    range: '0 - 100%',
  },

  // Approximation (APO)
  {
    name: '$APO',
    type: 'APO_STRUC',
    description: {
      en: 'Approximation settings for continuous path motion (blending).',
      ru: 'Настройки аппроксимации для непрерывного движения (сопряжения).',
      tr: 'Sürekli yol hareketi (karıştırma) için yaklaşım ayarları.',
    },
  },
  {
    name: '$APO.CDIS',
    type: 'REAL',
    description: {
      en: 'Distance-based approximation in mm. Blending starts this far from target.',
      ru: 'Аппроксимация по расстоянию в мм. Сопряжение начинается на этом расстоянии от цели.',
      tr: 'mm cinsinden mesafe tabanlı yaklaşım. Karıştırma hedeften bu uzaklıkta başlar.',
    },
    example: '$APO.CDIS = 50',
  },
  {
    name: '$APO.CPTP',
    type: 'INT',
    description: {
      en: 'PTP approximation as percentage (0-100%).',
      ru: 'PTP аппроксимация в процентах (0-100%).',
      tr: 'PTP yaklaşımı yüzde olarak (0-100%).',
    },
    example: '$APO.CPTP = 50',
    range: '0 - 100%',
  },
  {
    name: '$APO.CVEL',
    type: 'REAL',
    description: {
      en: 'Velocity-based approximation in %.',
      ru: 'Аппроксимация по скорости в %.',
      tr: 'Hız tabanlı yaklaşım %.',
    },
  },
  {
    name: '$APO.CORI',
    type: 'REAL',
    description: {
      en: 'Orientation-based approximation in degrees.',
      ru: 'Аппроксимация по ориентации в градусах.',
      tr: 'Derece cinsinden yönelim tabanlı yaklaşım.',
    },
  },

  // Override
  {
    name: '$OV_PRO',
    type: 'INT',
    description: {
      en: 'Program override (speed) in %. Affects all programmed motions.',
      ru: 'Программный оверрайд (скорость) в %. Влияет на все программные движения.',
      tr: 'Program geçersiz kılma (hız) %. Tüm programlı hareketleri etkiler.',
    },
    range: '0 - 100%',
    example: '$OV_PRO = 50  ; Run at 50% speed',
  },
  {
    name: '$OV_JOG',
    type: 'INT',
    description: {
      en: 'Jog override in %. Affects manual (jogging) motions.',
      ru: 'Оверрайд ручного управления в %. Влияет на ручные движения.',
      tr: 'Jog geçersiz kılma %. Manuel (jogging) hareketlerini etkiler.',
    },
    range: '0 - 100%',
  },

  // Position Variables
  {
    name: '$POS_ACT',
    type: 'E6POS',
    description: {
      en: 'Current actual Cartesian position (X, Y, Z, A, B, C, S, T, E1-E6).',
      ru: 'Текущая фактическая декартова позиция (X, Y, Z, A, B, C, S, T, E1-E6).',
      tr: 'Mevcut gerçek Kartezyen konum (X, Y, Z, A, B, C, S, T, E1-E6).',
    },
  },
  {
    name: '$AXIS_ACT',
    type: 'E6AXIS',
    description: {
      en: 'Current actual axis position (A1-A6, E1-E6) in degrees.',
      ru: 'Текущая фактическая позиция осей (A1-A6, E1-E6) в градусах.',
      tr: 'Mevcut gerçek eksen konumu (A1-A6, E1-E6) derece cinsinden.',
    },
  },
  {
    name: '$POS_INT',
    type: 'E6POS',
    description: {
      en: 'Interpolated (setpoint) Cartesian position.',
      ru: 'Интерполированная (заданная) декартова позиция.',
      tr: 'İnterpolasyon yapılmış (ayar noktası) Kartezyen konum.',
    },
  },

  // Advance Run
  {
    name: '$ADVANCE',
    type: 'INT',
    description: {
      en: 'Advance run pointer distance. Number of motion blocks read ahead.',
      ru: 'Расстояние предварительного просмотра. Количество блоков движения, читаемых вперёд.',
      tr: 'Önceden çalışma işaretçi mesafesi. Önceden okunan hareket bloğu sayısı.',
    },
    range: '0 - 5',
    example: '$ADVANCE = 3',
  },

  // Operating Modes
  {
    name: '$MODE_OP',
    type: 'ENUM',
    description: {
      en: 'Current operating mode: #T1, #T2, #AUT, #EXT.',
      ru: 'Текущий режим работы: #T1, #T2, #AUT, #EXT.',
      tr: 'Mevcut çalışma modu: #T1, #T2, #AUT, #EXT.',
    },
  },
  {
    name: '$T1',
    type: 'BOOL',
    description: {
      en: 'TRUE if in T1 (manual reduced speed) mode. Max 250 mm/s.',
      ru: 'TRUE если в режиме T1 (ручной с пониженной скоростью). Макс 250 мм/с.',
      tr: 'T1 (manuel düşük hız) modundaysa TRUE. Maks 250 mm/s.',
    },
  },
  {
    name: '$T2',
    type: 'BOOL',
    description: {
      en: 'TRUE if in T2 (manual full speed) mode.',
      ru: 'TRUE если в режиме T2 (ручной с полной скоростью).',
      tr: 'T2 (manuel tam hız) modundaysa TRUE.',
    },
  },
  {
    name: '$AUT',
    type: 'BOOL',
    description: {
      en: 'TRUE if in Automatic mode.',
      ru: 'TRUE если в автоматическом режиме.',
      tr: 'Otomatik moddaysa TRUE.',
    },
  },
  {
    name: '$EXT',
    type: 'BOOL',
    description: {
      en: 'TRUE if in External Automatic mode (PLC control).',
      ru: 'TRUE если в режиме внешнего автомата (управление ПЛК).',
      tr: 'Harici Otomatik moddaysa (PLC kontrolü) TRUE.',
    },
  },

  // Timers
  {
    name: '$TIMER',
    type: 'REAL[32]',
    description: {
      en: 'Array of 32 timers. Counts in milliseconds when enabled.',
      ru: 'Массив из 32 таймеров. Считает в миллисекундах когда включён.',
      tr: '32 zamanlayıcı dizisi. Etkinleştirildiğinde milisaniye cinsinden sayar.',
    },
    example: '$TIMER[1] = 0  ; Reset timer 1',
  },
  {
    name: '$TIMER_STOP',
    type: 'BOOL[32]',
    description: {
      en: 'Timer stop flags. TRUE = timer stopped, FALSE = timer running.',
      ru: 'Флаги остановки таймеров. TRUE = таймер остановлен, FALSE = таймер работает.',
      tr: 'Zamanlayıcı durdurma bayrakları. TRUE = durdu, FALSE = çalışıyor.',
    },
    example: '$TIMER_STOP[1] = FALSE  ; Start timer 1',
  },
  {
    name: '$TIMER_FLAG',
    type: 'BOOL[32]',
    description: {
      en: 'Timer overflow flags. Set to TRUE when timer overflows.',
      ru: 'Флаги переполнения таймеров. Устанавливается в TRUE при переполнении.',
      tr: 'Zamanlayıcı taşma bayrakları. Taşınca TRUE olur.',
    },
  },

  // Flags and Cyclic Flags
  {
    name: '$FLAG',
    type: 'BOOL[1024]',
    description: {
      en: 'Array of 1024 global boolean flags for program control.',
      ru: 'Массив из 1024 глобальных булевых флагов для управления программой.',
      tr: 'Program kontrolü için 1024 global boolean bayrak dizisi.',
    },
    example: '$FLAG[1] = TRUE',
  },
  {
    name: '$CYCFLAG',
    type: 'BOOL[32]',
    description: {
      en: 'Cyclic flags. Automatically updated in background cycle.',
      ru: 'Циклические флаги. Автоматически обновляются в фоновом цикле.',
      tr: 'Döngüsel bayraklar. Arka plan döngüsünde otomatik güncellenir.',
    },
  },

  // I/O
  {
    name: '$IN',
    type: 'BOOL[4096]',
    description: {
      en: 'Digital inputs array. $IN[n] reads input n.',
      ru: 'Массив цифровых входов. $IN[n] читает вход n.',
      tr: 'Dijital giriş dizisi. $IN[n] giriş n\'i okur.',
    },
    example: 'IF $IN[1] THEN ...',
  },
  {
    name: '$OUT',
    type: 'BOOL[4096]',
    description: {
      en: 'Digital outputs array. $OUT[n] = TRUE/FALSE sets output n.',
      ru: 'Массив цифровых выходов. $OUT[n] = TRUE/FALSE устанавливает выход n.',
      tr: 'Dijital çıkış dizisi. $OUT[n] = TRUE/FALSE çıkış n\'i ayarlar.',
    },
    example: '$OUT[1] = TRUE  ; Set output 1',
  },
  {
    name: '$ANIN',
    type: 'REAL[32]',
    description: {
      en: 'Analog inputs array. Returns voltage/current values.',
      ru: 'Массив аналоговых входов. Возвращает значения напряжения/тока.',
      tr: 'Analog giriş dizisi. Voltaj/akım değerlerini döndürür.',
    },
  },
  {
    name: '$ANOUT',
    type: 'REAL[32]',
    description: {
      en: 'Analog outputs array. Sets voltage/current output values.',
      ru: 'Массив аналоговых выходов. Устанавливает значения напряжения/тока выходов.',
      tr: 'Analog çıkış dizisi. Voltaj/akım çıkış değerlerini ayarlar.',
    },
  },

  // Program State
  {
    name: '$PRO_ACT',
    type: 'BOOL',
    description: {
      en: 'TRUE if a program is currently active.',
      ru: 'TRUE если программа активна.',
      tr: 'Bir program aktifse TRUE.',
    },
  },
  {
    name: '$PRO_MOVE',
    type: 'BOOL',
    description: {
      en: 'TRUE if robot is currently moving.',
      ru: 'TRUE если робот в движении.',
      tr: 'Robot hareket ediyorsa TRUE.',
    },
  },
  {
    name: '$PRO_IP',
    type: 'BOOL',
    description: {
      en: 'TRUE if program is in interpolation (executing motion).',
      ru: 'TRUE если программа в интерполяции (выполняет движение).',
      tr: 'Program interpolasyon modundaysa (hareket yürütüyor) TRUE.',
    },
  },

  // Robot Status
  {
    name: '$DRIVES_ON',
    type: 'BOOL',
    description: {
      en: 'TRUE if robot drives are powered on.',
      ru: 'TRUE если приводы робота включены.',
      tr: 'Robot sürücüleri açıksa TRUE.',
    },
  },
  {
    name: '$MOVE_ENABLE',
    type: 'BOOL',
    description: {
      en: 'TRUE if robot movement is enabled.',
      ru: 'TRUE если движение робота разрешено.',
      tr: 'Robot hareketi etkinse TRUE.',
    },
  },
  {
    name: '$ALARM_STOP',
    type: 'BOOL',
    description: {
      en: 'TRUE if emergency stop is active.',
      ru: 'TRUE если активен аварийный останов.',
      tr: 'Acil durdurma aktifse TRUE.',
    },
  },
  {
    name: '$STOPMESS',
    type: 'BOOL',
    description: {
      en: 'TRUE if there is an active stop message.',
      ru: 'TRUE если есть активное сообщение останова.',
      tr: 'Aktif bir durdurma mesajı varsa TRUE.',
    },
  },
  {
    name: '$POWER_FAIL',
    type: 'BOOL',
    description: {
      en: 'TRUE if power failure occurred.',
      ru: 'TRUE если произошёл сбой питания.',
      tr: 'Güç kesintisi olduysa TRUE.',
    },
  },

  // Initialization
  {
    name: '$INITMOV',
    type: 'BOOL',
    description: {
      en: 'Movement initialization flag. Set by BAS(#INITMOV).',
      ru: 'Флаг инициализации движения. Устанавливается BAS(#INITMOV).',
      tr: 'Hareket başlatma bayrağı. BAS(#INITMOV) ile ayarlanır.',
    },
  },
  {
    name: '$BWDSTART',
    type: 'BOOL',
    description: {
      en: 'TRUE when program runs backwards (step back mode).',
      ru: 'TRUE когда программа выполняется назад (режим шага назад).',
      tr: 'Program geri çalıştığında (geri adım modu) TRUE.',
    },
  },

  // Date/Time
  {
    name: '$DATE',
    type: 'REAL',
    description: {
      en: 'Current date and time as real number.',
      ru: 'Текущая дата и время как вещественное число.',
      tr: 'Gerçek sayı olarak mevcut tarih ve saat.',
    },
  },
  {
    name: '$ROB_TIMER',
    type: 'INT[16]',
    description: {
      en: 'Robot timers array. System-managed timers.',
      ru: 'Массив таймеров робота. Управляемые системой таймеры.',
      tr: 'Robot zamanlayıcıları dizisi. Sistem yönetimli zamanlayıcılar.',
    },
  },

  // Motion Parameters
  {
    name: '$CIRC_TYPE',
    type: 'ENUM',
    description: {
      en: 'Circular motion type: #BASE, #PATH.',
      ru: 'Тип кругового движения: #BASE, #PATH.',
      tr: 'Dairesel hareket tipi: #BASE, #PATH.',
    },
  },
  {
    name: '$ORI_TYPE',
    type: 'ENUM',
    description: {
      en: 'Orientation control type: #VAR, #CONSTANT, #JOINT.',
      ru: 'Тип управления ориентацией: #VAR, #CONSTANT, #JOINT.',
      tr: 'Yönelim kontrol tipi: #VAR, #CONSTANT, #JOINT.',
    },
  },
  {
    name: '$IPO_MODE',
    type: 'ENUM',
    description: {
      en: 'Interpolation mode: #BASE, #TCP.',
      ru: 'Режим интерполяции: #BASE, #TCP.',
      tr: 'İnterpolasyon modu: #BASE, #TCP.',
    },
  },

  // Spline
  {
    name: '$SPLINE_ENABLE',
    type: 'BOOL',
    description: {
      en: 'Enable/disable spline motion.',
      ru: 'Включить/выключить сплайновое движение.',
      tr: 'Spline hareketini etkinleştir/devre dışı bırak.',
    },
  },

  // Actual Tool/Base
  {
    name: '$ACT_TOOL',
    type: 'INT',
    description: {
      en: 'Index of currently active tool (1-16).',
      ru: 'Индекс текущего активного инструмента (1-16).',
      tr: 'Şu anda aktif aletin indeksi (1-16).',
    },
  },
  {
    name: '$ACT_BASE',
    type: 'INT',
    description: {
      en: 'Index of currently active base (1-32).',
      ru: 'Индекс текущей активной базы (1-32).',
      tr: 'Şu anda aktif tabanın indeksi (1-32).',
    },
  },
];

/**
 * Get documentation for a system variable
 */
export function getSystemVarDoc(varName: string, lang: 'en' | 'ru' | 'tr' = 'en'): string | undefined {
  // Normalize variable name
  const normalized = varName.toUpperCase().replace(/^\$/, '');
  
  const doc = SYSTEM_VAR_DOCS.find(d => 
    d.name.toUpperCase().replace(/^\$/, '') === normalized
  );
  
  if (!doc) return undefined;
  
  let result = `**${doc.name}**: \`${doc.type}\`\n\n`;
  result += doc.description[lang] || doc.description.en;
  
  if (doc.range) {
    result += `\n\n**Range:** ${doc.range}`;
  }
  
  if (doc.example) {
    result += `\n\n**Example:**\n\`\`\`krl\n${doc.example}\n\`\`\``;
  }
  
  return result;
}
