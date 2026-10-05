import {imageryFeed} from "./imagery-feed.mjs";
import {serveAudio} from './audio-files.mjs';
import { environmentFeed } from "./environment-feed.mjs";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = process.argv[2] || "dist";
const port = Number(process.argv[3] || 4178);
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml",
  ".wasm": "application/wasm", ".woff2": "font/woff2", ".woff": "font/woff", ".ico": "image/x-icon",
};

const serveEnvironment = environmentFeed(root);
const serveImagery=imageryFeed(root);
createServer(async (req, res) => {
  try {
    if (await serveImagery(req,res)) return;
    if (await serveEnvironment(req,res)) return;
    let p = decodeURIComponent((req.url || "/").split("?")[0]);
    if (p.endsWith("/")) p += "index.html";
    const file = join(root, normalize(p).replace(/^(\.\.[/\\])+/, ""));
    const s = await stat(file).catch(() => null);
    if (!s || !s.isFile()) {
      if(extname(p)){res.writeHead(404);res.end("Not found");return;}
      const html = await readFile(join(root,p.startsWith("/solar")?"solar/index.html":"index.html"));
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }
    const etag = `W/"${s.size.toString(16)}-${Math.trunc(s.mtimeMs).toString(16)}"`;
    const versioned = /-[A-Z0-9]{8}\.(js|css|woff2?|png|jpg)$/.test(file);
    const cloudTile = /\/earth\/cloud-tiles\/\d+\/\d+-\d+\.webp$/.test(p) && new URL(req.url,"http://localhost").searchParams.has("v");
    const localTile = /\/earth\/local-tiles\/\d+\/\d+\/\d+\.jpg$/.test(p) && new URL(req.url,"http://localhost").searchParams.has("v");
    const cache = versioned ? "public, max-age=31536000, immutable" : cloudTile || localTile ? "public, max-age=86400" : "no-cache";
    if (req.headers["if-none-match"] === etag) {
      res.writeHead(304, { etag, "cache-control": cache });
      res.end(); return;
    }
    if(serveAudio(req,res,file,s,etag))return;
    const body = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream", "cache-control": cache, etag });
    res.end(body);
  } catch (e) {
    res.writeHead(500); res.end(String(e));
  }
}).listen(port, "127.0.0.1", () => console.log("OCEAN ATLAS serving " + root + " on http://127.0.0.1:" + port));
