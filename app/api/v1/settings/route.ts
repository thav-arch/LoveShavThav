import { options, publicJson } from "@/lib/cms/api";
import { getSettings } from "@/lib/cms/queries";

export async function GET() {
  const [site, profile, theme] = await Promise.all([getSettings("site"), getSettings("profile"), getSettings("theme")]);
  return publicJson({ site, profile, theme }, 300);
}

export const OPTIONS = options;
