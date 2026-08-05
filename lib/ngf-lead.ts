/**
 * Relay a form submission to the central NGF lead store.
 *
 * WHEN TO USE THIS vs <LeadForm>:
 * - NEW sites: use `components/LeadForm.tsx`. It posts straight to the central
 *   store from the browser — no API route on the site at all, nothing to drift.
 * - EXISTING sites that already have a bespoke form + API route: call this from
 *   inside that route. It is deliberately ADDITIVE, so the site's own
 *   validation, branded email and success/error UX stay exactly as they are.
 *   Retrofitting a live client's form wholesale is how you lose leads.
 *
 * WHY IT EXISTS: several client sites captured leads by EMAIL ONLY. If the
 * notification failed to send, the enquiry was gone with no record anywhere,
 * and nothing appeared in the client's portal. The central store persists the
 * submission as the system of record and surfaces it under Form Submissions.
 *
 * CONTRACT:
 * - Call it BEFORE sending your notification email (persist first, notify
 *   second — see the "Lead capture: persist first" standard).
 * - It NEVER throws. Every path returns { ok } — no domain configured, non-2xx,
 *   network error, timeout. So it can never make an existing submission worse
 *   than it is today; your email still goes out.
 * - It resolves the client from NEXT_PUBLIC_SITE_URL, so that value must match
 *   `site_url` in the NGF admin exactly (the same pairing the content API uses).
 *   If it doesn't, this logs loudly and the lead never reaches the portal —
 *   check Admin -> Ecosystem, which tests that binding end to end.
 */
export async function relayLeadToNgf(
  formType: string,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean }> {
  try {
    const base = process.env.NGF_APP_URL || 'https://app.ngfsystems.com'
    const raw = process.env.NEXT_PUBLIC_SITE_URL || ''
    const domain = raw.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '')

    if (!domain) {
      console.error('[ngf-lead] NEXT_PUBLIC_SITE_URL is not set — lead not relayed to the portal')
      return { ok: false }
    }

    const res = await fetch(`${base}/api/public/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, formType, payload }),
      // Never let a slow portal hold up the customer's submission: worst case
      // this adds 5s before the notification email is sent, then gives up.
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) {
      console.error('[ngf-lead] relay rejected', { status: res.status, formType })
      return { ok: false }
    }
    return { ok: true }
  } catch (err) {
    console.error('[ngf-lead] relay failed (submission continues)', err)
    return { ok: false }
  }
}
