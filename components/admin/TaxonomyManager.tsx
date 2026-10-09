"use client";

import { useState } from "react";
import { deleteCategoryAction, deleteTagAction, renameTagAction, saveCategoryAction } from "@/app/admin/actions";
import { Field, Notice, useSaver } from "./ui";

type Category = { id: string; name: string; slug: string; description: string | null; scope: "project" | "post" | "any" };
type Tag = { id: string; name: string; slug: string; uses: number };

export function TaxonomyManager({ categories, tags, canEdit }: { categories: Category[]; tags: Tag[]; canEdit: boolean }) {
  const saver = useSaver();
  const [editing, setEditing] = useState<Category | null>(null);
  const blank = { id: "", name: "", slug: "", description: "", scope: "any" as const };
  const [form, setForm] = useState<Omit<Category, "description"> & { description: string }>(blank);

  const startEdit = (c: Category | null) => {
    setEditing(c);
    setForm(c ? { ...c, description: c.description ?? "" } : blank);
    saver.clear();
  };

  return (
    <div className="a-grid cols-2" style={{ alignItems: "start" }}>
      <section className="a-panel">
        <h2>Categories</h2>
        <p className="a-hint">One per project or post — used for filtering and in the API.</p>
        <table className="a-table">
          <tbody>
            {categories.map((c) => (
              <tr key={c.id}>
                <td>
                  <b>{c.name}</b>
                  <small>
                    {c.slug} · {c.scope}
                  </small>
                </td>
                <td>
                  {canEdit && (
                    <div className="a-actions" style={{ justifyContent: "flex-end" }}>
                      <button type="button" className="a-btn small" onClick={() => startEdit(c)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="a-btn small danger"
                        onClick={() => confirm(`Delete category “${c.name}”? Items keep existing without a category.`) && saver.run(() => deleteCategoryAction(c.id))}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {canEdit && (
          <form
            className="a-grid"
            style={{ marginTop: 16 }}
            onSubmit={(e) => {
              e.preventDefault();
              saver.run(() => saveCategoryAction(editing?.id ?? null, form), () => startEdit(null));
            }}
          >
            <h2>{editing ? `Edit “${editing.name}”` : "Add category"}</h2>
            <div className="a-grid cols-2">
              <Field label="Name" error={saver.fields.name}>
                <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="Applies to">
                <select value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value as Category["scope"] })}>
                  <option value="any">Projects & posts</option>
                  <option value="project">Projects</option>
                  <option value="post">Journal posts</option>
                </select>
              </Field>
            </div>
            <Field label="Description">
              <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <div className="a-actions">
              <button className="a-btn primary" disabled={saver.pending}>
                {editing ? "Save" : "Add"}
              </button>
              {editing && (
                <button type="button" className="a-btn ghost" onClick={() => startEdit(null)}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        )}
      </section>

      <section className="a-panel">
        <h2>Tags</h2>
        <p className="a-hint">Created automatically when you type them on a project or post.</p>
        <Notice result={saver.result} />
        <table className="a-table">
          <tbody>
            {tags.map((t) => (
              <tr key={t.id}>
                <td>
                  <b>{t.name}</b>
                  <small>
                    {t.uses} {t.uses === 1 ? "use" : "uses"}
                  </small>
                </td>
                <td>
                  {canEdit && (
                    <div className="a-actions" style={{ justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        className="a-btn small"
                        onClick={() => {
                          const name = prompt("Rename tag", t.name);
                          if (name && name !== t.name) saver.run(() => renameTagAction(t.id, name));
                        }}
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        className="a-btn small danger"
                        onClick={() => confirm(`Delete tag “${t.name}”? It will be removed from ${t.uses} item(s).`) && saver.run(() => deleteTagAction(t.id))}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!tags.length && <p className="a-empty">No tags yet.</p>}
      </section>
    </div>
  );
}
