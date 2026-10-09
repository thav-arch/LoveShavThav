/**
 * Extra building blocks for case-study sections (beyond images and cards),
 * first designed for Songs of Saaja and reusable by every project:
 *
 *   table    a data table (e.g. a beat chart): rows of cells, first row = header
 *   board    a reference board: a centre image (e.g. a map) with labelled
 *            reference sheets around it, joined by dashed connectors
 *   divider  a decorative transition: footprints trail, pattern band or rule
 *
 * Plus section-level options: tone (base / alternate band), edges (torn paper,
 * pattern band), heading styles, a subtitle, chips ("Story → Character →
 * Theme") and ornaments (decorative art at the page edges, with parallax).
 */
import type { GalleryItem } from "./gallery";

export const SECTION_KINDS = ["media", "cards", "table", "board", "divider"] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];

export const TONES = ["base", "alt"] as const;
export const EDGES = ["none", "torn", "torn-top", "torn-bottom", "pattern"] as const;
export const HEADINGS = ["default", "center", "kicker", "ornament", "rules", "dashed", "hidden"] as const;
export const DIVIDERS = ["footprints", "pattern", "rule"] as const;

export type Tone = (typeof TONES)[number];
export type Edge = (typeof EDGES)[number];
export type HeadingStyle = (typeof HEADINGS)[number];
export type DividerStyle = (typeof DIVIDERS)[number];

export type TableData = { header: boolean; rows: string[][] };

export type BoardRef = { label: string; image: GalleryItem; side: "left" | "right" };
export type BoardData = { center: GalleryItem | null; refs: BoardRef[] };

export type Ornament = {
  url: string;
  side: "left" | "right";
  /** vertical position within the section, 0–100 % */
  top: number;
  /** width at a 1440px-wide page; scales with the screen */
  width: number;
  /** gentle slow rotation (sun symbols) */
  spin?: boolean;
  flip?: boolean;
};

/** "a | b | c" lines (or tab-separated, pasted from a spreadsheet) → rows; blank lines skipped */
export const parseTable = (text: string): string[][] =>
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.split(/\||\t/).map((c) => c.trim()));

export const tableToText = (rows: string[][]) => rows.map((r) => r.join(" | ")).join("\n");
