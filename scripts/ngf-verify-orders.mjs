#!/usr/bin/env node
/**
 * ngf-verify-orders — prove a storefront's payment + order wiring works
 * BEFORE it takes a real customer's money.
 *
 *   npm run verify-orders            # read-only checks + a synthetic order report
 *   npm run verify-orders -- --dry   # read-only checks only, reports nothing
 *
 * WHY THIS EXISTS. Every previous "is it wired up?" answer was somebody's
 * opinion. Payment integrations fail in ways you cannot see from the code: a
 * token for the wrong environment, a location id that belongs to another
 * account, a site_url that does not match the portal, a mistyped ingest secret.
 * Each of those looks perfect in a diff and fails on the first real order.
 *
 * NOTHING HERE MOVES MONEY. It reads your Square location, and it posts ONE
 * synthetic order to the NGF ingest so you can see the whole path work end to
 * end. The synthetic order is clearly marked, costs nothing, and you delete it
 * from the portal afterwards.
 *
 * Zero dependencies, Node 18+ (global fetch) — same constraint as ngf-doctor.
 */

import { existsSync, readFileSync } from 'node:fs'

const args = process.argv.slice(2)
const DRY = args.includes('--dry')

const C = process.stdout.isTTY
  ? { g: '\x1b[32m', r: '\x1b[31m', y: '\x1b[33m', d: '\x1b[2m', b: '\x1b[1m', x: '\x1b[0m' }
  : { g: '', r: '', y: '', d: '', b: '', x: '' }

let failures = 0
let warnings = 0
const pass = (m, d) => console.log(`  ${C.g}PASS${C.x}  ${m}${d ? `\n        ${C.d}${d}${C.x}` : ''}`)
const fail = (m, d) => { failures++; console.log(`  ${C.r}FAIL${C.x}  ${m}${d ? `\n        ${C.d}${d}${C.x}` : ''}`) }
const warn = (m, d) => { warnings++; console.log(`  ${C.y}WARN${C.x}  ${m}${d ? `\n        ${C.d}${d}${C.x}` : ''}`) }

// ── Load .env.local without a dependency. Vercel injects real env vars, so this
// is only for local runs. Values are never printed. ──
function loadEnvLocal() {
  if (!existsSync('.env.local')) return
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m) continue
    const [, key, rawValue] = m
    if (process.env[key]) continue
    process.env[key] = rawValue.replace(/^["']|["']$/g, '')
  }
}
loadEnvLocal()

const env = (k) => (process.env[k] ?? '').trim()
const has = (k) => env(k).length > 0

console.log(`\n${C.b}NGF order wiring${C.x}\n`)

// ── 1. Environment ─────────────────────────────────────────────────────────
console.log(`${C.b}Environment${C.x}`)

const SITE_URL = env('NEXT_PUBLIC_SITE_URL')
const NGF_APP = env('NGF_APP_URL') || 'https://app.ngfsystems.com'
const domain = SITE_URL.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '')

if (!domain) {
  fail('NEXT_PUBLIC_SITE_URL is not set',
       'Everything binds on this: content, leads, store settings and orders all resolve the client by domain.')
} else {
  pass(`NEXT_PUBLIC_SITE_URL → ${domain}`)
}

for (const key of ['SQUARE_ACCESS_TOKEN', 'SQUARE_LOCATION_ID', 'SQUARE_ENVIRONMENT',
                   'NEXT_PUBLIC_SQUARE_APP_ID', 'NEXT_PUBLIC_SQUARE_LOCATION_ID',
                   'NEXT_PUBLIC_SQUARE_ENVIRONMENT']) {
  if (has(key)) pass(`${key} is set`)
  else fail(`${key} is missing`, 'The checkout renders its "not available" state without it.')
}

// The single most common Square misconfiguration, and it fails only at charge
// time: the server and browser halves pointing at different environments or
// different locations.
const serverEnv = env('SQUARE_ENVIRONMENT').toLowerCase()
const clientEnv = env('NEXT_PUBLIC_SQUARE_ENVIRONMENT').toLowerCase()
if (serverEnv && clientEnv) {
  if (serverEnv !== clientEnv) {
    fail(`SQUARE_ENVIRONMENT (${serverEnv}) ≠ NEXT_PUBLIC_SQUARE_ENVIRONMENT (${clientEnv})`,
         'The browser tokenizes against one environment and the server charges against the other. Every payment fails.')
  } else {
    pass(`Both halves agree on the ${serverEnv} environment`)
    if (serverEnv === 'production') {
      warn('This site is pointed at PRODUCTION Square', 'Real cards will be charged.')
    }
  }
}
if (has('SQUARE_LOCATION_ID') && has('NEXT_PUBLIC_SQUARE_LOCATION_ID')) {
  if (env('SQUARE_LOCATION_ID') !== env('NEXT_PUBLIC_SQUARE_LOCATION_ID')) {
    fail('SQUARE_LOCATION_ID ≠ NEXT_PUBLIC_SQUARE_LOCATION_ID',
         'Two separate vars must hold the same value; a mismatch fails only at charge time.')
  } else {
    pass('Both location ids match')
  }
}

if (has('NGF_ORDERS_SECRET')) pass('NGF_ORDERS_SECRET is set')
else fail('NGF_ORDERS_SECRET is missing',
          'Generate it in NGF admin → the client hub → Overview → Generate secret.')

// ── 2. Square, read-only ───────────────────────────────────────────────────
console.log(`\n${C.b}Square${C.x}`)

const SQUARE_HOST = serverEnv === 'production'
  ? 'https://connect.squareup.com'
  : 'https://connect.squareupsandbox.com'

if (has('SQUARE_ACCESS_TOKEN') && has('SQUARE_LOCATION_ID')) {
  try {
    // RetrieveLocation is a READ. It proves the token is valid, that it is for
    // this environment, and that the location actually belongs to it — the
    // three things that otherwise fail on the first real charge.
    const res = await fetch(`${SQUARE_HOST}/v2/locations/${env('SQUARE_LOCATION_ID')}`, {
      headers: {
        Authorization: `Bearer ${env('SQUARE_ACCESS_TOKEN')}`,
        'Square-Version': '2025-01-23',
      },
    })
    const body = await res.json().catch(() => ({}))

    if (res.status === 401) {
      fail('Square rejected the access token (401)',
           `Is the token for the ${serverEnv} environment? Sandbox and production tokens are not interchangeable.`)
    } else if (res.status === 404 || body?.errors?.[0]?.code === 'NOT_FOUND') {
      fail('Square does not recognise that location id',
           'The location belongs to a different Square account or environment.')
    } else if (!res.ok) {
      fail(`Square returned ${res.status}`, body?.errors?.[0]?.detail ?? '')
    } else {
      const loc = body.location ?? {}
      pass(`Square location: ${loc.name ?? '(unnamed)'} — ${loc.status ?? 'unknown status'}`,
           `currency ${loc.currency ?? '?'} · country ${loc.country ?? '?'}`)
      if (loc.status && loc.status !== 'ACTIVE') {
        fail(`Location status is ${loc.status}`, 'An inactive location cannot take payments.')
      }
      if (loc.capabilities && !loc.capabilities.includes('CREDIT_CARD_PROCESSING')) {
        fail('This location cannot process credit cards',
             'Square has not enabled card processing for it — check the Square dashboard.')
      } else if (loc.capabilities) {
        pass('Location can process credit cards')
      }
    }
  } catch (err) {
    fail('Could not reach Square', String(err))
  }
} else {
  warn('Skipped Square checks', 'Credentials missing, see above.')
}

// ── 3. NGF store settings ──────────────────────────────────────────────────
console.log(`\n${C.b}NGF store settings${C.x}`)

if (domain) {
  try {
    const res = await fetch(`${NGF_APP}/api/public/store-settings?domain=${encodeURIComponent(domain)}`)
    const body = await res.json().catch(() => ({}))
    const s = body.settings
    if (!res.ok || !s) {
      fail(`Store settings endpoint returned ${res.status}`)
    } else {
      const configured = s.shippingFlatCents > 0 || s.shippingFreeOverCents !== null || (s.taxRules ?? []).length > 0
      if (configured) {
        pass('Store settings are configured',
             `shipping ${(s.shippingFlatCents / 100).toFixed(2)}` +
             (s.shippingFreeOverCents !== null ? `, free over ${(s.shippingFreeOverCents / 100).toFixed(2)}` : ', never free') +
             `, tax rules: ${(s.taxRules ?? []).map((r) => `${r.state} ${r.ratePercent}%`).join(', ') || 'none'}`)
      } else {
        warn('Store settings are all zero',
             'The client has not set shipping or tax in their portal yet, so orders will charge neither. Fine for a test, wrong for a launch.')
      }
    }
  } catch (err) {
    fail('Could not reach the NGF store-settings endpoint', String(err))
  }
}

// ── 4. The ingest, end to end ──────────────────────────────────────────────
console.log(`\n${C.b}Order reporting${C.x}`)

if (DRY) {
  console.log(`  ${C.d}skipped (--dry)${C.x}`)
} else if (!domain || !has('NGF_ORDERS_SECRET')) {
  warn('Skipped the live report', 'Domain or secret missing, see above.')
} else {
  const orderRef = `verify_${Date.now().toString(36)}`
  const report = {
    version: 1,
    domain,
    orderRef,
    status: 'PAID',
    placedAt: new Date().toISOString(),
    currency: 'USD',
    customer: { name: 'NGF Wiring Test', email: 'verify@ngfsystems.local', phone: null },
    shipping: {
      method: 'Verification only',
      address: { line1: '1 Test Street', line2: null, city: 'Grand Rapids', state: 'MI', postalCode: '49503', country: 'US' },
      note: 'Synthetic order created by npm run verify-orders. Safe to delete.',
    },
    lines: [{
      sku: 'ngf-verify', title: 'NGF wiring test — delete me', variant: null,
      qty: 1, unitCents: 1, lineCents: 1, customization: null, imageUrl: null,
    }],
    totals: { subtotalCents: 1, discountCents: 0, shippingCents: 0, taxCents: 0, totalCents: 1 },
    payment: {
      provider: 'verification', status: 'COMPLETED',
      providerOrderId: null, providerPaymentId: null, receiptUrl: null,
      cardBrand: null, cardLast4: null, amountCents: 1,
    },
  }

  try {
    const res = await fetch(`${NGF_APP}/api/public/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-NGF-Order-Token': env('NGF_ORDERS_SECRET') },
      body: JSON.stringify(report),
    })
    const body = await res.json().catch(() => ({}))

    if (res.status === 401) {
      fail('NGF rejected the report (401)',
           'Either NGF_ORDERS_SECRET does not match the one generated in admin, or NEXT_PUBLIC_SITE_URL does not match this client\'s site_url exactly. Check Admin → Ecosystem.')
    } else if (!res.ok || !body.ok) {
      fail(`NGF rejected the report (${res.status})`, body.error ?? '')
    } else {
      pass('NGF accepted a synthetic order end to end',
           `Reference ${orderRef}. It should now be visible under Orders in the client's portal — DELETE IT before launch.`)
      console.log(`  ${C.d}Two emails should also have been sent (customer + owner). If they did not arrive, check RESEND_API_KEY and EMAIL_FROM on the NGF app.${C.x}`)
    }
  } catch (err) {
    fail('Could not reach the NGF orders endpoint', String(err))
  }
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log('')
if (failures > 0) {
  console.log(`${C.r}${C.b}${failures} problem${failures === 1 ? '' : 's'} — this site is NOT ready to take payments.${C.x}`)
  if (warnings) console.log(`${C.y}${warnings} warning${warnings === 1 ? '' : 's'}.${C.x}`)
  process.exit(1)
}
console.log(`${C.g}${C.b}Wiring verified.${C.x}${warnings ? ` ${C.y}${warnings} warning${warnings === 1 ? '' : 's'} to review.${C.x}` : ''}`)
console.log(`${C.d}Still to do by hand: a real sandbox purchase through the site, then confirm the order, the emails and the Square dashboard all agree.${C.x}\n`)
