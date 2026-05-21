# NOMA — NGF Client Site

This repo was scaffolded from `ngf-client-starter` and converted from a plain HTML mockup to a full Next.js site. The NGF portal editor at `app.ngfsystems.com` is wired up — every editable element on every page can be managed from the portal without a code change.

## Read this first

The universal foundation for every NGF client website is:

- **In-repo copy:** `NGF-STANDARDS.md` (this repo)
- **Canonical source:** `NorthCoveBuilders-Mockup/NGF-STANDARDS.md` (if this copy is stale)

That doc has the full tech-stack rules, NGF editor integration spec, setup checklist, and known gotchas.

**Read it before writing any code.** This file only covers NOMA-specific overrides.

---

## Setup checklist

- [ ] `npm install` (first time)
- [ ] Set `NEXT_PUBLIC_SITE_URL` in Vercel env vars to the client's domain (e.g. `noma-jewelry.com`)
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
| `components/NgfEditBridge.tsx` | Bridge to the portal live editor. Don't modify in isolation — sync from NorthCove. |
| `app/layout.tsx` | Mounts NgfEditBridge, CartProvider, Header, Footer. Calls `getNgfContent()`. |
| `next.config.ts` | CSP `frame-ancestors` header + image domain allowlist |
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
| Static assets | ⚠️ Not moved | `assets/` folder needs to be copied to `public/assets/` for logos to load |
| `NEXT_PUBLIC_SITE_URL` | ⚠️ Not set | Must be set before the portal content API can deliver content |
| NGF admin `site_url` | ⚠️ Not set | Set in admin → Clients → this client's config, must match NEXT_PUBLIC_SITE_URL |
| Checkout | ❌ Not implemented | Cart is demo-only; no real payment processing |
| Contact email | ⚠️ Placeholder | `hero.contactEmail` defaults to `mailto:hello@noma.com` — update via portal |
| Product reviews | ⚠️ Placeholder | All review text is placeholder; swap via portal editor |
