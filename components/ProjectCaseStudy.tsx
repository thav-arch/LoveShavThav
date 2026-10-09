"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import type { Project, ProjectMedia, ProjectSection } from "@/lib/project-types";
import { Board, Chips, Divider, Highlighted, Ornaments, SectionHeading, TableBlock } from "./Blocks";
import { Cards } from "./Cards";
import { Gallery } from "./Gallery";
import { projectIndex, projects } from "@/lib/projects";
import { mod } from "@/lib/motion";
import { exitProject, revealProject, switchProject } from "@/lib/transitions";
import { useEditorialScroll } from "./useEditorialScroll";
import { themeVars } from "@/lib/project-theme";
import { SongsOfSaaja } from "./stories/SongsOfSaaja";

const pad = (n: number) => String(n).padStart(2, "0");

export function Media({ media, priority = false }: { media: ProjectMedia; priority?: boolean }) {
  return (
    <figure className="cs-media" data-reveal>
      <div className="cs-frame">
        {media.type === "video" ? (
          <video data-autoplay src={media.src} muted loop playsInline preload="none" aria-label={media.alt} />
        ) : (
          <div className="cs-parallax" data-parallax>
            <Image src={media.src} alt={media.alt} fill sizes="(max-width: 900px) 100vw, 80vw" priority={priority} />
          </div>
        )}
      </div>
      {media.caption && <figcaption>{media.caption}</figcaption>}
    </figure>
  );
}

/**
 * One case-study section: heading + Markdown text + its image layout, with the
 * text placed where the plan says (lib/gallery.ts):
 *   top / bottom  text above or below the images
 *   left/right    text column beside the images
 *   overlay       text over the hero image
 *   inline        text as a tile inside the layout
 * The composition (column split, alignment, width, spacing, overlay look,
 * phone order) comes from lib/section-design.ts as data-attributes; CSS does
 * the rest, so nothing is measured or moved by script.
 */
function CaseSection({ section: s, n, band }: { section: ProjectSection; n: number; band?: string }) {
  const g = s.gallery;
  const placement = s.placement ?? g?.plan.text ?? "top";
  const d = s.design;
  const media = g ? undefined : s.cards ? "cards" : s.table ? "table" : s.board ? "board" : s.divider ? "divider" : "none";
  const attrs = {
    id: s.id,
    className: "cs-section",
    "data-text": placement,
    "data-split": d?.split,
    "data-valign": d?.valign,
    "data-align": d?.align,
    "data-width": d?.width,
    "data-space": d?.spacing,
    "data-ovpos": placement === "overlay" ? d?.overlayPos : undefined,
    "data-ovstyle": placement === "overlay" ? d?.overlayStyle : undefined,
    "data-mobile": d?.mobile,
    "data-media": media,
    "data-tone": d?.tone && d.tone !== "base" ? d.tone : undefined,
    "data-edge": d?.edge && d.edge !== "none" ? d.edge : undefined,
    "data-head": d?.heading && d.heading !== "default" ? d.heading : undefined,
    "data-chips": d?.chips === "solid" ? "solid" : undefined,
    style: d ? ({ "--scrim": d.scrim } as CSSProperties) : undefined,
  };

  // a divider is a pure transition: no heading or text
  if (s.divider)
    return (
      <section {...attrs} aria-hidden="true">
        <Divider style={s.divider} band={band} />
      </section>
    );

  const head = <SectionHeading style={d?.heading ?? "default"} n={n} title={s.title} subtitle={s.subtitle} />;
  // Markdown rendered and sanitised on the server (lib/cms/markdown.ts)
  const body = s.html ? <div className="cs-body prose" data-reveal dangerouslySetInnerHTML={{ __html: s.html }} /> : null;
  const chips = s.chips?.length ? <Chips chips={s.chips} /> : null;
  const text = (
    <>
      {head}
      {body}
      {chips}
    </>
  );
  const content = (extra: { overlay?: ReactNode; inline?: ReactNode; side?: boolean } = {}) =>
    g ? (
      <Gallery items={g.items} plan={g.plan} label={s.title} {...extra} />
    ) : s.cards ? (
      <Cards items={s.cards.items} plan={s.cards.plan} />
    ) : s.table ? (
      <TableBlock table={s.table} label={s.title} />
    ) : s.board ? (
      <Board board={s.board} />
    ) : null;
  // the band background, torn edges and ornaments sit behind the content
  const deco = (
    <>
      {d?.edge === "pattern" && band && <div className="csx-band csx-band-edge" style={{ backgroundImage: `url("${band}")` }} aria-hidden="true" />}
      {(d?.edge === "torn" || d?.edge === "torn-top") && <i className="csx-torn t" aria-hidden="true" />}
      {(d?.edge === "torn" || d?.edge === "torn-bottom") && <i className="csx-torn b" aria-hidden="true" />}
      {s.ornaments?.length ? <Ornaments items={s.ornaments} /> : null}
    </>
  );

  if (placement === "left" || placement === "right")
    return (
      <section {...attrs}>
        {deco}
        <div className="cs-side-text">{text}</div>
        {content({ side: true })}
      </section>
    );

  if (placement === "overlay" || placement === "inline") {
    const tile = <div className="cs-tile-text">{text}</div>;
    return (
      <section {...attrs}>
        {deco}
        {content(placement === "overlay" ? { overlay: tile } : { inline: tile })}
      </section>
    );
  }

  return (
    // above / below: same markup (heading first for screen readers); CSS orders it visually
    <section {...attrs}>
      {deco}
      {head}
      {body}
      {chips}
      {content()}
    </section>
  );
}

/**
 * Case study: a light, editorial page with ordinary (smoothed) scrolling —
 * a deliberate contrast to the spatial homepage. It is its own scroll
 * container on top of the paused WebGL canvas. Content comes from the CMS.
 */
export function ProjectCaseStudy({ project }: { project: Project }) {
  const index = Math.max(0, projectIndex(project.slug));
  const count = Math.max(1, projects.length);
  const prev = projects[mod(index - 1, count)] ?? project;
  const next = projects[mod(index + 1, count)] ?? project;
  const router = useRouter();
  const wrapper = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);

  useEffect(() => revealProject(content.current), []);
  useEditorialScroll(wrapper, content);

  const close = () => exitProject(router);
  const go = (dir: 1 | -1) => switchProject(dir, router);
  const disciplines = project.tags.filter((t) => !project.tools.includes(t));
  const hasSectionVideo = project.sections.some((s) => s.gallery?.items.some((it) => it.type === "video"));
  const theme = project.theme;
  const art = theme?.mode === "custom" && theme.heroStyle === "art";
  // a page built one-to-one from its Figma frame (lib/project-theme.ts → PAGE_TEMPLATES)
  const story = theme?.template === "songs-of-saaja" ? <SongsOfSaaja project={project} /> : null;

  return (
    <div ref={wrapper} className="cs" data-case-study data-themed={theme?.mode === "custom" || undefined} tabIndex={-1} style={themeVars(theme) as CSSProperties}>
      <header className="cs-bar">
        <button className="cs-home" onClick={close}>
          Thavanesh Nagarajan
        </button>
        <div className="cs-pager">
          <button onClick={() => go(-1)}>Previous</button>
          <span aria-label={`Project ${index + 1} of ${count}`}>
            {pad(index + 1)} / {pad(count)}
          </span>
          <button onClick={() => go(1)}>Next</button>
        </div>
        <button className="cs-close" onClick={close} aria-label="Close project">
          Close <span aria-hidden="true">×</span>
        </button>
      </header>

      <article ref={content} className={story ? "cs-content cs-content-story" : "cs-content"} data-cs-content>
        {story}
        {!story && art && (
          // art-led hero: the key art carries the title; the statement follows it
          <section className="csx-hero">
            <div className="csx-hero-art" data-intro>
              <div className="cs-parallax" data-parallax>
                <Image src={project.hero} alt={`${project.title} key art`} fill priority sizes="100vw" />
              </div>
            </div>
            {theme?.band && <div className="csx-band csx-band-hero" style={{ backgroundImage: `url("${theme.band}")` }} aria-hidden="true" />}
            <span className="csx-stem" data-progress aria-hidden="true" />
          </section>
        )}
        {!story && (
          <>
            <section className={art ? "cs-hero csx-hero-text" : "cs-hero"}>
              <p className={art ? "cs-eyebrow sr-only" : "cs-eyebrow"} data-intro>
                Project {pad(index + 1)} — {project.category}
              </p>
              <h1 className={art ? "cs-title sr-only" : "cs-title"} data-intro>
                {project.title}
              </h1>
              <p className="cs-lede" data-intro>
                <Highlighted text={project.description} />
              </p>
              <dl className="cs-meta" data-intro>
                <div>
                  <dt>Role</dt>
                  <dd>
                    {project.role.split(" / ").map((r) => (
                      <span key={r}>{r}</span>
                    ))}
                  </dd>
                </div>
                <div>
                  <dt>Year</dt>
                  <dd>{project.year}</dd>
                </div>
                <div>
                  <dt>Discipline</dt>
                  <dd>
                    {disciplines.map((t) => (
                      <span key={t}>{t}</span>
                    ))}
                  </dd>
                </div>
                <div>
                  <dt>Tools</dt>
                  <dd>
                    {project.tools.map((t) => (
                      <span key={t}>{t}</span>
                    ))}
                  </dd>
                </div>
              </dl>
              {!!project.links?.length && (
                <p className="cs-links" data-intro>
                  {project.links.map((l) => (
                    <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer">
                      {l.label} ↗
                    </a>
                  ))}
                </p>
              )}
            </section>

            {!art && (
              <div className="cs-hero-media" data-intro>
                <Media
                  media={{
                    type: "image",
                    src: project.hero,
                    alt: `${project.title} hero image`,
                  }}
                  priority
                />
              </div>
            )}

            {project.video && !hasSectionVideo && (
              <Media
                media={{
                  type: "video",
                  src: project.video,
                  alt: `${project.title} gameplay`,
                }}
              />
            )}

            {project.sections.map((s, n) => (
              <CaseSection key={s.id} section={s} n={n} band={theme?.band} />
            ))}
          </>
        )}

        {count > 1 && (
          <nav className="cs-adjacent" aria-label="More projects">
            <button className="cs-adj" onClick={() => go(-1)}>
              <span>Previous</span>
              <strong>{prev.title}</strong>
            </button>
            <button className="cs-adj cs-adj-next" onClick={() => go(1)}>
              <span>Next</span>
              <strong>{next.title}</strong>
            </button>
          </nav>
        )}

        <footer className="cs-foot">
          <button onClick={close}>← Back to the world</button>
          <span>© {new Date().getFullYear()} Thavanesh Nagarajan</span>
        </footer>
      </article>
    </div>
  );
}
