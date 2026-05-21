'use client'
import Image from 'next/image'
import Link from 'next/link'
import { useCart } from '@/components/CartProvider'

function parsePrice(p: string) {
  return Number(p.replace(/[^0-9.]/g, '')) || 0
}

function formatCurrency(v: number) {
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export function CartPageClient() {
  const { items, updateQty } = useCart()

  const subtotal = items.reduce((sum, i) => sum + parsePrice(i.price) * i.qty, 0)

  return (
    <div className="max-w-5xl mx-auto px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-widest text-[var(--accent)] mb-2">Your Bag</p>
      <h1 className="font-serif text-5xl text-[var(--ink)] mb-12">Cart overview</h1>

      <div className="flex flex-col lg:flex-row gap-12">
        {/* Items */}
        <div className="flex-1 flex flex-col gap-6">
          {items.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-[var(--muted)] text-lg mb-6">Your cart is empty.</p>
              <Link
                href="/products"
                className="inline-flex items-center px-6 py-3 rounded-full bg-[var(--ink)] text-[var(--bg)] font-medium hover:bg-[var(--brown)] transition-colors"
              >
                Continue Shopping
              </Link>
            </div>
          ) : (
            items.map((item) => (
              <article
                key={item.id}
                className="flex gap-4 p-4 rounded-2xl border border-[var(--border)] bg-[var(--panel)]"
              >
                <div className="relative w-24 h-24 rounded-xl overflow-hidden bg-[var(--beige)] shrink-0">
                  {item.image ? (
                    <Image src={item.image} alt={item.title} fill className="object-cover" sizes="96px" />
                  ) : (
                    <div className="w-full h-full bg-[var(--beige)]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-serif text-lg text-[var(--ink)] truncate">{item.title}</h3>
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-semibold text-[var(--ink)]">{item.price}</span>
                    <div className="flex items-center gap-2">
                      <button
                        className="w-8 h-8 rounded-full border border-[var(--border)] flex items-center justify-center text-lg text-[var(--ink)] hover:bg-[var(--beige)] transition-colors"
                        onClick={() => updateQty(item.id, -1)}
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <span className="text-sm font-medium text-[var(--ink)] w-6 text-center">×{item.qty}</span>
                      <button
                        className="w-8 h-8 rounded-full border border-[var(--border)] flex items-center justify-center text-lg text-[var(--ink)] hover:bg-[var(--beige)] transition-colors"
                        onClick={() => updateQty(item.id, 1)}
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>

        {/* Summary */}
        {items.length > 0 && (
          <aside className="lg:w-80 shrink-0">
            <div className="sticky top-40 rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6">
              <h3 className="font-serif text-xl text-[var(--ink)] mb-4">Order Summary</h3>
              <div className="flex justify-between text-sm text-[var(--muted)] mb-2">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-[var(--muted)] mb-4">
                <span>Shipping</span>
                <span>Free</span>
              </div>
              <div className="flex justify-between font-semibold text-[var(--ink)] text-base border-t border-[var(--border)] pt-4 mb-6">
                <span>Total</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <button className="w-full py-3 rounded-full bg-[var(--ink)] text-[var(--bg)] font-medium hover:bg-[var(--brown)] transition-colors mb-3">
                Proceed to Checkout
              </button>
              <Link
                href="/products"
                className="block w-full py-3 rounded-full border border-[var(--border)] text-center text-sm font-medium text-[var(--ink)] hover:bg-[var(--beige)] transition-colors"
              >
                Continue Shopping
              </Link>
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
