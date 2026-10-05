import type * as Cesium from 'cesium';
import type { Engine } from '../../lib/earthEngine';
// The service's Web Mercator tile footprint ends at ~85°. Explicit geographic
// caps over it prevent Cesium from stretching the last dark edge tile to ±90°.
export function addPolarCaps(C: Engine, v: Cesium.Viewer) { let cancelled = false; const layers: Cesium.ImageryLayer[] = []; const img = new Image(); img.onload = () => { if (cancelled || v.isDestroyed())
    return; for (const north of [true, false]) {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = Math.ceil(img.height * 10 / 180);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, north ? 0 : img.height - canvas.height, img.width, canvas.height, 0, 0, canvas.width, canvas.height);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < canvas.height; y++) {
        const edge = north ? 1 - y / (canvas.height - 1) : y / (canvas.height - 1), alpha = Math.min(1, edge * 10 / 4.8);
        for (let x = 0; x < canvas.width; x++)
            data.data[(y * canvas.width + x) * 4 + 3] = 255 * alpha;
    }
    ctx.putImageData(data, 0, 0);
    const provider = new C.SingleTileImageryProvider({ url: canvas.toDataURL(), tileWidth: canvas.width, tileHeight: canvas.height, rectangle: C.Rectangle.fromDegrees(-180, north ? 80 : -90, 180, north ? 90 : -80), credit: new C.Credit('Polar coverage · Solar System Scope · CC BY 4.0') });
    layers.push(v.imageryLayers.addImageryProvider(provider));
} }; img.src = '/earth/solar-earth_daymap-4k.jpg'; return () => { cancelled = true; img.onload = null; for (const l of layers)
    if (!v.isDestroyed())
        v.imageryLayers.remove(l, true); }; }
