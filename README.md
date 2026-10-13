# Thavanesh Nagarajan — portfolio

A plain static website: HTML, CSS and JavaScript files in a folder. No framework, no database, no build step, no installs.

## Run it on your computer

1. Open this folder in VS Code and install the **Live Server** extension (Ritwick Dey).
2. Right-click `index.html` → **Open with Live Server**.

(Opening `index.html` by double-click will not work: browsers block the 3D code from loading off `file://`. Any local web server works — Live Server is just the easiest.)

## Put it online (free)

Upload the folder as-is — there is nothing to build.

- **GitHub Pages:** push this folder to a GitHub repository → Settings → Pages → deploy from the `main` branch, root folder. (Free Pages needs a public repository.)
- **Cloudflare Pages:** create a project from the repository, leave the build command empty and set the output directory to `/`.

A custom domain can be attached on either.

## What is where

```
index.html            the landing page (3D strip, Featured / Full views, Profile, loader)
projects/             one HTML file per project page
  songs-of-saaja.html
  elevator-empire.html
css/                  fonts.css · base.css · world.css (landing) · case.css (all project pages) · saaja.css · elevator-empire.css
js/data.js            ALL the content of the landing page: projects (title, year, cover…) and the Profile text
js/main.js            starts everything
js/core, js/world     the 3D film strip, shaders, loading (three.js is in js/vendor)
js/ui                 loader, navigation, Full view, opening / closing project pages
js/pages/saaja.js     scroll animations of the Songs of Saaja page
js/pages/elevator-empire.js   text reveal, counting numbers and videos of the Elevator Empire page
js/video-manager.js   looping videos: one plays at a time, sound control per video, lazy loading (reusable)
js/page-effects.js    smooth scrolling, reveal and parallax shared by project pages
images/covers/        the landing-page card images (<slug>.webp = 1920px, <slug>-sm.webp = 480px)
images/saaja/         images of the Songs of Saaja page
images/elevator-empire/   the Elevator Empire artwork (p00-p15.webp slices), video posters, and video/ (put the 4 videos here)
fonts/                Inter Tight, Marcellus SC, Jersey 25 (self-hosted)
```

## Everyday edits

- **Change text on the landing page / Profile:** edit `js/data.js`.
- **Change a project page:** edit its file in `projects/` (and `css/<page>.css`). It is ordinary HTML.
- **Change the look of the 3D world** (grid glow, cursor ripple, corner rounding): the `motion.theme` block at the top of `js/main.js`.
- **Change the shape of the strip** (angle of the side projects, lens, how many show each side, per desktop / tablet / phone): the table at the top of `js/core/layout.js` (`diag`, `fov`, `maxSlot`, `maxLeft`).

## Add a project page

1. Copy `projects/songs-of-saaja.html` to `projects/<name>.html` and replace the content between `<article class="cs-content" …>` and its footer. Keep `<base href="../">` — it lets every path in the file be written from the site root, so the page works on its own **and** when the landing page opens it.
2. Put its images in `images/<name>/`, its styles in `css/<name>.css` (linked in the page's `<head>`), and — only if it needs scripting — a module in `js/pages/<name>.js` exporting `mount(cs)` that returns a clean-up function (see `js/pages/saaja.js`). Link it with `<script type="module" data-page src="js/pages/<name>.js">`.
3. In `js/data.js`, set the project's `"page"` to `"projects/<name>.html"`. Projects with `"page": null` show "case study coming soon" when clicked.

Add a brand-new project to the strip by adding an entry in `js/data.js` plus its two cover images in `images/covers/` (the 3D strip shows all entries automatically).

## Videos on a project page

A project page can hold any number of looping videos; `js/video-manager.js` makes them behave: they start muted, **only the video most on screen plays**, each has its own mute button and volume slider, and a video is only downloaded when it is near the screen. Mark one up like the `.ee-vid` boxes in `projects/elevator-empire.html` (a `<video data-src="…" poster="…" muted loop playsinline>` plus the two small control blocks) and call `initVideos(scroller)` from the page script. A missing file just leaves the poster image. File names and compression for Elevator Empire: `images/elevator-empire/video/README.txt`.

## Known state

- **Songs of Saaja** and **Elevator Empire** have project pages; the other five cards show "coming soon".
- **Elevator Empire** is the Figma page exported as artwork slices with live text and videos on top, scaled to the window width. On phones it is the same layout scaled down (pinch-zoom works); a dedicated phone layout needs the artwork cut into separate pieces.
- *Dashboards and UI* and *PowerUI Library* have no cover image yet, so they show a generated placeholder card. Drop `<slug>.webp` and `<slug>-sm.webp` into `images/covers/` and fill `thumbnail` / `thumbnailSmall` in `js/data.js`.
- Not included in this version: Playground, Journal, About, background music.
- The old version of the site (Next.js + database + dashboard) is kept in Git history: commit `947d14a`.
