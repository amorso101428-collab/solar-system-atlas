export interface Lesson {
  id: string; title_en: string; title_cn: string;
  steps: { label: string; cn: string; detail: string }[];
  question: string;
}

export const LESSONS: Lesson[] = [
  { id: "gyre", title_en: "WHY GYRES FORM", title_cn: "副热带环流怎样形成",
    steps: [
      { label: "PRESSURE", cn: "气压带", detail: "赤道低压与副热带高压之间的气压差建立行星风系。" },
      { label: "TRADE WINDS", cn: "信风", detail: "东南/东北信风驱动赤道流自东向西。" },
      { label: "WESTERLIES", cn: "西风带", detail: "中纬西风驱动北/南向的漂流，与信风方向相反。" },
      { label: "CORIOLIS", cn: "地转偏向力", detail: "科氏力使运动右偏（北半球）/左偏（南半球），闭合形成环流。" },
      { label: "CLOSURE", cn: "闭合", detail: "陆地把环流封闭，西侧被强化为西边界流。" },
    ],
    question: "为什么北半球副热带环流是顺时针？" },
  { id: "western-boundary", title_en: "WESTERN BOUNDARY INTENSIFICATION", title_cn: "西边界强化",
    steps: [
      { label: "PLANETARY VORTICITY", cn: "行星涡度", detail: "科氏参数随纬度变化，导致涡度守恒约束。" },
      { label: "ASYMMETRY", cn: "不对称", detail: "为守恒涡度，回流必须集中在海盆西侧，形成窄而快的急流。" },
      { label: "RESULT", cn: "结果", detail: "黑潮、湾流、厄加勒斯等西边界流比东侧回流快 5–10 倍、窄 10 倍。" },
    ],
    question: "为什么黑潮比加利福尼亚流强大得多？" },
  { id: "upwelling", title_en: "COASTAL UPWELLING", title_cn: "沿岸上升流",
    steps: [
      { label: "OFFSHORE WIND", cn: "离岸风", detail: "沿岸风把表层水推离海岸。" },
      { label: "EKMAN TRANSPORT", cn: "埃克曼输运", detail: "科氏力使表层输运偏离风向，形成离岸净输运。" },
      { label: "UPWELLING", cn: "上升补偿", detail: "深层冷水上涌，带来硝酸盐与磷酸盐。" },
      { label: "PRODUCTIVITY", cn: "生产力", detail: "浮游植物爆发 → 鱼类聚集 → 顶级捕食者与渔场。" },
    ],
    question: "秘鲁寒流为什么能支撑世界级渔场？" },
  { id: "monsoon", title_en: "MONSOON REVERSAL", title_cn: "季风与洋流反转",
    steps: [
      { label: "SUMMER", cn: "夏季", detail: "陆地升温快形成低压，西南季风驱动索马里上升流与东北向流。" },
      { label: "WINTER", cn: "冬季", detail: "陆地冷却形成高压，东北季风使北印度洋环流反向。" },
      { label: "CONTRAST", cn: "对比", detail: "北印度洋是全球唯一随季风整体反向的大洋环流。" },
    ],
    question: "为什么北印度洋洋流会发生季节性反转？" },
  { id: "amoc", title_en: "THERMOHALINE CIRCULATION", title_cn: "温盐环流",
    steps: [
      { label: "SINKING", cn: "下沉", detail: "北大西洋高盐冷水下沉，形成深层水团。" },
      { label: "TRANSPORT", cn: "输送", detail: "深层水沿洋盆南流，经南大洋进入印度洋与太平洋。" },
      { label: "RETURN", cn: "回流", detail: "通过上升流与表层暖流返回北大西洋，形成全球输送带。" },
      { label: "CLIMATE", cn: "气候", detail: "输送巨量热量，使西欧冬季偏暖，是气候系统的关键开关。" },
    ],
    question: "为什么说北大西洋暖流决定了西欧的冬天？" },
];
