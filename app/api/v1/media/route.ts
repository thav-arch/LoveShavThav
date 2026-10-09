import { write } from "@/lib/cms/api";
import { ServiceError } from "@/lib/cms/services/common";
import { uploadMedia } from "@/lib/cms/services/media";

/**
 * Media upload (multipart/form-data: file, alt?). Used by the dashboard's
 * media library and pickers. A route handler rather than a Server Action so
 * large files aren't subject to the 1 MB action body limit.
 */
export async function POST(req: Request) {
  return write(
    req,
    async (user) => {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File) || file.size === 0) throw new ServiceError("No file received.", 400);
      return uploadMedia(user, file, String(form.get("alt") ?? ""));
    },
    201,
  );
}
