# MAA SARASWATI — Dairy Products Website

A complete, production-shaped website for **MAA SARASWATI** (Pure Dairy Co.):
a React single-page app talking to an Express REST API, with JSON file storage
and a password-protected admin panel.

```
React (Vite)  ──/api──▶  Express  ──▶  JSON files in server/data
   :5180                    :4000
```

---

## Quick start

```bash
npm run install:all     # installs server + client dependencies
npm run dev             # starts API (:4000) and website (:5180)
```

Open **http://localhost:5180**

> **Note:** port **5180** is used instead of the Vite default 5173, because 5173
> is often already taken by another app on the machine.

### Admin panel

Go to **http://localhost:5180/admin**

| | |
|---|---|
| Email | `maasaraswati449@gmail.com` |
| Password | `admin123` |

These live in `server/.env`. The admin account is created automatically the
first time the app boots.

---

## What is included

### Public website
| Page | Route | Highlights |
|---|---|---|
| Home | `/` | Hero with layered product posters, live stats bar, scrolling marquee, brand pillars, featured products, 4-step process, paneer showcase, testimonials, FAQ accordion, bulk-order CTA |
| Products | `/products` | Live category tabs, debounced search, 5 sort modes, filter chips, active-filter state, empty state |
| Product detail | `/products/:slug` | Image gallery with hover-zoom + thumbnails, price/discount, quantity stepper with live total, 4 tabs (Description, Nutrition, How to Use, FAQs), feature cards, related products, WhatsApp + enquiry CTAs, mobile sticky bar |
| About | `/about` | Brand story, four promises, milestone timeline, team, facility visit info |
| Contact | `/contact` | Contact cards, validated enquiry form (client + server), SVG map, opening hours, FAQ |
| 404 | any unknown route | Branded not-found page |

### Admin panel
| Route | Purpose |
|---|---|
| `/admin` | Login (JWT, 12 h expiry) |
| `/admin/dashboard` | Stat cards, overview, product table, enquiry inbox |
| `/admin/products/new` | Create a product |
| `/admin/products/:id` | Edit a product |

- **Products tab** — search, edit, one-click in-stock/out-of-stock toggle,
  two-step delete confirmation.
- **Enquiries tab** — every enquiry from the contact form, with
  *new → contacted → closed* status tracking and delete.
- **Product editor** — name, category, pack size, pricing (auto-calculates the
  discount shown to customers), tagline, full description, highlights, usage,
  nutrition rows, feature cards, FAQs, multiple images (upload or paste a path),
  veg / in-stock / featured switches.
- Image upload accepts jpg, png, webp, gif, avif and svg up to 5 MB and is
  served from `/uploads`.

---

## Project layout

```
Diary/
├── package.json              # root scripts (runs both apps together)
├── firebase.json             # Hosting + Functions + Firestore config
├── .firebaserc               # your Firebase project id
├── firestore.rules           # database locked to server-only access
├── firestore.indexes.json
├── logo/                     # your original product images (source)
├── server/
│   ├── .env.example          # copy to .env
│   ├── data/                 # JSON store, used in local dev only
│   │   ├── products.json
│   │   ├── enquiries.json
│   │   └── users.json        # admin accounts (bcrypt hashed)
│   ├── seed/                 # starter data written to an empty Firestore
│   │   ├── products.json
│   │   └── enquiries.json
│   ├── uploads/              # images uploaded via the admin panel
│   └── src/
│       ├── app.js            # the Express app (shared by both entry points)
│       ├── index.js          # local dev server (npm start)
│       ├── functions.js      # Cloud Function entry (deployed)
│       ├── seed.js           # first-run seeding of an empty database
│       ├── db.js             # id + timestamp helpers
│       ├── auth.js           # JWT sign / verify / route guard
│       ├── storage/          # swappable persistence layer
│       │   ├── index.js      # picks json or firestore at startup
│       │   ├── json.js       # local files, atomic writes
│       │   └── firestore.js  # Cloud Firestore
│       └── routes/
│           ├── products.js   # public catalogue
│           ├── enquiries.js  # contact form (rate limited)
│           └── admin.js      # auth + product & enquiry CRUD + uploads
└── client/
    ├── public/
    │   ├── logo.svg
    │   └── images/products/  # product photos + generated artwork
    └── src/
        ├── main.jsx          # React entry
        ├── App.jsx           # routes
        ├── api.js            # API client + auth token storage
        ├── site.js           # phone / email / address in one place
        ├── index.css         # design tokens, buttons, forms, animations
        ├── styles.css        # page & component layout
        ├── hooks/            # useFetch, useDebounced, useReveal, …
        ├── components/       # Navbar, Footer, ProductCard, EnquiryFab, …
        └── pages/            # Home, Products, ProductDetail, About, Contact
            └── admin/        # AdminLogin, AdminDashboard, ProductForm
```

---

## API reference

Base URL `http://localhost:4000/api`

### Public
| Method | Endpoint | Notes |
|---|---|---|
| `GET` | `/health` | Service check |
| `GET` | `/products` | Optional `?category=`, `?featured=true`, `?q=`, `?inStock=true` |
| `GET` | `/products/categories` | Category list with counts |
| `GET` | `/products/:idOrSlug` | Full product + related products |
| `POST` | `/enquiries` | Contact form. Rate limited to 5 per IP / 10 min |

### Admin — send `Authorization: Bearer <token>`
| Method | Endpoint | Notes |
|---|---|---|
| `POST` | `/admin/login` | Returns a JWT |
| `GET` | `/admin/me` | Current user |
| `GET` | `/admin/stats` | Dashboard counters |
| `GET` `POST` | `/admin/products` | List / create |
| `PUT` `DELETE` | `/admin/products/:id` | Update / delete |
| `POST` | `/admin/upload` | Multipart field `image` |
| `GET` | `/admin/enquiries` | List enquiries |
| `PATCH` `DELETE` | `/admin/enquiries/:id` | Update status / delete |

---

## Product content

`server/data/products.json` holds the catalogue. Each product supports:

```jsonc
{
  "name": "Pasteurized Standardized Milk",
  "slug": "pasteurized-standardized-milk",
  "category": "Milk",
  "price": 56, "mrp": 62, "packSize": "500 ml", "fat": "4.5%",
  "rating": 4.7, "reviewCount": 1284,
  "shortDescription": "…",              // card + top of detail page
  "description": ["para 1", "para 2"],   // one array item per paragraph
  "images": ["/images/products/…"],     // first image is the main photo
  "highlights": ["100% pure & natural"],
  "features":  [{ "icon": "drop", "title": "…", "text": "…" }],
  "nutrition": [{ "label": "Fat", "value": "4.5%", "per": "of total" }],
  "usage": ["Tea, coffee and masala chai"],
  "faqs":     [{ "q": "…", "a": "…" }]
}
```

Feature icon keys: `drop`, `shield`, `nutrition`, `family`, `muscle`, `bone`,
`leaf`, `fire`, `snow`, `award`, `sparkle`, `truck`.

### The two hero products
Built from your own pack photos, so the copy matches what is on the pack:
- **Pasteurized Standardized Milk** — ₹56 / 500 ml, Fat 4.5%
- **High Protein Paneer** — ₹190 / 200 g, 18 g protein per 100 g

### The other six
Curd, Butter, Ghee, Cheddar Cheese, Rose Lassi and Fresh Cream were added so the
catalogue feels complete. They use brand-styled SVG artwork in
`client/public/images/products/generated/`. Replace them with real photos any
time — upload via the admin panel, or drop a file into that folder and set the
path in the editor.

---

## Adding your own images later

1. Put the file in `client/public/images/products/`
2. Admin panel → edit the product → **Add by path** →
   `/images/products/your-file.jpg`

Or just use **Upload Image** in the editor, which writes to `server/uploads/`.

---

## Deploying to Firebase

The whole site runs on Firebase: **Hosting** (React) + **Cloud Functions**
(Express API) + **Firestore** (database). The browser only ever talks to one
origin, because Hosting rewrites `/api/**` straight to the function.

```
Browser ──> Firebase Hosting ──┬──> /            → client/dist (static React)
                               └──> /api/**      → Cloud Function "api"
                                                       └──> Firestore
```

### One-time setup

```bash
npm run install:all                    # includes the Firebase CLI (dev dependency)
npx firebase login                      # opens a browser, sign in with Google
npx firebase use --add                  # pick or create your project
```

Put the project id in `.firebaserc` if `use --add` did not write it for you.

### Before your first deploy

Cloud Functions require the **Blaze (pay-as-you-go)** plan. You add a card, but
the free tier is generous and this small site will stay inside it:

| | Free allowance |
|---|---|
| Function invocations | 2,000,000 / month |
| Function compute | 400,000 GB-seconds / month |
| Firestore reads | 50,000 / day |
| Firestore writes | 20,000 / day |
| Hosting + SSL | unlimited |

Switch to Blaze in the Firebase console → **Build → Blaze** → *Upgrade*.

### Deploy

```bash
npm run deploy
```

That builds the React app and uploads three things:

- **Hosting** — `client/dist`, with SPA fallback and cache headers
- **Functions** — the Express API, region `asia-south1` (Mumbai)
- **Firestore** — the `firestore.rules` that lock the database to server-only access

The first request to the function seeds Firestore with the starter catalogue
from `server/seed/products.json` and creates the admin account, so the site is
populated immediately — no manual import step.

> **Do not put `PORT` in `server/.env`.** Cloud Functions reserves that key and
> the Firebase CLI will refuse to load the file, which stops the function from
> deploying at all. `npm start` falls back to port 4000 on its own.

To ship only one part while iterating:

```bash
npm run deploy:hosting   # frontend only
npm run deploy:api       # function only
npm run logs             # tail function logs
```

### Set the secrets the function needs

```bash
cd server
npx firebase functions:secrets:set JWT_SECRET
npx firebase functions:secrets:set ADMIN_PASSWORD
npx firebase functions:secrets:set ADMIN_EMAIL
```

Then reference them in `server/src/auth.js` / `app.js` via `defineSecret` if you
want them fully environment-driven. Until then the function falls back to the
values in `server/.env.example`, which is why `admin123` is the live password.

> **Note on the admin password.** The owner has chosen to keep `admin123`.
> That is a guessable password, so treat the admin panel as the softest point
> in the app: keep it off search engines, never share the login, and know that
> the endpoint is rate limited to **10 attempts per 15 minutes** per IP, so
> online guessing is slow and noisy. If you ever want to change it, set
> `ADMIN_PASSWORD` as a function secret and redeploy — no code change needed.

### After deploying

1. Your site is at `https://<project-id>.web.app`
2. Open **/admin** and sign in
3. Add your real product photos and correct the nutrition numbers

### Running the whole thing locally first (recommended)

```bash
npm run test:firebase
```

That boots the Firestore + Functions emulators, runs a 22-check smoke test
against the real deployed code path, and shuts down. It verifies seeding, the
catalogue, admin auth, product CRUD, enquiries and error handling — so problems
surface here rather than in production.

It needs **JDK 21+** on your PATH:

```bash
java -version   # must be 21 or newer
```

To browse the emulators by hand instead:

```bash
npm run emulators    # Firestore UI + Functions on http://localhost:4400
```

### Storage switch

`server/src/storage/` picks a backend at startup:

| `STORAGE` | Backend | Used by |
|---|---|---|
| unset / `json` | JSON files in `server/data` | `npm run dev` |
| `firestore` | Cloud Firestore | the deployed function |

The deployed function auto-detects the Cloud Functions runtime and uses
Firestore, so it can never accidentally write to a temporary disk.

---

## Production on any other host

```bash
npm run build     # builds the React app to client/dist
npm start         # starts the Express API
```

Serve `client/dist` from any static host and run the API on a Node host.
Configure the static host to fall back to `index.html` for unknown paths, and
either proxy `/api` to the Node server or set `VITE_API_BASE` at build time.
Set `STORAGE=json` and mount a **persistent disk** at `server/data`, otherwise
your products reset whenever the host restarts.

---

## Content disclaimer

Nutrition figures in the catalogue are **indicative values** written for the
demo. Before going live, replace them with the exact numbers from your printed
pack labels — or remove the Nutrition tab. A note to this effect already appears
in the product footer and on the nutrition tab.
