import type { Engine } from '../../lib/earthEngine';
import { MERCATOR_LAT, mercatorY, sampleElevation } from '../../lib/terrainGrid';
// Retain successfully decoded DEM tiles across Earth ↔ universe visits (24 MiB).
const decodedTiles = new Map<string,{pixels:Uint8ClampedArray;size:number}>();
/** Reproject DEM heights before geometry creation. The geographic root covers
 * both poles; no Web Mercator geometry or fake opaque polar patch is used. */
export function createGlobalTerrain(C: Engine) {
    const scheme = new C.GeographicTilingScheme(), size = 65, cache = new Map<string, Promise<{
        pixels: Uint8ClampedArray;
        size: number;
    }>>();
    let active = 0, alive = true;
    const waiters: (() => void)[] = [];
    const tile = (z: number, x: number, y: number) => { const key = `${z}/${x}/${y}`; if(decodedTiles.has(key)){const t=decodedTiles.get(key)!;decodedTiles.delete(key);decodedTiles.set(key,t);return Promise.resolve(t)} if (cache.has(key)) {
        const p = cache.get(key)!;
        cache.delete(key);
        cache.set(key, p);
        return p;
    } const task = (async () => { if (active >= 6)
        await new Promise<void>(resolve => waiters.push(resolve)); active++; try {
        if (!alive)
            throw Error('Terrain disposed');
        return await new Promise<{
            pixels: Uint8ClampedArray;
            size: number;
        }>((resolve, reject) => { const image = new Image(), timeout = setTimeout(() => { image.onload = image.onerror = null; image.src = ''; reject(Error('DEM timeout')); }, 10000); image.crossOrigin = 'anonymous'; image.onload = () => { clearTimeout(timeout); try {
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(image, 0, 0);
            const data={pixels:ctx.getImageData(0,0,image.width,image.height).data,size:image.width};decodedTiles.set(key,data);if(decodedTiles.size>96)decodedTiles.delete(decodedTiles.keys().next().value!);resolve(data);
        }
        catch (e) {
            reject(e);
        } }; image.onerror = () => { clearTimeout(timeout); reject(Error('DEM tile unavailable')); }; image.src = 'https://elevation-tiles-prod.s3.amazonaws.com/terrarium/' + key + '.png'; });
    }
    finally {
        active--;
        waiters.shift()?.();
    } })(); cache.set(key, task); task.catch(() => { cache.delete(key); }); if (cache.size > 200)
        cache.delete(cache.keys().next().value!); return task; };
    const provider = new C.CustomHeightmapTerrainProvider({ tilingScheme: scheme, width: size, height: size, credit: new C.Credit('Mapzen Terrain Tiles · USGS, SRTM, GMTED, ETOPO1 · <a href="/credits/Mapzen-terrain-attribution.md">DEM providers and attribution</a> · <a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md">Original licenses</a>'), callback: (x, y, level) => {
            if (!alive || waiters.length > 64)
                return undefined;
            // Coarse terrain is an ellipsoid; real elevations are requested only
            // for regional descendants, rather than downloading a global DEM.
            if(level<3)return Promise.resolve(new Float32Array(size*size));
            const rectangle = scheme.tileXYToRectangle(x, y, level), north = C.Math.toDegrees(rectangle.north), south = C.Math.toDegrees(rectangle.south), west = C.Math.toDegrees(rectangle.west), east = C.Math.toDegrees(rectangle.east), z = Math.min(15, level + 1), n = 2 ** z, coords = Array.from({ length: size }, (_, i) => { const lon = west + (east - west) * i / (size - 1), lat = north + (south - north) * i / (size - 1); return { x: Math.min(n * 256 - 1e-6, Math.max(0, (lon + 180) / 360 * n * 256)), y: Math.min(n * 256 - 1e-6, Math.max(0, mercatorY(lat) * n * 256)), lat }; });
            const keys = new Map<string, {
                x: number;
                y: number;
            }>();
            for (const row of coords)
                if (Math.abs(row.lat) <= MERCATOR_LAT)
                    for (const col of coords) {
                        const tx = Math.floor(col.x / 256), ty = Math.floor(row.y / 256);
                        keys.set(tx + '/' + ty, { x: tx, y: ty });
                    }
            return Promise.all([...keys].map(async ([key, t]) => [key, await tile(z, t.x, t.y)] as const)).then(tiles => { const source = new Map(tiles), heights = new Float32Array(size * size); for (let j = 0; j < size; j++) {
                const lat = coords[j].lat;
                if (Math.abs(lat) > MERCATOR_LAT)
                    continue;
                for (let i = 0; i < size; i++) {
                    const wx = coords[i].x, wy = coords[j].y, t = source.get(Math.floor(wx / 256) + '/' + Math.floor(wy / 256))!;
                    const height = sampleElevation(t.pixels, t.size, wx % 256, wy % 256);
                    heights[j * size + i] = Number.isFinite(height) && height > -12000 && height < 10000 ? Math.max(0, height) : 0;
                }
            } return heights; });
        } });
    provider.getTileDataAvailable = (_x, _y, level) => level <= 16;
    return { provider, dispose: () => { alive = false; cache.clear(); for (const resolve of waiters.splice(0))
            resolve(); } };
}
