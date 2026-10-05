/**
 * Site-level configuration. Replace the social URLs with your own profile
 * links — everything else picks them up automatically.
 */
export const SITE = {
  title: "EARTH",
  edition: "2026 年 10 月版",
  lede: ["地球表面 71% 的蓝色", "一份关于海洋的坐标图谱"],
  description:
    "从海面到 10,924 米的挑战者深渊——这里收录五大洋、12 条主要洋流，以及其中已为人类所知的海洋生命。",
  cta: "进入图谱",
  hints: "拖动旋转 · 滚轮缩放 · 点击查看档案",
  skip: "跳过开场 →",
  copyright: "© 2026 OCEAN ATLAS",
};

export interface SocialLink { label: string; url: string; }

/** TODO: 换成你的主页地址 */
export const SOCIAL: SocialLink[] = [
  { label: "小红书", url: "https://www.xiaohongshu.com/user/profile/REPLACE_ME" },
  { label: "哔哩哔哩", url: "https://space.bilibili.com/REPLACE_ME" },
  { label: "抖音", url: "https://www.douyin.com/user/REPLACE_ME" },
];

export const TELEMETRY = [
  "[ SYSTEM READY ]",
  "CURRENT FIELD // 0.5° GRID",
  "CATALOG // 5 OCEANS · 12 CURRENTS",
];

export const TELEMETRY_LIVE = "正在读取流场";
