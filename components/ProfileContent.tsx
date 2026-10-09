"use client";

import Link from "next/link";
import { usePortfolio } from "@/lib/store";

/**
 * Profile / playground text rendered inside the WebGL portal
 * (components/ProfilePortal.tsx). Edit it in the CMS: Admin → Settings → Profile.
 */
export type ProfileData = {
  name: string;
  roles: string[];
  intro: string;
  education: string[];
  skills: string[];
  email: string;
  links: { label: string; url: string }[];
};

export function ProfileContent({ profile }: { profile: ProfileData }) {
  const mode = usePortfolio((s) => s.mode);
  const on = mode === "PROFILE";

  return (
    <>
      <section className="portal-content" data-on={on || undefined} aria-hidden={!on} aria-label="Profile">
        <div className="portal-inner">
          <h1 className="pf-name">{profile.name}</h1>
          <p className="pf-roles">
            {profile.roles.map((r) => (
              <span key={r}>{r}</span>
            ))}
          </p>
          <p className="pf-intro">{profile.intro}</p>
          <p className="pf-edu">
            {profile.education.map((l) => (
              <span key={l}>{l}</span>
            ))}
          </p>
          <ul className="pf-skills">
            {profile.skills.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <p className="pf-links">
            <Link href="/about" tabIndex={on ? 0 : -1}>
              About
            </Link>
            <Link href="/journal" tabIndex={on ? 0 : -1}>
              Journal
            </Link>
            {profile.email && (
              <a href={`mailto:${profile.email}`} tabIndex={on ? 0 : -1}>
                Email
              </a>
            )}
            {profile.links.map((l) => (
              <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" tabIndex={on ? 0 : -1}>
                {l.label}
              </a>
            ))}
          </p>
        </div>
      </section>

      <section
        className="portal-content"
        data-on={mode === "PLAYGROUND" || undefined}
        aria-hidden={mode !== "PLAYGROUND"}
        aria-label="Playground"
      >
        <div className="portal-inner">
          <h1 className="pf-name">Playground</h1>
          <p className="pf-intro">Prototypes, game-jam builds and small interaction experiments.</p>
          <p className="pf-roles">
            <span>Coming soon</span>
          </p>
        </div>
      </section>
    </>
  );
}
