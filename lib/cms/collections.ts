import { z } from "zod";

/**
 * MODULAR SECTIONS — the one place to add a new content type.
 *
 * Each collection declares its fields once. From that definition the CMS
 * derives: the admin list + edit form, validation, the public API
 * (/api/v1/collections/<key>), and a section on the /about page. Rows are
 * stored in the generic `entries` table, so no database migration is needed.
 *
 * To add e.g. "talks": copy a block below, change the key/labels/fields.
 */
export type FieldType = "text" | "textarea" | "url" | "date" | "number" | "media" | "select" | "boolean";

export type Field = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  help?: string;
};

export type CollectionDef = {
  label: string;
  singular: string;
  /** field shown as the row title in lists */
  titleField: string;
  description: string;
  /** render on the public /about page */
  showOnAbout: boolean;
  /** "quote" | "list" — how the /about page renders the section */
  display: "quote" | "list";
  fields: Field[];
};

export const collections = {
  testimonials: {
    label: "Testimonials",
    singular: "Testimonial",
    titleField: "author",
    description: "Quotes from collaborators, clients and teachers.",
    showOnAbout: true,
    display: "quote",
    fields: [
      { name: "quote", label: "Quote", type: "textarea", required: true },
      { name: "author", label: "Author", type: "text", required: true },
      { name: "role", label: "Role / title", type: "text" },
      { name: "company", label: "Company / studio", type: "text" },
      { name: "avatar", label: "Photo", type: "media" },
      { name: "url", label: "Link", type: "url" },
    ],
  },
  achievements: {
    label: "Achievements",
    singular: "Achievement",
    titleField: "title",
    description: "Awards, exhibitions, jams, publications and talks.",
    showOnAbout: true,
    display: "list",
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "kind", label: "Kind", type: "select", options: ["Award", "Exhibition", "Game jam", "Talk", "Publication", "Other"] },
      { name: "issuer", label: "Issuer / event", type: "text" },
      { name: "date", label: "Date", type: "date" },
      { name: "description", label: "Description", type: "textarea" },
      { name: "url", label: "Link", type: "url" },
      { name: "image", label: "Image", type: "media" },
    ],
  },
} satisfies Record<string, CollectionDef>;

export type CollectionKey = keyof typeof collections;
export const collectionKeys = Object.keys(collections) as CollectionKey[];
export const isCollection = (k: string): k is CollectionKey => k in collections;
export const getCollection = (k: CollectionKey): CollectionDef => collections[k];

const safeUrl = z
  .string()
  .trim()
  .refine((v) => v === "" || /^https?:\/\//i.test(v) || v.startsWith("/"), "Must start with http(s):// or /");

function fieldSchema(f: Field) {
  let s: z.ZodType;
  switch (f.type) {
    case "number":
      s = z.coerce.number();
      break;
    case "boolean":
      s = z.coerce.boolean();
      break;
    case "url":
      s = safeUrl;
      break;
    case "date":
      s = z.string().trim().refine((v) => v === "" || !Number.isNaN(Date.parse(v)), "Invalid date");
      break;
    case "select":
      s = z.string().refine((v) => v === "" || !f.options || f.options.includes(v), "Invalid option");
      break;
    case "media":
      s = z.string().trim().max(500);
      break;
    default:
      s = z.string().trim().max(f.type === "textarea" ? 5000 : 300);
  }
  if (f.required && f.type !== "boolean" && f.type !== "number") {
    s = (s as z.ZodString).refine((v: string) => v.length > 0, `${f.label} is required`);
  }
  return s;
}

/** validation schema generated from the field definitions */
export function collectionSchema(def: CollectionDef) {
  return z.object(Object.fromEntries(def.fields.map((f) => [f.name, fieldSchema(f)])));
}
