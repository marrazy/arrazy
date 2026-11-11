import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

// Each Markdown file in src/content/writings/ is one post.
// The file name becomes the address: hash-bug.md -> /writings/hash-bug/
const writings = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/writings" }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      lede: z.string(), // the one-line summary under the title
      tag: z.string(),
      date: z.coerce.date().optional(), // leave out to show "Coming soon"
      image: image().optional(), // e.g. ./images/hash.jpg, relative to the post
    }),
});

export const collections = { writings };
