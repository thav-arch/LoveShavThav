PUT THE FOUR GAMEPLAY VIDEOS HERE (exact file names):

  prototype-v1-1.mp4   the small phone video next to "v1.1 & v1.2"     (portrait,  Figma frame 306 x 602)
  prototype-v1-2.mp4   the wide video under it                           (landscape, Figma frame 1040 x 603)
  prototype-v2.mp4     the phone video next to "Prototype v2"            (portrait,  Figma frame 398 x 798)
  prototype-v3.mp4     the phone video inside "Prototype v3"             (portrait,  Figma frame 383 x 681)

Until a file exists, the page shows that video's still image (poster-*.webp, one folder up) and nothing breaks.

Keep each file small: GitHub Pages rejects any single file over 100 MB, Cloudflare Pages over 25 MiB, and these videos
loop on the page, so a few MB each is plenty. H.264 MP4, no longer than ~30-60 s, 24-30 fps, about 1-2 Mbit/s:

  ffmpeg -i input.mov -vf "scale=-2:1080" -c:v libx264 -crf 28 -preset slow -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 96k prototype-v3.mp4

(portrait phone videos: scale=-2:1280 is enough; use -an instead of -c:a/-b:a if a video has no sound.)
HandBrake (free) does the same with its "Fast 1080p30" preset.
