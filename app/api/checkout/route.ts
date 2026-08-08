import { NextResponse } from 'next/server'
import { resolveCart, type IncomingItem } from '@/lib/checkout'
import { quote } from '@/lib/pricing'
import { createOrder, createPayment, cancelByIdempotencyKey, type Customer } from '@/lib/square'
import { reportOrderToNgf, siteDomain } from '@/lib/ngf-order'
import type { OrderReportV1 } from '@/lib/order-contract'

/**
 * POST /api/checkout — create a Square order and charge it.
 *
 * SECURITY MODEL
 *  - Card data never reaches here. The browser tokenizes with Square's hosted
 *    iframes and sends only a single-use `sourceId`.
 *  - Prices are re-derived from the catalog server-side; client-sent prices are
 *    ignored entirely, and anything that cannot be priced exactly is refused.
 *  - The secret token lives only in server env.
 *
 * THE ORDERING PROBLEM — read before changing the sequence below.
 *
 * Money moves at exactly one step (D). Everything before it is reversible;
 * nothing after it is. The order is therefore:
 *
 *   A. resolve + re-price the cart      (no side effects)
 *   B. create the Square Order          (Square now holds what to ship)
 *   C. report PENDING to NGF            (fire-and-forget alarm marker)
 *   D. create the Payment               ← MONEY MOVES HERE
 *   E. report PAID / FAILED to NGF      (best-effort)
 *   F. respond success                  (decided at D, never at E)
 *
 * Why C exists: if E were the only report and E failed, no row would exist and
 * nothing would announce that fact. With C, a PENDING row appears the moment
 * the buyer commits — so any PENDING order older than ~15 minutes is a
 * self-announcing alarm that something may have been charged and never
 * confirmed. It costs one fire-and-forget call.
 *
 * RULES THAT MUST NOT BE BROKEN:
 *  1. Never fail the response to the buyer after D succeeded. Once the payment
 *     is COMPLETED the answer is success, whatever NGF or logging did. Anything
 *     else invites them to pay twice.
 *  2. Never void or refund a settled payment because a downstream write failed.
 *     Refunds are a human decision in the Square Dashboard.
 *  3. Never treat a network failure at D as "not charged" — see the ladder below.
 */

export const runtime = 'nodejs'

interface CheckoutBody {
  sourceId?: string
  /** Stable per checkout ATTEMPT, generated once in the browser and reused
   *  across retries. This is what makes a retry safe. */
  orderRef?: string
  items?: IncomingItem[]
  customer?: {
    name?: string
    email?: string
    phone?: string
    line1?: string
    line2?: string
    city?: string
    state?: string
    postalCode?: string
    country?: string
    note?: string
  }
  /** What the browser displayed as the total. If it disagrees with the server's
   *  own calculation the order is refused rather than charged — a customer must
   *  never be charged a number they were not shown. */
  expectedTotalCents?: number
}

function bad(message: string, status = 400, kind = 'invalid') {
  return NextResponse.json({ ok: false, kind, error: message }, { status })
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: Request) {
  if (!process.env.SQUARE_ACCESS_TOKEN || !process.env.SQUARE_LOCATION_ID) {
    return bad('Online checkout is not available right now.', 503, 'config')
  }

  let body: CheckoutBody
  try {
    body = await req.json()
  } catch {
    return bad('Invalid request.')
  }

  const { sourceId, orderRef, items, customer, expectedTotalCents } = body
  if (!sourceId || !orderRef || !Array.isArray(items)) {
    return bad('Missing payment details.')
  }
  if (orderRef.length > 40) {
    return bad('Invalid order reference.')
  }

  // ── Customer + shipping. All required: Square's fulfillment recipient wants
  // them, and without them there is a paid order nobody can ship. ──
  const c = customer ?? {}
  const name = (c.name ?? '').trim()
  const email = (c.email ?? '').trim().toLowerCase()
  const phone = (c.phone ?? '').trim()
  const line1 = (c.line1 ?? '').trim()
  const city = (c.city ?? '').trim()
  const state = (c.state ?? '').trim().toUpperCase()
  const postalCode = (c.postalCode ?? '').trim()
  const country = (c.country ?? 'US').trim().toUpperCase()

  if (!name) return bad('Please enter your name.')
  if (!EMAIL_RE.test(email)) return bad('Please enter a valid email address.')
  if (!phone) return bad('Please enter a phone number for delivery.')
  if (!line1 || !city || !state || !postalCode) return bad('Please enter your full shipping address.')

  // ── A. Authoritative re-pricing ──
  const resolved = resolveCart(items)
  if (!resolved.ok) return bad(resolved.reason)

  const priced = quote(resolved.subtotalCents, state)

  // The browser and the server must agree on the total before any charge.
  if (
    typeof expectedTotalCents === 'number' &&
    expectedTotalCents !== priced.totalCents
  ) {
    return NextResponse.json(
      {
        ok: false,
        kind: 'stale',
        error: 'Your total changed. Please review your order and try again.',
        totals: priced,
      },
      { status: 409 },
    )
  }

  const squareCustomer: Customer = {
    name,
    email,
    phone,
    address: {
      line1,
      line2: (c.line2 ?? '').trim() || null,
      city,
      state,
      postalCode,
      country,
    },
    note: (c.note ?? '').trim() || null,
  }

  // Two DISTINCT idempotency keys, both derived from the same orderRef. Square
  // documents neither the retention window nor the scope of a key, so they are
  // treated as permanent and endpoint-scoped and never shared across endpoints.
  const orderKey = `o_${orderRef}`.slice(0, 45)
  const paymentKey = `p_${orderRef}`.slice(0, 45)

  // ── B. Create the Square order. Square now holds everything needed to ship. ──
  const order = await createOrder({
    idempotencyKey: orderKey,
    orderRef,
    lines: resolved.lines,
    shippingCents: priced.shippingCents,
    customer: squareCustomer,
  })
  if (!order.ok) {
    // Nothing charged. A config error must not leak Square's wording.
    const message =
      order.kind === 'config' || order.kind === 'server'
        ? 'We could not start your order. Nothing has been charged. Please try again or contact us.'
        : order.message
    return NextResponse.json({ ok: false, kind: order.kind, error: message }, { status: 502 })
  }

  const domain = siteDomain()
  const placedAt = new Date().toISOString()

  const baseReport = (
    status: OrderReportV1['status'],
    payment: OrderReportV1['payment'],
  ): OrderReportV1 => ({
    version: 1,
    domain,
    orderRef,
    status,
    placedAt,
    currency: 'USD',
    customer: { name, email, phone },
    shipping: {
      method: priced.shippingCents === 0 ? 'Free shipping' : 'Standard shipping',
      address: squareCustomer.address,
      note: squareCustomer.note,
    },
    lines: resolved.lines.map((l) => ({
      sku: l.sku,
      title: l.title,
      variant: l.variant,
      qty: l.qty,
      unitCents: l.unitCents,
      lineCents: l.lineCents,
      customization: l.customization,
      imageUrl: l.imageUrl,
    })),
    totals: {
      subtotalCents: priced.subtotalCents,
      discountCents: 0,
      shippingCents: priced.shippingCents,
      taxCents: priced.taxCents,
      // Square's number, not ours — see below.
      totalCents: order.data.totalCents,
    },
    payment,
  })

  // ── C. PENDING marker. Deliberately not awaited-critical: an NGF outage must
  // never stop NOMA taking money. ──
  void reportOrderToNgf(
    baseReport('PENDING', {
      provider: 'square',
      status: 'PENDING',
      providerOrderId: order.data.orderId,
      providerPaymentId: null,
      receiptUrl: null,
      cardBrand: null,
      cardLast4: null,
      amountCents: order.data.totalCents,
    }),
  )

  // ── D. MONEY MOVES. amountCents is READ BACK from the order, never
  // recomputed — any disagreement with Square's tax engine returns
  // PAYMENT_AMOUNT_MISMATCH, which arrives as an HTTP 400 that looks like a
  // declined card. ──
  let payment = await createPayment({
    idempotencyKey: paymentKey,
    sourceId,
    orderId: order.data.orderId,
    orderRef,
    amountCents: order.data.totalCents,
    buyerEmail: email,
  })

  // The nastiest case: the request failed at the network layer, so we do not
  // know whether the charge landed. Retrying with the IDENTICAL idempotency key
  // is strictly safe — Square either charges cleanly or replays the original
  // payment — and it resolves the ambiguity outright.
  if (!payment.ok && payment.kind === 'network') {
    await new Promise((r) => setTimeout(r, 700))
    payment = await createPayment({
      idempotencyKey: paymentKey,
      sourceId,
      orderId: order.data.orderId,
      orderRef,
      amountCents: order.data.totalCents,
      buyerEmail: email,
    })
  }

  if (!payment.ok) {
    if (payment.kind === 'network') {
      // Still unknown. Ask Square to cancel anything standing against this key.
      const cancelled = await cancelByIdempotencyKey(paymentKey)
      if (!cancelled) {
        // The one state where the buyer must NOT be told to try again.
        console.error('[checkout] UNKNOWN CHARGE STATE', { orderRef, orderId: order.data.orderId })
        return NextResponse.json(
          {
            ok: false,
            kind: 'unknown_charge',
            orderRef,
            error:
              'We could not confirm whether your payment went through. Please do NOT try again — ' +
              `contact us with reference ${orderRef} and we will confirm within one business day.`,
          },
          { status: 502 },
        )
      }
    }

    void reportOrderToNgf(
      baseReport('FAILED', {
        provider: 'square',
        status: 'FAILED',
        providerOrderId: order.data.orderId,
        providerPaymentId: null,
        receiptUrl: null,
        cardBrand: null,
        cardLast4: null,
        amountCents: order.data.totalCents,
      }),
    )

    const message =
      payment.kind === 'declined'
        ? payment.message
        : 'We could not process your payment. Nothing has been charged. Please try again.'
    return NextResponse.json(
      { ok: false, kind: payment.kind, error: message },
      { status: payment.kind === 'declined' ? 402 : 502 },
    )
  }

  // ── E. PAID report. Awaited so the portal is usually up to date by the time
  // the buyer sees the success screen — but its result CANNOT change the
  // response. If it failed it has already written its dead-letter line. ──
  await reportOrderToNgf(
    baseReport('PAID', {
      provider: 'square',
      status: 'COMPLETED',
      providerOrderId: order.data.orderId,
      providerPaymentId: payment.data.paymentId,
      receiptUrl: payment.data.receiptUrl,
      cardBrand: payment.data.cardBrand,
      cardLast4: payment.data.cardLast4,
      amountCents: order.data.totalCents,
    }),
  )

  // ── F. Success is decided at D. ──
  return NextResponse.json({
    ok: true,
    orderRef,
    paymentId: payment.data.paymentId,
    status: payment.data.status,
    receiptUrl: payment.data.receiptUrl,
    totals: { ...priced, totalCents: order.data.totalCents },
  })
}
