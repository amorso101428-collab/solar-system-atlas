# /current — published ocean current fields

Drop a `manifest.json` here (or point the ETL output at it) and the app will
use it instead of the analytic fallback. No code change required.

```json
{
  "file": "/current/current_2026093002.bin",
  "source": "COPERNICUS MARINE",
  "resolution": "0.083deg",
  "timestamp": "2026-09-30T02:00:00Z",
  "updatedAt": "2026-09-30T02:17:00Z",
  "mode": "ANALYSIS",
  "simulated": false,
  "license": "Copernicus Marine Service - free and open"
}
```

Produce the `.bin` with `pipeline/fetch_copernicus.py` (OACF container,
documented in `src/lib/currentFieldBinary.ts`).

## Fallback behaviour (plan §18)

| Situation | HUD |
|---|---|
| `manifest.json` present and the field parses | `LIVE` / `DELAYED` / `STALE` from the timestamp, real source shown |
| manifest 404 (no feed wired yet) | silent — analytic fallback, marked `SIMULATED` |
| manifest present but the field fails | **DEGRADED** banner, last known field kept on screen |
| forced offline (`?field=off`) | **UNAVAILABLE** banner — globe, species and dossiers stay fully usable |

Deep links for testing: `?field=/current/manifest.json`, `?field=off`.
