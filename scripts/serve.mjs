#!/usr/bin/env node
// A static server for docs/, so the walk can be opened without a build step.
//
// Deliberately tiny and dependency-free: the site is plain ES modules, real
// files and no bundler, and the only thing it needs from a server is correct
// MIME types for .js and .json. Module scripts will not load over file://,
// which is the only reason this exists at all.
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "docs");
const PORT = Number(process.env.PORT || 5170);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
};

http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      let file = path.join(ROOT, decodeURIComponent(url.pathname));
      // Directory -> index.html
      const info = await stat(file).catch(() => null);
      if (!info || info.isDirectory()) file = path.join(file, "index.html");
      // Never serve outside docs/.
      if (!path.resolve(file).startsWith(path.resolve(ROOT))) {
        res.writeHead(403).end("forbidden");
        return;
      }
      const body = await readFile(file);
      res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404, { "content-type": "text/plain" }).end("not found");
    }
  })
  .listen(PORT, () => console.log(`Campus Walk -> http://localhost:${PORT}`));
