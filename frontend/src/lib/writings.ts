import { getCollection, type CollectionEntry } from "astro:content";

export type Post = CollectionEntry<"writings">;

/*
  All posts, newest first.
  Posts with a date are sorted by date. Posts without one ("Coming soon") go on top.
  The № number counts up from the oldest post.
*/
export async function getPosts() {
  const posts = await getCollection("writings");
  posts.sort((a, b) => {
    const da = a.data.date?.getTime() ?? Infinity;
    const db = b.data.date?.getTime() ?? Infinity;
    return db - da || a.id.localeCompare(b.id);
  });
  return posts.map((post, i) => ({ post, no: `№ ${String(posts.length - i).padStart(3, "0")}` }));
}

export const formatDate = (date?: Date) =>
  date ? date.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" }) : "Coming soon";

export function readTime(post: Post) {
  const words = (post.body ?? "").split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.ceil(words / 200))} min read`;
}
