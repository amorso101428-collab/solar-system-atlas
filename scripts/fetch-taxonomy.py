import json,re,urllib.request,urllib.parse,concurrent.futures
from pathlib import Path
pairs=re.findall(r'id: "([^"]+)", sci: "([^"]+)"',Path('src/data/species.ts').read_text())
def fetch(pair):
 ident,name=pair;name=name.replace(' spp.','')
 req=urllib.request.Request('https://api.gbif.org/v1/species/match?'+urllib.parse.urlencode({'name':name}),headers={'User-Agent':'OceanAtlas/1.0 (local educational prototype)'})
 try:
  data=json.load(urllib.request.urlopen(req,timeout=25));return ident,{k:data.get(k) for k in ['usageKey','canonicalName','rank','matchType','confidence','kingdom','phylum','class','order','family','genus','species','kingdomKey','phylumKey','classKey','orderKey','familyKey','genusKey']}
 except Exception as e:return ident,{'error':str(e)}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool: result=dict(pool.map(fetch,pairs))
Path('src/data/taxonomy.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
print([(k,v.get('rank',v.get('error'))) for k,v in result.items()])
