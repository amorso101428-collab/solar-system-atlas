#!/usr/bin/env python3
"""
Natural Earth bathymetry contours -> a real global depth raster.

Natural Earth's ne_10m_bathymetry_<L>_<depth> layers are nested polygons:
each one covers the area DEEPER than <depth>. Rasterising them from the
shallowest (L_0 = all ocean) to the deepest (A_10000) leaves every pixel
holding the deepest contour that covers it — i.e. real depth, quantised to
the contour levels. Natural Earth derives these from GEBCO.

Output: public/earth/earth-depth.png (4096x2048)
  R    depth over 0..11000 m in 8 bits (43 m steps) — single channel so that
       bilinear filtering stays smooth; a packed 16-bit value would break at
       every texel edge under linear filtering
  G    depth gradient magnitude (for seafloor relief)
  A    ocean mask

Usage:  python3 rasterize_bathymetry.py /tmp/bathy
"""
from __future__ import annotations

import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

W, H = 4096, 2048
MAXD = 11000.0
# shallow -> deep, so later fills overwrite the deeper regions
ORDER = [("L_0", 0), ("K_200", 200), ("J_1000", 1000), ("I_2000", 2000),
         ("H_3000", 3000), ("G_4000", 4000), ("F_5000", 5000), ("E_6000", 6000),
         ("D_7000", 7000), ("C_8000", 8000), ("B_9000", 9000), ("A_10000", 10000)]


def draw_layer(draw: ImageDraw.ImageDraw, path: str, value: int) -> int:
    if not os.path.exists(path):
        return 0
    with open(path) as fh:
        gj = json.load(fh)
    n = 0
    for feat in gj.get("features", []):
        geom = feat.get("geometry") or {}
        polys = geom.get("coordinates") or []
        if geom.get("type") == "Polygon":
            polys = [polys]
        for poly in polys:
            for ring in poly:
                if len(ring) < 3:
                    continue
                pts = [((lon + 180.0) / 360.0 * (W - 1), (90.0 - lat) / 180.0 * (H - 1))
                       for lon, lat in ring]
                draw.polygon(pts, fill=value)
                n += 1
    return n


def main() -> int:
    src = sys.argv[1] if len(sys.argv) > 1 else "/tmp/bathy"
    out = sys.argv[2] if len(sys.argv) > 2 else "public/earth/earth-depth.png"

    depth = Image.new("I", (W, H), -1)          # -1 = land
    draw = ImageDraw.Draw(depth)
    for name, val in ORDER:
        p = os.path.join(src, f"ne_{name}.json")
        n = draw_layer(draw, p, val)
        print(f"  {name:8s} -> {val:6d} m   rings={n}")

    d = np.asarray(depth).astype(np.float32)
    ocean = d >= 0

    # single-channel 8-bit depth so bilinear filtering stays smooth
    r = np.clip(d / MAXD, 0, 1) * 255.0

    rgba = np.zeros((H, W, 4), dtype=np.uint8)
    rgba[:, :, 0] = r.astype(np.uint8)
    rgba[:, :, 1] = 0
    rgba[:, :, 2] = 0
    rgba[:, :, 3] = (ocean * 255).astype(np.uint8)
    Image.fromarray(rgba, "RGBA").save(out, optimize=True)

    lat = (90.0 - (np.arange(H) + 0.5) * 180.0 / H) * np.pi / 180.0
    wgt = np.cos(lat)[:, None] * np.ones((1, W))
    print("ocean fraction (spherical): %.4f" % ((ocean * wgt).sum() / wgt.sum()))
    print("depth percentiles (ocean): " + ", ".join(
        f"p{q}={np.percentile(d[ocean], q):.0f}m" for q in (5, 25, 50, 75, 95)))
    print("wrote", out, round(os.path.getsize(out) / 1048576, 2), "MB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
