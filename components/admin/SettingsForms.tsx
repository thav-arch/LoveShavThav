"use client";

import { useState } from "react";
import { saveSettingsAction } from "@/app/admin/actions";
import { FONTS, type FontKey, type ProfileSettings, type SiteSettings, type ThemeSettings } from "@/lib/cms/settings-schema";
import { Field, MediaField, Notice, TagInput, useSaver } from "./ui";

function SaveRow({ saver, disabled }: { saver: ReturnType<typeof useSaver>; disabled: boolean }) {
  return (
    <div className="a-actions" style={{ marginTop: 14 }}>
      <button className="a-btn primary" disabled={saver.pending || disabled}>
        {saver.pending ? "Saving…" : "Save"}
      </button>
      <Notice result={saver.result} />
    </div>
  );
}

export function SiteForm({ initial, readOnly }: { initial: SiteSettings; readOnly: boolean }) {
  const [v, setV] = useState(initial);
  const saver = useSaver();
  const e = saver.fields;
  return (
    <form
      className="a-panel"
      onSubmit={(ev) => {
        ev.preventDefault();
        saver.run(() => saveSettingsAction("site", v));
      }}
    >
      <h2>Site</h2>
      <p className="a-hint">Default title, description and sharing image for search engines and social cards.</p>
      <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0 }}>
        <div className="a-grid cols-2">
          <Field label="Site title" count={v.title.length} max={80} error={e.title}>
            <input type="text" value={v.title} onChange={(ev) => setV({ ...v, title: ev.target.value })} />
          </Field>
          <Field label="Tagline" error={e.tagline}>
            <input type="text" value={v.tagline} onChange={(ev) => setV({ ...v, tagline: ev.target.value })} />
          </Field>
          <Field label="Description" count={v.description.length} max={160} className="a-span-all" error={e.description}>
            <textarea rows={2} value={v.description} onChange={(ev) => setV({ ...v, description: ev.target.value })} />
          </Field>
          <Field label="Public URL" hint="Used for canonical links, the sitemap and structured data" error={e.url}>
            <input type="url" value={v.url} onChange={(ev) => setV({ ...v, url: ev.target.value })} />
          </Field>
          <Field label="X / Twitter handle" error={e.twitter}>
            <input type="text" value={v.twitter} placeholder="@handle" onChange={(ev) => setV({ ...v, twitter: ev.target.value })} />
          </Field>
          <MediaField label="Default share image" hint="1200×630" value={v.ogImage ? { url: v.ogImage } : null} onChange={(m) => setV({ ...v, ogImage: m?.url ?? "" })} />
        </div>
        <SaveRow saver={saver} disabled={readOnly} />
      </fieldset>
    </form>
  );
}

export function ProfileForm({ initial, readOnly }: { initial: ProfileSettings; readOnly: boolean }) {
  const [v, setV] = useState(initial);
  const saver = useSaver();
  const e = saver.fields;
  return (
    <form
      className="a-panel"
      onSubmit={(ev) => {
        ev.preventDefault();
        saver.run(() => saveSettingsAction("profile", v));
      }}
    >
      <h2>Profile</h2>
      <p className="a-hint">Shown in the liquid profile portal, on /about and in structured data.</p>
      <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0 }}>
        <div className="a-grid cols-2">
          <Field label="Name" error={e.name}>
            <input type="text" value={v.name} onChange={(ev) => setV({ ...v, name: ev.target.value })} />
          </Field>
          <Field label="Contact email" error={e.email}>
            <input type="email" value={v.email} onChange={(ev) => setV({ ...v, email: ev.target.value })} />
          </Field>
          <div className="a-field a-span-all">
            <span>Roles</span>
            <TagInput value={v.roles} onChange={(roles) => setV({ ...v, roles })} />
          </div>
          <Field label="Introduction" count={v.intro.length} max={600} className="a-span-all" error={e.intro}>
            <textarea rows={3} value={v.intro} onChange={(ev) => setV({ ...v, intro: ev.target.value })} />
          </Field>
          <Field label="Education (one line each)" className="a-span-all">
            <textarea
              rows={3}
              value={v.education.join("\n")}
              onChange={(ev) => setV({ ...v, education: ev.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
            />
          </Field>
          <div className="a-field a-span-all">
            <span>Skills</span>
            <TagInput value={v.skills} onChange={(skills) => setV({ ...v, skills })} />
          </div>
        </div>
        <h2 style={{ marginTop: 18 }}>Links</h2>
        <div className="a-repeat" style={{ marginTop: 8 }}>
          {v.links.map((l, i) => (
            <div className="a-grid cols-3" key={i}>
              <Field label="Label" error={e[`links.${i}.label`]}>
                <input type="text" value={l.label} onChange={(ev) => setV({ ...v, links: v.links.map((x, j) => (j === i ? { ...x, label: ev.target.value } : x)) })} />
              </Field>
              <Field label="URL" error={e[`links.${i}.url`]}>
                <input type="url" value={l.url} onChange={(ev) => setV({ ...v, links: v.links.map((x, j) => (j === i ? { ...x, url: ev.target.value } : x)) })} />
              </Field>
              <div className="a-field">
                <span>&nbsp;</span>
                <button type="button" className="a-btn danger" onClick={() => setV({ ...v, links: v.links.filter((_, j) => j !== i) })}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
        <button type="button" className="a-btn" style={{ marginTop: 8 }} onClick={() => setV({ ...v, links: [...v.links, { label: "", url: "" }] })}>
          + Add link
        </button>
        <SaveRow saver={saver} disabled={readOnly} />
      </fieldset>
    </form>
  );
}

function Color({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <div className="a-color">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </Field>
  );
}

function Range(props: { label: string; hint?: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format?: (v: number) => string }) {
  return (
    <Field label={props.label} hint={props.hint}>
      <div className="a-range">
        <input type="range" min={props.min} max={props.max} step={props.step} value={props.value} onChange={(e) => props.onChange(Number(e.target.value))} />
        <output>{props.format ? props.format(props.value) : props.value}</output>
      </div>
    </Field>
  );
}

export function ThemeForm({ initial, readOnly }: { initial: ThemeSettings; readOnly: boolean }) {
  const [v, setV] = useState(initial);
  const saver = useSaver();
  const set = (p: Partial<ThemeSettings>) => setV({ ...v, ...p });
  const fontOptions = Object.entries(FONTS) as [FontKey, (typeof FONTS)[FontKey]][];
  const fontVar = (k: FontKey) => `var(${FONTS[k].variable})`;

  return (
    <form
      className="a-panel"
      onSubmit={(ev) => {
        ev.preventDefault();
        saver.run(() => saveSettingsAction("theme", v));
      }}
    >
      <h2>Theme</h2>
      <p className="a-hint">Colours, type and the 3D world&apos;s look. Changes go live on save.</p>
      <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0 }}>
        <div
          aria-label="Theme preview"
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderRadius: 10, overflow: "hidden", border: "1px solid var(--a-line)", margin: "6px 0 16px" }}
        >
          <div style={{ background: v.bg, color: v.fg, padding: 18, fontFamily: fontVar(v.fontBody) }}>
            <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: v.uppercaseUi ? "uppercase" : "none" }}>World · navigation</div>
            <div style={{ fontFamily: fontVar(v.fontDisplay), fontSize: 26, marginTop: 8 }}>GOND</div>
            <div style={{ height: 3, width: 40, background: v.accent, marginTop: 8 }} />
          </div>
          <div style={{ background: v.paper, color: v.ink, padding: 18, fontFamily: fontVar(v.fontBody) }}>
            <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: v.uppercaseUi ? "uppercase" : "none", opacity: 0.6 }}>Case study</div>
            <div style={{ fontFamily: fontVar(v.fontDisplay), fontSize: 26, marginTop: 8 }}>Process</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Body text in the editorial pages.</div>
          </div>
        </div>
        <div className="a-grid cols-2">
          <Color label="World background" value={v.bg} onChange={(bg) => set({ bg })} />
          <Color label="World text" value={v.fg} onChange={(fg) => set({ fg })} />
          <Color label="Page background" value={v.paper} onChange={(paper) => set({ paper })} />
          <Color label="Page text" value={v.ink} onChange={(ink) => set({ ink })} />
          <Color label="Accent" value={v.accent} onChange={(accent) => set({ accent })} />
          <Field label="Reading layout">
            <select value={v.layout} onChange={(e) => set({ layout: e.target.value as ThemeSettings["layout"] })}>
              <option value="editorial">Editorial (full width)</option>
              <option value="compact">Compact (narrow column)</option>
            </select>
          </Field>
          <Field label="Body font">
            <select value={v.fontBody} onChange={(e) => set({ fontBody: e.target.value as FontKey })}>
              {fontOptions.map(([k, f]) => (
                <option key={k} value={k}>
                  {f.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Display font (titles)">
            <select value={v.fontDisplay} onChange={(e) => set({ fontDisplay: e.target.value as FontKey })}>
              {fontOptions.map(([k, f]) => (
                <option key={k} value={k}>
                  {f.label}
                </option>
              ))}
            </select>
          </Field>
          <label className="a-check">
            <input type="checkbox" checked={v.uppercaseUi} onChange={(e) => set({ uppercaseUi: e.target.checked })} />
            Uppercase navigation labels
          </label>
        </div>

        <h2 style={{ marginTop: 18 }}>3D world</h2>
        <div className="a-grid cols-2" style={{ marginTop: 8 }}>
          <Range label="Grid glow" hint="0 hides the floor grid" value={v.gridIntensity} min={0} max={2} step={0.05} onChange={(gridIntensity) => set({ gridIntensity })} />
          <Range label="Grid colour shift" value={v.gridHue} min={0} max={1} step={0.01} onChange={(gridHue) => set({ gridHue })} format={(n) => `${Math.round(n * 360)}°`} />
          <Range label="Card corner radius" value={v.cardRadius} min={0} max={0.2} step={0.005} onChange={(cardRadius) => set({ cardRadius })} />
          <Range label="Cursor wake strength" value={v.wakeStrength} min={0} max={0.05} step={0.001} onChange={(wakeStrength) => set({ wakeStrength })} />
          <label className="a-check">
            <input type="checkbox" checked={v.cursorWake} onChange={(e) => set({ cursorWake: e.target.checked })} />
            Liquid cursor wake
          </label>
        </div>
        <SaveRow saver={saver} disabled={readOnly} />
      </fieldset>
    </form>
  );
}
