/** 仿真标定与车辆常量（与各子系统共用） */
export const CONST = {
  MAX_TRACTION_ACC: 1.0,
  MAX_SERVICE_BRK: 1.1,
  EB_BRAKE: 1.3,
  ATP_OVERSPEED_MARGIN: 5,
  ATP_WARN_MARGIN: 2,
  RM_LIMIT: 25,
  URM_LIMIT: 15,
  AM_REC_OFFSET: 5,
  ATO_CRUISE_DEADBAND_KMH: 2,
  ATO_APPROACH_DIST_M: 180,
  /** 对标容差（m），ATO 车门允许阈值 — 约 ±5 cm 量级 */
  STOP_TOLERANCE: 0.05,
  /** RM/CM/AM/FAM 共性进站判窗 (m)：仅当距停车标较近且已近静止时进入 dwelling；位置由加速度积分得出 */
  ATO_ARRIVAL_WINDOW_M: 10,
  /**
   * AM/FAM 停站 dwelling 内、欠标时正向位置收束的最大剩余距离（m）；冲标侧不使用（无倒车修正）。
   * 须 ≥ 判窗：否则判到后可能出现的欠标（可达窗宽量级）无法收束，界面长期显示数米级误差。
   */
  ATO_DWELL_ALIGN_ASSIST_MAX_M: 12,
  CMD_ACC_TAU: 0.32,
  /** 自动模式进站末段：距标≤此长度内走统一距离-速度+蠕动轨迹。须 < 首站到出库点间距，否则出库即整段蠕动、ATO 起步极慢 */
  ATO_PRECISION_ZONE_M: 175,
  /** 距标≤此且自动模式时不施加 limCrit 巡航「提前拖死」限速 */
  ATO_SUPPRESS_LIM_CRIT_M: 260,
  /** 驻车 / 近标蠕动 PD（仅 dwell 内 dockingAcc 使用） */
  ATO_DOCK_KP: 5.5,
  ATO_DOCK_KD: 3.8,
  /**
   * ATP 站内常用制动曲线相对停车标的前移 (m)。
   * 过大会在离标尚远时即把允许速度降到 0，ATO/人工都会出现「系统性欠标」约同一数量级；
   * 实车仍有车钩/应答器冗余，仿真用与 ATO_STOP 同量级的小前移即可（EBI 仍可防冲标）。
   */
  ATP_STOP_MARGIN_M: 0.5,
  ATO_STOP_MARGIN_M: 0.35,
  ATO_BLEND_STATION_M: 600,
  ATO_CREEP_M: 26,
  /** 进站走廊：从 (CREEP_M+此值) 到 CREEP_M 平滑引入蠕动帽，避免距标≈26m 处 vReq 断崖导致滤波滞后冲标 */
  ATO_CREEP_BLEND_M: 22,

  G_DT: 1 / 30,

  /**
   * 站台门：列车门关闭后，PSD 继续关闭并锁紧的回读延时 (ms)。
   * 此期间 DMI 20 区显示「站台门未关闭」；到点后视为关闭锁紧，20 区熄灭。
   */
  PSD_PLATFORM_CLOSE_MS: 2000,

  /**
   * DMI 18 区「可以关门」：开门后须经过的乘降示意时长 (ms)，再显示关门提示。
   */
  DMI_Z18_CLOSE_HINT_DELAY_MS: 10000,

  /** 无门允许却操作开门时，DMI 17 区「非法打开」(c-z17=8) 保持时长 (ms) */
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
