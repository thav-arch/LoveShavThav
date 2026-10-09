import "server-only";
import { revalidateTag, updateTag } from "next/cache";
import { TAGS } from "./queries";

type Tag = keyof typeof TAGS;

/** from Server Actions: expire immediately so the editor sees their change */
export function invalidateFromAction(...keys: Tag[]) {
  for (const k of keys) updateTag(TAGS[k]);
}

/** from Route Handlers (API): expire immediately */
export function invalidateFromRoute(...keys: Tag[]) {
  for (const k of keys) revalidateTag(TAGS[k], { expire: 0 });
}
