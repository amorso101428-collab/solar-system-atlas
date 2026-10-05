/**
 * Astronomical Voices / 天文学思想长廊（v9 §5–§8）。
 *
 * 规范：
 *   1. 每条都要有**出处**（sourceTitle + sourceUrl）与**可靠性标注**：
 *        verified  —— 有可核对的一手出处（论文 / 书信 / 出版著作）
 *        attributed—— 广泛引用但一手来源不完整
 *        disputed  —— 流行的误归属（例如"But it still moves"）
 *   2. 有争议的必须照实显示，不能伪装成史实；
 *   3. 中英双语都给，英文尽量保留原句。
 */
export type AttributionStatus = 'verified' | 'attributed' | 'disputed'

export interface QuoteEntry {
  id: string
  person: string
  personZh: string
  quote: string
  quoteZh: string
  sourceTitle: string
  sourceUrl: string
  year?: number
  attributionStatus: AttributionStatus
}

export const QUOTES: QuoteEntry[] = [
  {
    id: 'copernicus-middle',
    person: 'Nicolaus Copernicus',
    personZh: '哥白尼',
    quote: 'In the middle of all sits the Sun.',
    quoteZh: '万物的中央，坐着太阳。',
    sourceTitle: 'De revolutionibus orbium coelestium, Book I (1543)',
    sourceUrl: 'https://www.gutenberg.org/ebooks/author/43330',
    year: 1543,
    attributionStatus: 'verified',
  },
  {
    id: 'kepler-geometry',
    person: 'Johannes Kepler',
    personZh: '开普勒',
    quote: 'Where there is matter, there is geometry.',
    quoteZh: '哪里有物质，哪里就有几何。',
    sourceTitle: 'MacTutor — Kepler quotations',
    sourceUrl: 'https://mathshistory.st-andrews.ac.uk/Biographies/Kepler/quotations/',
    year: 1596,
    attributionStatus: 'attributed',
  },
  {
    id: 'galileo-language',
    person: 'Galileo Galilei',
    personZh: '伽利略',
    quote:
      'Philosophy is written in this grand book — the universe — which stands continually open to our gaze.',
    quoteZh: '哲学写在那本一直摊开在我们眼前的大书里——宇宙。',
    sourceTitle: 'The Assayer (Il Saggiatore, 1623)',
    sourceUrl: 'https://mathshistory.st-andrews.ac.uk/Biographies/Galileo/quotations/',
    year: 1623,
    attributionStatus: 'verified',
  },
  {
    id: 'galileo-still-moves',
    person: 'Galileo Galilei',
    personZh: '伽利略',
    quote: 'And yet it moves.',
    quoteZh: '可它仍在转动。',
    sourceTitle: '无一手出处 · 流行误归属（MacTutor / MAA 均有说明）',
    sourceUrl: 'https://old.maa.org/node/3575152',
    year: 1633,
    attributionStatus: 'disputed',
  },
  {
    id: 'newton-shoulders',
    person: 'Isaac Newton',
    personZh: '牛顿',
    quote: 'If I have seen further it is by standing on the shoulders of Giants.',
    quoteZh: '如果说我看得更远，那是因为我站在巨人的肩上。',
    sourceTitle: 'Letter to Robert Hooke, 5 February 1676 — Newton Project',
    sourceUrl: 'https://newtonproject.ox.ac.uk/view/texts/normalized/OTHE00018',
    year: 1676,
    attributionStatus: 'verified',
  },
  {
    id: 'newton-seas',
    person: 'Isaac Newton',
    personZh: '牛顿',
    quote:
      'I do not know what I may appear to the world, but to myself I seem to have been only like a boy playing on the seashore.',
    quoteZh: '我不知道世人怎样看我，但在我看来，自己不过是个在海边玩耍的孩子。',
    sourceTitle: '回忆录（Spence, 1726 记载）· 广泛引用',
    sourceUrl: 'https://mathshistory.st-andrews.ac.uk/Biographies/Newton/quotations/',
    year: 1726,
    attributionStatus: 'attributed',
  },
  {
    id: 'brahe-not-in-vain',
    person: 'Tycho Brahe',
    personZh: '第谷·布拉赫',
    quote: 'Let me not seem to have lived in vain.',
    quoteZh: '别让我看起来白活了一场。',
    sourceTitle: '临终语（据其助手记载）',
    sourceUrl: 'https://mathshistory.st-andrews.ac.uk/Biographies/Brahe/',
    year: 1601,
    attributionStatus: 'attributed',
  },
  {
    id: 'herschel-further',
    person: 'William Herschel',
    personZh: '威廉·赫歇尔',
    quote: 'I have looked further into space than ever human being did before me.',
    quoteZh: '我望进了比任何前人都更深的太空。',
    sourceTitle: '致其妹妹 Caroline 的信（1783 前后）',
    sourceUrl: 'https://www.britannica.com/biography/William-Herschel',
    year: 1783,
    attributionStatus: 'attributed',
  },
  {
    id: 'leavitt-paper',
    person: 'Henrietta Swan Leavitt',
    personZh: '亨丽埃塔·莱维特',
    quote:
      'A straight line can readily be drawn among each of the two series of points corresponding to maxima and minima.',
    quoteZh: '对应极大与极小的两组点，各自都能轻易画出一条直线。',
    sourceTitle: 'Harvard College Observatory Circular 173 (1912)',
    sourceUrl: 'https://adsabs.harvard.edu/full/1912HarCi.173....1L',
    year: 1912,
    attributionStatus: 'verified',
  },
  {
    id: 'hubble-receding-horizons',
    person: 'Edwin Hubble',
    personZh: '哈勃',
    quote: 'The history of astronomy is a history of receding horizons.',
    quoteZh: '天文学的历史，就是一部地平线不断后退的历史。',
    sourceTitle: 'The Realm of the Nebulae (1936)',
    sourceUrl: 'https://archive.org/details/realmofnebulae0000hubb',
    year: 1936,
    attributionStatus: 'verified',
  },
  {
    id: 'hubble-five-senses',
    person: 'Edwin Hubble',
    personZh: '哈勃',
    quote:
      'Equipped with his five senses, man explores the universe around him and calls the adventure Science.',
    quoteZh: '人类用五种感官探索周围的宇宙，并把这场冒险叫作科学。',
    sourceTitle: 'The Nature of Science (1929)',
    sourceUrl: 'https://www.jstor.org/stable/2257',
    year: 1929,
    attributionStatus: 'verified',
  },
  {
    id: 'payne-joy',
    person: 'Cecilia Payne-Gaposchkin',
    personZh: '塞西莉亚·佩恩',
    quote:
      'There is no joy more intense than that of coming upon a fact that cannot be understood in terms of currently accepted ideas.',
    quoteZh: '没有什么喜悦，比得上撞见一个用现有理论解释不了的事实。',
    sourceTitle: '她在哈佛的讲稿与回忆 · 广泛引用',
    sourceUrl: 'https://www.aip.org/history-programs/physics-history/cecilia-payne-gaposchkin',
    year: 1956,
    attributionStatus: 'attributed',
  },
  {
    id: 'rubin-conceptions',
    person: 'Vera Rubin',
    personZh: '薇拉·鲁宾',
    quote: 'Science progresses best when observations force us to alter our preconceptions.',
    quoteZh: '当观测迫使我们改变成见时，科学才进步得最快。',
    sourceTitle: 'Her writings on dark matter · 广泛引用',
    sourceUrl: 'https://www.nsf.gov/news/news_summ.jsp?cntn_id=246357',
    year: 1990,
    attributionStatus: 'attributed',
  },
  {
    id: 'rubin-numbers',
    person: 'Vera Rubin',
    personZh: '薇拉·鲁宾',
    quote: 'Fame is fleeting, but my numbers mean more to me than my name.',
    quoteZh: '名声转瞬即逝，但我的数据比我的名字更重要。',
    sourceTitle: '访谈 · 广泛引用',
    sourceUrl: 'https://www.nsf.gov/news/news_summ.jsp?cntn_id=246357',
    year: 2000,
    attributionStatus: 'attributed',
  },
  {
    id: 'cannon-instinct',
    person: 'Annie Jump Cannon',
    personZh: '安妮·坎农',
    quote: 'It is as if the stars were speaking to me.',
    quoteZh: '就好像星星在对我说话。',
    sourceTitle: '关于恒星光谱分类工作的回忆 · 二手来源',
    sourceUrl: 'https://www.womenshistory.org/education-resources/biographies/annie-jump-cannon',
    year: 1920,
    attributionStatus: 'attributed',
  },
  {
    id: 'mitchell-hunger',
    person: 'Maria Mitchell',
    personZh: '玛丽亚·米切尔',
    quote:
      'We have a hunger of the mind which asks for knowledge of all around us, and the more we gain, the more is our desire.',
    quoteZh: '我们心里有一种饥饿，想要知道身边的一切；知道得越多，就越想知道。',
    sourceTitle: '她的日记与讲演 (1850s)',
    sourceUrl: 'https://www.womenshistory.org/education-resources/biographies/maria-mitchell',
    year: 1855,
    attributionStatus: 'attributed',
  },
  {
    id: 'sagan-starstuff',
    person: 'Carl Sagan',
    personZh: '卡尔·萨根',
    quote: 'We are made of star-stuff.',
    quoteZh: '我们由星尘构成。',
    sourceTitle: 'Cosmos (1980), Episode 1',
    sourceUrl: 'https://www.loc.gov/item/2013650119/',
    year: 1980,
    attributionStatus: 'verified',
  },
  {
    id: 'sagan-somewhere',
    person: 'Carl Sagan',
    personZh: '卡尔·萨根',
    quote: 'Somewhere, something incredible is waiting to be known.',
    quoteZh: '在某个地方，有某种不可思议的事物正等着被发现。',
    sourceTitle: '无一手出处（常被归给萨根，但其著作中查无此句）',
    sourceUrl: 'https://en.wikiquote.org/wiki/Carl_Sagan',
    year: 1980,
    attributionStatus: 'disputed',
  },
  {
    id: 'hawking-look-up',
    person: 'Stephen Hawking',
    personZh: '霍金',
    quote: 'Remember to look up at the stars and not down at your feet.',
    quoteZh: '记得抬头看星星，而不是低头看脚下。',
    sourceTitle: '公开演讲与访谈 · 广泛引用',
    sourceUrl: 'https://www.hawking.org.uk/',
    year: 2018,
    attributionStatus: 'attributed',
  },
]

/** 按固定顺序取第 n 条（主页与图谱共用同一份数据） */
export function quoteAt(index: number): QuoteEntry {
  return QUOTES[((index % QUOTES.length) + QUOTES.length) % QUOTES.length]!
}
