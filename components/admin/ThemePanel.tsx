"use client";

import { HERO_STYLES, PAGE_TEMPLATES, THEME_FONTS, THEME_PRESETS, type ProjectTheme } from "@/lib/project-theme";
import { MediaField } from "./ui";

const COLOURS: [keyof ProjectTheme, string][] = [
  ["bg", "Background"],
  ["ink", "Text"],
  ["alt", "Band background"],
  ["altInk", "Band text"],
  ["accent", "Highlight ==text=="],
  ["accent2", "Highlight ^^text^^"],
  ["chip", "Chips"],
];
const TEMPLATE_LABEL: Record<string, string> = {
  sections: "Built from the sections below",
  "songs-of-saaja": "Songs of Saaja — built from the Figma frame (sections below are not shown)",
};
const FONT_LABEL: Record<string, string> ={ site: "Site font", "marcellus-sc": "Marcellus SC", "instrument-serif": "Instrument Serif", syne: "Syne" };

/**
 * Per-project look of the case study (lib/project-theme.ts): a preset, then
 * colours, font, hero style and the pattern band.
 */
export function ThemePanel({ value, onChange }: { value: ProjectTheme; onChange: (t: ProjectTheme) => void }) {
  const custom = value.mode === "custom";
  const set = (patch: ProjectTheme) => onChange({ ...value, ...patch });
  return (
    <section className="a-panel">
      <h2>Case-study look</h2>
      <p className="a-hint">Give this project its own colours and type, or keep the site&apos;s look.</p>
      <div className="a-grid" style={{ marginTop: 10 }}>
        <label className="a-field">
          <span>Page</span>
          <select value={value.template ?? "sections"} onChange={(e) => onChange({ ...value, template: e.target.value as ProjectTheme["template"] })}>
            {PAGE_TEMPLATES.map((t) => (
              <option key={t} value={t}>
                {TEMPLATE_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="a-field">
          <span>Preset</span>
          <select
            value={custom ? "" : "site"}
            onChange={(e) => e.target.value && onChange({ ...THEME_PRESETS[e.target.value].theme, band: value.band, template: value.template, music: value.music })}
          >
            {!custom && <option value="site">Site default</option>}
            {custom && <option value="">Custom</option>}
            {Object.entries(THEME_PRESETS)
              .filter(([k]) => k !== "site" || custom)
              .map(([k, p]) => (
                <option key={k} value={k}>
                  {p.label}
                </option>
              ))}
          </select>
        </label>
        {custom && (
          <>
            <div className="a-theme-colours">
              {COLOURS.map(([k, l]) => (
                <label key={k} className="a-color" title={l}>
                  <input type="color" value={(value[k] as string) || "#000000"} onChange={(e) => set({ [k]: e.target.value })} />
                  <span>{l}</span>
                </label>
              ))}
            </div>
            <label className="a-field">
              <span>Font</span>
              <select value={value.font ?? "site"} onChange={(e) => set({ font: e.target.value as ProjectTheme["font"] })}>
                {THEME_FONTS.map((f) => (
                  <option key={f} value={f}>
                    {FONT_LABEL[f]}
                  </option>
                ))}
              </select>
            </label>
            <label className="a-field">
              <span>Hero</span>
              <select value={value.heroStyle ?? "classic"} onChange={(e) => set({ heroStyle: e.target.value as ProjectTheme["heroStyle"] })}>
                {HERO_STYLES.map((h) => (
                  <option key={h} value={h}>
                    {h === "art" ? "Key art first (title is in the art)" : "Classic (big title, then image)"}
                  </option>
                ))}
              </select>
            </label>
            <MediaField
              label="Pattern band"
              hint="A seamless strip shown under the hero and as a section edge"
              value={value.band ? { url: value.band } : null}
              onChange={(m) => set({ band: m?.url ?? "" })}
            />
          </>
        )}
      </div>
    </section>
  );
}
