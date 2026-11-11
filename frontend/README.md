# arrazy.com frontend

Built with [Astro](https://astro.build). Pages are made into plain HTML files at build time,
and Nginx serves them. The live Spotify parts are small React components.

## Run it on your computer

```bash
npm install
npm run dev        # http://localhost:5173, reloads when you save
npm run build      # makes the final site in dist/
npm run check      # checks types and finds mistakes
```

By default the site talks to the live API. To use a backend running on your computer,
make a file called `.env` in this folder with:

```
PUBLIC_API_URL=http://127.0.0.1:8000/v1
```

## Where things live

| To change | Edit |
| --- | --- |
| Name, email, links, API address, time zone | `src/config.ts` |
| Home page text | `src/pages/index.astro` |
| About intro | `src/pages/about.astro` |
| Experience and tools | `src/data/about.ts` |
| Projects | `src/data/projects.ts` |
| Colours, fonts, spacing | `src/styles/global.css` |
| Sidebar menu | `NAV` in `src/config.ts` |

## Add a post

Make a new file in `src/content/writings/`. The file name becomes the address,
so `my-first-post.md` opens at `/writings/my-first-post/`.

```md
---
title: My first post
lede: One line that sums it up.
tag: Engineering
date: 2026-11-20
image: ./images/my-first-post.jpg
---

Write the post here in Markdown.
```

- Leave out `date` to show "Coming soon".
- Leave out `image` to show an empty frame. Put images in `src/content/writings/images/`.
- Posts are sorted newest first, and the № numbers update by themselves.

## Add photos to Life

Photos live in Cloudflare R2 (bucket `arrazy-photos`, served at https://img.arrazy.com), not in this repo.
Each folder in the bucket is a city: `jakarta/IMG_0808.jpg` shows under Jakarta, and `hong-kong/`
shows as "Hong Kong" with its own page at `/life/hong-kong/`. Photos are shown and numbered in file
name order (numbers compared as numbers), so name files `01-...`, `02-...` to control the order.
Cloudflare resizes and converts them on the fly, so upload the originals.

**1. Upload**

- **Cloudflare dashboard** (works from a phone too): R2 → `arrazy-photos` → open or create the city
  folder → Upload.
- **From your computer**, with the AWS CLI and an `r2` profile that has your R2 keys
  (`aws configure --profile r2`, region `auto`):

  ```bash
  aws s3 sync ./photos/sydney s3://arrazy-photos/sydney \
    --profile r2 --endpoint-url https://<account-id>.r2.cloudflarestorage.com
  ```

**2. Sync**

The site only knows about photos listed in `src/data/photos.json`. To update it:

- **GitHub** (website or app): Actions → **Sync photos** → Run workflow. It updates `photos.json`,
  commits it to `main`, and starts the Frontend deploy. If nothing changed, it stops there.
- **Locally**: `npm run photos`, then commit `src/data/photos.json` yourself. This needs
  `R2_ENDPOINT`, `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` (and optionally `R2_BUCKET`)
  in `frontend/.env`, which git and Docker both ignore.

Only new or changed photos are downloaded (to read their size), so syncing stays quick.
Deleting a photo from R2 removes it from the site on the next sync.

## Add albums to Playlist

Albums come from the backend, in `backend/src/api/data/playlist.json`. Paste Spotify album links there.
