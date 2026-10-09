"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deletePostAction, savePostAction } from "@/app/admin/actions";
import { slugify } from "@/lib/cms/validation";
import { ConfirmButton, Field, MarkdownField, MediaField, Notice, SeoPanel, StatusPill, TagInput, useSaver, type SeoValue } from "./ui";

export type PostFormValue = {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  cover: { id: string; url: string } | null;
  categoryId: string;
  tags: string[];
  seo: SeoValue;
  status: "draft" | "published" | "archived";
  /** yyyy-mm-ddThh:mm (local) — empty = now when published */
  publishedAt: string;
};

export const emptyPost: PostFormValue = {
  title: "",
  slug: "",
  excerpt: "",
  body: "",
  cover: null,
  categoryId: "",
  tags: [],
  seo: { title: "", description: "", ogImage: "", canonical: "", noindex: false },
  status: "draft",
  publishedAt: "",
};

export function PostForm({
  id,
  initial,
  categories,
  canPublish,
  canDelete,
}: {
  id: string | null;
  initial: PostFormValue;
  categories: { id: string; name: string }[];
  canPublish: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const saver = useSaver<{ id: string; slug: string }>(dirty);
  const e = saver.fields;
  const set = (patch: Partial<PostFormValue>) => {
    setV((c) => ({ ...c, ...patch }));
    setDirty(true);
  };
  const autoSlug = slugify(v.title);
  const scheduled = v.status === "published" && v.publishedAt && new Date(v.publishedAt) > new Date();

  const save = (status = v.status) =>
    saver.run(
      () =>
        savePostAction(id, {
          title: v.title,
          slug: v.slug,
          excerpt: v.excerpt,
          body: v.body,
          coverId: v.cover?.id ?? "",
          categoryId: v.categoryId,
          tags: v.tags.join("\n"),
          seo: v.seo,
          status,
          publishedAt: v.publishedAt ? new Date(v.publishedAt).toISOString() : "",
        }),
      (r) => {
        setDirty(false);
        setV((c) => ({ ...c, status, slug: r.data!.slug }));
        if (!id) router.replace(`/admin/posts/${r.data!.id}`);
      },
    );

  return (
    <form
      onSubmit={(ev) => {
        ev.preventDefault();
        save();
      }}
    >
      <div className="a-head">
        <div>
          <Link href="/admin/posts" className="a-crumb">
            ← Journal
          </Link>
          <h1>{v.title || "New post"}</h1>
          <p>
            <StatusPill status={scheduled ? "scheduled" : v.status} />{" "}
            {id && v.status === "published" && !scheduled && (
              <a href={`/journal/${v.slug}`} target="_blank" rel="noreferrer">
                /journal/{v.slug} ↗
              </a>
            )}
          </p>
        </div>
      </div>

      <div className="a-editor">
        <div>
          <section className="a-panel">
            <div className="a-grid">
              <Field label="Title" error={e.title}>
                <input type="text" value={v.title} required onChange={(ev) => set({ title: ev.target.value })} aria-invalid={!!e.title} />
              </Field>
              <Field label="URL slug" hint={`/journal/${v.slug || autoSlug || "…"}`} error={e.slug}>
                <input type="text" value={v.slug} placeholder={autoSlug} onChange={(ev) => set({ slug: ev.target.value })} />
              </Field>
              <Field label="Excerpt" hint="Shown in the journal list and as the default meta description" count={v.excerpt.length} max={400} error={e.excerpt}>
                <textarea rows={2} value={v.excerpt} onChange={(ev) => set({ excerpt: ev.target.value })} />
              </Field>
              <MarkdownField label="Body" value={v.body} onChange={(body) => set({ body })} big error={e.body} />
            </div>
          </section>
        </div>

        <aside>
          <section className="a-panel">
            <h2>Publishing</h2>
            <div className="a-grid" style={{ marginTop: 10 }}>
              <Field label="Status" hint={canPublish ? undefined : "Authors save drafts — an editor publishes."}>
                <select value={v.status} onChange={(ev) => set({ status: ev.target.value as PostFormValue["status"] })}>
                  <option value="draft">Draft</option>
                  <option value="published" disabled={!canPublish}>
                    Published
                  </option>
                  <option value="archived">Archived</option>
                </select>
              </Field>
              <Field label="Publish date" hint="A future date schedules the post (goes live within the hour)." error={e.publishedAt}>
                <input type="datetime-local" value={v.publishedAt} onChange={(ev) => set({ publishedAt: ev.target.value })} />
              </Field>
              <Field label="Category">
                <select value={v.categoryId} onChange={(ev) => set({ categoryId: ev.target.value })}>
                  <option value="">— none —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="a-field">
                <span>Tags</span>
                <TagInput value={v.tags} onChange={(tags) => set({ tags })} />
              </div>
              <MediaField label="Cover image" value={v.cover} onChange={(m) => set({ cover: m ? { id: m.id, url: m.variants.sm ?? m.url } : null })} />
            </div>
          </section>
          <SeoPanel
            value={v.seo}
            onChange={(seo) => set({ seo })}
            fallbackTitle={v.title}
            fallbackDescription={v.excerpt}
            path={`/journal/${v.slug || autoSlug}`}
            errors={e}
          />
        </aside>
      </div>

      <div className="a-savebar">
        <div style={{ flex: 1 }}>
          <Notice result={saver.result} />
          {!saver.result && dirty && <span className="a-hint">Unsaved changes</span>}
        </div>
        <div className="a-actions">
          {id && canDelete && (
            <ConfirmButton
              label="Delete"
              confirm={`Delete “${v.title}”? This can't be undone.`}
              disabled={saver.pending}
              onConfirm={() =>
                saver.run(
                  () => deletePostAction(id),
                  () => {
                    setDirty(false);
                    router.push("/admin/posts");
                  },
                )
              }
            />
          )}
          {canPublish && v.status !== "published" && (
            <button type="button" className="a-btn" disabled={saver.pending} onClick={() => save("published")}>
              Save & publish
            </button>
          )}
          <button className="a-btn primary" disabled={saver.pending}>
            {saver.pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </form>
  );
}
