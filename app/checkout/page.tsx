import type { Metadata } from 'next'
import { CheckoutClient } from '@/components/checkout/CheckoutClient'

export const metadata: Metadata = {
  title: 'Checkout',
  robots: { index: false, follow: false },
}

export default function CheckoutPage() {
  return (
    <main className="section" style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <CheckoutClient />
    </main>
  )
}
