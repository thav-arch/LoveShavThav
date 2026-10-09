import { options, publicJson, readJson, write } from "@/lib/cms/api";
import { getPublishedProjects } from "@/lib/cms/queries";
import { invalidateFromRoute } from "@/lib/cms/revalidate";
import { saveProject } from "@/lib/cms/services/projects";

export async function GET() {
  return publicJson(await getPublishedProjects());
}

export async function POST(req: Request) {
  return write(
    req,
    async (user) => {
      const r = await saveProject(user, null, await readJson(req));
      invalidateFromRoute("projects", "taxonomy");
      return r;
    },
    201,
  );
}

export const OPTIONS = options;
