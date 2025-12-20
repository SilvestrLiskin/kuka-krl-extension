// KSS 8.7 Sistem Değişkenleri
// Bu liste KUKA System Software 8.7'deki standart sistem değişkenlerini içerir
export const KSS_87_SYSTEM_VARS = [
  // Mesaj ve durum
  '$MSG_T',
  // Fren ve hareket
  '$BRAKE_SIG',
  '$MOVE_ENABLE',
  '$DRIVES_ON',
  '$DRIVES_OFF',
  '$ALARM_STOP',
  // Çalışma modları
  '$T1',
  '$T2',
  '$AUT',
  '$EXT',
  // Program durumu
  '$PRO_ACT',
  '$PRO_IP',
  '$PRO_MOVE',
  '$PRO_STATE0',
  '$PRO_STATE1',
  // Pozisyon ve kinematik
  '$POS_ACT',
  '$POS_INT',
  '$AXIS_ACT',
  '$AXIS_ACT_MES',
  '$AXIS_INC',
  '$VEL_ACT',
  '$TORQUE_AXIS',
  '$POWER_FAIL',
  '$ROB_CAL',
  '$MEAS_PULSE',
  '$CURR_ACT',
  // Hız ayarları
  '$OV_PRO',
  '$OV_JOG',
  '$VEL',
  '$VEL_AXIS',
  '$VEL_CP',
  '$VEL_ORI',
  '$VEL_ROTAX',
  '$VEL_EXTAX',
  // Zamanlayıcılar
  '$TIMER',
  '$TIMER_STOP',
  '$TIMER_FLAG',
  // Bayraklar
  '$CYCFLAG',
  '$FLAG',
  // Giriş/Çıkış
  '$IN',
  '$OUT',
  '$ANIN',
  '$ANOUT',
  '$DIGIN',
  '$DIGOUT',
  // Tarih/Saat
  '$DATE',
  '$ROB_TIMER',
  // Mod ve koordinat sistemi
  '$MODE_OP',
  '$NULLFRAME',
  '$WORLD',
  '$ROOT',
  '$TOOL',
  '$BASE',
  '$LOAD',
  '$ROBROOT',
  // Hız ve ivme parametreleri
  '$ACC',
  '$ACC_AXIS',
  '$ACC_CP',
  '$ACC_ORI',
  '$ACC_ROTAX',
  '$ACC_EXTAX',
  '$APO',
  '$ADVANCE',
  // Tool, Base, Load verileri
  '$TOOL_DATA',
  '$BASE_DATA',
  '$LOAD_DATA',
  '$EX_AX_DATA',
  '$ACT_BASE',
  '$ACT_TOOL',
  '$ACT_EX_AX',
  // Hareket kontrol
  '$CIRC_TYPE',
  '$ORI_TYPE',
  '$IPO_MODE',
  '$CP_DOF',
  '$ASYNC_EX_AX_DECOUPLE',
  '$INITMOV',
  '$BWDSTART',
  // Submit yorumlayıcı
  '$STOPMESS',
  '$STOP_MESS',
  '$PSER',
  '$RI',
  // Koordinat dönüşüm
  '$H_POS',
  '$AXIS_FOR',
  '$AXIS_BACK',
  '$AXIS_DIR',
  // Interrupt değişkenleri
  '$CYCINT',
  '$ADAP_ACC',
  // Robot özellikleri
  '$H_ROBA',
  '$ROBCOR',
  '$FDYN',
  // Spline
  '$SPLINE_ENABLE',
  // PTP ve CP parametreleri
  '$PTP_PARAMS',
  '$CP_PARAMS',
  '$LDAT_ACT',
  '$PDAT_ACT',
  '$FDAT_ACT',
  '$LDAT',
  '$PDAT',
  '$FDAT',
  // Ek değişkenler
  '$ON_PATH',
  '$ON_PATH_EX',
  '$ESTOP',
  '$BS_EM',
  '$SAFETY_SW',
];
