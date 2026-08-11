import type { Metadata } from 'next'
import { CheckoutClient } from '@/components/checkout/CheckoutClient'
import { getStoreSettings } from '@/lib/ngf-store'

export const metadata: Metadata = {
  title: 'Checkout',
  robots: { index: false, follow: false },
}

export default async function CheckoutPage() {
  // Fetched on the server and handed down, because the settings live in the NGF
  // portal and a client component cannot read them. The API route re-fetches
  // them independently before charging — the copy passed here is for DISPLAY
  // only and is never trusted for the amount.
  const settings = await getStoreSettings()

  return (
    <main className="section" style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <CheckoutClient settings={settings} />
    </main>
  )
}
