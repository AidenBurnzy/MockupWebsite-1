import { PRODUCTS } from '@/lib/site-data'

/**
 * Server-side authoritative pricing.
 *
 * The cart lives in localStorage and its prices are DISPLAY ONLY — never trust
 * them for charging. resolveCartAmount() re-derives every line's price from the
 * hardcoded PRODUCTS catalog so a tampered client price can't change what we
 * charge. Cart item ids are either `${productId}` (no variant) or
 * `${productId}-${size}` (e.g. `sheri-necklace-16"`).
 */

function priceToCents(p: string): number {
  const n = Number(String(p).replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

export interface CheckoutLine {
  id: string
  title: string
  qty: number
  unitCents: number
  lineCents: number
}

export interface ResolvedCart {
  lines: CheckoutLine[]
  totalCents: number
}

/** Re-price the cart from the catalog. Unknown/zero-price ids are dropped. */
export function resolveCartAmount(items: { id: string; qty: number }[]): ResolvedCart {
  const lines: CheckoutLine[] = []

  for (const item of Array.isArray(items) ? items : []) {
    if (!item || typeof item.id !== 'string') continue
    const qty = Math.max(1, Math.floor(Number(item.qty) || 1))

    // Match the product whose id equals the cart id or is its prefix.
    const product = PRODUCTS.find(
      (p) => item.id === p.id || item.id.startsWith(p.id + '-'),
    )
    if (!product) continue

    let unitCents = 0
    let title = product.name

    if (item.id === product.id) {
      unitCents = priceToCents(product.price)
    } else {
      const size = item.id.slice(product.id.length + 1)
      const variant = product.variants?.find((v) => v.size === size)
      if (variant) {
        unitCents = priceToCents(variant.price)
        title = `${product.name} (${size})`
      } else {
        // size suffix didn't match a real variant — fall back to base price
        unitCents = priceToCents(product.price)
      }
    }

    if (unitCents <= 0) continue
    lines.push({ id: item.id, title, qty, unitCents, lineCents: unitCents * qty })
  }

  const totalCents = lines.reduce((sum, l) => sum + l.lineCents, 0)
  return { lines, totalCents }
}
