# Deploying to Cloudflare Pages

**Live at <https://maa-saraswati-diary.pages.dev>**

The site runs on the free Firebase plan, which allows **360 MB a day** of
transfer across every visitor. The four video ads are 5.4 MB, so a few dozen
people watching them would have used the whole day's allowance and taken the site
down for everyone - the shop included.

Cloudflare Pages' free tier has no bandwidth allowance, so the films can live on
the site. This is the move that makes that possible.

**Nothing about the shop's data moves.** Firebase Authentication and Firestore
are separate services; they keep serving the panel, the products and the reviews
from the same project they always have. Only the HTML, CSS, JavaScript and the
films are served from somewhere else.

## What is already in place

| File | Why |
| --- | --- |
| `client/public/_redirects` | The site is a single-page app. Without this, opening `/products` or sharing a product link would 404. |
| `client/public/_headers` | Cache rules and `Accept-Ranges` for the films, so a video can be seeked and played. |
| `npm run deploy:pages` | Build and upload in one step. |

The build needs no network access and no secrets: the only thing that runs before
it copies a local file.

## One-time setup

1. Create a free account at <https://dash.cloudflare.com/sign-up>.
2. **Workers & Pages → Create → Pages → Connect to Git**.
3. Choose `maasaraswati-diary`, then the `maa-saraswati` repository.
4. Fill in the build settings:

   | Setting | Value |
   | --- | --- |
   | Framework preset | None |
   | Build command | `npm run build` |
   | Build output directory | `client/dist` |
   | Root directory | `/` |
   | Environment variables | leave empty |

5. Deploy. The first build takes a couple of minutes.

From then on, every push to `main` publishes the site by itself, which is
better than the current arrangement where hosting has to be uploaded by hand.

## Or, without the dashboard

If you would rather not use the Git connection:

```sh
npm run pages:login     # opens a browser to authorise
npm run deploy:pages    # builds and uploads
```

The address will be `maa-saraswati-diary.pages.dev` unless the project is given
another name.

## Adding a video without touching R2

**`Add Video.bat` in the project root.** Double-click it, choose a file, type a
title, press Enter twice. The film is compressed, given a poster frame, put on
the video page and published. That is the whole tool.

Nothing about it needs an account, a card, a dashboard or a login, which is the
point: the R2 route below is the better one once it is available, but it is
gated on a card being entered, and a shop should not be unable to change its own
website until that happens.

```
Add Video.bat                          # ask, then publish
node client/scripts/add-video.mjs      # the same, from a terminal
node client/scripts/add-video.mjs --list
node client/scripts/add-video.mjs --remove milk
```

Flags, for running it without asking anything: `--file`, `--title`, `--note`,
`--remove <slug>`, `--list`, `--yes`.

Two things it will not do quietly:

- It asks before publishing, and says plainly when it has only changed the files
  on this computer.
- If the partner panel is in charge of the video page - which it will be once R2
  is on and films have been uploaded there - it says so and explains that the
  page will keep showing the panel's films. A film added here would otherwise
  look added and then lost.

The films themselves are compressed on the way in: 1280x720 at a screen
appropriate quality, audio at voice level, the index moved to the front so a
browser can start playing before the file has finished arriving. The shop's own
films lose about half their size. The original is never touched.

## Films: R2, and the one step that needs a card

The videos page is built out of films in `client/src/videoAds.js` and the files
in `client/public/videos`. They are served by Pages like everything else, which
is fine, but it means every film a visitor presses play is downloaded out of
the Pages allowance.

**R2 is where uploaded films live.** The partner panel's Videos tab sends a
film to a Cloudflare Function, which puts it in R2, and the video page lists
what is there. R2's free tier holds 10 GB and — the reason for choosing it —
does not charge for the data coming back out.

Enabling it takes one visit to the Cloudflare dashboard, and it asks for a card
even on the free tier. Nothing is charged while usage stays inside the free
allowance, but the card has to be there, which is why this step was left for the
owner to do rather than done from a machine that could not.

1. Dashboard → **R2** → enable. A card is requested; that is expected.
2. `npx wrangler r2 bucket create maa-videos`
3. Uncomment the `[[r2_buckets]]` block in `wrangler.toml` — publishing a
   Function that names a bucket which does not exist is refused outright, so the
   site cannot be deployed at all while the line is live.
4. `npm run deploy:pages`

Until then the site is not broken and does not pretend otherwise: the functions
notice the missing binding and say so, the public video page goes on serving the
films built into the site, and the panel shows **Storage not switched on** with
the upload button disabled.

### Moving the existing four films across

Once R2 is on, the four films in `client/src/videoAds.js` should be uploaded
through the panel and that file emptied to `[]`. The panel's list takes over as
the one list of films; the built-in list is only ever a fallback for when the
video service cannot be reached.

## Where the video pieces live

| What | Where |
| --- | --- |
| `GET/POST/PUT/DELETE /api/videos` | `functions/api/videos.js` |
| Who is allowed to call it | `functions/_lib/auth.js` |
| Bucket layout, size limits, path safety | `functions/_lib/videos.js` |
| Streaming films and posters | `functions/media/[[path]].js` |
| The panel screen | `client/src/pages/admin/PartnerVideos.jsx` |
| The public list, with its fallback | `client/src/hooks/useVideoAds.js` |
| Taking a poster frame from a film | `client/src/lib/videoPoster.js` |

In the bucket: `videos/<name>.mp4`, `posters/<name>.jpg`, and
`videos/index.json` holding the titles, notes and order.

Firestore was deliberately not used for any of this. A film is measured in
megabytes and a Firestore document is capped at one, and a new collection would
have meant editing and publishing security rules by hand in the Firebase
console. The Functions check the owner's sign-in token on the server instead,
which is the same protection without the console.

### Tests

```sh
npx wrangler pages dev client/dist --port 8788   # in one terminal
SITE_EMAIL=... SITE_PASSWORD=... node e2e/video-upload.mjs
```

`wrangler pages dev` gives a real R2 bucket with no account involved, so the
whole round trip — pick a file, take a poster frame, store it, list it, serve it
with Range requests, play it, rename it, move it, remove it — is checked before
anything is published. 46 checks.

## A domain, later

Cloudflare Pages can host a domain it does not have to buy. Buy the domain
wherever is cheapest - that part is unaffected by this change.

## What to leave alone until it is proven

The Firebase hosting deployment is not removed by this. It can keep serving
`maa-saraswati-diary.web.app` while Cloudflare is checked, and the two are
identical because both are built from the same folder. Only once Cloudflare has
been visited, the videos played and the panel signed into should the old
deployment be retired.
