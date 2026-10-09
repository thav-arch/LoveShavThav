import { create } from "zustand";

/**
 * Central portfolio state (React-facing, low-frequency).
 *
 * Anything that changes every frame — carousel position/target/velocity,
 * pointer, hover, transition progress — lives in the mutable `motion` object
 * (lib/motion.ts) instead, so the 60fps loop never triggers React renders.
 */
/** PAGE = an editorial route (/journal, /about) covering the paused world */
export type PortfolioMode = "WORLD" | "PROFILE" | "PLAYGROUND" | "INDEX" | "PROJECT" | "PAGE";
export type TransitionState = "idle" | "entering" | "exiting" | "switching";

type PortfolioState = {
  mode: PortfolioMode;
  /** project index (0..N-1) currently in the centre of the carousel */
  activeIndex: number;
  /** project the user is opening / viewing */
  selectedSlug: string | null;
  transition: TransitionState;
  /** +1 next, -1 previous (prev/next navigation and carousel moves) */
  direction: 1 | -1;
  /** where the open project was launched from — used for the matching exit */
  openedFrom: "world" | "index" | "direct";
  introDone: boolean;
  set: (patch: Partial<Omit<PortfolioState, "set">>) => void;
};

export const usePortfolio = create<PortfolioState>((set) => ({
  mode: "WORLD",
  activeIndex: 0,
  selectedSlug: null,
  transition: "idle",
  direction: 1,
  openedFrom: "world",
  introDone: false,
  set: (patch) => set(patch),
}));

export const isPortalMode = (m: PortfolioMode) => m === "PROFILE" || m === "PLAYGROUND";
