import { siteDomain } from '@/lib/ngf-order'

/**
 * Store settings + order pricing — CANONICAL. Byte-identical on every NGF site.
 *
 * Do not hand-edit. Shipping and tax are owned by the CLIENT in their portal
 * (Store Settings), fetched here at request time, and the quote() below must
 * match the platform's copy exactly — NGF re-checks the arithmetic when the
 * order is reported, so a drifted formula is rejected rather than silently
 * charged.
 *
 * Everything a business should be able to change about how it charges lives in
 * the portal, not in this repo. Never hardcode a shipping rate or a tax rate in
 * a client site again.
 */

export interface TaxRule {
  state: string
  ratePercent: number
}

export interface StoreSettings {
  currency: string
  shippingFlatCents: number
  /** Null = shipping is never free. */
  shippingFreeOverCents: number | null
  shippingLabel: string
  taxRules: TaxRule[]
  taxAppliesShipping: boolean
  policyReturns: string | null
  policyShipping: string | null
}

/**
 * Used when the portal is unreachable or nothing has been configured.
 *
 * ZEROES, DELIBERATELY. Charging nothing extra is a recoverable mistake that
 * costs postage; charging a number nobody configured is not recoverable and
 * looks like fraud to the customer. Under-charging fails safe here.
 */
export const FALLBACK_SETTINGS: StoreSettings = {
  currency: 'USD',
  shippingFlatCents: 0,
  shippingFreeOverCents: null,
  shippingLabel: 'Shipping',
  taxRules: [],
  taxAppliesShipping: true,
  policyReturns: null,
  policyShipping: null,
}

/**
 * Read the store's settings from the portal.
 *
 * ISR-cached for 60s with a tag, exactly like getNgfContent() — the settings
 * change rarely, and hitting the portal on every checkout render would put an
 * external service on the critical path of a sale.
 *
 * NEVER THROWS. A portal outage falls back to zeroes rather than blocking
 * checkout.
 */
export async function getStoreSettings(): Promise<StoreSettings> {
  try {
    const base = process.env.NGF_APP_URL || 'https://app.ngfsystems.com'
    const domain = siteDomain()
    if (!domain) return FALLBACK_SETTINGS

    const res = await fetch(
      `${base}/api/public/store-settings?domain=${encodeURIComponent(domain)}`,
      { next: { revalidate: 60, tags: ['ngf-store-settings'] } },
    )
    if (!res.ok) return FALLBACK_SETTINGS

    const json = (await res.json()) as { settings?: Partial<StoreSettings> }
    return { ...FALLBACK_SETTINGS, ...(json.settings ?? {}) }
  } catch {
    return FALLBACK_SETTINGS
  }
}

export interface Quote {
  subtotalCents: number
  shippingCents: number
  taxCents: number
  totalCents: number
}

/**
 * THE canonical quote. Mirrored in the NGF app as quoteOrder() in
 * lib/store-settings.ts; NGF re-checks the arithmetic identity when the order is
 * reported, so a drifted copy is caught rather than silently charged.
 *
 * `state` is the SHIPPING destination, or null before an address is entered — in
 * which case tax is not yet knowable and reads as zero.
 */
export function quote(
  subtotalCents: number,
  state: string | null,
  settings: StoreSettings,
): Quote {
  const freeOver = settings.shippingFreeOverCents
  const shippingCents =
    subtotalCents === 0 || (freeOver !== null && subtotalCents >= freeOver)
      ? 0
      : settings.shippingFlatCents

  const destination = (state ?? '').trim().toUpperCase()
  const rule = settings.taxRules.find((r) => r.state === destination)
  const base = settings.taxAppliesShipping ? subtotalCents + shippingCents : subtotalCents
  // Rounded once at the end. Rounding per line and summing drifts from what
  // Square's own tax engine computes, and a one-cent disagreement is rejected
  // as PAYMENT_AMOUNT_MISMATCH.
  const taxCents = rule ? Math.round((base * rule.ratePercent) / 100) : 0

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
