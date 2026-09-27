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

## A domain, later

Cloudflare Pages can host a domain it does not have to buy. Buy the domain
wherever is cheapest - that part is unaffected by this change.

## What to leave alone until it is proven

The Firebase hosting deployment is not removed by this. It can keep serving
`maa-saraswati-diary.web.app` while Cloudflare is checked, and the two are
identical because both are built from the same folder. Only once Cloudflare has
been visited, the videos played and the panel signed into should the old
deployment be retired.
