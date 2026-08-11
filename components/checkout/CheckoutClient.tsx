'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useCart } from '@/components/CartProvider'
import { quote, formatCents, type StoreSettings } from '@/lib/ngf-store'

/**
 * Square Web Payments SDK checkout.
 *
 * Card number / CVV / expiry are rendered inside Square-hosted iframes injected
 * into #card-container — raw card data never touches this page's DOM or our
 * server. On submit, card.tokenize() returns a single-use token that we POST to
 * /api/checkout, which re-prices the cart, creates a real Square order and
 * charges it.
 *
 * TWO THINGS HERE ARE ABOUT MONEY, NOT LAYOUT:
 *
 * 1. `orderRef` is generated ONCE per cart and reused across retries. The
 *    server derives both Square idempotency keys from it, so retrying after a
 *    network failure replays the original payment instead of taking a second
 *    one. It regenerates only when the cart itself changes, because Square
 *    rejects a reused key with a different order body.
 *
 * 2. The cart is cleared ONLY after the server confirms the charge settled.
 *    Clearing earlier loses the buyer's basket on a declined card; not clearing
 *    at all — the previous behaviour — let them refresh and pay twice.
 */

type SquareCard = {
  attach: (sel: string) => Promise<void>
  tokenize: () => Promise<{ status: string; token?: string; errors?: { message: string }[] }>
}
type SquarePayments = { card: () => Promise<SquareCard> }
declare global {
  interface Window {
    Square?: { payments: (appId: string, locationId: string) => SquarePayments }
  }
}

function parsePrice(p: string) {
  return Number(p.replace(/[^0-9.]/g, '')) || 0
}

const APP_ID = process.env.NEXT_PUBLIC_SQUARE_APP_ID
const LOCATION_ID = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID
const SQUARE_JS =
  process.env.NEXT_PUBLIC_SQUARE_ENVIRONMENT === 'production'
    ? 'https://web.squarecdn.com/v1/square.js'
    : 'https://sandbox.web.squarecdn.com/v1/square.js'

type Status = 'loading' | 'ready' | 'submitting' | 'paid' | 'unconfigured' | 'blocked'

const field: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '10px',
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--ink)',
  fontSize: '16px',
  marginTop: '4px',
}
const label: React.CSSProperties = {
  fontSize: '0.8rem',
  color: 'var(--muted)',
  display: 'block',
  marginBottom: '10px',
}

function newOrderRef() {
  const rand =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, '')
      : `${Date.now()}${Math.random().toString(16).slice(2)}`
  // <= 40 chars, so it also fits Square's reference_id cap.
  return `noma_${rand}`.slice(0, 40)
}

export function CheckoutClient({ settings }: { settings: StoreSettings }) {
  const { items, clearCart } = useCart()
  const [status, setStatus] = useState<Status>('loading')
  const [message, setMessage] = useState<string>('')
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null)
  const [paidRef, setPaidRef] = useState<string | null>(null)
  const cardRef = useRef<SquareCard | null>(null)

  const [form, setForm] = useState({
    name: '', email: '', phone: '',
    line1: '', line2: '', city: '', state: '', postalCode: '', country: 'US',
    note: '',
  })
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const subtotalCents = items.reduce(
    (sum, i) => sum + Math.round(parsePrice(i.price) * 100) * i.qty,
    0,
  )
  // Tax needs a destination, so totals firm up once the state is entered.
  const totals = useMemo(
    () => quote(subtotalCents, form.state || null, settings),
    [subtotalCents, form.state, settings],
  )

  // The ref must change whenever the Square ORDER BODY would change — not just
  // when the cart does.
  //
  // THE BUG THIS FIXES: the signature used to be cart ids and quantities only.
  // So a customer whose card declined, or who mistyped their state, would fix it
  // and resubmit against the SAME Square idempotency key with a DIFFERENT order
  // body. Square answers IDEMPOTENCY_KEY_REUSED, which classifies as a config
  // error, so they saw "We could not start your order" on every subsequent
  // attempt forever, with no hint that reloading was the cure. A declined card
  // is the single most common non-happy path in checkout, and it was a dead end.
  const orderSignature = useMemo(
    () =>
      [
        items.map((i) => `${i.id}x${i.qty}x${i.customization ?? ''}`).join('|'),
        // Everything that reaches the Square order: the fulfilment recipient,
        // and the destination, which decides shipping and tax.
        form.name, form.email, form.phone,
        form.line1, form.line2, form.city, form.state, form.postalCode, form.country,
        form.note,
        totals.totalCents,
      ].join('~'),
    [items, form, totals.totalCents],
  )
  const orderRefRef = useRef<string>(newOrderRef())
  useEffect(() => {
    orderRefRef.current = newOrderRef()
  }, [orderSignature])

  // Bumped on every FAILED attempt. The server appends it to the payment
  // idempotency key only, so a genuine retry after a decline gets a fresh
  // payment key while the network-ambiguity retry inside the server still
  // reuses the same one — which is what makes that retry safe.
  const attemptRef = useRef(0)

  useEffect(() => {
    if (!APP_ID || !LOCATION_ID) {
      setStatus('unconfigured')
      return
    }
    let cancelled = false

    async function init() {
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
          setStatus('blocked')
          setMessage('Could not load the secure payment form. Please refresh and try again.')
        }
      }
    }

    init()
    return () => { cancelled = true }
  }, [])

  const missing =
    !form.name.trim() || !form.email.trim() || !form.phone.trim() ||
    !form.line1.trim() || !form.city.trim() || !form.state.trim() || !form.postalCode.trim()

  async function handlePay(e: React.FormEvent) {
    e.preventDefault()
    const card = cardRef.current
    if (!card || items.length === 0 || missing || status !== 'ready') return

    setStatus('submitting')
    setMessage('')

    try {
      const result = await card.tokenize()
      if (result.status !== 'OK' || !result.token) {
        setStatus('ready')
        setMessage(result.errors?.[0]?.message || 'Please check your card details.')
        return
      }

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId: result.token,
          orderRef: orderRefRef.current,
          attempt: attemptRef.current,
          expectedTotalCents: totals.totalCents,
          items: items.map((i) => ({ id: i.id, qty: i.qty, customization: i.customization ?? null })),
          customer: form,
        }),
      })
      const data = await res.json()

      if (!res.ok || !data.ok) {
        // 'unknown_charge' is the one case where retrying is dangerous, so the
        // form stays locked and the message says so explicitly.
        if (data.kind === 'unknown_charge') {
          setStatus('blocked')
          setMessage(data.error)
          return
        }
        // A new payment key next time. Without this, retrying after a decline
        // reuses a consumed key and Square refuses outright.
        attemptRef.current += 1
        setStatus('ready')
        setMessage(data.error || 'Payment failed. Please try again.')
        return
      }

      // Confirmed settled — only now is it safe to empty the basket.
      setReceiptUrl(data.receiptUrl ?? null)
      setPaidRef(data.orderRef ?? null)
      setStatus('paid')
      clearCart()
    } catch {
      setStatus('ready')
      setMessage('Something went wrong sending your payment. Please try again.')
    }
  }

  if (status === 'paid') {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0' }}>
        <p style={{ fontSize: '2.4rem', marginBottom: '8px' }}>✓</p>
        <h1 className="font-serif" style={{ fontSize: '2rem', color: 'var(--ink)', marginBottom: '10px' }}>
          Order confirmed
        </h1>
        <p style={{ color: 'var(--muted)', marginBottom: '8px' }}>
          Thank you — a confirmation is on its way to {form.email}.
        </p>
        {paidRef && (
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '24px' }}>
            Order reference <strong style={{ color: 'var(--ink)' }}>{paidRef}</strong>
          </p>
        )}
        {receiptUrl && (
          <a href={receiptUrl} target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'underline', display: 'inline-block', marginBottom: '20px' }}>
            View your receipt
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
    <div style={{ maxWidth: '560px', margin: '0 auto', padding: '8px 0 48px' }}>
      <p className="eyebrow" style={{ marginBottom: '6px' }}>Checkout</p>
      <h1 className="font-serif" style={{ fontSize: 'clamp(2rem, 5vw, 2.8rem)', color: 'var(--ink)', marginBottom: '24px' }}>
        Payment
      </h1>

      <div style={{ border: '1px solid var(--border)', borderRadius: '14px', padding: '18px', marginBottom: '22px', background: 'var(--panel)' }}>
        {items.length === 0 ? (
          <p style={{ color: 'var(--muted)', textAlign: 'center', margin: 0 }}>
            Your cart is empty. <Link href="/products" style={{ color: 'var(--accent)', fontWeight: 600 }}>Shop pieces →</Link>
          </p>
        ) : (
          <>
            {items.map((i) => (
              <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '8px', color: 'var(--ink)' }}>
                <span style={{ color: 'var(--muted)' }}>
                  {i.title} × {i.qty}
                  {i.customization ? <em style={{ display: 'block', fontSize: '0.8rem' }}>Engraving: {i.customization}</em> : null}
                </span>
                <span>{formatCents(Math.round(parsePrice(i.price) * 100) * i.qty)}</span>
              </div>
            ))}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: '6px', fontSize: '0.85rem', color: 'var(--muted)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>Subtotal</span><span>{formatCents(totals.subtotalCents)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>{settings.shippingLabel}</span>
                <span>{totals.shippingCents === 0 ? 'Free' : formatCents(totals.shippingCents)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Tax{form.state ? '' : ' (enter address)'}</span>
                <span>{formatCents(totals.taxCents)}</span>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: 'var(--ink)', borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: '8px' }}>
              <span>Total</span>
              <span>{formatCents(totals.totalCents)}</span>
            </div>
          </>
        )}
      </div>

      {status === 'unconfigured' ? (
        <div style={{ border: '1px dashed var(--border)', borderRadius: '14px', padding: '20px', color: 'var(--muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--ink)' }}>Online checkout isn&apos;t available yet.</strong><br />
          We&apos;d still love to get this piece to you — email{' '}
          <a href="mailto:hello@noma.com" style={{ color: 'var(--accent)', fontWeight: 600 }}>hello@noma.com</a>{' '}
          and we&apos;ll take your order personally.
        </div>
      ) : (
        <form onSubmit={handlePay}>
          <h2 className="font-serif" style={{ fontSize: '1.1rem', color: 'var(--ink)', marginBottom: '12px' }}>Where should we send it?</h2>

          <label style={label}>Full name*<input required style={field} value={form.name} onChange={set('name')} autoComplete="name" /></label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <label style={label}>Email*<input required type="email" style={field} value={form.email} onChange={set('email')} autoComplete="email" /></label>
            <label style={label}>Phone*<input required type="tel" style={field} value={form.phone} onChange={set('phone')} autoComplete="tel" /></label>
          </div>
          <label style={label}>Address*<input required style={field} value={form.line1} onChange={set('line1')} autoComplete="address-line1" /></label>
          <label style={label}>Apt / suite<input style={field} value={form.line2} onChange={set('line2')} autoComplete="address-line2" /></label>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px' }}>
            <label style={label}>City*<input required style={field} value={form.city} onChange={set('city')} autoComplete="address-level2" /></label>
            <label style={label}>State*<input required maxLength={2} placeholder="MI" style={{ ...field, textTransform: 'uppercase' }} value={form.state} onChange={set('state')} autoComplete="address-level1" /></label>
            <label style={label}>ZIP*<input required style={field} value={form.postalCode} onChange={set('postalCode')} autoComplete="postal-code" /></label>
          </div>
          <label style={label}>Delivery notes<input style={field} value={form.note} onChange={set('note')} placeholder="Gift note, buzzer code…" /></label>

          <h2 className="font-serif" style={{ fontSize: '1.1rem', color: 'var(--ink)', margin: '18px 0 12px' }}>Payment</h2>
          <div id="card-container" style={{ minHeight: '90px', marginBottom: '10px', opacity: status === 'loading' ? 0.5 : 1 }} />
          {status === 'loading' && <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Loading secure payment form…</p>}

          {message && (
            <p role="alert" style={{ color: 'var(--burgundy)', fontSize: '0.85rem', marginBottom: '10px' }}>{message}</p>
          )}

          <button
            type="submit"
            disabled={status !== 'ready' || items.length === 0 || missing}
            className="btn-solid"
            style={{
              width: '100%', justifyContent: 'center', marginTop: '6px',
              opacity: status !== 'ready' || items.length === 0 || missing ? 0.55 : 1,
              cursor: status !== 'ready' || items.length === 0 || missing ? 'not-allowed' : 'pointer',
            }}
          >
            {status === 'submitting' ? 'Processing…' : `Pay ${formatCents(totals.totalCents)}`}
          </button>

          <p style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--muted)', marginTop: '12px' }}>
            🔒 Secured by Square. Card details are encrypted and never touch our servers.
          </p>
        </form>
      )}
    </div>
  )
}
