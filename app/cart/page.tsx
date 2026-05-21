import type { Metadata } from 'next'
import { CartPageClient } from '@/components/cart/CartPageClient'

export const metadata: Metadata = {
  title: 'Your Cart',
  description: 'Review your NOMA cart and proceed to checkout.',
}

export default function CartPage() {
  return <CartPageClient />
}
