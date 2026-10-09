"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteMediaAction, updateMediaAltAction } from "@/app/admin/actions";
import { DropZone, Field, Notice, Thumb, uploadFiles, useSaver, type MediaItem } from "./ui";

const kb = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);

export function MediaLibrary({ items, canDelete }: { items: MediaItem[]; canDelete: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sel, setSel] = useState<MediaItem | null>(null);
  const [alt, setAlt] = useState("");
  const saver = useSaver();

  const upload = async (files: File[]) => {
    setBusy(true);
    setErr("");
    try {
      await uploadFiles(files);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const pick = (m: MediaItem) => {
    setSel(m);
    setAlt(m.alt);
    saver.clear();
  };

  return (
    <div className="a-editor">
      <div>
        <DropZone onFiles={upload} busy={busy} />
        {err && <p className="a-notice bad">{err}</p>}
        <div className="a-media-grid" style={{ marginTop: 16 }}>
          {items.map((m) => (
            <button type="button" key={m.id} className="a-media-card" aria-pressed={sel?.id === m.id} onClick={() => pick(m)}>
              <Thumb url={m.variants.sm ?? m.url} mime={m.mimeType} />
              <div>
                <b>{m.filename}</b>
                <span className="a-hint">{m.alt ? "✓ alt text" : "no alt text"}</span>
              </div>
            </button>
          ))}
        </div>
        {!items.length && <p className="a-empty">No media yet.</p>}
      </div>
      <aside>
        <section className="a-panel">
          {!sel ? (
            <p className="a-hint">Select a file to edit its alt text or copy its URL.</p>
          ) : (
            <div className="a-grid">
              <Thumb url={sel.url} mime={sel.mimeType} />
              <p className="a-hint">
                {sel.mimeType} · {kb(sel.size)}
                {sel.width ? ` · ${sel.width}×${sel.height}` : ""}
              </p>
              <Field label="URL">
                <input type="text" readOnly value={sel.url} onFocus={(e) => e.target.select()} />
              </Field>
              <Field label="Alt text" hint="Describe the image for screen readers and search engines.">
                <textarea rows={3} value={alt} onChange={(e) => setAlt(e.target.value)} />
              </Field>
              <Notice result={saver.result} />
              <div className="a-actions">
                <button type="button" className="a-btn primary" disabled={saver.pending} onClick={() => saver.run(() => updateMediaAltAction(sel.id, alt))}>
                  Save alt text
                </button>
                {canDelete && (
                  <button
                    type="button"
                    className="a-btn danger"
                    disabled={saver.pending}
                    onClick={() => {
                      if (!confirm(`Delete ${sel.filename}?`)) return;
                      saver.run(
                        async () => {
                          const r = await deleteMediaAction(sel.id);
                          if (!r.ok && r.error.startsWith("Still used by") && confirm(`${r.error}\n\nDelete anyway? Those items will lose this file.`))
                            return deleteMediaAction(sel.id, true);
                          return r;
                        },
                        () => setSel(null),
                      );
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          )}
        </section>
      </aside>
    </div>
  );
}
