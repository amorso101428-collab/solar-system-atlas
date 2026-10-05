"""Compatibility entry point: native 0.25° GFS decoder now runs in Node.
Use NODE_BINARY when Node is not on PATH. No NumPy dependency.
"""
import os, subprocess, sys
from pathlib import Path
root = Path(__file__).resolve().parents[1]
subprocess.run([os.environ.get("NODE_BINARY", "node"), str(root / "scripts/fetch-weather.mjs"), *sys.argv[1:]], cwd=root, check=True)
