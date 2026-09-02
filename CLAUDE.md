# NOMA — NGF Client Site

This repo was scaffolded from `ngf-client-starter` and converted from a plain HTML mockup to a full Next.js site. The NGF portal editor at `app.ngfsystems.com` is wired up — every editable element on every page can be managed from the portal without a code change.

## Read this first

The universal foundation for every NGF client website is:

- **Canonical source — always fetch this, never keep a copy:**
  https://raw.githubusercontent.com/Nick-NGFsystems/ngf-client-starter/main/NGF-STANDARDS.md

This repo used to carry its own `NGF-STANDARDS.md`. It has been deleted: it was
frozen at this site's initial build while the canonical doc kept moving, so it
was stale by definition and `npm run doctor` fails a fork that keeps one. The
old pointer here also named `NorthCoveBuilders-Mockup`, which is no longer the
source.

That doc has the full tech-stack rules, NGF editor integration spec, setup checklist, and known gotchas.

**Read it before writing any code.** This file only covers NOMA-specific overrides.

---

## Setup checklist

- [ ] `npm install` (first time)
- [ ] Set `NEXT_PUBLIC_SITE_URL` in Vercel env vars to the client's domain (`noelleandmary.com`)
- [ ] Set `NGF_APP_URL` (optional — defaults to `https://app.ngfsystems.com`)
- [ ] In the NGF admin portal, set this client's `site_url` field to match `NEXT_PUBLIC_SITE_URL` exactly
- [ ] Deploy to Vercel
- [ ] Open the client's portal editor — verify every annotated field shows up in the sidebar
- [ ] Move `assets/` folder contents to `public/assets/` (logos, images) — Next.js serves static files from `public/`

---

## Stack

| Layer | Tool | Version |
|---|---|---|
| Framework | Next.js App Router | 16.1.6 |
| Runtime | React | 19.2.3 |
| Language | TypeScript | always |
| Styling | Tailwind CSS | 4.x |
| Deployment | Vercel | — |

No database. No auth. Pure content site — all data comes from the NGF portal content API and hardcoded fallbacks in `lib/site-data.ts`.

---

## What's wired up

| File | Purpose |
|---|---|
| `lib/ngf.ts` | `getNgfContent()` + `getItems()` — fetch published content from the NGF portal. Don't modify. |
| `components/NgfEditBridge.tsx` | Bridge to the portal live editor. Canonical — never hand-edit; run `npm run sync-ngf` (source: `ngf-client-starter`). |
| `app/layout.tsx` | Mounts NgfEditBridge, CartProvider, Header, Footer. Calls `getNgfContent()`. |
| `next.config.ts` | Full security-header baseline in ONE CSP entry (frame-ancestors merged in) with Square's origins allowed + image domain allowlist |
| `components/CartProvider.tsx` | localStorage cart state shared across components |
| `lib/site-data.ts` | Hardcoded fallback data for products, bundles, reviews |

---

## Adding editable content

1. Add a hardcoded fallback in the server component: `const headline = content['hero.headline'] || 'Default'`
2. Add all four `data-ngf-*` attributes to the rendered element
3. Deploy — the editor sidebar auto-discovers the field

**Always use `||`, never `??` for fallbacks.** Published content can be an empty string; `??` won't catch that.

---

## Static assets

The `assets/` folder (logos, images) from the original HTML mockup needs to be moved to `public/assets/` for Next.js to serve them. The image tags in the app reference `/assets/logos/...` paths.

To do this locally:
```bash
# From the repo root:
cp -r assets public/assets
```

---

## Key editable content map (data-ngf fields)

| Field key | Where | Type |
|---|---|---|
| `brand.announcementText` | Header banner | text |
| `brand.footerTagline` | Footer | text |
| `hero.eyebrow` | Homepage hero | text |
| `hero.headline` | Homepage hero | text |
| `hero.lede` | Homepage hero | textarea |
| `hero.image` | Homepage hero | image |
| `hero.engravingTagline/Title/Body` | Homepage hero callout | text/textarea |
| `hero.contactEmail` | Contact CTA href | text |
| `bestSellers.items.N.*` | Homepage best sellers | group |
| `reviews.eyebrow/headline` | Homepage reviews | text |
| `reviews.items.N.*` | Homepage reviews | group |
| `bundles.eyebrow/headline` | Homepage + products | text |
| `bundles.items.N.*` | Homepage + products bundles | group |
| `founder.eyebrow/headline/body/signature/image` | Homepage founder section | text/image |
| `products.eyebrow/lede` | Products page | text |
| `products.items.N.*` | Products page grid | group |
| `engraving.eyebrow/headline/lede` | Products engraving section | text/textarea |

---

## Interactive client components

| Component | Behavior |
|---|---|
| `components/CartProvider.tsx` | localStorage cart context (addItem, updateQty) |
| `components/layout/Header.tsx` | Mobile nav toggle, cart count badge |
| `components/home/BestSellersGrid.tsx` | Product modal + add to cart |
| `components/products/ProductGrid.tsx` | Filter/sort, product modal, add to cart |
| `components/products/EngravingPreview.tsx` | Live text + font preview on tag image |
| `components/cart/CartPageClient.tsx` | Full cart display with qty controls |

---

## Known Gaps / Integration Checklist

| Area | Status | Notes |
|---|---|---|
| Static assets | ✅ Moved | `public/assets/` holds logos + product photos (30 files). |
| Checkout | ✅ Built + sandbox-tested | Square Web Payments SDK at `/checkout`; `/api/checkout` re-prices server-side, creates a Square order, charges, then reports to the portal. A real sandbox order reached NOMA's portal. Needs production Square keys to take real money. |
| `NEXT_PUBLIC_SITE_URL` | ✅ Correct locally / ⚠️ absent in Vercel | `noelleandmary.com` in `.env.local`, matching the portal binding. NOT set in Vercel, so the deployed site falls back to `VERCEL_PROJECT_PRODUCTION_URL` (`noma-mockup.vercel.app`), which resolves to no client — the deploy currently ignores all published content and would refuse orders. |
| NGF admin `site_url` | ✅ `noelleandmary.com` | Both apex and `www` resolve to client `cmrkupuik0001…` with 19 published keys. `noma-mockup.vercel.app` resolves to nothing — anything still pointing there is silently broken. |
| Store settings (shipping/tax) | ❌ Not configured | Nothing set in the portal's Store tab, so `quote()` falls back to zeroes — every order ships free and untaxed. Set before launch. |
| Vercel env vars | ⚠️ Not set | `.env.local` does not deploy. All 11 vars from `.env.local.example` must exist in Vercel, and `NEXT_PUBLIC_*` before the build runs. |
| Test orders | ⚠️ Present | Sandbox test orders sit in NOMA's portal looking like real sales — delete via the admin orders route before handover. Counts have differed between the portal view and a direct DB query, so check the portal itself rather than trusting a remembered number. |
| Contact email | ⚠️ Placeholder | `hero.contactEmail` defaults to `mailto:hello@noma.com` — update via portal. |
| Product reviews | ⚠️ Placeholder | All review text is placeholder; swap via portal editor. |
