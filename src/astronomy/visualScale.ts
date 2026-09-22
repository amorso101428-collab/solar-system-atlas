/**
 * VisualScaleSystem（v5 §2 / §3）。
 *
 * **真实数据与艺术坐标彻底分离**：数据层只保存真实值（AU、km），
 * 所有显示坐标都由这里的非线性映射算出来，任何地方都不允许写
 * `displayPosition = realPosition * ONE_GLOBAL_SCALE`。
 *
 * 三条曲线：
 *   mapAuToVisual()           轨道半径：分段单调映射，保留真实远近排序，
 *                             内太阳系明显分层，Mars → Jupiter 留出可见断层，
 *                             外行星继续展开但不无限外扩。
 *   planetVisualRadius()      行星半径：幂律压缩，保住"木星明显比地球大"的真实比例感。
 *   moonVisualRadius()        天然卫星半径：更强的压缩，避免卫星吞掉轨道间距。
 */

/**
 * 轨道半径的分段控制点：[真实 AU, 视觉半径]。
 * 相邻行星的间距就是"视觉分层"，火星→木星那一段刻意留出 22 单位的空区
 * （小行星带正好落在里面）。
 *
 * 外太阳系的间距按"每个行星系统的盘半径 + 4~6 单位净空"倒推：
 *   木星盘 10.6 / 土星盘 12.6（含 2.35 倍半径的环）/ 天王星盘 7.6 / 海王星盘 5.8，
 * 所以 66 → 96 → 118 → 133 → 144 这一段里，相邻两圈的同心圆永远不会叠在一起
 * （旧版的 70 → 90 让木星的最外圈正好切进土星环）。
 */
const AU_STOPS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [0.387, 16], // Mercury —— 让开太阳（视觉半径 7.5 + 日冕）
  [0.723, 28], // Venus
  [1.0, 40], // Earth —— 水星→地球 = 水星→金星 × 2（24 = 12 × 2）
  [1.524, 55], // Mars
  /**
   * v8 §13：外太阳系重新拉开。判据不是"看着差不多"，而是
   * **相邻两个行星盘的半径之和 + 6 单位净空**（盘半径见 utils/layout 的 DISK_RADIUS，
   * 含环与同心圆的实际外缘）：
   *   木星盘 12.2 → 88          空出 100.2
   *   土星盘 14.5 → 122（122-14.5=107.5 > 100.2+6）
   *   天王星盘 8.8 → 152（152-8.8=143.2 > 136.5+6）
   *   海王星盘 6.7 → 175（175-6.7=168.3 > 160.8+6）
   *   冥王星盘 5.0 → 194（194-5=189 > 181.7+6）
   * 旧版的 79 → 106 → 130 → 148 让木星的同心圆切进土星环，
   * 聚焦木星时背景全是土星的轨道线。
   */
  [5.203, 88], // Jupiter
  [9.537, 122], // Saturn
  [19.19, 152], // Uranus
  [30.07, 175], // Neptune
  [39.48, 194], // Pluto
]

/** 真实 AU → 视觉轨道半径（分段线性 + 末端线性外推） */
export function mapAuToVisual(au: number): number {
  const value = Math.max(0, au)
  for (let i = 1; i < AU_STOPS.length; i++) {
    const [auA, rA] = AU_STOPS[i - 1]!
    const [auB, rB] = AU_STOPS[i]!
    if (value <= auB) {
      const k = (value - auA) / (auB - auA)
      return rA + (rB - rA) * k
    }
  }
  const [auLast, rLast] = AU_STOPS[AU_STOPS.length - 1]!
  const [auPrev, rPrev] = AU_STOPS[AU_STOPS.length - 2]!
  const slope = (rLast - rPrev) / (auLast - auPrev)
  return rLast + (value - auLast) * slope
}

/** 单调三次插值的斜率（Fritsch–Carlson），保证曲线不过冲、不产生折角 */
function pchipSlopes(xs: number[], ys: number[]): number[] {
  const n = xs.length
  const h: number[] = []
  const delta: number[] = []
  for (let i = 0; i < n - 1; i++) {
    h.push(xs[i + 1]! - xs[i]!)
    delta.push((ys[i + 1]! - ys[i]!) / h[i]!)
  }
  const m = new Array<number>(n).fill(0)
  m[0] = delta[0]!
  m[n - 1] = delta[n - 2]!
  for (let i = 1; i < n - 1; i++) {
    const d0 = delta[i - 1]!
    const d1 = delta[i]!
    if (d0 * d1 <= 0) {
      m[i] = 0
    } else {
      const w1 = 2 * h[i]! + h[i - 1]!
      const w2 = h[i]! + 2 * h[i - 1]!
      m[i] = (w1 + w2) / (w1 / d0 + w2 / d1)
    }
  }
  return m
}

const AU_XS = AU_STOPS.map((stop) => stop[0])
const AU_YS = AU_STOPS.map((stop) => stop[1])
const AU_MS = pchipSlopes(AU_XS, AU_YS)

/**
 * 同一条曲线的**光滑**版本（v8.1）。
 *
 * 分段线性映射在每一个行星停点处都有斜率突变，拿它去画彗星轨道时，
 * 一条本来干净的椭圆会被折成有棱角的形状——用户看到的就是"轨道不规则"。
 * 这里用单调三次插值：仍然过所有停点（所以"1 AU 就在地球轨道上"这条不变），
 * 但整条曲线是 C1 连续的，椭圆读起来就是椭圆。
 */
export function mapAuToVisualSmooth(au: number): number {
  const value = Math.max(0, au)
  const n = AU_XS.length
  for (let i = 1; i < n; i++) {
    if (value <= AU_XS[i]!) {
      const x0 = AU_XS[i - 1]!
      const x1 = AU_XS[i]!
      const h = x1 - x0
      const t = (value - x0) / h
      const t2 = t * t
      const t3 = t2 * t
      const h00 = 2 * t3 - 3 * t2 + 1
      const h10 = t3 - 2 * t2 + t
      const h01 = -2 * t3 + 3 * t2
      const h11 = t3 - t2
      return (
        h00 * AU_YS[i - 1]! + h10 * h * AU_MS[i - 1]! + h01 * AU_YS[i]! + h11 * h * AU_MS[i]!
      )
    }
  }
  // 末端线性外推，和分段版保持一致
  const last = n - 1
  return AU_YS[last]! + (value - AU_XS[last]!) * AU_MS[last]!
}

/**
 * 太阳的视觉半径（v6 §1）。
 *
 * 真实值：太阳 695,700 km，木星 69,911 km —— 太阳半径是木星的 **9.95 倍**。
 * 按真实比例画，太阳会吞掉水星轨道；按"看着酷"随手定大小，就会出现
 * "太阳比木星还小、土星比木星还大"这种层级错误。
 *
 * 这里取 7.5：**明显大于木星（4.20）**，又留得住水星轨道（16）。
 * 真正的恒星感交给日冕、色球层与 bloom，而不是把球体本身撑大。
 */
export const SUN_VISUAL_RADIUS = 7.5

/** 木星的视觉半径：整个行星尺寸系统的基准单位 */
export const JUPITER_VISUAL_RADIUS = 4.2
const JUPITER_KM = 69911

/**
 * 行星视觉半径：**保序压缩**（v6 §1）。
 *
 *   R = R_木星 × (km / km_木星) ^ 0.5
 *
 * NASA 数据下这条曲线给出：
 *   木星 4.20 > 土星 3.83 > 天王星 2.53 ≈ 海王星 2.49 > 地球 1.27 > 金星 1.24
 *   > 火星 0.92 > 水星 0.78 > 冥王星 0.55
 *
 * 旧版用 0.036·km^0.42（本质是"整体缩放的幂律"），地球/木星只剩 0.37、
 * 水星/木星 0.24，木星与土星几乎一样大——层级读不出来。指数 0.5 的压缩
 * 让每颗行星之间的差距更接近真实比例，同时太阳仍然装得下。
 */
export function planetVisualRadius(radiusKm: number): number {
  return JUPITER_VISUAL_RADIUS * Math.sqrt(Math.max(radiusKm, 1) / JUPITER_KM)
}

/**
 * 天然卫星视觉半径：同一条曲线的 0.42 次方版本（比行星压得更狠一档）。
 * 月球 ≈ 0.27（地球的 21%，真实 27%）、木卫三 0.32、土卫六 0.31、土卫一 0.087。
 * 这样一颗行星的十几颗卫星才能在自己的轨道盘里排开而不互相重叠。
 */
export function moonVisualRadius(radiusKm: number): number {
  return 0.0115 * Math.pow(Math.max(radiusKm, 0.5), 0.42)
}

/** 小行星带 / 柯伊伯带的视觉区间，直接用 AU 走同一条曲线 */
export const BELT_AU = { inner: 2.1, outer: 3.3 }
export const KUIPER_AU = { inner: 30, outer: 50 }

/** 图谱默认要装下的最大半径（含柯伊伯带内侧） */
/** 图谱默认取景半径：刚好装下冥王星轨道与柯伊伯带内侧 */
export const ATLAS_OUTER_RADIUS = mapAuToVisual(39.48) + 5
