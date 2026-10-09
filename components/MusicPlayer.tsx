"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { trackFor, type MusicPlan, type Track } from "@/lib/music";

/**
 * Background music for the public site (tracks are chosen in the dashboard —
 * lib/music.ts). Lives in the site layout, so it keeps playing while visitors
 * move between pages and crossfades when the next page has a different track.
 *
 * - Sound only ever starts from a visitor's click / key press (browser rule).
 * - Visitors get play/pause and their own volume; both are remembered.
 * - Volume runs through Web Audio gain nodes (iPhones ignore audio.volume).
 * - Two players alternate for crossfades; each track resumes where it left off.
 * - Pauses in background tabs, and dips under a video that is playing.
 */

const KEY_ON = "music:on";
const KEY_VOL = "music:vol";
const DUCK = 0.18;

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {}
};

type Deck = { el: HTMLAudioElement; gain: GainNode; url: string };

class Engine {
  ctx: AudioContext;
  master: GainNode;
  decks: Deck[];
  live = 0;
  /** where each track was, so returning to a page resumes it */
  positions = new Map<string, number>();

  constructor() {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.decks = [0, 1].map(() => {
      const el = new Audio();
      el.loop = true;
      el.preload = "auto";
      el.crossOrigin = "anonymous";
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      this.ctx.createMediaElementSource(el).connect(gain).connect(this.master);
      return { el, gain, url: "" };
    });
  }

  /** must run inside a click / key press: lets both players make sound later (iOS) */
  unlock(url: string) {
    void this.ctx.resume();
    for (const d of this.decks)
      if (!d.url) {
        d.el.src = url;
        // stop again unless play() has already handed this player a track
        d.el.play().then(() => !d.url && d.el.pause(), () => {});
      }
  }

  setMaster(v: number) {
    this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.08);
  }

  /** crossfade to a track (or to silence with null) */
  play(track: Track | null, fade: number) {
    const now = this.ctx.currentTime;
    const cur = this.decks[this.live];
    const ramp = (g: GainNode, to: number) => {
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(g.gain.value, now);
      g.gain.linearRampToValueAtTime(to, now + Math.max(0.05, fade));
    };
    if (track && cur.url === track.url) {
      if (cur.el.paused) void cur.el.play().catch(() => {});
      ramp(cur.gain, track.volume);
      return;
    }
    // fade the current track out, remember where it was, then pause it
    if (cur.url) {
      ramp(cur.gain, 0);
      const leaving = cur.url;
      setTimeout(() => {
        if (this.decks[this.live] !== cur || !track) {
          this.positions.set(leaving, cur.el.currentTime);
          if (cur.gain.gain.value < 0.01) cur.el.pause();
        }
      }, fade * 1000 + 80);
    }
    if (!track) return;
    this.live = 1 - this.live;
    const next = this.decks[this.live];
    if (next.url !== track.url) {
      next.url = track.url;
      next.el.src = track.url;
      const at = this.positions.get(track.url);
      if (at) next.el.addEventListener("loadedmetadata", () => (next.el.currentTime = at % (next.el.duration || Infinity)), { once: true });
    }
    next.gain.gain.cancelScheduledValues(now);
    next.gain.gain.setValueAtTime(0, now);
    void next.el.play().catch(() => {});
    ramp(next.gain, track.volume);
  }

  pauseAll(fade: number) {
    this.play(null, fade);
    const cur = this.decks[this.live];
    setTimeout(() => {
      for (const d of this.decks) if (d.gain.gain.value < 0.01) d.el.pause();
      if (cur.url) this.positions.set(cur.url, cur.el.currentTime);
    }, fade * 1000 + 100);
  }
}

export function MusicPlayer({ plan }: { plan: MusicPlan }) {
  const path = usePathname();
  const track = trackFor(path, plan);
  const engine = useRef<Engine | null>(null);
  const [on, setOn] = useState(false);
  const [vol, setVol] = useState(0.8);
  const [duck, setDuck] = useState(1);
  const fade = plan.fade;

  // any track anywhere on the site? otherwise there is nothing to control
  const hasMusic = plan.enabled && (!!plan.default.url || [plan.home, plan.projects, plan.journal, plan.about, ...Object.values(plan.perProject)].some((s) => s.mode === "custom" && s.url));

  useEffect(() => {
    const v = Number(read(KEY_VOL));
    if (read(KEY_VOL) != null && v >= 0 && v <= 1) setVol(v);
  }, []);

  /** start sound — only call from a click / key press */
  const start = useCallback(() => {
    if (!hasMusic) return;
    try {
      engine.current ??= new Engine();
    } catch {
      return; // no Web Audio
    }
    const first = track ?? plan.default;
    if (first.url) engine.current.unlock(first.url);
    setOn(true);
  }, [hasMusic, track, plan.default]);

  // start on the first click or key press: if the dashboard says so, or this visitor turned music on before
  useEffect(() => {
    if (!hasMusic) return;
    const choice = read(KEY_ON);
    if (choice === "0" || (plan.start !== "interaction" && choice !== "1")) return;
    const go = (e: Event) => {
      // the sound button handles its own click
      if ((e.target as HTMLElement | null)?.closest?.(".mp")) return;
      start();
      off();
    };
    const off = () => {
      removeEventListener("pointerdown", go, true);
      removeEventListener("keydown", go, true);
    };
    addEventListener("pointerdown", go, true);
    addEventListener("keydown", go, true);
    return off;
  }, [hasMusic, plan.start, start]);

  // play this page's track (crossfading from the last one)
  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    if (on) e.play(track, fade);
    else e.pauseAll(fade * 0.6);
  }, [on, track?.url, track?.volume, fade]); // eslint-disable-line react-hooks/exhaustive-deps

  // overall × visitor × (dip under videos)
  useEffect(() => {
    engine.current?.setMaster(plan.volume * vol * duck);
  }, [plan.volume, vol, duck, on]);

  // background tab: pause; back: carry on
  useEffect(() => {
    const vis = () => {
      const e = engine.current;
      if (!e || !on) return;
      if (document.hidden) void e.ctx.suspend();
      else void e.ctx.resume();
    };
    document.addEventListener("visibilitychange", vis);
    return () => document.removeEventListener("visibilitychange", vis);
  }, [on]);

  // lower the music while a video with sound plays
  useEffect(() => {
    if (!plan.duck) return;
    const check = () => {
      const loud = Array.from(document.querySelectorAll("video")).some((v) => !v.paused && !v.muted && v.volume > 0);
      setDuck(loud ? DUCK : 1);
    };
    const opts = { capture: true };
    for (const t of ["play", "pause", "ended", "volumechange"]) document.addEventListener(t, check, opts);
    return () => {
      for (const t of ["play", "pause", "ended", "volumechange"]) document.removeEventListener(t, check, opts);
    };
  }, [plan.duck]);

  if (!hasMusic) return null;
  const playing = on && !!track;
  const label = on ? "Turn background music off" : "Turn background music on";
  const now = track?.title ? `Now playing: ${track.title}` : on && !track ? "No music on this page" : "Background music";

  return (
    <div className="mp" data-on={on || undefined} data-playing={playing || undefined}>
      <button
        type="button"
        className="mp-toggle"
        aria-label={label}
        aria-pressed={on}
        title={now}
        onClick={() => {
          if (on) {
            setOn(false);
            write(KEY_ON, "0");
          } else {
            start();
            write(KEY_ON, "1");
          }
        }}
      >
        <span className="mp-bars" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
        <span className="mp-label">{on ? "Sound on" : "Sound off"}</span>
      </button>
      <label className="mp-vol">
        <span className="sr-only">Music volume</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={vol}
          onChange={(e) => {
            const v = Number(e.target.value);
            setVol(v);
            write(KEY_VOL, String(v));
            if (!on && v > 0) {
              start();
              write(KEY_ON, "1");
            }
          }}
          style={{ "--v": vol } as CSSProperties}
        />
      </label>
      <span className="sr-only" aria-live="polite">
        {on && track?.title ? `Playing ${track.title}` : ""}
      </span>
    </div>
  );
}
