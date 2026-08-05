'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'

// Stored in localStorage: 'accepted' | 'declined'.
const CONSENT_KEY = 'ngf-cookie-consent'

/**
 * True once the visitor has accepted non-essential (analytics) cookies.
 *
 * Gate every cookie-based tracker — Google Analytics, Microsoft Clarity, Meta
 * pixel, etc. — behind this so it never loads without consent. Example in a
 * server component (read the cookie/localStorage via a small client wrapper, or
 * mount the tracker in a 'use client' component that checks this):
 *
 *   'use client'
 *   export function Analytics() {
 *     if (!hasCookieConsent()) return null
 *     return <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} ... />
 *   }
 *
 * Cookieless analytics (Vercel Analytics) needs NO consent — don't gate it and
 * don't render the banner for it.
 */
export function hasCookieConsent(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(CONSENT_KEY) === 'accepted'
}

/**
 * Clear the stored choice so the banner shows again on the next render.
 *
 * REQUIRED for compliance, not a nicety: consent must be as easy to WITHDRAW as
 * it was to give. Without this the banner only ever appears once — accept or
 * decline, and the visitor can never change their mind or revoke analytics.
 *
 * Wire it to a "Cookie settings" control that is reachable from every page —
 * the footer, and/or the privacy policy. Reloading applies the change
 * immediately, since gated scripts evaluate hasCookieConsent() at render time:
 *
 *   'use client'
 *   import { resetCookieConsent } from '@/components/CookieConsent'
 *   <button type="button" onClick={resetCookieConsent}>Cookie settings</button>
 */
export function resetCookieConsent(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(CONSENT_KEY)
  window.location.reload()
}

/**
 * Cookie consent banner. Mount once in app/layout.tsx. It only appears when the
 * site actually loads cookie-based analytics — set `NEXT_PUBLIC_COOKIE_ANALYTICS=1`
 * in that case. Leave it unset for cookieless / no-analytics sites and the banner
 * stays hidden. Links to /privacy.
 */
export default function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const usesCookieAnalytics = process.env.NEXT_PUBLIC_COOKIE_ANALYTICS === '1'
    if (usesCookieAnalytics && !window.localStorage.getItem(CONSENT_KEY)) {
      setVisible(true)
    }
  }, [])

  if (!visible) return null

  const choose = (value: 'accepted' | 'declined') => {
    window.localStorage.setItem(CONSENT_KEY, value)
    setVisible(false)
    // Reload so gated analytics scripts (re)evaluate consent on a fresh render.
    if (value === 'accepted') window.location.reload()
  }

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-[9999] border-t border-gray-200 bg-white/95 p-4 shadow-lg backdrop-blur sm:p-5"
    >
      <div className="mx-auto flex max-w-4xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-600">
          We use cookies for analytics to understand how visitors use this site. See our{' '}
          <Link href="/privacy" className="font-medium text-gray-900 underline">Privacy &amp; Cookie Policy</Link>.
        </p>
        <div className="flex flex-shrink-0 gap-2">
          <button
            type="button"
            onClick={() => choose('declined')}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={() => choose('accepted')}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}
