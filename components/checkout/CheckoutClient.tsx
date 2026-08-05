'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useCart } from '@/components/CartProvider'

/**
 * Square Web Payments SDK checkout.
 *
 * The card number / CVV / expiry fields are rendered inside Square-hosted
 * iframes injected into #card-container — raw card data never touches this
 * page's DOM or our server. On submit, card.tokenize() returns a single-use
 * token that we POST to /api/checkout, which recomputes the amount and charges.
 */

// Square's SDK attaches a global. Keep the typing loose.
type SquareCard = { attach: (sel: string) => Promise<void>; tokenize: () => Promise<{ status: string; token?: string; errors?: { message: string }[] }> }
type SquarePayments = { card: () => Promise<SquareCard> }
declare global {
  interface Window {
    Square?: { payments: (appId: string, locationId: string) => SquarePayments }
  }
}

function parsePrice(p: string) {
  return Number(p.replace(/[^0-9.]/g, '')) || 0
}
function formatCurrency(v: number) {
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const APP_ID = process.env.NEXT_PUBLIC_SQUARE_APP_ID
const LOCATION_ID = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID
const SQUARE_JS =
  process.env.NEXT_PUBLIC_SQUARE_ENVIRONMENT === 'production'
    ? 'https://web.squarecdn.com/v1/square.js'
    : 'https://sandbox.web.squarecdn.com/v1/square.js'

type Status = 'loading' | 'ready' | 'submitting' | 'paid' | 'error' | 'unconfigured'

export function CheckoutClient() {
  const { items } = useCart()
  const [status, setStatus] = useState<Status>('loading')
  const [message, setMessage] = useState<string>('')
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null)
  const cardRef = useRef<SquareCard | null>(null)

  const subtotal = items.reduce((sum, i) => sum + parsePrice(i.price) * i.qty, 0)

  useEffect(() => {
    if (!APP_ID || !LOCATION_ID) {
      setStatus('unconfigured')
      return
    }

    let cancelled = false

    async function init() {
      // Load Square's SDK once.
      if (!window.Square) {
        await new Promise<void>((resolve, reject) => {
          const existing = document.getElementById('square-web-sdk') as HTMLScriptElement | null
          if (existing) {
            existing.addEventListener('load', () => resolve(), { once: true })
            existing.addEventListener('error', () => reject(new Error('load')), { once: true })
            return
          }
          const s = document.createElement('script')
          s.id = 'square-web-sdk'
          s.src = SQUARE_JS
          s.onload = () => resolve()
          s.onerror = () => reject(new Error('load'))
          document.head.appendChild(s)
        })
      }
      if (cancelled || !window.Square) return

      try {
        const payments = window.Square.payments(APP_ID!, LOCATION_ID!)
        const card = await payments.card()
        await card.attach('#card-container')
        if (cancelled) return
        cardRef.current = card
        setStatus('ready')
      } catch {
        if (!cancelled) {
          setStatus('error')
          setMessage('Could not load the payment form. Please refresh and try again.')
        }
      }
    }

    init()
    return () => {
      cancelled = true
    }
  }, [])

  async function handlePay() {
    const card = cardRef.current
    if (!card || items.length === 0) return
    setStatus('submitting')
    setMessage('')

    try {
      const result = await card.tokenize()
      if (result.status !== 'OK' || !result.token) {
        setStatus('ready')
        setMessage(result.errors?.[0]?.message || 'Please check your card details.')
        return
      }

      const idempotencyKey =
        (typeof crypto !== 'undefined' && crypto.randomUUID)
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.round(performance.now())}`

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId: result.token,
          idempotencyKey,
          items: items.map((i) => ({ id: i.id, qty: i.qty })),
        }),
      })
      const data = await res.json()

      if (!res.ok || !data.ok) {
        setStatus('error')
        setMessage(data.error || 'Payment failed. Please try again.')
        return
      }

      setReceiptUrl(data.receiptUrl ?? null)
      setStatus('paid')
    } catch {
      setStatus('error')
      setMessage('Something went wrong processing your payment.')
    }
  }

  // ── Success ──
  if (status === 'paid') {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0' }}>
        <p style={{ fontSize: '2.4rem', marginBottom: '8px' }}>✓</p>
        <h1 className="font-serif" style={{ fontSize: '2rem', color: 'var(--ink)', marginBottom: '10px' }}>
          Payment received
        </h1>
        <p style={{ color: 'var(--muted)', marginBottom: '24px' }}>
          Thank you — your order is confirmed.
        </p>
        {receiptUrl && (
          <a href={receiptUrl} target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'underline', display: 'inline-block', marginBottom: '20px' }}>
            View Square receipt
          </a>
        )}
        <div>
          <Link href="/products" style={{ display: 'inline-block', padding: '12px 24px', borderRadius: '999px', background: 'var(--ink)', color: 'var(--bg)', fontWeight: 500 }}>
            Continue Shopping
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '520px', margin: '0 auto', padding: '8px 0 48px' }}>
      <p className="eyebrow" style={{ marginBottom: '6px' }}>Checkout</p>
      <h1 className="font-serif" style={{ fontSize: 'clamp(2rem, 5vw, 2.8rem)', color: 'var(--ink)', marginBottom: '24px' }}>
        Payment
      </h1>

      {/* Order summary */}
      <div style={{ border: '1px solid var(--border)', borderRadius: '14px', padding: '18px', marginBottom: '22px', background: 'var(--panel)' }}>
        {items.length === 0 ? (
          <p style={{ color: 'var(--muted)', textAlign: 'center', margin: 0 }}>
            Your cart is empty. <Link href="/products" style={{ color: 'var(--accent)', fontWeight: 600 }}>Shop pieces →</Link>
          </p>
        ) : (
          <>
            {items.map((i) => (
              <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '8px', color: 'var(--ink)' }}>
                <span style={{ color: 'var(--muted)' }}>{i.title} × {i.qty}</span>
                <span>{formatCurrency(parsePrice(i.price) * i.qty)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: 'var(--ink)', borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: '6px' }}>
              <span>Total</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
          </>
        )}
      </div>

      {status === 'unconfigured' ? (
        <div style={{ border: '1px dashed var(--border)', borderRadius: '14px', padding: '20px', color: 'var(--muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--ink)' }}>Payments aren&apos;t connected yet.</strong><br />
          Add your Square credentials to <code>.env.local</code> to enable live checkout.
        </div>
      ) : (
        <>
          {/* Square injects hosted card iframes here */}
          <div
            id="card-container"
            style={{ minHeight: '90px', marginBottom: '10px', opacity: status === 'loading' ? 0.5 : 1 }}
          />
          {status === 'loading' && <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Loading secure payment form…</p>}

          {message && (
            <p style={{ color: 'var(--burgundy)', fontSize: '0.85rem', marginBottom: '10px' }}>{message}</p>
          )}

          <button
            onClick={handlePay}
            disabled={status !== 'ready' || items.length === 0}
            className="btn-solid"
            style={{
              width: '100%', justifyContent: 'center', marginTop: '6px',
              opacity: status !== 'ready' || items.length === 0 ? 0.55 : 1,
              cursor: status !== 'ready' || items.length === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            {status === 'submitting' ? 'Processing…' : `Pay ${formatCurrency(subtotal)}`}
          </button>

          <p style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--muted)', marginTop: '12px' }}>
            🔒 Secured by Square. Card details are encrypted and never touch our servers.
          </p>
        </>
      )}
    </div>
  )
}
