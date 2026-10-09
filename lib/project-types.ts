/**
 * The shape of a published project as the portfolio front end sees it
 * (3D carousel, index, case study). Built from the database by
 * lib/cms/queries.ts and shared with client components.
 */
import type { GalleryItem, GalleryPlan, ResolvedText } from "./gallery";
import type { ResolvedDesign } from "./section-design";
import type { Card, CardsPlan } from "./cards";
import type { BoardData, DividerStyle, Ornament, TableData } from "./blocks";
import type { ProjectTheme } from "./project-theme";

export type ProjectMedia = {
  type: "image" | "video";
  src: string;
  alt: string;
  caption?: string;
};

export type ProjectSection = {
  id: string;
  title: string;
  /** Markdown source */
  body: string;
  /** rendered, sanitised HTML (filled in by the server) */
  html?: string;
  /** images/videos + the layout planned on the server (lib/gallery.ts) */
  gallery?: { items: GalleryItem[]; plan: GalleryPlan };
  /** where the text sits relative to the images / cards, resolved on the server */
  placement?: ResolvedText;
  /** how text and images are composed, resolved on the server (lib/section-design.ts) */
  design?: ResolvedDesign;
  /** card section: numbered steps + the orientation decided on the server (lib/cards.ts) */
  cards?: { items: Card[]; plan: CardsPlan };
  /** seed data only: a single image/video (imported as a one-item gallery) */
  media?: ProjectMedia;
  /** extras (lib/blocks.ts) */
  subtitle?: string;
  chips?: string[];
  ornaments?: Ornament[];
  table?: TableData;
  board?: BoardData;
  divider?: DividerStyle;
};

export type Project = {
  id: string;
  slug: string;
  title: string;
  /** short category/type line shown on the card */
  subtitle: string;
  /** one or two sentences, case-study intro */
  description: string;
  year: string;
  category: string;
  role: string;
  tags: string[];
  tools: string[];
  /** used for fallback textures and small UI tints */
  accent: string;
  /** cover width ÷ height — sets the frame width on the 3D film strip */
  aspect?: number;
  thumbnail: string;
  thumbnailSmall: string;
  hero: string;
  video?: string;
  links?: { label: string; url: string }[];
  sections: ProjectSection[];
  /** per-project look of the case study (lib/project-theme.ts) */
  theme?: ProjectTheme;
};
