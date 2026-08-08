/**
 * Shipping and tax — the ONE place either is decided.
 *
 * Every displayed number and every charged number derives from here, so the
 * total the customer sees is provably the total they are charged. Do not
 * compute shipping or tax anywhere else.
 *
 * ── NICK: CONFIRM THESE TWO BEFORE THE FIRST REAL ORDER ────────────────────
 * Both values below are assumptions, chosen to match what the site already
 * promises customers. They are almost certainly close, but they are money, so
 * they need your explicit sign-off (and the tax one needs an accountant).
 */

/**
 * ASSUMPTION 1 — free-shipping threshold.
 * Taken from the site's own announcement banner (app/layout.tsx):
 *   "Complimentary shipping over $100 | Personalization available"
 * If you change the banner in the portal editor, change this to match or the
 * site will promise one thing and charge another.
 */
export const FREE_SHIPPING_THRESHOLD_CENTS = 10_000

/** ASSUMPTION 2 — flat shipping rate below that threshold. Nothing on the site
 *  states a rate today, so this is a placeholder. Set it to what postage on a
 *  small padded envelope actually costs you. */
export const FLAT_SHIPPING_CENTS = 799

/**
 * ASSUMPTION 3 — sales tax.
 *
 * NOMA is a Michigan business, and Michigan is a flat 6% state rate with no
 * local add-ons, which is why this is a single number rather than a rate table.
 * Tax is charged ONLY on Michigan destinations — that is the origin-state
 * default and is right until NOMA crosses another state's economic-nexus
 * threshold, which is a long way off at this volume.
 *
 * CONFIRM WITH AN ACCOUNTANT, specifically: is shipping taxable in Michigan?
 * This code says YES (tax is applied to goods + shipping), which is the common
 * reading for delivery charges on taxable goods. If they say no, remove
 * `shippingCents` from the taxable base in quote() below — a one-line change.
 */
export const TAX_STATE = 'MI'
export const TAX_RATE_PERCENT = 6

export interface Quote {
  subtotalCents: number
  shippingCents: number
  taxCents: number
  totalCents: number
}

/**
 * Compute the full price of an order.
 *
 * `state` is the SHIPPING destination's 2-letter code, or null before the
 * customer has entered an address — in which case tax is not yet known and
 * shows as zero. The checkout must therefore re-quote once the address is
 * complete, and the server always re-quotes authoritatively before charging.
 */
export function quote(subtotalCents: number, state: string | null): Quote {
  const shippingCents =
    subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS || subtotalCents === 0
      ? 0
      : FLAT_SHIPPING_CENTS

  const taxable = (state ?? '').trim().toUpperCase() === TAX_STATE
  // Rounded once, at the end, on the combined base. Rounding per line and
  // summing drifts from what Square's own tax engine computes.
  const taxCents = taxable
    ? Math.round(((subtotalCents + shippingCents) * TAX_RATE_PERCENT) / 100)
    : 0

  return {
    subtotalCents,
    shippingCents,
    taxCents,
    totalCents: subtotalCents + shippingCents + taxCents,
  }
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}
