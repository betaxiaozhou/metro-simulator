/** 仿真标定与车辆常量（与各子系统共用） */
export const CONST = {
  MAX_TRACTION_ACC: 1.0,
  MAX_SERVICE_BRK: 1.1,
  EB_BRAKE: 1.3,
  ATP_OVERSPEED_MARGIN: 5,
  ATP_WARN_MARGIN: 2,
  RM_LIMIT: 25,
  AM_REC_OFFSET: 5,
  ATO_CRUISE_DEADBAND_KMH: 2,
  ATO_APPROACH_DIST_M: 180,
  /**
   * ATO 理想进站曲线所用的制动强度比例（相对 MAX_SERVICE_BRK）。
   * 实车曲线偏保守；仿真若取满额常用制动且指令又有滤波滞后，易出现「跟不上曲线」冲标，故 envelope 略收紧。
   */
  ATO_ENVELOPE_DECEL_SCALE: 0.74,
  /** 剩余距离 kinematic 制动 min(|a|) = v²/(2d) 的安全放大，消化 CMD_ACC_TAU 建压滞后 */
  ATO_STOP_KINEMATIC_SAFETY: 1.14,
  /** 对标容差（m），ATO 车门允许阈值 — 约 ±5 cm 量级 */
  STOP_TOLERANCE: 0.05,
  /**
   * 进入 dwelling（对标停稳）的最大纵向误差 |车头位置 − 停车标|（m）。
   * 过小且无末端蠕动时会永远无法「到站」；过大则会在距标尚远（实测 ~1.35 m）且低速时被误判到站。
   */
  ATO_ARRIVAL_WINDOW_M: 0.42,
  CMD_ACC_TAU: 0.32,
  /** 距标≤此且自动模式时不施加 limCrit 巡航「提前拖死」限速 */
  ATO_SUPPRESS_LIM_CRIT_M: 260,
  /**
   * ATP 站内常用制动曲线相对停车标的前移 (m)。
   * 过大会在离标尚远时即把允许速度降到 0，ATO/人工都会出现「系统性欠标」约同一数量级；
   * 实车仍有车钩/应答器冗余，仿真用与 ATO_STOP 同量级的小前移即可（EBI 仍可防冲标）。
   */
  ATP_STOP_MARGIN_M: 0.5,
  ATO_STOP_MARGIN_M: 0.35,
  ATO_BLEND_STATION_M: 600,

  G_DT: 1 / 30,

  /**
   * 站台门：列车门关闭后，PSD 继续关闭并锁紧的回读延时 (ms)。
   * 此期间 DMI 20 区显示「站台门未关闭」；到点后视为关闭锁紧，20 区熄灭。
   */
  PSD_PLATFORM_CLOSE_MS: 2000,

  /**
   * AM/FAM · A/A：自**进站 dwelling 起算**的仿真停站时间（s），达到后**自动关门**。
   * 与 DMI「请关门」、与「建议发车」均为**独立**参数，可分别标定。
   */
  STATION_AA_AUTOCLOSE_DWELL_S: 20,

  /**
   * DMI 18 区**建议发车（晚点预警）**上行箭头：自**到站** `departSuggestEpochMs` 起算的墙钟秒数；
   * 非 ATP 许可，且**不得**与 A/A 自动关门共用同一常量。
   */
  STATION_DWELL_DEPART_HINT_S: 24,

  /** DMI 建议发车锚点：列车越过停车标前方此距离 (m) 后清除本站晚点预警时钟 */
  DEPART_SUGGEST_CLEAR_PAST_STATION_M: 110,

  /** 仍可视为停留在锚点站台附近的最大 |Δ位置| (m)，防止途中误亮建议发车 */
  DEPART_SUGGEST_ANCHOR_RADIUS_M: 140,

  /**
   * DMI 18 区「请关门」：自**本次开门** `doorOpenedAtMs` 起算的墙钟 (ms)，到时显示关门提示。
   */
  DMI_Z18_CLOSE_HINT_DELAY_MS: 20000,

  /** 无门允许却操作开门时告警窗口；仅车门未全关时 DMI 17 区才显示「非法打开」(c-z17=8) */
  DMI_DOOR_ILLEGAL_INDICATE_MS: 5000,

  /** 牵引/电制动电流模型（多台逆变器并联等效为安培，示意量纲） */
  MOTOR_I_REF_A: 720,
  /** 低速以下再生能力快速衰减起点 (km/h) */
  REGEN_KNEE_KMH_LOW: 4,
  /** 高速区再生能力下降起点 (km/h) */
  REGEN_FADE_START_KMH: 70,
  /** 常用制动中归因于电制动（再生）的能量份额，其余折算为摩擦/空压机制动 */
  ELEC_BRAKE_SHARE_SB: 0.88,
  /** 快速/紧急制动仍以空气制动为主，电制动仅占小份额 */
  ELEC_BRAKE_SHARE_RAPID: 0.14,
  /** 电流指令一阶滤波 (s)，略快于机械制动建压 */
  MOTOR_CURRENT_TAU_S: 0.1,
};
