/**
 * Every toggleable thing on the globe, grouped, with its real provenance.
 * The top menu is generated from this list — a new data layer means a new
 * entry here plus a renderer.
 */
export type LayerGroup = "OCEAN" | "ATMOSPHERE" | "TERRAIN" | "REFERENCE" | "VIEW";
export type Provenance = "MODEL" | "OBSERVED" | "DERIVED" | "ESTIMATED" | "SIMULATED";

export interface LayerSource {
  name: string;
  dataset?: string;
  url?: string;
  resolution?: string;
  latency?: string;
  license?: string;
}

export interface LayerSpec {
  id: string;
  en: string;
  cn: string;
  group: LayerGroup;
  /** false = present in the menu, data pipeline not connected yet */
  live: boolean;
  defaultOn: boolean;
  provenance: Provenance;
  source: LayerSource;
  note?: string;
}

export const GROUPS: LayerGroup[] = ["OCEAN", "ATMOSPHERE", "TERRAIN", "REFERENCE", "VIEW"];

export const GROUP_LABEL: Record<LayerGroup, { en: string; cn: string }> = {
  OCEAN: { en: "OCEAN", cn: "海洋" },
  ATMOSPHERE: { en: "ATMOSPHERE", cn: "大气" },
  TERRAIN: { en: "TERRAIN", cn: "地形" },
  REFERENCE: { en: "REFERENCE", cn: "参考" },
  VIEW: { en: "VIEW", cn: "视图" },
};

export const LAYERS: LayerSpec[] = [
  {id:"land",en:"LAND SURFACE",cn:"陆地表面",group:"TERRAIN",live:true,defaultOn:true,provenance:"OBSERVED",source:{name:"Saved Earth texture · GeoQ domestic map / optional Tianditu",resolution:"Screen-space adaptive tiles · coverage varies",url:"https://thematic.geoq.cn/arcgis/rest/services/ChinaOnlineStreetGray/MapServer",license:"GeoQ provider credits; saved texture attribution"}},
  {id:"ocean",en:"OCEAN SURFACE",cn:"海洋表面",group:"OCEAN",live:true,defaultOn:true,provenance:"OBSERVED",source:{name:"Saved Earth texture · GeoQ domestic map / optional Tianditu",resolution:"Screen-space adaptive tiles · coverage varies",url:"https://thematic.geoq.cn/arcgis/rest/services/ChinaOnlineStreetGray/MapServer",license:"GeoQ provider credits; saved texture attribution"}},
  {id:"windbelts",en:"CIRCULATION BELTS",cn:"全球环流带（示意）",group:"REFERENCE",live:true,defaultOn:false,provenance:"DERIVED",source:{name:"Idealized atmospheric circulation"}},
  // ---------------- OCEAN ----------------
  { id: "currents", en: "SURFACE CURRENTS", cn: "表层洋流", group: "OCEAN", live: true, defaultOn: false,
    provenance: "SIMULATED",
    source: { name: "OCEAN ATLAS ANALYTIC FIELD", resolution: "0.5°", license: "—" },
    note: "解析场；接 Copernicus Marine / OSCAR 后即为真实数据。" },
  { id: "warmcold", en: "WARM / COLD", cn: "暖流·寒流", group: "OCEAN", live: true, defaultOn: false,
    provenance: "DERIVED",
    source: { name: "DERIVED FROM 12 NAMED CURRENTS", resolution: "0.5°", license: "—" } },
  { id: "relief", en: "SEAFLOOR RELIEF", cn: "海底地形起伏", group: "OCEAN", live: true, defaultOn: false,
    provenance: "OBSERVED",
    source: { name: "NATURAL EARTH BATHYMETRY", dataset: "ne_10m_bathymetry_*",
      url: "naturalearthdata.com", resolution: "1:10m · 200–10000 m", license: "public domain" },
    note: "GEBCO 派生等深线，栅格化为真实水深。" },
  { id: "sst", en: "SEA SURFACE TEMPERATURE", cn: "海表温度", group: "OCEAN", live: false, defaultOn: false,
    provenance: "OBSERVED",
    source: { name: "NOAA OISST v2.1", resolution: "0.25°", latency: "每日", license: "public domain" } },
  { id: "salinity", en: "SALINITY", cn: "盐度", group: "OCEAN", live: false, defaultOn: false,
    provenance: "MODEL",
    source: { name: "COPERNICUS MARINE", resolution: "0.25°", license: "free & open" } },
  { id: "chlorophyll", en: "CHLOROPHYLL", cn: "叶绿素", group: "OCEAN", live: false, defaultOn: false,
    provenance: "OBSERVED",
    source: { name: "EMODnet / COPERNICUS", resolution: "~4 km", license: "open" } },

  { id: "atmosphere", en: "ATMOSPHERE", cn: "大气散射", group: "ATMOSPHERE", live: true, defaultOn: true,
    provenance: "ESTIMATED", source: { name: "RAYLEIGH", license: "—" } },
  // ---------------- ATMOSPHERE ----------------
  { id: "clouds", en: "PHOTOGRAPHIC CLOUDS", cn: "摄影云层", group: "ATMOSPHERE", live: true, defaultOn: true,
    provenance: "OBSERVED", source: { name: "Solar System Scope · saved satellite composite", resolution: "8192 × 4096 · adaptive 2K / 4K / 8K", url: "https://www.solarsystemscope.com/textures/", license: "CC BY 4.0" } },
  { id: "cloudcover", en: "CLOUD COVER FORECAST", cn: "云量预报", group: "ATMOSPHERE", live: true, defaultOn: false,
    provenance: "MODEL", source: { name: "NOAA / NCEP GFS total cloud cover", resolution: "0.25° native forecast grid", url:"https://tds.scigw.unidata.ucar.edu/thredds/catalog/grib/NCEP/GFS/Global_0p25deg/catalog.html", license: "US government data" } },
  { id: "wind", en: "WIND AT 10 M", cn: "10 米风场", group: "ATMOSPHERE", live: true, defaultOn: false,
    provenance: "MODEL", source: {name:"NOAA / NCEP GFS via NSF Unidata", url:"https://tds.scigw.unidata.ucar.edu/thredds/catalog/grib/NCEP/GFS/Global_0p25deg/catalog.html",resolution:"0.25° native forecast grid",license:"US government data"}},
  { id: "rain", en: "PRECIPITATION", cn: "降水", group: "ATMOSPHERE", live: true, defaultOn: false,
    provenance: "MODEL", source: {name:"NOAA / NCEP GFS via NSF Unidata", url:"https://tds.scigw.unidata.ucar.edu/thredds/catalog/grib/NCEP/GFS/Global_0p25deg/catalog.html",resolution:"0.25° native forecast grid",license:"US government data"}},
  { id: "monsoon", en: "MONSOON", cn: "季风", group: "ATMOSPHERE", live: false, defaultOn: false,
    provenance: "DERIVED",
    source: { name: "NCEP-NCAR REANALYSIS (planned)", resolution: "2.5°", license: "public domain" } },
  { id: "airglow", en: "NIGHT AIRGLOW", cn: "夜间气辉", group: "ATMOSPHERE", live: false, defaultOn: false,
    provenance: "ESTIMATED", source: { name: "MODELED EMISSION", license: "—" } },

  // ---------------- TERRAIN ----------------
  { id:"landrelief",en:"3D TERRAIN",cn:"真实三维地形",group:"TERRAIN",live:true,defaultOn:false,provenance:"OBSERVED",source:{name:"Mapzen Terrain Tiles",resolution:"Reprojected global DEM; polar ellipsoid fallback",url:"https://registry.opendata.aws/terrain-tiles/",license:"Source-specific open DEM licenses"},note:"由实际高程瓦片构造山地，关闭后回到椭球面。" },
  { id: "graticule", en: "GRATICULE", cn: "经纬网", group: "TERRAIN", live: true, defaultOn: false,
    provenance: "DERIVED", source: { name: "GENERATED", license: "—" } },
  { id: "trenches", en: "TRENCHES & RIDGES", cn: "海沟·海岭", group: "TERRAIN", live: false, defaultOn: false,
    provenance: "DERIVED",
    source: { name: "GEBCO / NATURAL EARTH", resolution: "1:10m", license: "public domain" } },
  { id: "plates", en: "PLATE BOUNDARIES", cn: "板块边界", group: "TERRAIN", live: false, defaultOn: false,
    provenance: "OBSERVED", source: { name: "PB2002 (Bird 2003)", license: "academic citation" } },

  // ---------------- REFERENCE ----------------
  { id: "boundaries", en: "COASTLINES", cn: "海岸线", group: "REFERENCE", live: true, defaultOn: false,
    provenance: "DERIVED",
    source: { name: "NATURAL EARTH 110m", resolution: "1:110m", license: "public domain" } },
  { id: "labels", en: "GEOGRAPHIC LABELS", cn: "地理标注", group: "REFERENCE", live: true, defaultOn: true,
    provenance: "DERIVED", source: { name: "Natural Earth · OpenStreetMap / CARTO", url: "https://www.naturalearthdata.com/", license: "Public domain / ODbL; on-screen credits" } },
  { id: "divesites", en: "DIVE SITES", cn: "潜点", group: "REFERENCE", live: true, defaultOn: false,
    provenance: "OBSERVED",
    source: { name: "AGENCY / OPERATOR DATA", resolution: "14 sites", license: "see dossier" } },
  { id: "eez", en: "EEZ", cn: "专属经济区", group: "REFERENCE", live: false, defaultOn: false,
    provenance: "OBSERVED", source: { name: "MARINE REGIONS", license: "CC-BY" } },

  // ---------------- VIEW ----------------
  { id: "stars", en: "STARFIELD", cn: "粒子星空", group: "VIEW", live: true, defaultOn: true,
    provenance: "ESTIMATED", source: { name: "GENERATED PARTICLE ENVIRONMENT", resolution: "3600 visual particles", license: "Project code" } },
  { id: "field", en: "VELOCITY FIELD", cn: "流场底色", group: "VIEW", live: true, defaultOn: false,
    provenance: "DERIVED", source: { name: "FROM CURRENT FIELD", license: "—" } },
];

export const DEFAULT_LAYERS: Record<string, boolean> =
  Object.fromEntries(LAYERS.map((l) => [l.id, l.defaultOn]));
