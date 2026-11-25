/**
 * AUDIT-ONLY SCRIPT
 * Serves the production build of MillLedger with compression (gzip/brotli),
 * proper Cache-Control headers, and reverse proxies /api to port 4000.
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.resolve(__dirname, "../../client/dist");
const STATIC_PORT = 4173;
const API_PORT = 4000;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

export function startProductionStaticServer(port = STATIC_PORT) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const parsedUrl = new URL(req.url || "/", `http://${req.headers.host}`);
      const pathname = decodeURIComponent(parsedUrl.pathname);

      // Proxy API requests to backend
      if (pathname.startsWith("/api/")) {
        const proxyReq = http.request(
          {
            hostname: "127.0.0.1",
            port: API_PORT,
            path: req.url,
            method: req.method,
            headers: req.headers,
          },
          (proxyRes) => {
            res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
            proxyRes.pipe(res);
          }
        );
        proxyReq.on("error", (err) => {
          console.error("API proxy error:", err.message);
          res.writeHead(502, { "Content-Type": "text/plain" });
          res.end("Bad Gateway: API unreachable");
        });
        req.pipe(proxyReq);
        return;
      }

      // Serve static files
      let filePath = path.join(CLIENT_DIST, pathname);
      let isFallback = false;

      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(CLIENT_DIST, "index.html");
        isFallback = true;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || "application/octet-stream";

      // Cache headers
      const headers = {
        "Content-Type": contentType,
        "Vary": "Accept-Encoding",
      };

      if (pathname.startsWith("/assets/")) {
        headers["Cache-Control"] = "public, max-age=31536000, immutable";
      } else if (isFallback || ext === ".html") {
        headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
      } else {
        headers["Cache-Control"] = "public, max-age=3600";
      }

      // Compression negotiation
      const acceptEncoding = req.headers["accept-encoding"] || "";
      const rawContent = fs.readFileSync(filePath);

      // Do not compress binary fonts or images that are already compressed
      const shouldCompress = /text|javascript|json|xml|svg/i.test(contentType);

      if (shouldCompress && acceptEncoding.includes("br")) {
        headers["Content-Encoding"] = "br";
        const compressed = zlib.brotliCompressSync(rawContent);
        headers["Content-Length"] = String(compressed.length);
        res.writeHead(200, headers);
        res.end(compressed);
      } else if (shouldCompress && acceptEncoding.includes("gzip")) {
        headers["Content-Encoding"] = "gzip";
        const compressed = zlib.gzipSync(rawContent);
        headers["Content-Length"] = String(compressed.length);
        res.writeHead(200, headers);
        res.end(compressed);
      } else {
        headers["Content-Length"] = String(rawContent.length);
        res.writeHead(200, headers);
        res.end(rawContent);
      }
    });

    server.listen(port, "127.0.0.1", () => {
      console.log(`[Audit Prod Server] Serving ${CLIENT_DIST} with compression on http://127.0.0.1:${port}`);
      resolve(server);
    });

    server.on("error", reject);
  });
}

// Standalone execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startProductionStaticServer().catch(console.error);
}
