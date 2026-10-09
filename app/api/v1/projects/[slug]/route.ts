import { eq } from "drizzle-orm";
import { error, options, publicJson, readJson, write } from "@/lib/cms/api";
import { db, schema } from "@/lib/cms/db";
import { getProjectBySlug } from "@/lib/cms/queries";
import { invalidateFromRoute } from "@/lib/cms/revalidate";
import { ServiceError } from "@/lib/cms/services/common";
import { deleteProject, patchProject } from "@/lib/cms/services/projects";

type Ctx = RouteContext<"/api/v1/projects/[slug]">;

async function idFor(slug: string) {
  const r = await db.select({ id: schema.projects.id }).from(schema.projects).where(eq(schema.projects.slug, slug));
  if (!r[0]) throw new ServiceError("Project not found.", 404);
  return r[0].id;
}

export async function GET(_req: Request, ctx: Ctx) {
  const p = await getProjectBySlug((await ctx.params).slug);
  return p ? publicJson(p) : error(404, "Project not found.");
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  return write(req, async (user) => {
    const r = await patchProject(user, await idFor(slug), await readJson(req));
    invalidateFromRoute("projects", "taxonomy", "redirects");
    return r;
  });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  return write(req, async (user) => {
    await deleteProject(user, await idFor(slug));
    invalidateFromRoute("projects");
  });
}

export const OPTIONS = options;
