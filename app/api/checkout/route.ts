import { NextResponse } from 'next/server'
import { resolveCartAmount } from '@/lib/checkout'

/**
 * POST /api/checkout — create a Square payment.
 *
 * Security model:
 *  - Card data never reaches here. The client tokenizes the card with Square's
 *    Web Payments SDK (Square-hosted iframes) and sends only a single-use
 *    `sourceId` (nonce).
 *  - The amount is recomputed from the catalog via resolveCartAmount() — the
 *    client-sent cart prices are ignored, so a tampered price can't change the
 *    charge.
 *  - The secret access token lives only in server env and is never exposed.
 */

// Force Node.js runtime (not edge) — we hold a secret and call an external API.
export const runtime = 'nodejs'

const SQUARE_HOST =
  process.env.SQUARE_ENVIRONMENT === 'production'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com'

export async function POST(req: Request) {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN
  const locationId = process.env.SQUARE_LOCATION_ID

  if (!accessToken || !locationId) {
    return NextResponse.json(
      { error: 'Payments are not configured yet. (Missing Square credentials.)' },
      { status: 503 },
    )
  }

  let body: { sourceId?: string; items?: { id: string; qty: number }[]; idempotencyKey?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const { sourceId, items, idempotencyKey } = body
  if (!sourceId || !Array.isArray(items) || !idempotencyKey) {
    return NextResponse.json({ error: 'Missing payment details.' }, { status: 400 })
  }

  const { lines, totalCents } = resolveCartAmount(items)
  if (totalCents <= 0) {
    return NextResponse.json({ error: 'Your cart is empty or contains no valid items.' }, { status: 400 })
  }

  try {
    const res = await fetch(`${SQUARE_HOST}/v2/payments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source_id: sourceId,
        // Square requires the idempotency key to be <= 45 chars.
        idempotency_key: String(idempotencyKey).slice(0, 45),
        amount_money: { amount: totalCents, currency: 'USD' },
        location_id: locationId,
        note: `NOMA order — ${lines.reduce((s, l) => s + l.qty, 0)} item(s)`,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      const detail = data?.errors?.[0]?.detail || 'Payment could not be processed.'
      return NextResponse.json({ error: detail }, { status: 502 })
    }

    return NextResponse.json({
      ok: true,
      paymentId: data.payment?.id ?? null,
      status: data.payment?.status ?? null,
      receiptUrl: data.payment?.receipt_url ?? null,
      totalCents,
    })
  } catch {
    return NextResponse.json({ error: 'Could not reach the payment processor.' }, { status: 502 })
  }
}
