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

## Adding a video without opening a dashboard

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

## Where the films are kept

Films uploaded from the panel do not go in Firestore and do not go in R2.

**Not R2** because Cloudflare will not switch R2 on until a card is on the
account, and a shop should not have to enter a card number to change its own
website. R2 is still the better store - any size, reads cost nothing - and is
worth switching to if a card is ever added. Nothing above the storage layer would
change.

**Not Firestore** because a document there is capped at one megabyte and a film
is several. It is also the wrong tool for it: a video is not a row, and reading
one out of a document store costs a read out of a daily allowance that the
catalogue is already spending.

So:

| | Where | Why |
| --- | --- | --- |
| The film bytes | Workers KV | Free with no card. One value holds up to 25 MB, which is a whole film, so a film is stored whole and reading it back is one read. 100,000 reads a day. |
| The poster frame | Workers KV | Same store, a few tens of kilobytes. |
| The list of films | Firestore, one document | Strongly consistent, which matters more here than it does for a page of text. |
| The list of films | Firestore, one document | Strongly consistent, and read straight through. There is no cached copy in front of it - see below. |

A namespace is free to create and costs nothing to keep:

```sh
npx wrangler kv namespace create maa-videos
```

### Three things that went wrong, and what they are for

**The list was in KV first, and it lost films.** KV reads are eventually
consistent, so removing one film and removing another immediately afterwards
could read the list as it was before the first removal, and put that film back
on the page. The list is strongly consistent data, so it went to Firestore,
which is read-your-writes.

**"Could not read it" was answered as "there is nothing there".** A request to
Firestore failed once and the video page came up empty - for the owner as well as
for visitors. A read that cannot be made now throws rather than returning an
empty list, because a caller told "nothing here" when the answer is "I could not
look" will empty the page, and an owner watching that believes their films are
gone. The same applies to the read that a change depends on: answered as empty, a
change would have written back a list holding one film and deleted the rest.

**A film that had been stored was hidden as missing.** The page checks each film
against the store and offers only what it can serve, so a name whose file had
gone could not draw a card that plays nothing. But the store's own listing is
eventually consistent too, so for a minute or two after an upload the film was
not in the listing and the upload looked as though it had failed. A film is only
checked once it is old enough to have settled. The panel is also shown films the
file has gone, marked as such, because a film the owner can neither see nor
remove is a film that stays for ever.

### Files

| What | Where |
| --- | --- |
| `GET/POST/PUT/DELETE /api/videos` | `functions/api/videos.js` |
| Who is allowed to call it | `functions/_lib/auth.js` |
| The store, the list, size limits, path safety | `functions/_lib/videos.js` |
| Serving films and posters, with Range | `functions/media/[[path]].js` |
| The panel screen | `client/src/pages/admin/PartnerVideos.jsx` |
| The public list, with its fallback | `client/src/hooks/useVideoAds.js` |
| Taking a poster frame from a film | `client/src/lib/videoPoster.js` |

There was a KV copy of the list in front of Firestore, so a visit would not spend a read. It is gone. The store's smallest possible staleness is a minute, so the owner who added a film and went to look at it was shown a page without it - and a read of one small document, against an allowance of fifty thousand a day, for a page that gets few visitors, was not worth trading a minute of being wrong for.

In the store: `film:<name>` and `poster:<name>`. In Firestore:
`shop/video-list`, which the catalogue skips by name - the same way it skips the
About page, and for the same reason: `syncShopWithApproved` deletes anything in
that collection which is not an approved product, and without the skip every visit
to the panel would empty the video page.

### Tests

```sh
SITE_EMAIL=... SITE_PASSWORD=... node e2e/video-upload.mjs
```

70 checks against the deployed site, with the real sign-in and the real store:
pick a file, take a frame, store it, list it, serve it whole and in parts, seek
to the end, play it, rename it, move it, walk every tab in the panel and check
nothing was swept away, then remove it and find the files gone.

It has to run against a real deployment. The list is in Firestore, which a local
server reaches over the network, so a run against localhost would write the list
for real while the films went into a local store the site cannot see.

## Content that must never stay hidden

Cards fade in as they scroll into view, which is fine for a picture of a
product. It is not fine for a video: the animation hides the card until an
intersection observer fires, and if it does not, the film is on the page and
cannot be seen. It was reported as three videos on the website and four in the
panel - the fourth was there the whole time at zero opacity. A film a customer
cannot see is a film the shop does not have.

So the video cards do not animate, and every other animated card is shown
regardless after a moment and a half. The animation still happens for
everything it was meant for; the timeout only catches what it would otherwise
keep.

## A domain, later

Cloudflare Pages can host a domain it does not have to buy. Buy the domain
wherever is cheapest - that part is unaffected by this change.

## What to leave alone until it is proven

The Firebase hosting deployment is not removed by this. It can keep serving
`maa-saraswati-diary.web.app` while Cloudflare is checked, and the two are
identical because both are built from the same folder. Only once Cloudflare has
been visited, the videos played and the panel signed into should the old
deployment be retired.
