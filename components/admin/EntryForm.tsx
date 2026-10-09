"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteEntryAction, saveEntryAction } from "@/app/admin/actions";
import type { CollectionDef } from "@/lib/cms/collections";
import { ConfirmButton, Field, MediaField, Notice, StatusPill, useSaver } from "./ui";

type Status = "draft" | "published" | "archived";

/** Form generated from a collection's field definitions (lib/cms/collections.ts) */
export function EntryForm({
  collection,
  def,
  id,
  initial,
  initialStatus,
  canPublish,
  canDelete,
}: {
  collection: string;
  def: CollectionDef;
  id: string | null;
  initial: Record<string, unknown>;
  initialStatus: Status;
  canPublish: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [data, setData] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(def.fields.map((f) => [f.name, initial[f.name] ?? (f.type === "boolean" ? false : "")])),
  );
  const [status, setStatus] = useState<Status>(initialStatus);
  const [dirty, setDirty] = useState(false);
  const saver = useSaver<{ id: string }>(dirty);
  const set = (name: string, value: unknown) => {
    setData((d) => ({ ...d, [name]: value }));
    setDirty(true);
  };
  const title = String(data[def.titleField] ?? "") || `New ${def.singular.toLowerCase()}`;
  const list = `/admin/collections/${collection}`;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        saver.run(
          () => saveEntryAction(collection, id, { data, status }),
          (r) => {
            setDirty(false);
            if (!id) router.replace(`${list}/${r.data!.id}`);
          },
        );
      }}
    >
      <div className="a-head">
        <div>
          <Link href={list} className="a-crumb">
            ← {def.label}
          </Link>
          <h1>{title}</h1>
          <p>
            <StatusPill status={status} />
          </p>
        </div>
      </div>
      <div className="a-editor">
        <section className="a-panel">
          <div className="a-grid cols-2">
            {def.fields.map((f) => {
              const err = saver.fields[f.name];
              const value = data[f.name];
              const label = f.label + (f.required ? " *" : "");
              switch (f.type) {
                case "textarea":
                  return (
                    <Field key={f.name} label={label} hint={f.help} error={err} className="a-span-all">
                      <textarea rows={4} value={String(value ?? "")} onChange={(e) => set(f.name, e.target.value)} aria-invalid={!!err} />
                    </Field>
                  );
                case "media":
                  return (
                    <MediaField
                      key={f.name}
                      label={label}
                      hint={f.help}
                      value={value ? { url: String(value) } : null}
                      onChange={(m) => set(f.name, m ? (m.variants.sm ?? m.url) : "")}
                    />
                  );
                case "select":
                  return (
                    <Field key={f.name} label={label} hint={f.help} error={err}>
                      <select value={String(value ?? "")} onChange={(e) => set(f.name, e.target.value)}>
                        <option value="">—</option>
                        {f.options?.map((o) => (
                          <option key={o}>{o}</option>
                        ))}
                      </select>
                    </Field>
                  );
                case "boolean":
                  return (
                    <label key={f.name} className="a-check">
                      <input type="checkbox" checked={!!value} onChange={(e) => set(f.name, e.target.checked)} />
                      {f.label}
                    </label>
                  );
                default:
                  return (
                    <Field key={f.name} label={label} hint={f.help} error={err}>
                      <input
                        type={f.type === "url" ? "url" : f.type === "date" ? "date" : f.type === "number" ? "number" : "text"}
                        value={String(value ?? "")}
                        onChange={(e) => set(f.name, e.target.value)}
                        aria-invalid={!!err}
                      />
                    </Field>
                  );
              }
            })}
          </div>
        </section>
        <aside>
          <section className="a-panel">
            <h2>Publishing</h2>
            <Field label="Status" hint={canPublish ? "Published items appear on /about and in the API." : "An editor publishes."}>
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as Status);
                  setDirty(true);
                }}
              >
                <option value="draft">Draft</option>
                <option value="published" disabled={!canPublish}>
                  Published
                </option>
                <option value="archived">Archived</option>
              </select>
            </Field>
          </section>
        </aside>
      </div>
      <div className="a-savebar">
        <div style={{ flex: 1 }}>
          <Notice result={saver.result} />
        </div>
        <div className="a-actions">
          {id && canDelete && (
            <ConfirmButton
              label="Delete"
              confirm="Delete this item?"
              onConfirm={() =>
                saver.run(
                  () => deleteEntryAction(collection, id),
                  () => {
                    setDirty(false);
                    router.push(list);
                  },
                )
              }
            />
          )}
          <button className="a-btn primary" disabled={saver.pending}>
            {saver.pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </form>
  );
}
