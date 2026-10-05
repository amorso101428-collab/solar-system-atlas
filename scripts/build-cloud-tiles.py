"""Prepare alpha once, offline. Preserve native pixels at the finest level."""
from pathlib import Path
from PIL import Image
import numpy as np
import json,hashlib
source=Path('assets/sources/earth-clouds-8k.jpg')
image=Image.open(source).convert('RGB')
pixels=np.asarray(image,dtype=np.float32).mean(axis=2)/255
alpha=np.clip((pixels-.06)/.76,0,1)
rgba=np.full((image.height,image.width,4),255,dtype=np.uint8)
rgba[:,:,3]=np.rint(250*alpha*alpha*(3-2*alpha)).astype(np.uint8)
image=Image.fromarray(rgba)
folder=Path('public/earth/cloud-tiles');folder.mkdir(parents=True,exist_ok=True)
# Two-pixel gutters, including longitude wrap; no interpolation seam at ±180°.
for level,width in enumerate([2048,4096,8192]):
    reduced=image if width==image.width else image.resize((width,width//2),Image.Resampling.LANCZOS)
    nx,ny=width//512,width//1024
    gutter=Image.new('RGBA',(width+4,width//2+4))
    gutter.paste(reduced,(2,2));gutter.paste(reduced.crop((width-2,0,width,width//2)),(0,2));gutter.paste(reduced.crop((0,0,2,width//2)),(width+2,2))
    gutter.paste(gutter.crop((0,2,width+4,3)).resize((width+4,2)),(0,0));gutter.paste(gutter.crop((0,width//2+1,width+4,width//2+2)).resize((width+4,2)),(0,width//2+2))
    directory=folder/str(level);directory.mkdir(exist_ok=True)
    for y in range(ny):
        for x in range(nx):gutter.crop((x*512,y*512,x*512+516,y*512+516)).save(directory/f'{x}-{y}.webp',quality=90,alpha_quality=85 if level==2 else 75 if level==0 else 80,method=5)
manifest={'source':'https://www.solarsystemscope.com/textures/download/8k_earth_clouds.jpg','license':'CC BY 4.0','nativeSize':[8192,4096],'levels':[2048,4096,8192],'tileSize':512,'gutter':2,'sourceSHA256':hashlib.sha256(source.read_bytes()).hexdigest(),'bytes':sum(p.stat().st_size for p in folder.glob('*/*.webp'))}
(folder/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(manifest))
