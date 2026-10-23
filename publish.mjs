import fs from "node:fs";
import path from "node:path";

const WORKER = "https://worker-route.poweredbyalgo.com/app-publisher";
const APP = "toolbox";
const DIST = path.resolve("dist");
const PASSWORD = process.env.UPLOAD_PASSWORD;
if (!PASSWORD) throw new Error("请通过环境变量 UPLOAD_PASSWORD 提供上传密码");

const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else files.push(path.relative(DIST, p).split(path.sep).join("/"));
  }
})(DIST);

if (!files.includes("app.json")) throw new Error("dist 根目录缺少 app.json");
console.log(`publishing ${APP}: ${files.length} files`);

const MIME = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2"
};

const res = await fetch(WORKER + "/presign", {
  method: "POST",
  headers: { "X-Password": PASSWORD, "Content-Type": "application/json" },
  body: JSON.stringify({ app: APP, files })
});
if (!res.ok) throw new Error("presign 失败: " + res.status + " " + (await res.text()));
const { uploads, expiresAt } = await res.json();
console.log("presign ok, expires at", expiresAt);

for (const u of uploads) {
  const ext = path.extname(u.file).toLowerCase();
  const put = await fetch(u.url, {
    method: "PUT",
    headers: { "Content-Type": MIME[ext] || "application/octet-stream" },
    body: fs.readFileSync(path.join(DIST, u.file))
  });
  if (!put.ok) throw new Error("上传失败: " + u.key + " " + put.status + " " + (await put.text()));
  console.log("uploaded", u.key);
}
console.log("done");
