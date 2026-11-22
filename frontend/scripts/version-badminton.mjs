// Runs after `astro build`. Gives every file of the badminton app a new address on each release,
// for example /badminton/styles.css?v=3f2a9c01de, so no cache can serve an old copy next to a new page.
// Cloudflare tells browsers to keep .css and .js files for 4 hours, so without this a phone can
// show a new page with old styles and old code. The page itself (/badminton/) is never cached.
//
// Every reference that should be rewritten must be found, or the build stops with an error.
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const DIR = path.resolve(process.argv[2] ?? "dist/badminton");
const read = (f) => fs.readFileSync(path.join(DIR, f));
const text = (f) => read(f).toString("utf8");
const write = (f, s) => fs.writeFileSync(path.join(DIR, f), s);
const hash = (data) => createHash("sha256").update(data).digest("hex").slice(0, 10);

const version = {};
const url = (f) => `/badminton/${f}?v=${version[f]}`;

function swap(source, file, refs) {
  let out = source;
  for (const f of refs) {
    const plain = `/badminton/${f}`;
    const pattern = new RegExp(`${plain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=["')])`, "g");
    if (!pattern.test(out)) throw new Error(`version-badminton: ${file} has no reference to ${plain}`);
    out = out.replace(pattern, url(f));
  }
  return out;
}

// 1. Files that point to nothing else
for (const f of [
  "fonts/geist-latin-wght-normal.woff2",
  "fonts/geist-mono-latin-wght-normal.woff2",
  "icon.svg",
  "icon-192.png",
  "icon-512.png",
  "logic.js",
  "icons.js",
]) {
  version[f] = hash(read(f));
}

// 2. Files that point to the ones above, then their own version
const styles = swap(text("styles.css"), "styles.css", ["fonts/geist-latin-wght-normal.woff2", "fonts/geist-mono-latin-wght-normal.woff2"]);
write("styles.css", styles);
version["styles.css"] = hash(styles);

const app = swap(text("app.js"), "app.js", ["logic.js", "icons.js"]);
write("app.js", app);
version["app.js"] = hash(app);

const manifest = swap(text("manifest.webmanifest"), "manifest.webmanifest", ["icon.svg", "icon-192.png", "icon-512.png"]);
write("manifest.webmanifest", manifest);
version["manifest.webmanifest"] = hash(manifest);

// 3. The page
const page = swap(text("index.html"), "index.html", [
  "styles.css",
  "app.js",
  "manifest.webmanifest",
  "icon.svg",
  "icon-192.png",
  "fonts/geist-latin-wght-normal.woff2",
]);
write("index.html", page);

// 4. The offline code: save the versioned files, under a cache name that changes with every release.
//    sw.js keeps its plain address so phones always find it, and its content changes with each release.
const build = hash(Object.entries(version).sort().map(([f, v]) => `${f}=${v}`).join("\n") + page);
let sw = swap(text("sw.js"), "sw.js", Object.keys(version));
if (!/const CACHE = "badminton-[^"]+";/.test(sw)) throw new Error("version-badminton: sw.js has no CACHE name");
sw = sw.replace(/const CACHE = "badminton-[^"]+";/, `const CACHE = "badminton-${build}";`);
write("sw.js", sw);

console.log(`version-badminton: release ${build}, ${Object.keys(version).length} files versioned`);
