import { PRODUCTS } from '@/lib/site-data'

/**
 * Server-side authoritative pricing.
 *
 * The cart lives in localStorage and its prices are DISPLAY ONLY — never trust
 * them for charging. resolveCart() re-derives every line's price from the
 * hardcoded PRODUCTS catalog, so a tampered client price cannot change what we
 * charge. Cart item ids are either `${productId}` or `${productId}-${size}`
 * (e.g. `sheri-necklace-16"`).
 *
 * IT FAILS CLOSED. Every previous version of this function silently dropped or
 * silently re-priced anything it did not recognise, which is the wrong default
 * for money — a cart that cannot be priced exactly should refuse to be charged,
 * not be charged a number nobody chose. Two concrete bugs that came from
 * failing open:
 *
 *   1. An unmatched size suffix fell back to the product's BASE price. Base
 *      prices in this catalog are strings like "From $39", so a 20" necklace
 *      that should cost $49 would have been charged $39. Undercharging, silently.
 *   2. Unknown ids were dropped from the cart entirely, so the customer was
 *      charged for less than their basket showed and had no idea.
 *
 * Both now reject the whole order with a reason.
 */

/**
 * A base price may be a range ("From $39"), which is a MARKETING string, not a
 * chargeable amount. Anything not a single unambiguous price is refused.
 */
function exactPriceToCents(raw: string): number | null {
  const text = String(raw).trim()
  // "From $39", "$39–$49", "$39 - $49" — all ambiguous, all refused.
  if (/from|to|–|—|\bor\b/i.test(text)) return null
  const matches = text.match(/\d+(?:\.\d+)?/g)
  if (!matches || matches.length !== 1) return null
  const n = Number(matches[0])
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n * 100)
}

export interface CheckoutLine {
  id: string
  sku: string
  title: string
  variant: string | null
  qty: number
  unitCents: number
  lineCents: number
  imageUrl: string | null
  customization: string | null
}

export type ResolvedCart =
  | { ok: true; lines: CheckoutLine[]; subtotalCents: number }
  | { ok: false; reason: string }

/** Per-line and per-order caps. A jewelry order is small; anything past these
 *  is a mistake or an attack, and either way is worth a human look. */
const MAX_QTY_PER_LINE = 20
const MAX_LINES = 50

export interface IncomingItem {
  id: string
  qty: number
  /** Free-text engraving for this line, if the buyer asked for one. */
  customization?: string | null
}

export function resolveCart(items: IncomingItem[]): ResolvedCart {
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, reason: 'Your cart is empty.' }
  }
  if (items.length > MAX_LINES) {
    return { ok: false, reason: 'That is too many different items for one order.' }
  }

  const lines: CheckoutLine[] = []

  for (const item of items) {
    if (!item || typeof item.id !== 'string') {
      return { ok: false, reason: 'Your cart contains an invalid item.' }
    }

    // Integer, at least 1, capped. Rejects negatives, zero, fractions and NaN
    // rather than coercing them — a negative qty against a positive one is how
    // you build a cart that totals less than it should.
    const qty = Number(item.qty)
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_LINE) {
      return { ok: false, reason: 'One of the quantities in your cart is not valid.' }
    }

    const product = PRODUCTS.find(
      (p) => item.id === p.id || item.id.startsWith(p.id + '-'),
    )
    if (!product) {
      return { ok: false, reason: 'One of the items in your cart is no longer available.' }
    }

    let unitCents: number | null
    let title = product.name
    let variant: string | null = null

    if (item.id === product.id) {
      // No variant chosen. Only chargeable if the product has ONE unambiguous
      // price — a product with variants has no single price, so requiring a
      // choice is correct rather than guessing the cheapest.
      if (product.variants && product.variants.length > 0) {
        return { ok: false, reason: `Please choose a size for ${product.name}.` }
      }
      unitCents = exactPriceToCents(product.price)
    } else {
      const size = item.id.slice(product.id.length + 1)
      const match = product.variants?.find((v) => v.size === size)
      if (!match) {
        // Previously this fell through to the base price. Now it refuses.
        return { ok: false, reason: `That size is no longer available for ${product.name}.` }
      }
      unitCents = exactPriceToCents(match.price)
      title = product.name
      variant = size
    }

    if (unitCents === null) {
      return { ok: false, reason: `We could not price ${product.name}. Please contact us to order.` }
    }

    const customization =
      typeof item.customization === 'string' && item.customization.trim()
        ? item.customization.trim().slice(0, 200)
        : null

    lines.push({
      id: item.id,
      sku: product.id,
      title,
      variant,
      qty,
      unitCents,
      lineCents: unitCents * qty,
      imageUrl: product.image ?? null,
      customization,
    })
  }

  const subtotalCents = lines.reduce((sum, l) => sum + l.lineCents, 0)
  if (subtotalCents <= 0) {
    return { ok: false, reason: 'Your cart total is zero.' }
  }

  return { ok: true, lines, subtotalCents }
}
