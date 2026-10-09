import { collectionKeys } from "@/lib/cms/collections";

/** API index — lists the available endpoints */
export function GET() {
  return Response.json({
    version: 1,
    read: {
      "GET /api/v1/projects": "published projects (carousel order)",
      "GET /api/v1/projects/{slug}": "one published project",
      "GET /api/v1/posts": "published journal posts (?tag=, ?category=)",
      "GET /api/v1/posts/{slug}": "one published post incl. rendered HTML",
      "GET /api/v1/settings": "site, profile and theme settings",
      ...Object.fromEntries(collectionKeys.map((k) => [`GET /api/v1/collections/${k}`, `published ${k}`])),
    },
    write: {
      auth: "signed-in session cookie + same-origin request; permissions follow the user's role",
      "POST /api/v1/projects": "create",
      "PATCH /api/v1/projects/{slug}": "partial update — only the fields you send change",
      "DELETE /api/v1/projects/{slug}": "delete",
      "POST /api/v1/posts": "create",
      "PATCH /api/v1/posts/{slug}": "partial update — only the fields you send change",
      "DELETE /api/v1/posts/{slug}": "delete",
      "POST /api/v1/media": "multipart upload (field: file, optional alt)",
    },
  });
}
