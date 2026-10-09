import { error, options, publicJson } from "@/lib/cms/api";
import { isCollection } from "@/lib/cms/collections";
import { getEntries } from "@/lib/cms/queries";

export async function GET(_req: Request, ctx: RouteContext<"/api/v1/collections/[type]">) {
  const { type } = await ctx.params;
  if (!isCollection(type)) return error(404, "Unknown collection.");
  return publicJson(await getEntries(type));
}

export const OPTIONS = options;
