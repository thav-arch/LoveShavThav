// Gameplay videos on a long page: they autoplay muted and loop, but only ONE plays at a time (the one
// most on screen), each has its own mute button + volume slider, and nothing is downloaded until a video
// is close to the screen. Reusable: give a page any number of  .ee-vid  boxes (see projects/elevator-empire.html).
//
//   <div class="ee-vid" data-state="idle">
//     <video muted loop playsinline preload="none" poster="…" data-src="path/to/video.mp4"></video>
//     <button class="ee-vplay">…</button>  <div class="ee-vc"><button class="ee-vmute">…</button><input class="ee-vvol"></div>
//   </div>
//
// data-state on the box: idle | playing | paused | error  (a missing video file just leaves the poster image).
// Returns a function that stops everything.
export function initVideos(scroller, selector = ".ee-vid") {
  const boxes = [...scroller.querySelectorAll(selector)];
  if (!boxes.length) return () => {};

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const saveData = navigator.connection?.saveData === true;
  const autoplay = !reduced && !saveData; // otherwise the visitor presses play
  const SHOW = 0.35; // a video counts as "on screen" once this much of it is visible

  const items = boxes.map((box) => ({
    box,
    video: box.querySelector("video"),
    playBtn: box.querySelector(".ee-vplay"),
    muteBtn: box.querySelector(".ee-vmute"),
    vol: box.querySelector(".ee-vvol"),
    ratio: 0,
    loaded: false,
    failed: false,
    userPaused: false, // the visitor paused it: do not restart it by scrolling
    userPlay: false, // the visitor pressed play (needed when autoplay is off)
  }));
  const cleanups = [];
  const on = (el, type, fn, opts) => {
    el.addEventListener(type, fn, opts);
    cleanups.push(() => el.removeEventListener(type, fn, opts));
  };
  const setState = (it, s) => (it.box.dataset.state = s);
  if (!autoplay) boxes.forEach((b) => b.setAttribute("data-manual", ""));

  /* -------------------------------------------------------------- loading */
  const load = (it) => {
    if (it.loaded || it.failed || !it.video.dataset.src) return;
    it.loaded = true;
    it.video.preload = "metadata";
    it.video.src = it.video.dataset.src;
    it.video.load();
  };
  items.forEach((it) => {
    it.video.disablePictureInPicture = true;
    it.video.disableRemotePlayback = true;
    it.video.volume = it.vol ? Number(it.vol.value) : 0.7;
    on(it.video, "error", () => {
      if (!it.loaded) return; // no src yet
      it.failed = true;
      setState(it, "error");
      console.warn("Video could not be loaded:", it.video.dataset.src);
    });
  });
  // start fetching a video a little before it scrolls into view
  const loadIO = new IntersectionObserver((entries) => entries.forEach((e) => e.isIntersecting && load(items.find((i) => i.box === e.target))), {
    root: scroller,
    rootMargin: "60% 0px 60% 0px",
  });
  items.forEach((it) => loadIO.observe(it.box));

  /* ---------------------------------------------------------- play / pause */
  const play = (it) => {
    if (it.failed) return;
    load(it);
    const p = it.video.play();
    if (!p) return setState(it, "playing");
    p.then(() => setState(it, "playing")).catch((err) => {
      if (err?.name === "NotAllowedError" && !it.video.muted) {
        // the browser refuses sound without a click: fall back to muted playback
        setMuted(it, true);
        play(it);
      } else {
        setState(it, "paused");
      }
    });
  };
  const pause = (it) => {
    if (!it.video.paused) it.video.pause();
    if (it.box.dataset.state !== "error") setState(it, it.userPaused ? "paused" : "idle");
  };

  // the one video that should be playing: the most visible one (ties: the closest to the middle of the screen)
  let active = null;
  const choose = () => {
    const mid = scroller.getBoundingClientRect().top + scroller.clientHeight / 2;
    let best = null;
    let bestScore = -1;
    for (const it of items) {
      if (it.failed || it.ratio < SHOW) continue;
      const r = it.box.getBoundingClientRect();
      const score = it.ratio - Math.abs((r.top + r.bottom) / 2 - mid) / 100000;
      if (score > bestScore) {
        best = it;
        bestScore = score;
      }
    }
    active = best;
    for (const it of items) {
      const shouldPlay = it === active && !document.hidden && !it.userPaused && (autoplay || it.userPlay);
      if (shouldPlay) {
        if (it.video.paused) play(it);
      } else if (!it.video.paused) pause(it);
    }
  };
  const ratioIO = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => (items.find((i) => i.box === e.target).ratio = e.intersectionRatio));
      choose();
    },
    { root: scroller, threshold: Array.from({ length: 21 }, (_, i) => i / 20) },
  );
  items.forEach((it) => ratioIO.observe(it.box));
  on(document, "visibilitychange", choose);

  /* ----------------------------------------------------------------- sound */
  const setMuted = (it, muted) => {
    it.video.muted = muted;
    if (it.muteBtn) {
      it.muteBtn.setAttribute("aria-pressed", String(muted));
      const name = it.video.getAttribute("aria-label") || "video";
      it.muteBtn.setAttribute("aria-label", (muted ? "Unmute " : "Mute ") + name);
    }
  };
  // only one video makes sound: turning one on silences the others
  const soloSound = (it) => items.forEach((o) => o !== it && !o.video.muted && setMuted(o, true));

  items.forEach((it) => {
    setMuted(it, true);
    if (it.muteBtn)
      on(it.muteBtn, "click", () => {
        const unmute = it.video.muted;
        if (unmute) {
          if (it.video.volume === 0) {
            it.video.volume = 0.7;
            if (it.vol) it.vol.value = "0.7";
          }
          soloSound(it);
        }
        setMuted(it, !unmute);
      });
    if (it.vol)
      on(it.vol, "input", () => {
        const v = Number(it.vol.value);
        it.video.volume = v;
        if (v === 0) setMuted(it, true);
        else if (it.video.muted) {
          soloSound(it);
          setMuted(it, false);
        }
      });
    if (it.playBtn)
      on(it.playBtn, "click", () => {
        if (it.video.paused) {
          it.userPaused = false;
          it.userPlay = true;
          play(it);
        } else {
          it.userPaused = true;
          pause(it);
        }
      });
    // touch: a tap on the video shows the controls for a few seconds
    let hide = 0;
    on(it.box, "pointerdown", (e) => {
      if (e.pointerType !== "touch") return;
      it.box.setAttribute("data-controls", "");
      clearTimeout(hide);
      hide = setTimeout(() => it.box.removeAttribute("data-controls"), 3500);
    });
    cleanups.push(() => clearTimeout(hide));
  });

  return () => {
    loadIO.disconnect();
    ratioIO.disconnect();
    cleanups.forEach((f) => f());
    items.forEach((it) => {
      it.video.pause();
      if (it.loaded) {
        it.video.removeAttribute("src");
        it.video.load(); // frees the download / decoder
      }
    });
  };
}
