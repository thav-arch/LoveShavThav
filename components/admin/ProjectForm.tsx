"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteProjectAction, saveProjectAction } from "@/app/admin/actions";
import { slugify } from "@/lib/cms/validation";
import {
  ConfirmButton,
  Field,
  MarkdownField,
  MediaField,
  Notice,
  SeoPanel,
  StatusPill,
  TagInput,
  useSaver,
  type SeoValue,
} from "./ui";
import { emptySectionContent, SectionEditor, type SectionContent } from "./SectionEditor";
import { ThemePanel } from "./ThemePanel";
import { ProjectMusicPanel } from "./MusicFields";
import type { ProjectTheme } from "@/lib/project-theme";

/** a case-study section: heading + Markdown + its image layout (lib/gallery.ts) */
type Section = { id: string; title: string; body: string } & SectionContent;
type Link_ = { label: string; url: string };

export type ProjectFormValue = {
  title: string;
  slug: string;
  subtitle: string;
  summary: string;
  year: string;
  role: string;
  tools: string[];
  tags: string[];
  accent: string;
  categoryId: string;
  cover: { id: string; url: string } | null;
  hero: { id: string; url: string } | null;
  videoUrl: string;
  links: Link_[];
  sections: Section[];
  seo: SeoValue;
  status: "draft" | "published" | "archived";
  featured: boolean;
  theme: ProjectTheme;
};

export const emptyProject: ProjectFormValue = {
  title: "",
  slug: "",
  subtitle: "",
  summary: "",
  year: String(new Date().getFullYear()),
  role: "",
  tools: [],
  tags: [],
  accent: "#888888",
  categoryId: "",
  cover: null,
  hero: null,
  videoUrl: "",
  links: [],
  sections: [],
  seo: { title: "", description: "", ogImage: "", canonical: "", noindex: false },
  status: "draft",
  featured: true,
  theme: { mode: "site" },
};

const SECTION_PRESETS = ["Process", "Gameplay", "System Design", "Level Design", "Iteration", "Prototype", "Outcome"];

export function ProjectForm({
  id,
  initial,
  categories,
  canPublish,
  canDelete,
}: {
  id: string | null;
  initial: ProjectFormValue;
  categories: { id: string; name: string }[];
  canPublish: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const saver = useSaver<{ id: string; slug: string }>(dirty);
  const e = saver.fields;
  const set = (patch: Partial<ProjectFormValue>) => {
    setV((cur) => ({ ...cur, ...patch }));
    setDirty(true);
  };

  const setSection = (i: number, patch: Partial<Section>) => set({ sections: v.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const moveSection = (i: number, d: -1 | 1) => {
    const s = [...v.sections];
    const j = i + d;
    if (j < 0 || j >= s.length) return;
    [s[i], s[j]] = [s[j], s[i]];
    set({ sections: s });
  };
  const addSection = (title = "") =>
    set({
      sections: [
        ...v.sections,
        { id: slugify(title) || `section-${Date.now().toString(36)}`, title, body: "", ...emptySectionContent },
      ],
    });

  const save = (status = v.status) =>
    saver.run(
      () =>
        saveProjectAction(id, {
          title: v.title,
          slug: v.slug,
          subtitle: v.subtitle,
          summary: v.summary,
          year: v.year,
          role: v.role,
          tools: v.tools.join("\n"),
          tags: v.tags.join("\n"),
          accent: v.accent,
          categoryId: v.categoryId,
          coverId: v.cover?.id ?? "",
          heroId: v.hero?.id ?? "",
          videoUrl: v.videoUrl,
          links: v.links,
          // images live in `items`; the old single-media fields are cleared once a section is saved here
          sections: v.sections.map((s, i) => ({ ...s, id: s.id || slugify(s.title) || `section-${i + 1}`, mediaUrl: null })),
          seo: v.seo,
          status,
          featured: v.featured,
          theme: v.theme,
        }),
      (r) => {
        setDirty(false);
        setV((cur) => ({ ...cur, status, slug: r.data!.slug }));
        if (!id) router.replace(`/admin/projects/${r.data!.id}`);
      },
    );

  const autoSlug = slugify(v.title);

  return (
    <form
      onSubmit={(ev) => {
        ev.preventDefault();
        save();
      }}
    >
      <div className="a-head">
        <div>
          <Link href="/admin/projects" className="a-crumb">
            ← Projects
          </Link>
          <h1>{v.title || "New project"}</h1>
          <p>
            <StatusPill status={v.status} /> {id && v.status === "published" && <a href={`/projects/${v.slug}`} target="_blank" rel="noreferrer">/projects/{v.slug} ↗</a>}
          </p>
        </div>
      </div>

      <div className="a-editor">
        <div>
          <section className="a-panel">
            <div className="a-grid cols-2">
              <Field label="Title" error={e.title} className="a-span-all">
                <input type="text" value={v.title} onChange={(ev) => set({ title: ev.target.value })} required aria-invalid={!!e.title} />
              </Field>
              <Field label="URL slug" hint={`/projects/${v.slug || autoSlug || "…"}${id ? " — changing it keeps a redirect from the old URL" : ""}`} error={e.slug}>
                <input type="text" value={v.slug} placeholder={autoSlug} onChange={(ev) => set({ slug: ev.target.value })} />
              </Field>
              <Field label="Card subtitle" hint="Short type line shown on the 3D card" error={e.subtitle}>
                <input type="text" value={v.subtitle} onChange={(ev) => set({ subtitle: ev.target.value })} />
              </Field>
              <Field label="Summary" hint="1–2 sentences: case-study intro and default meta description" count={v.summary.length} max={600} className="a-span-all" error={e.summary}>
                <textarea rows={3} value={v.summary} onChange={(ev) => set({ summary: ev.target.value })} />
              </Field>
              <Field label="Role" error={e.role}>
                <input type="text" value={v.role} placeholder="Game Designer / Narrative Designer" onChange={(ev) => set({ role: ev.target.value })} />
              </Field>
              <Field label="Year" error={e.year}>
                <input type="text" value={v.year} onChange={(ev) => set({ year: ev.target.value })} />
              </Field>
              <div className="a-field">
                <span>Disciplines / tags</span>
                <TagInput value={v.tags} onChange={(tags) => set({ tags })} placeholder="Game Design, Level Design…" />
              </div>
              <div className="a-field">
                <span>Tools</span>
                <TagInput value={v.tools} onChange={(tools) => set({ tools })} placeholder="Unity, Blender…" />
              </div>
            </div>
          </section>

          <section className="a-panel">
            <h2>Media</h2>
            <p className="a-hint">The cover is the 3D card (16:10, ≥ 1600px wide). The hero opens the case study.</p>
            <div className="a-grid cols-2">
              <MediaField label="Card cover" value={v.cover} onChange={(m) => set({ cover: m ? { id: m.id, url: m.variants.sm ?? m.url } : null })} />
              <MediaField label="Case-study hero" value={v.hero} onChange={(m) => set({ hero: m ? { id: m.id, url: m.variants.sm ?? m.url } : null })} />
              <MediaField
                label="Gameplay video (optional)"
                kind="video"
                hint="Shown after the hero when no section has a video"
                value={v.videoUrl ? { url: v.videoUrl } : null}
                onChange={(m) => set({ videoUrl: m?.url ?? "" })}
              />
              <Field label="Accent colour" hint="Fallback card colour and small tints">
                <div className="a-color">
                  <input type="color" value={v.accent} onChange={(ev) => set({ accent: ev.target.value })} />
                  <input type="text" value={v.accent} onChange={(ev) => set({ accent: ev.target.value })} aria-invalid={!!e.accent} />
                </div>
              </Field>
            </div>
          </section>

          <section className="a-panel">
            <div className="a-head" style={{ marginBottom: 12 }}>
              <div>
                <h2>Case-study sections</h2>
                <p className="a-hint">
                  Rendered in order on the project page. Text supports Markdown. Each section holds images or numbered cards — pick a layout and composition, or leave them on Auto.
                </p>
              </div>
            </div>
            <div className="a-repeat">
              {v.sections.map((s, i) => (
                <div className="a-item" key={i}>
                  <header>
                    <span className="a-num">{String(i + 1).padStart(2, "0")}</span>
                    <b>{s.title || "Untitled section"}</b>
                    <button type="button" className="a-btn small ghost" onClick={() => moveSection(i, -1)} disabled={i === 0} aria-label="Move up">
                      ↑
                    </button>
                    <button type="button" className="a-btn small ghost" onClick={() => moveSection(i, 1)} disabled={i === v.sections.length - 1} aria-label="Move down">
                      ↓
                    </button>
                    <button type="button" className="a-btn small danger" onClick={() => set({ sections: v.sections.filter((_, j) => j !== i) })}>
                      Remove
                    </button>
                  </header>
                  <div className="a-grid">
                    <Field label="Heading" error={e[`sections.${i}.title`]}>
                      <input type="text" value={s.title} onChange={(ev) => setSection(i, { title: ev.target.value })} />
                    </Field>
                    <MarkdownField label="Text" value={s.body} onChange={(body) => setSection(i, { body })} rows={6} />
                    <SectionEditor value={s} title={s.title} body={s.body} onChange={(patch) => setSection(i, patch)} />
                    {Object.entries(e)
                      .filter(([k]) => k.startsWith(`sections.${i}.`) && k !== `sections.${i}.title`)
                      .slice(0, 3)
                      .map(([k, msg]) => (
                        <p key={k} className="a-notice bad">
                          {msg}
                        </p>
                      ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="a-actions" style={{ marginTop: 12 }}>
              <button type="button" className="a-btn" onClick={() => addSection()}>
                + Add section
              </button>
              <span className="a-hint">Quick add:</span>
              {SECTION_PRESETS.filter((p) => !v.sections.some((s) => s.title === p)).map((p) => (
                <button key={p} type="button" className="a-btn small ghost" onClick={() => addSection(p)}>
                  {p}
                </button>
              ))}
            </div>
          </section>

          <section className="a-panel">
            <h2>Links</h2>
            <p className="a-hint">Play it, itch.io, trailer, press… shown under the project intro.</p>
            <div className="a-repeat">
              {v.links.map((l, i) => (
                <div className="a-grid cols-3" key={i}>
                  <Field label="Label" error={e[`links.${i}.label`]}>
                    <input type="text" value={l.label} onChange={(ev) => set({ links: v.links.map((x, j) => (j === i ? { ...x, label: ev.target.value } : x)) })} />
                  </Field>
                  <Field label="URL" error={e[`links.${i}.url`]}>
                    <input type="url" value={l.url} onChange={(ev) => set({ links: v.links.map((x, j) => (j === i ? { ...x, url: ev.target.value } : x)) })} />
                  </Field>
                  <div className="a-field">
                    <span>&nbsp;</span>
                    <button type="button" className="a-btn danger" onClick={() => set({ links: v.links.filter((_, j) => j !== i) })}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button type="button" className="a-btn" style={{ marginTop: 10 }} onClick={() => set({ links: [...v.links, { label: "", url: "" }] })}>
              + Add link
            </button>
          </section>
        </div>

        <aside>
          <section className="a-panel">
            <h2>Publishing</h2>
            <div className="a-grid" style={{ marginTop: 10 }}>
              <Field label="Status" hint={canPublish ? undefined : "Authors save drafts — an editor publishes."}>
                <select value={v.status} onChange={(ev) => set({ status: ev.target.value as ProjectFormValue["status"] })}>
                  <option value="draft">Draft</option>
                  <option value="published" disabled={!canPublish}>
                    Published
                  </option>
                  <option value="archived">Archived</option>
                </select>
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
              <label className="a-check">
                <input type="checkbox" checked={v.featured} onChange={(ev) => set({ featured: ev.target.checked })} />
                Featured
              </label>
            </div>
          </section>
          <ThemePanel value={v.theme} onChange={(theme) => set({ theme })} />
          <ProjectMusicPanel value={v.theme.music} onChange={(music) => set({ theme: { ...v.theme, music } })} />
          <SeoPanel
            value={v.seo}
            onChange={(seo) => set({ seo })}
            fallbackTitle={v.title}
            fallbackDescription={v.summary}
            path={`/projects/${v.slug || autoSlug}`}
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
                  () => deleteProjectAction(id),
                  () => {
                    setDirty(false);
                    router.push("/admin/projects");
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
