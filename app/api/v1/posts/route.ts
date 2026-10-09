import { options, publicJson, readJson, write } from "@/lib/cms/api";
import { getPublishedPosts } from "@/lib/cms/queries";
import { invalidateFromRoute } from "@/lib/cms/revalidate";
import { savePost } from "@/lib/cms/services/posts";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const tag = q.get("tag")?.toLowerCase();
  const category = q.get("category")?.toLowerCase();
  let posts = await getPublishedPosts();
  if (tag) posts = posts.filter((p) => p.tags.some((t) => t.toLowerCase() === tag));
  if (category) posts = posts.filter((p) => p.category?.toLowerCase() === category);
  return publicJson(posts);
}

export async function POST(req: Request) {
  return write(
    req,
    async (user) => {
      const r = await savePost(user, null, await readJson(req));
      invalidateFromRoute("posts", "taxonomy");
      return r;
    },
    201,
  );
}

export const OPTIONS = options;
