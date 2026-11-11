// Lists the photos in the R2 bucket and writes src/data/photos.json for the Life page.
//
//   npm run photos
//
// Needs R2_ENDPOINT, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY (from frontend/.env locally,
// or repository secrets in the "Sync photos" workflow). R2_BUCKET defaults to "arrazy-photos".
//
// Only new or changed photos (by ETag) are downloaded, to read their width and height.
// Everything else is reused from the existing photos.json.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { GetObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { imageSize } from "image-size";

const OUT = fileURLToPath(new URL("../src/data/photos.json", import.meta.url));
// "<city>/<file>.<ext>", one folder deep
const PHOTO_KEY = /^[^/]+\/[^/]+\.(jpe?g|png|webp|avif)$/i;
const DOWNLOADS_AT_ONCE = 4;

const required = ["R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(
    `Missing ${missing.join(", ")}.\n` +
      "Locally, put them in frontend/.env. In GitHub Actions, add them as repository secrets.",
  );
  process.exit(1);
}

const bucket = process.env.R2_BUCKET || "arrazy-photos";
const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  // R2 doesn't support the newer default checksums
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

const byKey = new Intl.Collator("en", { numeric: true }).compare;
const cleanEtag = (etag) => (etag ?? "").replaceAll('"', "");

async function listPhotos() {
  const objects = [];
  let ContinuationToken;
  do {
    const page = await s3.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken }));
    for (const obj of page.Contents ?? []) {
      if (obj.Key && PHOTO_KEY.test(obj.Key)) objects.push({ key: obj.Key, etag: cleanEtag(obj.ETag) });
    }
    ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (ContinuationToken);
  return objects;
}

async function measure(key) {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const bytes = await res.Body.transformToByteArray();
  const { width, height, orientation } = imageSize(bytes);
  if (!width || !height) throw new Error("no width or height found");
  // EXIF orientations 5 to 8 are turned 90°, and Cloudflare shows them turned
  return orientation >= 5 && orientation <= 8 ? { width: height, height: width } : { width, height };
}

async function readExisting() {
  try {
    const list = JSON.parse(await readFile(OUT, "utf8"));
    return new Map(list.map((p) => [p.key, p]));
  } catch {
    return new Map();
  }
}

const existing = await readExisting();
const objects = await listPhotos();

const reused = [];
const toMeasure = [];
for (const obj of objects) {
  const old = existing.get(obj.key);
  if (old && old.etag === obj.etag) reused.push(old);
  else toMeasure.push(obj);
}

const measured = [];
const skipped = [];
for (let i = 0; i < toMeasure.length; i += DOWNLOADS_AT_ONCE) {
  const batch = toMeasure.slice(i, i + DOWNLOADS_AT_ONCE);
  const results = await Promise.allSettled(batch.map((obj) => measure(obj.key)));
  results.forEach((result, j) => {
    const { key, etag } = batch[j];
    if (result.status === "fulfilled") {
      measured.push({ key, ...result.value, etag });
    } else {
      skipped.push(key);
      console.warn(`! Skipped ${key}: ${result.reason?.message ?? result.reason}`);
    }
  });
}

const photos = [...reused, ...measured]
  .map(({ key, width, height, etag }) => ({ key, width, height, etag }))
  .sort((a, b) => byKey(a.key, b.key));

const keys = new Set(photos.map((p) => p.key));
const added = measured.filter((p) => !existing.has(p.key)).map((p) => p.key);
const changed = measured.filter((p) => existing.has(p.key)).map((p) => p.key);
const removed = [...existing.keys()].filter((key) => !keys.has(key));

for (const key of added) console.log(`+ ${key}`);
for (const key of changed) console.log(`~ ${key}`);
for (const key of removed) console.log(`- ${key}`);

await writeFile(OUT, JSON.stringify(photos, null, 2) + "\n");

const cities = new Set(photos.map((p) => p.key.split("/")[0]));
console.log(
  `${photos.length} photos in ${cities.size} ${cities.size === 1 ? "city" : "cities"}: ` +
    `${added.length} added, ${changed.length} changed, ${removed.length} removed, ` +
    `${reused.length} unchanged, ${skipped.length} skipped.`,
);
