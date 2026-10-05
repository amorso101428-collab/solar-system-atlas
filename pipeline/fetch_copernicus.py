#!/usr/bin/env python3
"""
OCEAN ATLAS — Current Field ETL
===============================

Turns a Copernicus Marine surface current product into the compact OACF binary
that the browser consumes. NetCDF never reaches the client.

  Copernicus Marine (NetCDF, 1/12 deg, hourly surface u/v)
        -> this script (crop / downsample / quantise)
        -> current_YYYYMMDDHH.bin  (OACF, ~1.3 MB at 0.5 deg)
        -> R2 / any object store
        -> loadCurrentField(url) in the browser

Install
-------
    python3 -m pip install copernicusmarine xarray netCDF4 numpy

Credentials (Copernicus Marine account, free):
    copernicusmarine login          # or set COPERNICUSMARINE_SERVICE_USERNAME /
                                    # COPERNICUSMARINE_SERVICE_PASSWORD

Usage
-----
    python3 fetch_copernicus.py --out ./out --step 4
    python3 fetch_copernicus.py --start 2026-09-29 --end 2026-09-30 --step 4

Notes
-----
* --step 4 downsamples 1/12 deg to ~1/3 deg; --step 6 gives ~1/2 deg (0.5 deg
  target used by the shipped front-end grid).
* Products and variable names change over time. If the dataset id below is
  retired, list what your account can see with:
      copernicusmarine describe --contains "GLOBAL_ANALYSISFORECAST_PHY"
"""
from __future__ import annotations

import argparse
import datetime as dt
import struct
import sys
from pathlib import Path

import numpy as np

DATASET_ID = "cmems_mod_glo_phy_anfc_0.083deg_PT1H-m"
VARIABLES = ["uo", "vo"]          # eastward / northward surface velocity
MAGIC = b"OACF"
VERSION = 1


def write_oacf(path: Path, lon0, lat0, dlon, dlat, u, v, ocean, source, resolution, timestamp_ms, simulated=False):
    """Write the OACF container. Arrays are (height, width) float32, lat ascending."""
    h, w = u.shape
    with path.open("wb") as f:
        f.write(MAGIC)
        f.write(struct.pack("<HHH", VERSION, w, h))
        f.write(struct.pack("<ffff", lon0, lat0, dlon, dlat))
        f.write(struct.pack("<d", float(timestamp_ms)))
        for s in (source, resolution):
            b = s.encode("utf-8")
            f.write(struct.pack("<H", len(b)))
            f.write(b)
        f.write(struct.pack("<B", 1 if simulated else 0))
        f.write(np.clip(np.round(u * 10000), -32768, 32767).astype("<i2").tobytes())
        f.write(np.clip(np.round(v * 10000), -32768, 32767).astype("<i2").tobytes())
        f.write(np.ascontiguousarray(ocean.astype(np.uint8)).tobytes())
    return path


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="./out")
    ap.add_argument("--step", type=int, default=4, help="spatial downsample factor")
    ap.add_argument("--start", default=None, help="YYYY-MM-DD (default: latest)")
    ap.add_argument("--end", default=None)
    args = ap.parse_args()

    try:
        import copernicusmarine
        import xarray as xr
    except ImportError:
        print("missing deps: python3 -m pip install copernicusmarine xarray netCDF4", file=sys.stderr)
        return 1

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    kwargs = dict(dataset_id=DATASET_ID, variables=VARIABLES,
                  minimum_longitude=-180, maximum_longitude=180,
                  minimum_latitude=-80, maximum_latitude=90,
                  minimum_depth=0, maximum_depth=1)
    if args.start:
        kwargs.update(start_datetime=f"{args.start}T00:00:00", end_datetime=f"{args.end or args.start}T23:59:59")

    ds = copernicusmarine.open_dataset(**kwargs)

    step = max(1, args.step)
    ds = ds.isel(longitude=slice(None, None, step), latitude=slice(None, None, step))

    lats = ds["latitude"].values
    lons = ds["longitude"].values
    lat0, lon0 = float(lats[0]), float(lons[0])
    dlat = float(lats[1] - lats[0]) if len(lats) > 1 else 1.0
    dlon = float(lons[1] - lons[0]) if len(lons) > 1 else 1.0
    # OACF wants row 0 = south pole
    if dlat < 0:
        ds = ds.isel(latitude=slice(None, None, -1))
        lat0, dlat = float(ds["latitude"].values[0]), abs(dlat)

    times = ds["time"].values
    for ti, t in enumerate(times):
        u = np.nan_to_num(ds["uo"].isel(time=ti).values.astype("float32"))
        v = np.nan_to_num(ds["vo"].isel(time=ti).values.astype("float32"))
        ocean = np.isfinite(ds["uo"].isel(time=ti).values) & ~((u == 0) & (v == 0))
        stamp = dt.datetime.utcfromtimestamp(t.astype("datetime64[s]").astype(int))
        name = f"current_{stamp:%Y%m%d%H}.bin"
        write_oacf(out_dir / name, lon0, lat0, dlon, dlat, u, v, ocean,
                   source="COPERNICUS MARINE", resolution=f"{abs(dlon):.3f}deg",
                   timestamp_ms=int(stamp.replace(tzinfo=dt.timezone.utc).timestamp() * 1000))
        print("wrote", out_dir / name, u.shape)

    print("\nNext: upload to R2 and point the app at /current/<file>.bin")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
