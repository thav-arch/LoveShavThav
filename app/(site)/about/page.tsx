import type { Metadata } from "next";
import Image from "next/image";
import { EditorialPage } from "@/components/EditorialPage";
import { JsonLd } from "@/components/JsonLd";
import { collectionKeys, getCollection } from "@/lib/cms/collections";
import { getEntries, getSettings } from "@/lib/cms/queries";
import { personLd } from "@/lib/cms/seo";

export const metadata: Metadata = { title: "About", alternates: { canonical: "/about" } };

const str = (v: unknown) => (typeof v === "string" ? v : "");

/**
 * About: profile from Settings, then every modular collection marked
 * `showOnAbout` in lib/cms/collections.ts — new section types appear here
 * automatically once they have published items.
 */
export default async function AboutPage() {
  const [site, profile] = await Promise.all([getSettings("site"), getSettings("profile")]);
  const sections = await Promise.all(
    collectionKeys
      .filter((k) => getCollection(k).showOnAbout)
      .map(async (k) => ({ key: k, def: getCollection(k), items: await getEntries(k) })),
  );

  return (
    <EditorialPage label="About">
      <JsonLd data={personLd(site, profile)} />
      <section className="cs-hero">
        <p className="cs-eyebrow" data-intro>
          {profile.roles.join(" · ")}
        </p>
        <h1 className="cs-title" data-intro>
          {profile.name}
        </h1>
        <p className="cs-lede" data-intro>
          {profile.intro}
        </p>
        <dl className="cs-meta" data-intro>
          <div>
            <dt>Education</dt>
            <dd>
              {profile.education.map((e) => (
                <span key={e}>{e}</span>
              ))}
            </dd>
          </div>
          <div className="cs-meta-wide">
            <dt>Skills</dt>
            <dd className="about-skills">
              {profile.skills.map((s) => (
                <span key={s}>{s}</span>
              ))}
            </dd>
          </div>
          {(profile.email || profile.links.length > 0) && (
            <div>
              <dt>Contact</dt>
              <dd>
                {profile.email && <a href={`mailto:${profile.email}`}>{profile.email}</a>}
                {profile.links.map((l) => (
                  <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer">
                    {l.label}
                  </a>
                ))}
              </dd>
            </div>
          )}
        </dl>
      </section>

      {sections
        .filter((s) => s.items.length > 0)
        .map(({ key, def, items }) => (
          <section key={key} className="cs-section about-section" id={key}>
            <div className="cs-section-head" data-reveal>
              <h2>{def.label}</h2>
            </div>
            {def.display === "quote" ? (
              <div className="about-quotes">
                {items.map(({ id, data }) => (
                  <figure key={id} className="about-quote" data-reveal>
                    <blockquote>“{str(data.quote)}”</blockquote>
                    <figcaption>
                      {str(data.avatar) && (
                        <span className="about-avatar">
                          <Image src={str(data.avatar)} alt="" fill sizes="40px" />
                        </span>
                      )}
                      <span>
                        <strong>{str(data.author)}</strong>
                        {[str(data.role), str(data.company)].filter(Boolean).join(", ")}
                      </span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              <ul className="about-list">
                {items.map(({ id, data }) => {
                  const title = str(data[def.titleField]);
                  const url = str(data.url);
                  return (
                    <li key={id} data-reveal>
                      <span className="about-when">{str(data.date) ? new Date(str(data.date)).getFullYear() : ""}</span>
                      <span>
                        <strong>{url ? <a href={url} target="_blank" rel="noopener noreferrer">{title} ↗</a> : title}</strong>
                        {[str(data.kind), str(data.issuer)].filter(Boolean).join(" · ")}
                        {str(data.description) && <em>{str(data.description)}</em>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ))}
    </EditorialPage>
  );
}
