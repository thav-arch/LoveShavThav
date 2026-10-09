import { MusicPlayer } from "@/components/MusicPlayer";
import { PortfolioShell } from "@/components/PortfolioShell";
import { getPublishedProjects, getSettings } from "@/lib/cms/queries";
import type { MusicSlot } from "@/lib/music";

/**
 * Public site: the persistent 3D portfolio shell. Projects, profile and the
 * WebGL theme come from the CMS (cached; refreshed when content is saved).
 * Background music (Settings → Music, plus each project's own) plays across pages.
 */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [projects, profile, theme, music] = await Promise.all([
    getPublishedProjects(),
    getSettings("profile"),
    getSettings("theme"),
    getSettings("music"),
  ]);
  const perProject: Record<string, MusicSlot> = {};
  for (const p of projects) if (p.theme?.music && p.theme.music.mode !== "default") perProject[p.slug] = p.theme.music;
  return (
    <PortfolioShell
      projects={projects}
      profile={profile}
      theme={{
        gridHue: theme.gridHue,
        gridIntensity: theme.gridIntensity,
        cursorWake: theme.cursorWake,
        wakeStrength: theme.wakeStrength,
        cardRadius: theme.cardRadius,
      }}
    >
      {children}
      <MusicPlayer plan={{ ...music, perProject }} />
    </PortfolioShell>
  );
}
