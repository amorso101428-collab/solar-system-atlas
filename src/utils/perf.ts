/**
 * 渲染质量状态（v9.3）。
 *
 * 站点在核显（Intel UHD 之类）上跑不动满血的后处理管线：Bloom + MSAA×4 +
 * 半浮点目标在 1080p 上就能把帧率压到 20 上下。这里放一个模块级对象，
 * 由 `PerfGovernor` 每 1.5 秒按实测帧率调一次渲染比例，PostFX / HUD 只读。
 *
 *   scale 1.0 = 原生分辨率；0.5 = 一半分辨率（GPU 负载约降到 1/4）
 */
export const perfState = {
  /** 当前渲染比例 0.5 … 1 */
  scale: 1,
  /** 最近一次实测帧率 */
  fps: 0,
  /** 是否已经因为性能原因降过画质 */
  degraded: false,
}

/** 渲染比例下限：再低就没有可读性了 */
export const PERF_MIN_SCALE = 0.55
/** 设备像素比上限：4K/高缩放屏上没必要按 2 倍渲染 */
export const PERF_MAX_DPR = 1.5
