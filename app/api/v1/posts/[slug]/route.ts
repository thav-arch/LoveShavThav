import { eq } from "drizzle-orm";
import { error, options, publicJson, readJson, write } from "@/lib/cms/api";
import { db, schema } from "@/lib/cms/db";
import { getPostBySlug } from "@/lib/cms/queries";
import { invalidateFromRoute } from "@/lib/cms/revalidate";
import { ServiceError } from "@/lib/cms/services/common";
import { deletePost, patchPost } from "@/lib/cms/services/posts";

type Ctx = RouteContext<"/api/v1/posts/[slug]">;

async function idFor(slug: string) {
  const r = await db.select({ id: schema.posts.id }).from(schema.posts).where(eq(schema.posts.slug, slug));
  if (!r[0]) throw new ServiceError("Post not found.", 404);
  return r[0].id;
}

export async function GET(_req: Request, ctx: Ctx) {
  const p = await getPostBySlug((await ctx.params).slug);
  return p ? publicJson(p) : error(404, "Post not found.");
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  return write(req, async (user) => {
    const r = await patchPost(user, await idFor(slug), await readJson(req));
    invalidateFromRoute("posts", "taxonomy", "redirects");
    return r;
  });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  return write(req, async (user) => {
    await deletePost(user, await idFor(slug));
    invalidateFromRoute("posts");
  });
}

export const OPTIONS = options;
