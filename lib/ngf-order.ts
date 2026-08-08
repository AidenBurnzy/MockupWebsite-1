import type { OrderReportV1 } from '@/lib/order-contract'

/**
 * Report a completed order to the central NGF order store.
 *
 * WHAT THIS IS NOT: it is not the system of record. Square is — the order it
 * holds has the line items, the engraving and the shipping address, so NOMA can
 * fulfil from the Square Dashboard even if every call in this file fails. That
 * is the whole reason the checkout creates a real Square Order before charging.
 *
 * WHAT IT IS: the queryable mirror that puts orders in the client's own portal
 * and emails them a notification. Convenience layered on top of Square.
 *
 * CONTRACT — identical in spirit to lib/ngf-lead.ts:
 * - It NEVER throws. Every path returns { ok }. A payment that has already
 *   settled must never be failed by a reporting problem.
 * - It resolves the client from NEXT_PUBLIC_SITE_URL, which must match
 *   `site_url` in the NGF admin exactly. If it does not, this logs loudly and
 *   the order never reaches the portal — check Admin → Ecosystem, which tests
 *   that binding end to end.
 * - Unlike the lead relay this is AUTHENTICATED, with a per-client shared
 *   secret. An unauthenticated order endpoint would let anyone tell Nick to
 *   ship jewelry to an address of their choosing. Leads tolerate junk; orders
 *   do not.
 */

const TIMEOUT_MS = 5000

export async function reportOrderToNgf(report: OrderReportV1): Promise<{ ok: boolean }> {
  const base = process.env.NGF_APP_URL || 'https://app.ngfsystems.com'
  const secret = process.env.NGF_ORDERS_SECRET

  if (!report.domain) {
    console.error('[ngf-order] NEXT_PUBLIC_SITE_URL is not set — order not reported', {
      orderRef: report.orderRef,
    })
    return { ok: false }
  }
  if (!secret) {
    console.error('[ngf-order] NGF_ORDERS_SECRET is not set — order not reported', {
      orderRef: report.orderRef,
    })
    return { ok: false }
  }

  // One retry. The endpoint is idempotent on (client, orderRef), so a duplicate
  // is a no-op — which makes retrying strictly safe and worth doing once for a
  // transient blip.
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 800))
    try {
      const res = await fetch(`${base}/api/public/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-NGF-Order-Token': secret,
        },
        body: JSON.stringify(report),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (res.ok) return { ok: true }
      console.error('[ngf-order] report rejected', {
        status: res.status,
        orderRef: report.orderRef,
        attempt,
      })
      // 4xx will not improve on retry — only retry server-side and network faults.
      if (res.status < 500) break
    } catch (err) {
      console.error('[ngf-order] report failed', { orderRef: report.orderRef, attempt, err })
    }
  }

  // DEAD-LETTER LINE. On a site with no database, a greppable log line IS the
  // dead-letter queue — it is not elegant, it is sufficient, and it carries
  // everything needed to replay the report by hand. Keep it on one line and
  // keep the field names stable so it can be found later.
  console.error(
    '[ngf-order] UNREPORTED ' +
      `orderRef=${report.orderRef} ` +
      `status=${report.status} ` +
      `squareOrderId=${report.payment.providerOrderId ?? '-'} ` +
      `paymentId=${report.payment.providerPaymentId ?? '-'} ` +
      `totalCents=${report.totals.totalCents} ` +
      `email=${report.customer.email}`,
  )
  return { ok: false }
}

/** Bare host, matching how the content API and lead relay resolve the client. */
export function siteDomain(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || '')
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '')
}
