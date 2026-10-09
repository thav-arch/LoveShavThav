"use client";

import { useEffect, useRef, useState } from "react";
import { saveSettingsAction } from "@/app/admin/actions";
import type { MusicSettings, MusicSlot, Track } from "@/lib/music";
import { Field, MediaPicker, Notice, Thumb, useSaver } from "./ui";

const pct = (n: number) => `${Math.round(n * 100)}%`;

/** a file + title + volume, with a preview player that plays at that volume */
function TrackFields({ value, onChange, master = 1 }: { value: Track; onChange: (t: Track) => void; master?: number }) {
  const [open, setOpen] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (audio.current) audio.current.volume = Math.min(1, value.volume * master);
  }, [value.volume, master, value.url]);
  return (
    <div className="a-track">
      <div className="a-media-slot">
        <Thumb url={value.url} mime={value.url ? "audio/*" : undefined} />
        <div className="a-actions">
          <button type="button" className="a-btn small" onClick={() => setOpen(true)}>
            {value.url ? "Replace" : "Choose audio"}
          </button>
          {value.url && (
            <button type="button" className="a-btn small ghost" onClick={() => onChange({ ...value, url: "", title: "" })}>
              Remove
            </button>
          )}
        </div>
      </div>
      {value.url && (
        <>
          <Field label="Title (shown to visitors on hover)">
            <input type="text" maxLength={80} value={value.title} placeholder="e.g. Forest at dusk" onChange={(e) => onChange({ ...value, title: e.target.value })} />
          </Field>
          <Field label="Track volume" hint="Evens out tracks that were recorded louder or quieter than others">
            <div className="a-range">
              <input type="range" min={0} max={1} step={0.05} value={value.volume} onChange={(e) => onChange({ ...value, volume: Number(e.target.value) })} />
              <output>{pct(value.volume)}</output>
            </div>
          </Field>
          {/* preview at the volume visitors will hear (track × overall) */}
          <audio ref={audio} src={value.url} controls preload="none" loop />
        </>
      )}
      <MediaPicker
        open={open}
        kind="audio"
        onClose={() => setOpen(false)}
        onPick={(m) => {
          onChange({ ...value, url: m.url, title: value.title || m.filename.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ") });
          setOpen(false);
        }}
      />
    </div>
  );
}

/** a page's music: use the level above, its own track, or silence */
export function SlotFields({ label, value, onChange, inherit, master }: { label: string; value: MusicSlot; onChange: (s: MusicSlot) => void; inherit: string; master?: number }) {
  return (
    <div className="a-field a-span-all">
      <span>{label}</span>
      <select value={value.mode} onChange={(e) => onChange({ ...value, mode: e.target.value as MusicSlot["mode"] })}>
        <option value="default">{inherit}</option>
        <option value="custom">Its own track</option>
        <option value="off">No music</option>
      </select>
      {value.mode === "custom" && <TrackFields value={value} onChange={(t) => onChange({ ...value, ...t })} master={master} />}
    </div>
  );
}

const PAGES: { key: "home" | "projects" | "journal" | "about"; label: string; inherit: string }[] = [
  { key: "home", label: "Home (the 3D world)", inherit: "Use the default track" },
  { key: "projects", label: "Project pages", inherit: "Use the default track" },
  { key: "journal", label: "Journal", inherit: "Use the default track" },
  { key: "about", label: "About", inherit: "Use the default track" },
];

/** Settings → Music */
export function MusicForm({ initial, readOnly }: { initial: MusicSettings; readOnly: boolean }) {
  const [v, setV] = useState(initial);
  const saver = useSaver();
  const set = (p: Partial<MusicSettings>) => setV({ ...v, ...p });
  return (
    <form
      className="a-panel"
      onSubmit={(ev) => {
        ev.preventDefault();
        saver.run(() => saveSettingsAction("music", v));
      }}
    >
      <h2>Music</h2>
      <p className="a-hint">
        Background music for the site. Each project can also choose its own track (Projects → edit → Music). Visitors always get a play/pause button and their own volume slider.
      </p>
      <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0 }}>
        <div className="a-grid cols-2">
          <label className="a-check a-span-all">
            <input type="checkbox" checked={v.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
            Play background music on the site
          </label>
          <Field label="How it starts" hint="Browsers never allow sound before the visitor interacts with the page">
            <select value={v.start} onChange={(e) => set({ start: e.target.value as MusicSettings["start"] })}>
              <option value="button">When the visitor presses the sound button</option>
              <option value="interaction">On the visitor&apos;s first click or key press</option>
            </select>
          </Field>
          <Field label="Overall volume">
            <div className="a-range">
              <input type="range" min={0} max={1} step={0.05} value={v.volume} onChange={(e) => set({ volume: Number(e.target.value) })} />
              <output>{pct(v.volume)}</output>
            </div>
          </Field>
          <Field label="Crossfade between pages">
            <div className="a-range">
              <input type="range" min={0} max={6} step={0.2} value={v.fade} onChange={(e) => set({ fade: Number(e.target.value) })} />
              <output>{v.fade.toFixed(1)} s</output>
            </div>
          </Field>
          <label className="a-check">
            <input type="checkbox" checked={v.duck} onChange={(e) => set({ duck: e.target.checked })} />
            Lower the music while a video plays
          </label>
          <div className="a-field a-span-all">
            <span>Default track</span>
            <TrackFields value={v.default} onChange={(t) => set({ default: t })} master={v.volume} />
          </div>
          {PAGES.map((p) => (
            <SlotFields key={p.key} label={p.label} value={v[p.key]} inherit={p.inherit} onChange={(s) => set({ [p.key]: s })} master={v.volume} />
          ))}
        </div>
        <div className="a-actions" style={{ marginTop: 14 }}>
          <button className="a-btn primary" disabled={saver.pending || readOnly}>
            {saver.pending ? "Saving…" : "Save"}
          </button>
          <Notice result={saver.result} />
        </div>
      </fieldset>
    </form>
  );
}

/** Project → Music (saved with the project) */
export function ProjectMusicPanel({ value, onChange }: { value: MusicSlot | undefined; onChange: (s: MusicSlot) => void }) {
  const slot: MusicSlot = value ?? { mode: "default", url: "", title: "", volume: 0.8 };
  return (
    <section className="a-panel">
      <h2>Music</h2>
      <p className="a-hint">Background music while this project is open. Site-wide music is set in Settings → Music.</p>
      <div className="a-grid" style={{ marginTop: 10 }}>
        <SlotFields label="On this project's page" value={slot} onChange={onChange} inherit="Use the music for project pages (Settings)" />
      </div>
    </section>
  );
}
