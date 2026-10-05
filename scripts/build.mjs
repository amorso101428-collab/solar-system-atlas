/**
 * Production build without rollup.
 * The DSH runtime's node enforces library validation, so rollup's native addon
 * cannot be dlopen'd. esbuild runs as a subprocess and is unaffected.
 * On a normal machine `pnpm build:vite` works too.
 */
import { build } from "esbuild";
import { cp, mkdir, rm, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import {restoreSourceAssets} from './restore-source-assets.mjs';
await restoreSourceAssets();
import "./sync-solar-ui.mjs";

const out = "dist";
await rm(out, { recursive: true, force: true });
await mkdir(out + "/assets", { recursive: true });
if (existsSync("public")) await cp("public", out, { recursive: true });

await build({
  entryPoints: ["src/main.tsx"],
  bundle: true,
  format: "esm",
  outdir: out + "/assets",
  splitting: true,
  chunkNames: "[name]-[hash]",
  jsx: "automatic",
  target: ["es2020"],
  minify: true,
  sourcemap: false,
  legalComments: "none",
  loader: {
    ".woff2": "file", ".woff": "file", ".ttf": "file",
    ".png": "file", ".jpg": "file", ".jpeg": "file", ".svg": "file", ".webp": "file",
  },
  // Vite treats a leading "/" as a public asset; esbuild would try to resolve it.
  plugins: [{
    name: "public-external",
    setup(b) {
      b.onResolve({ filter: /^\// }, (args) => ({ path: args.path, external: true }));
    },
  }],
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "info",
});

const html = await readFile("index.html", "utf8");
const built = html
  .replace(
    '<script type="module" src="/src/main.tsx"></script>',
    '<link rel="stylesheet" href="/assets/main.css" />\n    <script type="module" src="/assets/main.js"></script>'
  );
await writeFile(out + "/index.html", built);

console.log("\n  OCEAN ATLAS built -> " + out);

await import('./build-solar.mjs');

// Keep the existing Node preview services, and ship Pages edge adapters for
// same-origin map tiles and live orbit requests in the cloud deployment.
await cp('scripts/pages-worker.mjs', out + '/_worker.js');
await writeFile(out + '/_routes.json', JSON.stringify({version: 1, include: ['/api/*'], exclude: []}, null, 2));
const solarHeaders = await readFile(out + '/_headers', 'utf8');
const mapOrigins = 'https://elevation-tiles-prod.s3.amazonaws.com https://*.tianditu.gov.cn https://*.cartocdn.com https://tile.googleapis.com';
const connectOrigins = mapOrigins + ' https://api.open-meteo.com https://marine-api.open-meteo.com';
const pagesHeaders = solarHeaders
  .replace("img-src 'self' data: blob: https://cloudflareinsights.com", "img-src 'self' data: blob: https://cloudflareinsights.com " + mapOrigins)
  .replace("connect-src 'self' blob: data: https://music.163.com", "connect-src 'self' blob: data: " + connectOrigins + ' https://music.163.com')
  .replace('/assets/*\n  Cache-Control: public, max-age=31536000, immutable', '/assets/*\n  Cache-Control: public, max-age=0, must-revalidate');
await writeFile(out + '/_headers', pagesHeaders + '\n/solar/assets/*\n  Cache-Control: public, max-age=0, must-revalidate\n\n/solar/*\n  Cache-Control: public, max-age=0, must-revalidate\n\n/weather/*\n  Cache-Control: public, max-age=0, must-revalidate\n');
