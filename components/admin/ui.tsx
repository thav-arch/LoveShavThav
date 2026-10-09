"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { listMediaAction } from "@/app/admin/actions";
import { renderMarkdown } from "@/lib/cms/markdown";
import type { ActionResult } from "@/lib/cms/services/common";

/* ------------------------------------------------------------ fields */

export function Field({
  label,
  hint,
  error,
  count,
  max,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  count?: number;
  max?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`a-field ${className ?? ""}`}>
      <span>
        {label}
        {max != null && count != null && <small className={count > max ? "over" : ""}>{`${count}/${max}`}</small>}
      </span>
      {children}
      {hint && !error && <small className="a-hint">{hint}</small>}
      {error && (
        <small className="a-err" role="alert">
          {error}
        </small>
      )}
    </label>
  );
}

export function StatusPill({ status }: { status: string }) {
  return <span className={`a-pill ${status}`}>{status}</span>;
}

/* ------------------------------------------------------- save helper */

/**
 * Runs a server action, tracks pending state and the result, and exposes
 * per-field errors. Warns before leaving the page with unsaved changes.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useSaver<_Default = unknown>(dirty = false) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult<unknown> | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    addEventListener("beforeunload", warn);
    return () => removeEventListener("beforeunload", warn);
  }, [dirty]);

  const run = useCallback(
    <R,>(fn: () => Promise<ActionResult<R>>, onOk?: (r: ActionResult<R> & { ok: true }) => void) =>
      start(async () => {
        const r = await fn();
        setResult(r);
        if (r.ok) {
          onOk?.(r);
          router.refresh();
        }
      }),
    [router],
  );
  const fields = result && !result.ok ? (result.fields ?? {}) : {};
  return { pending, result, run, fields, clear: () => setResult(null) };
}

export function Notice({ result }: { result: ActionResult<unknown> | null }) {
  if (!result) return null;
  if (result.ok) return result.message ? <p className="a-notice ok">{result.message}</p> : null;
  return (
    <p className="a-notice bad" role="alert">
      {result.error}
    </p>
  );
}

/* ---------------------------------------------------------- tag input */

export function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const parts = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const next = [...value];
    for (const p of parts) if (!next.some((v) => v.toLowerCase() === p.toLowerCase())) next.push(p);
    onChange(next);
    setDraft("");
  };
  return (
    <div className="a-tags">
      {value.map((t) => (
        <span key={t}>
          {t}
          <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((v) => v !== t))}>
            ×
          </button>
        </span>
      ))}
      <input
        type="text"
        value={draft}
        placeholder={value.length ? "" : (placeholder ?? "Type and press Enter")}
        onChange={(e) => (e.target.value.endsWith(",") ? add(e.target.value) : setDraft(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (draft.trim()) add(draft);
          } else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={() => draft.trim() && add(draft)}
      />
    </div>
  );
}

/* -------------------------------------------------------------- media */

export type MediaItem = Awaited<ReturnType<typeof listMediaAction>>[number];

export async function uploadFiles(files: File[]) {
  const out: MediaItem[] = [];
  for (const file of files) {
    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/v1/media", { method: "POST", body });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error?.message ?? `Upload failed (${res.status})`);
    out.push(json.data);
  }
  return out;
}

export const isAudio = (url?: string | null, mime?: string) => !!url && (!!mime?.startsWith("audio") || /\.(mp3|m4a|ogg|wav)$/i.test(url));

export function Thumb({ url, mime }: { url?: string | null; mime?: string }) {
  if (!url) return <div className="a-thumb empty">none</div>;
  if (isAudio(url, mime))
    return (
      <div className="a-thumb audio" aria-label="Audio file">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm12-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
      </div>
    );
  const video = mime?.startsWith("video") || /\.(mp4|webm)$/i.test(url);
  return (
    <div className="a-thumb">
      {video ? (
        <video src={url} muted playsInline preload="metadata" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" loading="lazy" />
      )}
    </div>
  );
}

export function DropZone({ onFiles, busy, accept = "image/*,video/mp4,video/webm,audio/mpeg,audio/mp4,audio/x-m4a,audio/ogg,audio/wav,.mp3,.m4a,.ogg,.wav" }: { onFiles: (f: File[]) => void; busy?: boolean; accept?: string }) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div
      className="a-drop"
      data-over={over || undefined}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (e.dataTransfer.files.length) onFiles([...e.dataTransfer.files]);
      }}
    >
      <strong>{busy ? "Uploading…" : "Drop files here"}</strong>
      <span>JPG, PNG, WebP, AVIF, GIF (≤ 20 MB) · MP4, WebM (≤ 80 MB) · MP3, M4A, OGG, WAV (≤ 30 MB)</span>
      <button type="button" className="a-btn small" disabled={busy} onClick={() => input.current?.click()}>
        Choose files
      </button>
      <input
        ref={input}
        type="file"
        multiple
        accept={accept}
        hidden
        onChange={(e) => {
          if (e.target.files?.length) onFiles([...e.target.files]);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/**
 * modal library: pick an existing file or upload new ones.
 * With `multiple`, clicks toggle a selection (in click order) and "Add" hands
 * the whole set to onPickMany; uploads are added to the selection.
 */
export function MediaPicker({
  open,
  onClose,
  onPick,
  onPickMany,
  multiple = false,
  kind = "any",
}: {
  open: boolean;
  onClose: () => void;
  onPick?: (m: MediaItem) => void;
  onPickMany?: (m: MediaItem[]) => void;
  multiple?: boolean;
  kind?: "image" | "video" | "audio" | "any";
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [picked, setPicked] = useState<MediaItem[]>([]);

  const load = useCallback(async (query: string) => setItems(await listMediaAction(query)), []);
  useEffect(() => {
    const d = dialog.current!;
    if (open && !d.open) {
      d.showModal();
      setPicked([]);
      void load("");
    } else if (!open && d.open) d.close();
  }, [open, load]);

  const shown = items.filter((m) => kind === "any" || m.mimeType.startsWith(kind));
  const toggle = (m: MediaItem) =>
    setPicked((cur) => (cur.some((x) => x.id === m.id) ? cur.filter((x) => x.id !== m.id) : [...cur, m]));
  const choose = (m: MediaItem) => (multiple ? toggle(m) : onPick?.(m));
  const upload = async (files: File[]) => {
    setBusy(true);
    setErr("");
    try {
      const added = await uploadFiles(files);
      setItems((cur) => [...added, ...cur]);
      if (multiple) setPicked((cur) => [...cur, ...added]);
      else if (added.length === 1) onPick?.(added[0]);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog ref={dialog} className="a-modal" onClose={onClose} onCancel={onClose}>
      <header>
        <h2>Media library</h2>
        <div className="a-actions">
          <input
            type="search"
            placeholder="Search…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              void load(e.target.value);
            }}
          />
          {multiple && (
            <button type="button" className="a-btn primary" disabled={!picked.length} onClick={() => onPickMany?.(picked)}>
              Add {picked.length || ""} {picked.length === 1 ? "file" : "files"}
            </button>
          )}
          <button type="button" className="a-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </header>
      <div>
        <DropZone
          onFiles={upload}
          busy={busy}
          accept={kind === "image" ? "image/*" : kind === "video" ? "video/mp4,video/webm" : kind === "audio" ? "audio/mpeg,audio/mp4,audio/x-m4a,audio/ogg,audio/wav,.mp3,.m4a,.ogg,.wav" : undefined}
        />
        {err && <p className="a-notice bad">{err}</p>}
        {multiple && <p className="a-hint" style={{ marginTop: 10 }}>Click files to select them — they are added in the order you click.</p>}
        <div className="a-media-grid" style={{ marginTop: 14 }}>
          {shown.map((m) => {
            const n = picked.findIndex((x) => x.id === m.id);
            return (
              <button type="button" key={m.id} className="a-media-card" aria-pressed={multiple ? n >= 0 : undefined} onClick={() => choose(m)}>
                <Thumb url={m.variants.sm ?? m.url} mime={m.mimeType} />
                {n >= 0 && <span className="a-pick-n">{n + 1}</span>}
                <div>
                  <b>{m.filename}</b>
                  <span className="a-hint">{m.width ? `${m.width}×${m.height}` : m.mimeType.startsWith("audio") ? `${m.mimeType.split("/")[1].toUpperCase()} · ${(m.size / 1048576).toFixed(1)} MB` : m.mimeType}</span>
                </div>
              </button>
            );
          })}
        </div>
        {!shown.length && <p className="a-empty">No media yet — upload something above.</p>}
      </div>
    </dialog>
  );
}

/** a single media field: preview + choose / clear */
export function MediaField({
  label,
  hint,
  value,
  onChange,
  kind = "image",
}: {
  label: string;
  hint?: string;
  value: { id?: string | null; url?: string | null } | null;
  onChange: (m: MediaItem | null) => void;
  kind?: "image" | "video" | "audio" | "any";
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="a-field">
      <span>{label}</span>
      <div className="a-media-slot">
        <Thumb url={value?.url} />
        <div className="a-actions">
          <button type="button" className="a-btn small" onClick={() => setOpen(true)}>
            {value?.url ? "Replace" : "Choose"}
          </button>
          {value?.url && (
            <button type="button" className="a-btn small ghost" onClick={() => onChange(null)}>
              Remove
            </button>
          )}
        </div>
      </div>
      {hint && <small className="a-hint">{hint}</small>}
      <MediaPicker
        open={open}
        kind={kind}
        onClose={() => setOpen(false)}
        onPick={(m) => {
          onChange(m);
          setOpen(false);
        }}
      />
    </div>
  );
}

/* ----------------------------------------------------------- markdown */

export function MarkdownField({
  label,
  value,
  onChange,
  rows = 8,
  hint = "Markdown: **bold**, _italic_, [link](https://…), ## heading, - list",
  error,
  big,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  hint?: string;
  error?: string;
  big?: boolean;
}) {
  const [preview, setPreview] = useState(false);
  const html = useMemo(() => (preview ? renderMarkdown(value) : ""), [preview, value]);
  return (
    <div className="a-field">
      <span>
        {label}
        <small>{value.trim() ? `${value.trim().split(/\s+/).length} words` : ""}</small>
      </span>
      <div className="a-tabs">
        <button type="button" aria-pressed={!preview} onClick={() => setPreview(false)}>
          Write
        </button>
        <button type="button" aria-pressed={preview} onClick={() => setPreview(true)}>
          Preview
        </button>
      </div>
      {preview ? (
        <div className="a-preview" dangerouslySetInnerHTML={{ __html: html || "<p class='a-hint'>Nothing to preview</p>" }} />
      ) : (
        <textarea className={big ? "a-code" : undefined} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error} />
      )}
      {error ? <small className="a-err">{error}</small> : <small className="a-hint">{hint}</small>}
    </div>
  );
}

/* ---------------------------------------------------------------- SEO */

export type SeoValue = { title: string; description: string; ogImage: string; canonical: string; noindex: boolean };

export function SeoPanel({
  value,
  onChange,
  fallbackTitle,
  fallbackDescription,
  path,
  errors,
}: {
  value: SeoValue;
  onChange: (v: SeoValue) => void;
  fallbackTitle: string;
  fallbackDescription: string;
  path: string;
  errors: Record<string, string>;
}) {
  const set = (patch: Partial<SeoValue>) => onChange({ ...value, ...patch });
  const [host, setHost] = useState("");
  useEffect(() => setHost(location.host), []);
  const title = value.title || fallbackTitle;
  const desc = value.description || fallbackDescription;
  return (
    <section className="a-panel">
      <h2>Search & sharing</h2>
      <p className="a-hint">Leave blank to use the title and summary.</p>
      <div className="a-grid">
        <div className="a-serp" aria-label="Search result preview">
          <cite>
            {host}
            {path}
          </cite>
          <b>{title || "Untitled"}</b>
          <p>{desc || "Add a description to control the snippet shown in search results."}</p>
        </div>
        <Field label="SEO title" count={value.title.length} max={60} error={errors["seo.title"]}>
          <input type="text" value={value.title} placeholder={fallbackTitle} onChange={(e) => set({ title: e.target.value })} />
        </Field>
        <Field label="Meta description" count={value.description.length} max={160} error={errors["seo.description"]}>
          <textarea rows={3} value={value.description} placeholder={fallbackDescription} onChange={(e) => set({ description: e.target.value })} />
        </Field>
        <MediaField
          label="Social share image"
          hint="1200×630 works best. Defaults to the hero/cover."
          value={value.ogImage ? { url: value.ogImage } : null}
          onChange={(m) => set({ ogImage: m?.url ?? "" })}
        />
        <Field label="Canonical URL" hint="Only if this content lives elsewhere first." error={errors["seo.canonical"]}>
          <input type="url" value={value.canonical} onChange={(e) => set({ canonical: e.target.value })} />
        </Field>
        <label className="a-check">
          <input type="checkbox" checked={value.noindex} onChange={(e) => set({ noindex: e.target.checked })} />
          Hide from search engines (noindex)
        </label>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ confirm */

export function ConfirmButton({
  label,
  confirm,
  onConfirm,
  className = "a-btn danger",
  disabled,
}: {
  label: string;
  confirm: string;
  onConfirm: () => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button type="button" className={className} disabled={disabled} onClick={() => window.confirm(confirm) && onConfirm()}>
      {label}
    </button>
  );
}
