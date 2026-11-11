import { SITE } from "../config";
import list from "../data/photos.json";

/*
  Photos for the Life page live in Cloudflare R2 (bucket "arrazy-photos", served at img.arrazy.com),
  one folder per city, for example:
    jakarta/IMG_0808.jpg
    hong-kong/night-market.jpg
  `npm run photos` (or the "Sync photos" workflow) lists the bucket into src/data/photos.json.
  The folder name becomes the city ("hong-kong" shows as "Hong Kong") and gets its own page.
  Photos are numbered in file name order, so name files 01-..., 02-... to control the order.
*/

type Entry = { key: string; width: number; height: number; etag: string };

export type PhotoImage = { src: string; srcset: string; full: string; width: number; height: number };
// `id` stays the same when other photos are added (it's the R2 key), so it can seed the layout
export type Photo = { id: string; n: string; city: string; slug: string; ratio: number; image?: PhotoImage };
export type City = { slug: string; name: string };

const photos = list as Entry[];

/** A resized copy from Cloudflare image transformations. */
export const photoUrl = (key: string, width: number) =>
  `${SITE.images}/cdn-cgi/image/width=${width},format=auto,quality=82/${encodeURI(key)}`;

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
  if (photos.length === 0) {
    return SAMPLE.map(([slug, ratio], i) => ({
      id: `sample-${i}`, n: String(i + 1).padStart(3, "0"), slug, city: titleCase(slug), ratio,
    }));
  }
  // photos.json is already sorted by key, with numbers compared as numbers
  return photos.map(({ key, width, height }, i) => {
    const slug = key.split("/")[0];
    return {
      id: key,
      n: String(i + 1).padStart(3, "0"),
      slug,
      city: titleCase(slug),
      ratio: height / width,
      image: {
        src: photoUrl(key, 800),
        srcset: [400, 800, 1200].map((w) => `${photoUrl(key, w)} ${w}w`).join(", "),
        full: photoUrl(key, 1800), // for the lightbox
        width,
        height,
      },
    };
  });
}

export function getCities(): City[] {
  const seen = new Map<string, string>();
  for (const p of getPhotos()) seen.set(p.slug, p.city);
  return [...seen].map(([slug, name]) => ({ slug, name })).sort((a, b) => a.name.localeCompare(b.name));
}

export const hasRealPhotos = () => photos.length > 0;
