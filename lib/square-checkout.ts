import type { CheckoutLine } from '@/lib/checkout'

/**
 * Square Orders + Payments.
 *
 * WHY AN ORDER AND NOT JUST A PAYMENT. The previous version charged a bare
 * amount with the note "NOMA order — 2 item(s)". Square therefore knew a sum of
 * money and nothing else: not what was bought, not the size, not the engraving,
 * not where to ship it. A paid order that cannot be fulfilled is worse than no
 * order.
 *
 * Creating a real Order first means SQUARE holds everything needed to fulfil —
 * line items, quantities, the shipping recipient and address. That is what makes
 * the downstream report to NGF best-effort rather than load-bearing: if NGF is
 * unreachable, Nick can still ship from the Square Dashboard alone.
 *
 * Square's own condition, quoted from their docs: "An order appears in the
 * Square Dashboard or Square products if both the following conditions are true:
 * The order includes fulfillment. The order is paid." So the fulfillment block
 * is not optional decoration — without it the order is invisible to the merchant.
 */

const HOST =
  process.env.SQUARE_ENVIRONMENT === 'production'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com'

// Pinned. SHIPMENT fulfillments and shipment_details are Beta in Square's API,
// so the version this was written against is stated explicitly rather than
// floating — a silent Beta rename would otherwise break checkout in production.
const SQUARE_VERSION = '2025-01-23'

export interface ShippingAddress {
  line1: string
  line2: string | null
  city: string
  state: string
  postalCode: string
  country: string
}

export interface Customer {
  name: string
  email: string
  phone: string
  address: ShippingAddress
  note: string | null
}

export type SquareResult<T> =
  | { ok: true; data: T }
  | { ok: false; kind: 'declined' | 'config' | 'server' | 'network'; message: string }

function auth() {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN
  const locationId = process.env.SQUARE_LOCATION_ID
  return { accessToken, locationId }
}

/**
 * Classify a Square error.
 *
 * BRANCH ON `errors[0].category`, NEVER ON HTTP STATUS. This is the single most
 * important detail in Square's error model: a declined card, a CVV failure and
 * a PAYMENT_AMOUNT_MISMATCH (which is OUR bug, not the buyer's) all come back as
 * HTTP 400. Treating 400 as "bad card" would tell a customer their perfectly
 * good card was declined because we miscalculated a total.
 */
function classify(body: unknown): { kind: 'declined' | 'config' | 'server'; message: string } {
  const errors = (body as { errors?: { category?: string; code?: string; detail?: string }[] })?.errors
  const first = errors?.[0]
  const category = first?.category ?? ''

  if (category === 'PAYMENT_METHOD_ERROR') {
    // Safe to show the buyer — it is about their card, and Square's wording is
    // already customer-appropriate.
    return { kind: 'declined', message: first?.detail || 'Your card was declined. Please try another card.' }
  }
  if (category === 'AUTHENTICATION_ERROR' || category === 'INVALID_REQUEST_ERROR') {
    // Our fault: bad token, bad location, malformed body, amount mismatch.
    // NEVER surfaced verbatim — Square's detail here leaks internals.
    return { kind: 'config', message: first?.detail || 'Request rejected by the payment processor.' }
  }
  return { kind: 'server', message: first?.detail || 'The payment processor returned an error.' }
}

async function squareFetch<T>(
  path: string,
  body: unknown,
): Promise<SquareResult<T>> {
  const { accessToken } = auth()
  if (!accessToken) {
    return { ok: false, kind: 'config', message: 'Square access token is not configured.' }
  }

  let res: Response
  try {
    res = await fetch(`${HOST}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Square-Version': SQUARE_VERSION,
      },
      body: JSON.stringify(body),
    })
  } catch {
    // Genuinely did not reach Square, OR reached it and the response was lost.
    // The caller must treat this as UNKNOWN, never as "not charged".
    return { ok: false, kind: 'network', message: 'Could not reach the payment processor.' }
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const { kind, message } = classify(data)
    console.error('[square] request failed', { path, status: res.status, errors: (data as { errors?: unknown }).errors })
    return { ok: false, kind, message }
  }
  return { ok: true, data: data as T }
}

interface SquareOrder {
  id: string
  total_money?: { amount?: number; currency?: string }
}

/**
 * Create the order. Square computes tax and totals from what we send, and its
 * arithmetic — not ours — is authoritative for the charge.
 */
export async function createOrder(args: {
  idempotencyKey: string
  orderRef: string
  lines: CheckoutLine[]
  shippingCents: number
  shippingLabel: string
  /** The tax rule that applies to THIS destination, already resolved from the
   *  client's portal settings. Null when the destination is not taxed. */
  tax: { name: string; ratePercent: number } | null
  /** Whether tax applies to the shipping charge — a per-state, per-client
   *  decision, so it comes from settings rather than being assumed here. */
  taxAppliesShipping: boolean
  customer: Customer
}): Promise<SquareResult<{ orderId: string; totalCents: number }>> {
  const { locationId } = auth()
  if (!locationId) {
    return { ok: false, kind: 'config', message: 'Square location is not configured.' }
  }

  const result = await squareFetch<{ order: SquareOrder }>('/v2/orders', {
    idempotency_key: args.idempotencyKey,
    order: {
      location_id: locationId,
      reference_id: args.orderRef,
      line_items: args.lines.map((line, index) => ({
        uid: `line-${index}`,
        name: line.title,
        // Quantity is a STRING in Square's API, max 12 chars. Sending a number
        // is rejected.
        quantity: String(line.qty),
        base_price_money: { amount: line.unitCents, currency: 'USD' },
        ...(line.variant ? { variation_name: line.variant } : {}),
        // The engraving travels with the line it belongs to, so it is visible
        // on the Square Dashboard order without cross-referencing anything.
        ...(line.customization ? { note: `Engraving: ${line.customization}`.slice(0, 500) } : {}),
      })),
      ...(args.tax
        ? {
            taxes: [
              {
                uid: 'sales-tax',
                name: args.tax.name,
                percentage: String(args.tax.ratePercent),
                scope: 'ORDER',
                type: 'ADDITIVE',
              },
            ],
          }
        : {}),
      ...(args.shippingCents > 0
        ? {
            service_charges: [
              {
                uid: 'shipping',
                name: args.shippingLabel,
                amount_money: { amount: args.shippingCents, currency: 'USD' },
                // SUBTOTAL_PHASE adds shipping BEFORE tax, so tax applies to it.
                // TOTAL_PHASE adds it after, leaving it untaxed. Which is correct
                // varies by state, so the client chooses it in their portal.
                calculation_phase: args.taxAppliesShipping ? 'SUBTOTAL_PHASE' : 'TOTAL_PHASE',
              },
            ],
          }
        : {}),
      // Without a fulfillment the order never shows in the Square Dashboard.
      // All four recipient fields are sent because Square's own reference and
      // its guide disagree about which are required — sending all four
      // satisfies both readings.
      fulfillments: [
        {
          uid: 'ship-1',
          type: 'SHIPMENT',
          state: 'PROPOSED',
          shipment_details: {
            recipient: {
              display_name: args.customer.name,
              email_address: args.customer.email,
              phone_number: args.customer.phone,
              address: {
                address_line_1: args.customer.address.line1,
                ...(args.customer.address.line2
                  ? { address_line_2: args.customer.address.line2 }
                  : {}),
                locality: args.customer.address.city,
                administrative_district_level_1: args.customer.address.state,
                postal_code: args.customer.address.postalCode,
                country: args.customer.address.country,
              },
            },
            ...(args.customer.note ? { shipping_note: args.customer.note.slice(0, 500) } : {}),
          },
        },
      ],
    },
  })

  if (!result.ok) return result

  const order = result.data.order
  const totalCents = order?.total_money?.amount
  if (!order?.id || typeof totalCents !== 'number') {
    return { ok: false, kind: 'server', message: 'The payment processor returned an incomplete order.' }
  }
  return { ok: true, data: { orderId: order.id, totalCents } }
}

interface SquarePayment {
  id: string
  status?: string
  receipt_url?: string
  card_details?: { card?: { card_brand?: string; last_4?: string } }
}

/**
 * Charge the order.
 *
 * `amountCents` MUST be read back from the CreateOrder response, never
 * recomputed here — any rounding disagreement with Square's tax engine produces
 * PAYMENT_AMOUNT_MISMATCH, which arrives as an HTTP 400 that looks like a
 * declined card.
 */
export async function createPayment(args: {
  idempotencyKey: string
  sourceId: string
  orderId: string
  orderRef: string
  amountCents: number
  buyerEmail: string
}): Promise<SquareResult<{
  paymentId: string
  status: string
  receiptUrl: string | null
  cardBrand: string | null
  cardLast4: string | null
}>> {
  const { locationId } = auth()
  if (!locationId) {
    return { ok: false, kind: 'config', message: 'Square location is not configured.' }
  }

  const result = await squareFetch<{ payment: SquarePayment }>('/v2/payments', {
    // Square caps this at 45 characters.
    idempotency_key: args.idempotencyKey.slice(0, 45),
    source_id: args.sourceId,
    order_id: args.orderId,
    location_id: locationId,
    amount_money: { amount: args.amountCents, currency: 'USD' },
    autocomplete: true,
    buyer_email_address: args.buyerEmail,
    reference_id: args.orderRef.slice(0, 40),
    note: `NOMA web order ${args.orderRef}`.slice(0, 500),
  })

  if (!result.ok) return result

  const payment = result.data.payment
  if (!payment?.id) {
    return { ok: false, kind: 'server', message: 'The payment processor returned an incomplete payment.' }
  }

  return {
    ok: true,
    data: {
      paymentId: payment.id,
      status: payment.status ?? 'UNKNOWN',
      receiptUrl: payment.receipt_url ?? null,
      cardBrand: payment.card_details?.card?.card_brand ?? null,
      cardLast4: payment.card_details?.card?.last_4 ?? null,
    },
  }
}

/**
 * Cancel a payment we are unsure completed.
 *
 * Square provides this endpoint precisely for the case where CreatePayment's
 * response was lost. Success means nothing stands and the buyer was not
 * charged — which is the only way to say that honestly after a network failure.
 */
export async function cancelByIdempotencyKey(idempotencyKey: string): Promise<boolean> {
  const result = await squareFetch<unknown>('/v2/payments/cancel', {
    idempotency_key: idempotencyKey.slice(0, 45),
  })
  return result.ok
}
