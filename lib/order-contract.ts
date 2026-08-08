/**
 * OrderReportV1 — the normalized order every NGF storefront POSTs to
 * `POST {NGF_APP_URL}/api/public/orders` once a payment has settled.
 *
 * PROVIDER-AGNOSTIC BY CONSTRUCTION. Nothing below is Square-shaped. A future
 * Stripe or PayPal storefront fills the same fields from its own SDK and the
 * NGF side needs no changes: `payment.provider` is a label, and every provider
 * id is an opaque string NGF stores and displays but never calls.
 *
 * That is the whole reason the integration point is the SITE and not NGF. Each
 * storefront already holds its own payment credentials; NGF holds none, and so
 * never becomes a place where client payment keys accumulate.
 *
 * This file is duplicated verbatim in the NGF app as `lib/order-contract.ts`.
 * A copy rather than a shared package because these repos have no shared build
 * — and `version` below is what catches the copies drifting apart.
 */

export interface OrderLineV1 {
  /** Stable catalog id, so "what sold" survives a product being renamed. */
  sku: string
  /** Title AS SOLD, snapshotted — the order should read the way the buyer saw it. */
  title: string
  /** e.g. `18"`. Separate from title so a pick list can column it. */
  variant: string | null
  qty: number
  /** Integer cents. Both sent so NGF never does money arithmetic of its own. */
  unitCents: number
  lineCents: number
  /**
   * What to engrave. The single most important field here for NOMA: the site
   * advertises personalization, and without this a buyer can order an engraved
   * piece and nothing anywhere records what it should say.
   */
  customization: string | null
  /** Absolute URL, so the portal can render a visual pick list. */
  imageUrl: string | null
}

export interface OrderReportV1 {
  /** Bump on any breaking change. NGF rejects unknown versions loudly rather
   *  than silently mis-parsing an order somebody has already paid for. */
  version: 1

  /** Bare host of the storefront. Resolves to a client via the same
   *  domain→client binding the content and lead APIs already use. */
  domain: string

  /** The storefront's own order id, STABLE ACROSS RETRIES. This is the dedupe
   *  key — NGF holds a unique index on (client_id, order_ref), which is what
   *  makes reporting safe to retry. Kept ≤ 40 chars so it also fits Square's
   *  `reference_id` limit. */
  orderRef: string

  /** PENDING is written BEFORE the charge, PAID after it settles. A PENDING row
   *  that never became PAID is the alarm that money may have moved without
   *  being recorded — see the ordering notes in app/api/checkout/route.ts. */
  status: 'PENDING' | 'PAID' | 'FAILED'

  /** RFC 3339 UTC — when the buyer submitted, not when NGF received it, which
   *  can be later after retries. */
  placedAt: string

  currency: string

  customer: {
    name: string
    /** Required. An order NGF cannot email is an order somebody has to chase. */
    email: string
    /** Carriers need it for delivery exceptions, and Square's fulfillment
     *  recipient wants it too. */
    phone: string | null
  }

  /** Null only for pickup or digital orders. A physical order always has one. */
  shipping: {
    /** Buyer-facing label of the method chosen. Free text — carrier service
     *  taxonomies are not portable between providers. */
    method: string
    address: {
      line1: string
      line2: string | null
      city: string
      state: string
      postalCode: string
      /** ISO 3166 alpha-2. */
      country: string
    }
    /** Gift note or delivery instructions. */
    note: string | null
  } | null

  /** Non-empty. What to pull off the shelf. */
  lines: OrderLineV1[]

  /** All integer cents, sent rather than derived: the charging system's
   *  arithmetic is authoritative and NGF must never disagree with the receipt.
   *  NGF asserts subtotal − discount + shipping + tax === total and rejects a
   *  mismatch, because a report that does not add up is a bug or a forgery. */
  totals: {
    subtotalCents: number
    discountCents: number
    shippingCents: number
    taxCents: number
    totalCents: number
  }

  payment: {
    /** 'square' | 'stripe' | … A label. NGF branches on nothing. */
    provider: string
    status: 'PENDING' | 'COMPLETED' | 'FAILED'
    /** Opaque ids, so a human can jump from the portal to the provider's own
     *  dashboard. NGF never calls the provider with them. */
    providerOrderId: string | null
    providerPaymentId: string | null
    receiptUrl: string | null
    /** Display-only card identity, for "the Visa ending 4242" in a dispute.
     *  Brand and last four are non-sensitive; NOTHING else about a card ever
     *  appears in this contract, and the NGF ingest rejects payloads containing
     *  card-shaped keys outright. */
    cardBrand: string | null
    cardLast4: string | null
    amountCents: number
  }
}

/** Keys that must never appear anywhere in a report. Enforced on both ends. */
export const FORBIDDEN_KEY_PATTERN =
  /card_?number|\bpan\b|cvv|cvc|exp_?month|exp_?year|source_id|nonce|access_?token|secret/i

/** True when the money adds up. Both the sender and NGF check this. */
export function totalsBalance(t: OrderReportV1['totals']): boolean {
  return (
    t.subtotalCents - t.discountCents + t.shippingCents + t.taxCents === t.totalCents
  )
}
