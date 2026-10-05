import sys,json,urllib.request,urllib.parse,re,concurrent.futures,html,time
from pathlib import Path
pairs=re.findall(r'id: "([^"]+)", sci: "([^"]+)"',Path('src/data/species.ts').read_text())
if len(sys.argv)>1:pairs=[p for p in pairs if p[0] in sys.argv[1:]]
def read(url):return json.load(urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'OceanAtlas/1.0 (educational local prototype; image attribution retained)'}),timeout=25))
def fetch(pair):
 ident,sci=pair;sci=sci.replace(' spp.','')
 try:
  q=urllib.parse.urlencode({'action':'query','format':'json','titles':sci,'redirects':1,'prop':'pageimages','piprop':'original'})
  pages=read('https://en.wikipedia.org/w/api.php?'+q)['query']['pages'];url=next(iter(pages.values())).get('original',{}).get('source')
  if not url:return ident,{'error':'No lead image'}
  filename=urllib.parse.unquote(urllib.parse.urlsplit(url).path.rsplit('/',1)[-1]);filename={'bluefin':'Atlantic Bluefin Tuna.jpg','lanternfish':'Physonect siphonophore feeding on a lanternfish.jpg'}.get(ident,filename);q=urllib.parse.urlencode({'action':'query','format':'json','titles':'File:'+filename,'redirects':1,'prop':'imageinfo','iiprop':'url|extmetadata','iiurlwidth':'1280'})
  pages=read('https://commons.wikimedia.org/w/api.php?'+q)['query']['pages'];i=next(iter(pages.values()))['imageinfo'][0];m=i.get('extmetadata',{})
  def clean(k):return html.unescape(re.sub('<[^>]+>','',m.get(k,{}).get('value','')))
  license=clean('LicenseShortName');artist=clean('Artist');src=i.get('descriptionurl','');download=i.get('thumburl',i['url'])
  if not license or not any(s in license.upper() for s in ['CC','PUBLIC DOMAIN','PD','GFDL']):return ident,{'error':'License requires review','file':filename,'license':license}
  path=Path('public/species')/(ident+Path(filename).suffix.lower());path.parent.mkdir(parents=True,exist_ok=True)
  image=urllib.request.urlopen(urllib.request.Request(download,headers={'User-Agent':'OceanAtlas/1.0'}),timeout=25).read();path.write_bytes(image)
  return ident,{'image':'/'+str(path.relative_to('public')),'author':artist[:400],'license':license,'licenseUrl':clean('LicenseUrl'),'source':src,'description':clean('ImageDescription')[:500],'file':filename}
 except Exception as e:return ident,{'error':str(e),'file':locals().get('filename'),'url':locals().get('url')}
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:result=dict(pool.map(fetch,pairs))
previous=json.loads(Path('src/data/photographs.json').read_text()) if Path('src/data/photographs.json').exists() else {}
previous.update(result)
Path('src/data/photographs.json').write_text(json.dumps(previous,ensure_ascii=False,indent=2))
print([(k,v.get('image',v.get('error'))) for k,v in result.items()])
