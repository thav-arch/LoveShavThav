import type { Role } from "../db/schema";

/**
 * Role-based access control.
 *
 *   admin  — everything, including users, roles and site settings/theme
 *   editor — create, edit, publish and delete all content, media and taxonomy
 *   author — create content and edit their OWN drafts; cannot publish,
 *            delete others' work, or touch settings and users
 *
 * Every server action and write API route checks permissions through `can`.
 */
export type Resource = "content" | "media" | "taxonomy" | "settings" | "users";
export type Action = "read" | "create" | "update" | "delete" | "publish";

type Rule = Partial<Record<Resource, readonly Action[] | "own">>;

const RULES: Record<Role, Rule> = {
  admin: {
    content: ["read", "create", "update", "delete", "publish"],
    media: ["read", "create", "update", "delete"],
    taxonomy: ["read", "create", "update", "delete"],
    settings: ["read", "update"],
    users: ["read", "create", "update", "delete"],
  },
  editor: {
    content: ["read", "create", "update", "delete", "publish"],
    media: ["read", "create", "update", "delete"],
    taxonomy: ["read", "create", "update", "delete"],
    settings: ["read"],
  },
  author: {
    content: "own",
    media: ["read", "create"],
    taxonomy: ["read"],
  },
};

export type Actor = { id: string; role: Role };

/**
 * @param ownerId author of the record being changed (for "own" rules)
 */
export function can(user: Actor | null, action: Action, resource: Resource, ownerId?: string | null) {
  if (!user) return false;
  const rule = RULES[user.role][resource];
  if (!rule) return false;
  if (rule === "own") {
    if (action === "read" || action === "create") return true;
    if (action === "publish") return false;
    return ownerId != null && ownerId === user.id;
  }
  return rule.includes(action);
}

export class ForbiddenError extends Error {
  status = 403;
  constructor(message = "You don't have permission to do that.") {
    super(message);
  }
}

export function assertCan(user: Actor | null, action: Action, resource: Resource, ownerId?: string | null) {
  if (!can(user, action, resource, ownerId)) throw new ForbiddenError();
}

export const ROLE_LABEL: Record<Role, string> = { admin: "Admin", editor: "Editor", author: "Author" };
