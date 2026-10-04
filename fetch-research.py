import concurrent.futures,urllib.request,json,re,html
from pathlib import Path
p=Path.cwd(); out=p/'research';out.mkdir(exist_ok=True)
slugs=[f'mariner-{i}' for i in range(1,10)]+[f'ranger-{i}' for i in range(1,10) if i!=7]+[f'surveyor-{i}' for i in range(2,8)]+[f'lunar-orbiter-{i}' for i in range(1,6)]+[f'pioneer-{i}' for i in range(5,10)]+['viking-2','mars-phoenix','messenger','deep-space-1','deep-space-2','genesis','lcross','ladee','clementine','lunar-prospector','magsat','seasat','sorce','trmm','uars','rhessi','trace','sampex','fast','image','timed','aim','ibex','stereo-b','dscovr','nustar','galex','fuse','suzaku','hitomi','rxte']
def fetch(slug):
 try:
  url='https://science.nasa.gov/mission/'+slug+'/'
  with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=25) as r: text=r.read().decode();final=r.url
  main=re.search(r'<main\b[\s\S]*?</main>',text)
  text=main.group(0) if main else text
  text=re.sub(r'<(script|style)\b[\s\S]*?</\1>','',text)
  text=html.unescape(re.sub('<[^>]+>','\n',text)); text='\n'.join(x.strip() for x in text.splitlines() if x.strip())
  (out/(slug+'.txt')).write_text(text,encoding='utf-8')
  return {'slug':slug,'url':final,'ok':True,'excerpt':text[:2400]}
 except Exception as e:return {'slug':slug,'ok':False,'error':str(e)}
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool: rows=list(pool.map(fetch,slugs))
(out/'missions.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps([{'slug':r['slug'],'ok':r['ok']} for r in rows]));print('verified',sum(r['ok'] for r in rows))
