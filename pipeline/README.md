# Data pipeline

The browser never parses NetCDF. Everything is pre-chewed here.

```
Copernicus Marine / HYCOM / drifters / HF radar
        |
        v
  fetch_copernicus.py          crop, downsample, quantise
        |
        v
  current_YYYYMMDDHH.bin       OACF container, ~1.3 MB at 0.5 deg
        |
        v
  R2 / object storage  ->  CDN  ->  loadCurrentField(url)
```

## The CurrentField contract

Everything in the app reads one shape:

```ts
interface CurrentField {
  width, height: number;
  lon0, lat0, dLon, dLat: number;   // row 0 is the SOUTH pole
  u, v: Float32Array;               // eastward / northward, m/s
  speed: Float32Array;
  ocean: Uint8Array;                // 1 = water
  source: string; resolution: string;
  simulated: boolean; timestamp: number;
}
```

Swap the producer, not the consumers. `src/lib/currentField.ts` builds the
fallback (analytic gyres + equatorial system + ACC + western-boundary jets) and
`src/lib/currentFieldBinary.ts` parses the real product. Wiring it up is:

```ts
import { loadCurrentField } from "./lib/currentFieldBinary";
const field = await loadCurrentField("/current/current_2026093002.bin")
  .catch(() => buildSyntheticField(720, 360));
```

## Provenance rules (non-negotiable)

Every published field carries `source`, `timestamp` and, in the HUD,
**MODEL / OBSERVED / DERIVED / ESTIMATED**. A model analysis is never labelled
as a direct observation. See `ocean-atlas-plan-v3.md` sections 3 and 24.

## What still needs wiring

- [ ] Copernicus Marine credentials + first real `current_*.bin`
- [ ] Drifter / HF-radar layer (`Layer 2`) rendered as observed-only points
- [ ] HYCOM fallback fetch
- [ ] Objects published to R2 with the time-chunked path `/current/YYYY/MM/DD/`
- [ ] Signed-off freshness thresholds for LIVE / DELAYED / STALE
