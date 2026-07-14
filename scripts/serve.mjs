import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const valueAfter = (flag, fallback) => args.includes(flag) ? args[args.indexOf(flag) + 1] ?? fallback : fallback;
const host = valueAfter("--host", "127.0.0.1");
const port = Number(valueAfter("--port", "4173"));
const build = spawnSync(process.execPath, ["scripts/build.mjs"], { stdio: "inherit" });
if (build.status !== 0) process.exit(build.status ?? 1);

const contentTypes = { ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml" };
const root = join(process.cwd(), "site");
const server = createServer(async (request, response) => {
  const path = new URL(request.url, `http://${request.headers.host}`).pathname;
  const requested = path === "/" ? "/index.html" : path;
  const filename = normalize(join(root, requested));
  if (!filename.startsWith(root)) { response.writeHead(403).end("Forbidden"); return; }
  try {
    await access(filename);
    if ((await stat(filename)).isDirectory()) throw new Error("directory");
    response.writeHead(200, { "Content-Type": contentTypes[extname(filename)] ?? "application/octet-stream", "Cache-Control": "no-store" });
    createReadStream(filename).pipe(response);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
  }
});
server.listen(port, host, () => console.log(`Paper reader preview: http://${host}:${port}`));
