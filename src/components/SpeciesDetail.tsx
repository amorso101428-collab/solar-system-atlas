import ScienceReading from "./ScienceReading";
import { useEffect, useRef, useState } from "react";
import { SPECIES, type SpeciesDossier } from "../data/species";
import taxonomy from "../data/taxonomy.json";
import photographs from "../data/photographs.json";
import { useLanguage } from "../i18n";
import { useAtlas } from "../state/store";
interface Taxon {usageKey?:number;rank?:string;kingdom?:string|null;phylum?:string|null;class?:string|null;order?:string|null;family?:string|null;genus?:string|null;canonicalName?:string;}
interface Photo {image?:string;author?:string;license?:string;licenseUrl?:string;source?:string;description?:string;}
const taxa=taxonomy as Record<string,Taxon>,photos=photographs as Record<string,Photo>;
// Conventional ray-finned-fish class complements backbone records with an omitted class rank.
const CLASS_FISH=new Set(["bluefin","moonfish","lanternfish","sardine-run"]);
const CN:Record<string,string>={Animalia:"动物界",Chromista:"色素界",Chordata:"脊索动物门",Arthropoda:"节肢动物门",Mollusca:"软体动物门",Ochrophyta:"赭色植物门",Mammalia:"哺乳纲",Elasmobranchii:"板鳃亚纲",Actinopterygii:"辐鳍鱼纲",Testudines:"龟鳖类",Aves:"鸟纲",Cephalopoda:"头足纲",Malacostraca:"软甲纲",Phaeophyceae:"褐藻纲",Cetacea:"鲸目",Artiodactyla:"偶蹄目",Carnivora:"食肉目",Lamniformes:"鼠鲨目",Orectolobiformes:"须鲨目",Squaliformes:"角鲨目",Scombriformes:"鲭形目",Tetraodontiformes:"鲀形目",Myctophiformes:"灯笼鱼目",Clupeiformes:"鲱形目",Aulopiformes:"仙女鱼目",Octopoda:"八腕目",Euphausiacea:"磷虾目",Sphenisciformes:"企鹅目",Fucales:"墨角藻目",Balaenopteridae:"须鲸科",Physeteridae:"抹香鲸科",Delphinidae:"海豚科",Lamnidae:"鼠鲨科",Rhincodontidae:"鲸鲨科",Scombridae:"鲭科",Cheloniidae:"海龟科",Octopodidae:"蛸科",Somniosidae:"梦鲨科",Spheniscidae:"企鹅科",Mustelidae:"鼬科",Molidae:"翻车鲀科",Myctophidae:"灯笼鱼科",Euphausiidae:"磷虾科",Clupeidae:"鲱科",Sargassaceae:"马尾藻科",Bathysauridae:"深海蜥鱼科"};
export default function SpeciesDetail({species:s}:{species:SpeciesDossier}){
 const {t,text,name,locale}=useLanguage(),select=useAtlas(a=>a.select);const tax:Taxon={...taxa[s.id]},photo=photos[s.id];if(!tax.class&&CLASS_FISH.has(s.id))tax.class="Actinopterygii";
 const [section,setSection]=useState("life"),[lightbox,setLightbox]=useState(false),[photoFailed,setPhotoFailed]=useState(false),[expanded,setExpanded]=useState<string|null>("family");const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(lightbox)dialog.current?.showModal();else dialog.current?.close();},[lightbox]);
 const ranks: [keyof Taxon,string,string,string,string][]=[
 ["kingdom","界","Kingdom","分类的最高层级之一，用来区分动物、植物、色素生物等大的演化类群。","A broad taxonomic rank separating major evolutionary groups, such as animals, plants and chromists."],
 ["phylum","门","Phylum","在界之下，按共同的基本身体结构和演化关系归类。","Within a kingdom, organisms are grouped by shared body organization and evolutionary relationships."],
 ["class","纲","Class","门内较细的类群；不同分类体系的阶元设置可能不同。","A subdivision within a phylum. Rank placement can differ among taxonomic systems."],
 ["order","目","Order","将具有较近演化关系的多个科归为一组。","Groups related families within a class."],
 ["family","科","Family","将具有共同演化起源的属归为一组，可继续查看本资料库里的同科生物。","Groups related genera. Explore the organisms from this family in the atlas."],
 ["genus","属","Genus","学名的第一个词，包含一个或多个亲缘较近的物种。","The first part of a scientific species name; it contains one or more closely related species."]];
 const related=SPECIES.filter(o=>o.id!==s.id&&(taxa[o.id]?.family===tax.family||o.group===s.group));
 return <article className="species-detail">
  <header className="record-heading"><span className="eyebrow">{tax.rank==="FAMILY"?t("科级类群档案","Family-level record"):tax.rank==="GENUS"?t("属级类群档案","Genus-level record"):t("物种档案","Species dossier")}</span><h1>{name(s)}</h1><p className="scientific">{s.sci}</p></header>
  {photo?.image&&!photoFailed?<figure className="species-photo"><button onClick={()=>setLightbox(true)} aria-label={t(`放大${s.name_cn}摄影`,`Enlarge photograph of ${s.name_en}`)}><img src={photo.image} alt={name(s)} onError={()=>setPhotoFailed(true)}/><span>{t("查看摄影","View photograph")} ↗</span></button><figcaption>{s.id==="deepsea-lizardfish"?t("NOAA 深海 ROV 实拍","NOAA deep-sea ROV photograph"):s.id==="lanternfish"?t("ROV 实拍：管水母捕食灯笼鱼","ROV frame: siphonophore feeding on a lanternfish"):s.id==="bluefin"?t("水族馆摄影","Aquarium photograph"):t("生物摄影","Wildlife photograph")} · {photo.author}<br/><a href={photo.source} target="_blank" rel="noreferrer">{t("原始来源","Original source")}</a> · <a href={photo.licenseUrl||photo.source} target="_blank" rel="noreferrer">{photo.license}</a></figcaption></figure>:<p className="notice">{t("此记录暂缺已核对许可的摄影。","A photograph with a verified license is not yet available for this record.")}</p>}
  <div className="species-tabs" role="tablist" aria-label={t("档案章节","Dossier sections")}>{[["life",t("生态","Ecology")],["taxonomy",t("界门纲目科","Taxonomy")]].map(([k,l])=><button key={k} role="tab" aria-selected={section===k} onClick={()=>setSection(k)}>{l}</button>)}</div>
  {section==="life"?<div className="species-section" role="tabpanel"><dl className="dossier__rows">{[[t("类群","Group"),s.group],[t("深度","Depth"),s.depth],[t("温度","Temperature"),s.tempC],[t("盐度","Salinity"),s.salinity],[t("长度","Length"),s.length],[t("食性","Diet"),s.diet],["IUCN",s.iucn]].map(([k,v])=><div key={k}><dt>{k}</dt><dd>{text(v)}</dd></div>)}</dl><section className="habitat-card"><h3>{t("栖息地","Habitat")}</h3><p>{text(s.habitat)}</p><h3>{t("生命策略","Life in the ocean")}</h3><p>{text(s.note)}</p></section><ScienceReading kind="ecology" compact/></div>:<div className="taxonomy-tree species-section" role="tabpanel"><h3>{t("分类位置","Taxonomic placement")}</h3>
   <p className="panel__hint">{t("点击分类层级，展开说明与关联物种。学名保留拉丁文。","Select a rank to expand its explanation and related organisms. Scientific names remain in Latin.")}</p>
   {ranks.map(([k,cn,en,description,english])=>{const value=tax[k];if(typeof value!=="string")return <div key={k} className="taxon-missing">{t(cn,en)} · {t("来源未提供该阶元","Rank omitted by source")}</div>;
    const same=SPECIES.filter(o=>o.id!==s.id&&taxa[o.id]?.[k]===value);return <div className="taxon-node" key={k}><button aria-expanded={expanded===k} onClick={()=>setExpanded(expanded===k?null:k)}><small>{t(cn,en)}</small><span>{locale==="zh-CN"&&CN[value]?CN[value]:value}{locale==="zh-CN"&&CN[value]&&<em>{value}</em>}</span><i aria-hidden>{expanded===k?"−":"+"}</i></button>{expanded===k&&<div className="taxon-body"><p>{t(description,english)}</p>{same.length>0?<div className="tagrow">{same.map(o=><button className="tag" key={o.id} onClick={()=>select({kind:"species",id:o.id})}>{name(o)} ›</button>)}</div>:<p>{t("资料库中暂未收录此类群的其他成员。","No other members of this group are cataloged yet.")}</p>}</div>}</div>;
   })}<footer className="sources"><a href={`https://www.gbif.org/species/${tax.usageKey}`} target="_blank" rel="noreferrer">GBIF · {t("核对分类","Verify taxonomy")}</a><p>{t("分类快照：2026-10-02。辐鳍鱼纲补全采用通行分类。科、属级记录不指代单一物种。","Taxonomy snapshot: 2026-10-02. Omitted ray-finned-fish class ranks use conventional taxonomy. Family and genus records do not represent one species.")}</p></footer>
  </div>}
  {related.length>0&&<section><h3>{t("继续探索","Explore further")}</h3><div className="related-species">{related.map(o=><button key={o.id} onClick={()=>select({kind:"species",id:o.id})}>{photos[o.id]?.image&&<img src={photos[o.id].image} alt="" loading="lazy"/>}<span>{name(o)}<small>{o.sci}</small></span><i aria-hidden>›</i></button>)}</div></section>}
  <footer className="sources">{t("资料来源","Record sources")} · {s.source}</footer>
  <dialog ref={dialog} className="photo-dialog" onCancel={()=>setLightbox(false)} onClick={e=>{if(e.target===e.currentTarget)setLightbox(false);}}><button className="photo-close" autoFocus aria-label={t("关闭摄影","Close photograph")} onClick={()=>setLightbox(false)}>×</button><h2>{name(s)}</h2><img src={photo?.image} alt={name(s)}/><p>{photo?.author} · {photo?.license}</p></dialog>
 </article>;
}
