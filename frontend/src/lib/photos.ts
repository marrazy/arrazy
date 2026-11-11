import type { ImageMetadata } from "astro";

/*
  Photos for the Life page are found automatically.
  Put them in src/assets/life/<city>/, for example:
    src/assets/life/sydney/harbour.jpg
    src/assets/life/hong-kong/night-market.jpg
  The folder name becomes the city ("hong-kong" shows as "Hong Kong") and gets its own page.
  Photos are numbered in name order, so name files 01-..., 02-... to control the order.
*/

const files = import.meta.glob<{ default: ImageMetadata }>(
  "/src/assets/life/*/*.{jpg,jpeg,png,webp,avif}",
  { eager: true },
);

// `id` stays the same when other photos are added (it's the file path), so it can seed the layout
export type Photo = { id: string; n: string; city: string; slug: string; image?: ImageMetadata; ratio: number };
export type City = { slug: string; name: string };

const titleCase = (slug: string) =>
  slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

// Shown only while there are no real photos yet
const SAMPLE: Array<[string, number]> = [
  ["sydney", 1.33], ["jakarta", 1.5], ["sydney", 0.75], ["sydney", 0.75],
  ["jakarta", 1.33], ["sydney", 1], ["jakarta", 0.75], ["sydney", 1.5],
];

export function getPhotos(): Photo[] {
  const entries = Object.entries(files).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) {
    return SAMPLE.map(([slug, ratio], i) => ({
      id: `sample-${i}`, n: String(i + 1).padStart(3, "0"), slug, city: titleCase(slug), ratio,
    }));
  }
  return entries.map(([path, mod], i) => {
    const slug = path.split("/").at(-2)!;
    const image = mod.default;
    return {
      id: path, n: String(i + 1).padStart(3, "0"), slug, city: titleCase(slug), image,
      ratio: image.height / image.width,
    };
  });
}

export function getCities(): City[] {
  const seen = new Map<string, string>();
  for (const p of getPhotos()) seen.set(p.slug, p.city);
  return [...seen].map(([slug, name]) => ({ slug, name })).sort((a, b) => a.name.localeCompare(b.name));
}

export const hasRealPhotos = () => Object.keys(files).length > 0;
