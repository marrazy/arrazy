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

Put photos in `src/assets/life/<city>/`, for example `src/assets/life/sydney/01-harbour.jpg`.
Each folder becomes a city in the menu with its own page, and `hong-kong` shows as "Hong Kong".
Photos are shown in file name order. Astro shrinks and converts them when it builds.

## Add albums to Playlist

Albums come from the backend, in `backend/src/api/data/playlist.json`. Paste Spotify album links there.
