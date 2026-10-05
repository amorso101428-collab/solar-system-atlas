import {WIND_SYSTEMS} from '../data/winds';
import {useAtlas} from '../state/store';
import {useLanguage} from '../i18n';

export default function WindPanel(){
 const {t,locale}=useLanguage(),id=useAtlas(s=>s.windFocus),inspect=useAtlas(s=>s.inspectWind);
 const system=WIND_SYSTEMS.find(w=>w.id===id);
 return <article>
  <p className="panel__hint">{t('流线来自 10 米风场预报；风带和季风名称是气候地理说明，并非把每条预报流线判定为一种季风。风名表示风的来向，线条移动表示空气去向。','Streamlines show forecast wind at 10 m. Wind-belt and monsoon names provide climate context, rather than classifying each forecast line. Wind names describe where air comes from; moving traces show where it goes.')}</p>
  {system?<>
   <button className="tag" onClick={()=>inspect(null)}>{t('← 返回风带列表','← All wind systems')}</button>
   <header className="record-heading"><span className="eyebrow">{system.family==='monsoon'?t('季节性季风系统','Seasonal monsoon system'):t('行星风带','Planetary wind belt')}</span><h1>{system.name[locale]}</h1></header>
   <dl className="dossier__rows"><div><dt>{t('所在带与范围','Zone and extent')}</dt><dd>{system.zone[locale]}</dd></div><div><dt>{t('性质','Characteristics')}</dt><dd>{system.character[locale]}</dd></div></dl>
   <section className="reading-chapter"><h3>{t('如何理解','Understanding the wind')}</h3><p>{system.description[locale]}</p></section>
   {system.seasons?.map(season=><section className="reading-chapter" key={season.name.en}><h3>{season.name[locale]}</h3><p>{season.direction[locale]}</p><p>{season.character[locale]}</p></section>)}
   <p className="panel__hint">{t('风带纬度是示意范围；边界会随季节移动，天气系统也会使当天风向偏离盛行风。季风的温湿性质受空气来源和路径影响。','Belt latitudes are schematic. Boundaries migrate seasonally, and daily wind may differ from the prevailing flow. Monsoon temperature and moisture depend on air origin and path.')}</p>
   <footer className="notice"><a href={system.source.url} target="_blank" rel="noreferrer">{system.source.name} ↗</a></footer>
  </>:<div className="catalog-list">{WIND_SYSTEMS.map(w=><button key={w.id} onClick={()=>inspect(w.id)}><span>{w.name[locale]}<small>{w.character[locale]}</small></span><span aria-hidden>↗</span></button>)}</div>}
 </article>;
}
