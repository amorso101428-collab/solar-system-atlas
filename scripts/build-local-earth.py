from pathlib import Path
from PIL import Image
import json,hashlib
import numpy as np
Image.MAX_IMAGE_PIXELS=300_000_000
source=Path('assets/sources/nasa-blue-marble-21600.jpg')
image=Image.open(source).convert('RGB')
assert image.size==(21600,10800), image.size
sea=Image.open('public/earth/solar-earth_daymap-4k.jpg').convert('RGB')
folder=Path('public/earth/local-tiles');folder.mkdir(exist_ok=True)
for level,width in enumerate([1350,2700,5400,10800,21600]):
 reduced=image if width==21600 else image.resize((width,width//2),Image.Resampling.LANCZOS)
 ocean=sea.resize((width,width//2),Image.Resampling.LANCZOS)
 for y in range(2**level):
  target=folder/str(level)/str(y);target.mkdir(parents=True,exist_ok=True)
  for x in range(2*2**level):
   box=(x*675,y*675,(x+1)*675,(y+1)*675);tile=reduced.crop(box);pixels=np.asarray(tile).astype(np.float32)
   # NASA base-map deep water has no bathymetry. Preserve the existing blue
   # ocean photograph; never imply that its lower-resolution sea is 21K detail.
   deep=np.clip((24-pixels[:,:,0])/12,0,1)*np.clip((40-pixels[:,:,1])/16,0,1)*np.clip((pixels[:,:,2]-pixels[:,:,0])/8,0,1)
   tile=Image.composite(ocean.crop(box),tile,Image.fromarray((deep*255).astype(np.uint8)))
   tile.save(target/f'{x}.jpg',quality=88,optimize=True)
 print('level',level,'ready',flush=True)
manifest={'source':'https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/october/world.200410.3x21600x10800.jpg','sourcePage':'https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/','credit':'NASA Earth Observatory · Blue Marble Next Generation · Reto Stöckli / NASA GSFC','derived':'NASA land with existing Solar System Scope CC BY 4.0 sea colour; ocean detail remains 4K', 'nativeSize':list(image.size),'tileSize':675,'maximumLevel':4,'groundResolution':'2 km/pixel at equator','observation':'October 2004 composite; not live imagery','sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'bytes':sum(p.stat().st_size for p in folder.glob('*/*/*.jpg'))}
(folder/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
