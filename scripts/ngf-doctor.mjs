#!/usr/bin/env node
/**
 * ngf-doctor — mechanical conformance check for an NGF client site.
 *
 *   node scripts/ngf-doctor.mjs          # check the current repo
 *   node scripts/ngf-doctor.mjs --strict # treat warnings as failures too
 *
 * NGF-STANDARDS.md contains ~40 "MUST" rules and nothing enforced them, so
 * sites drifted silently — the caching rule, the SEO launch gate, and the
 * annotation rules were all being broken on live sites at once. This script
 * turns the mechanically-checkable subset into a pass/fail command you can run
 * before launch (and in CI).
 *
 * Exit code 0 = pass, 1 = at least one FAIL (or a WARN under --strict).
 * Zero dependencies — runs anywhere Node runs.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative, extname } from 'node:path'

const ROOT = process.cwd()
const STRICT = process.argv.includes('--strict')

const results = []
const ok = (name, detail = '') => results.push({ level: 'PASS', name, detail })
const warn = (name, detail) => results.push({ level: 'WARN', name, detail })
const fail = (name, detail) => results.push({ level: 'FAIL', name, detail })

const read = (p) => {
  try { return readFileSync(join(ROOT, p), 'utf8') } catch { return null }
}
const has = (p) => existsSync(join(ROOT, p))

/**
 * Strip // and block comments before pattern-matching. Without this the checks
 * fire on prose — e.g. a comment that says "never use cache: 'no-store'" would
 * be reported as the violation it warns against.
 */
const stripComments = (s) =>
  (s ?? '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"\\])\/\/.*$/gm, '$1')

/** All source files under app/ and components/, excluding the legacy site/ dir. */
function sourceFiles() {
  const out = []
  const walk = (dir) => {
    let entries
    try { entries = readdirSync(join(ROOT, dir)) } catch { return }
    for (const e of entries) {
      const rel = join(dir, e)
      if (e === 'node_modules' || e === '.next' || e === 'site') continue
      let st
      try { st = statSync(join(ROOT, rel)) } catch { continue }
      if (st.isDirectory()) walk(rel)
      else if (['.ts', '.tsx', '.js', '.jsx'].includes(extname(e))) out.push(rel)
    }
  }
  walk('app')
  walk('components')
  walk('lib')
  return out
}

const FILES = sourceFiles().map((f) => ({ path: f, src: stripComments(read(f)) }))

// ── 1. Content fetching + caching ────────────────────────────────────────────
const ngfRaw = read('lib/ngf.ts')
const ngf = ngfRaw === null ? null : stripComments(ngfRaw)
if (!ngf) {
  fail('lib/ngf.ts present', 'Missing — the site cannot fetch portal content.')
} else {
  ok('lib/ngf.ts present')
  if (/cache:\s*['"]no-store['"]/.test(ngf)) {
    fail('Content cache mode', "lib/ngf.ts uses cache:'no-store' — hits the database on EVERY pageview. Use next:{revalidate:60,tags:['ngf-content']}.")
  } else if (/next:\s*\{[^}]*revalidate:\s*\d+/.test(ngf)) {
    ok('Content cache mode', 'ISR revalidate is configured.')
  } else {
    warn('Content cache mode', 'Could not find a revalidate option in lib/ngf.ts — verify it is not fetching uncached.')
  }
  if (!/tags:\s*\[\s*['"]ngf-content['"]/.test(ngf)) {
    warn('Content cache tag', "Fetch is missing tags:['ngf-content'] (cosmetic, but keeps sites consistent).")
  }
}

// force-dynamic on a page defeats ISR even when the fetch is correct.
for (const f of FILES) {
  if (/export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/.test(f.src) && /getNgfContent/.test(f.src)) {
    fail('force-dynamic defeats caching', `${f.path} sets force-dynamic AND reads NGF content — the page will bypass the ISR cache entirely.`)
  }
}

// ── 2. Instant publish (/api/revalidate) ─────────────────────────────────────
const revPath = ['app/api/revalidate/route.ts', 'app/api/revalidate/route.js'].find(has)
if (!revPath) {
  warn('/api/revalidate present', 'Missing — publishes will take up to 60s to appear instead of being instant.')
} else {
  const rev = read(revPath)
  if (!/revalidatePath|revalidateTag/.test(rev)) {
    fail('/api/revalidate works', `${revPath} never calls revalidatePath() — it reports success to the portal while busting nothing. This is worse than missing.`)
  } else {
    ok('/api/revalidate works')
  }
  // Fail-open check: `if (expected && secret !== expected)` lets anyone through
  // when the env var is unset.
  if (/if\s*\(\s*expected\s*&&/.test(rev)) {
    fail('/api/revalidate fails closed', `${revPath} only checks the secret when it is set — with the env var missing, any caller gets a 200.`)
  } else {
    ok('/api/revalidate fails closed')
  }
}

// ── 2b. Lead capture reaches the central store ───────────────────────────────
// Every enquiry must be PERSISTED before it is emailed. Email-only routes lose
// the lead outright when a send fails, and they never appear in the client's
// portal. Two conformant shapes: <LeadForm> (posts straight to the store, no
// site route at all), or relayLeadToNgf() called inside an existing route.
{
  const API_ROUTES = FILES.filter((f) => /app[\\/]api[\\/].*route\.tsx?$/.test(f.path))
  const MAILERS = /resend|Resend|sendMail|nodemailer|sendContactNotification|sendNotificationEmail/
  // A lead route either mails someone OR just stores contact details. Catch
  // BOTH: a route that persists an enquiry and notifies nobody is the worse
  // failure — the business never learns a customer got in touch at all.
  const looksLikeLead = (src) =>
    /export\s+async\s+function\s+POST/.test(src) &&
    (MAILERS.test(src) || (/\bemail\b/i.test(src) && /\b(name|phone)\b/i.test(src)))
  // A route "reaches the portal" if it relays to the central lead store, OR if
  // it posts to /api/leads/ingest — the prospect-signup path used by NGF's own
  // marketing site, where an enquiry is a lead for the AGENCY rather than a
  // customer of a client. Both persist; only email-only routes lose the lead.
  const REACHES = /relayLeadToNgf|api\/leads\/ingest/
  const mailing = API_ROUTES.filter((f) => looksLikeLead(f.src) && !/revalidate|\bngf-lead\b/.test(f.path))
  const relayed = mailing.filter((f) => REACHES.test(f.src))
  const orphaned = mailing.filter((f) => !REACHES.test(f.src))
  const usesLeadForm = FILES.some((f) => /<LeadForm[\s/>]/.test(f.src))

  if (orphaned.length) {
    fail(
      'Lead capture reaches the portal',
      `${orphaned.map((f) => f.path).join(', ')} send email but never call relayLeadToNgf(). ` +
        `A failed send loses the enquiry with no record anywhere, and nothing shows in the client's ` +
        `Form Submissions inbox. Call relayLeadToNgf() before the send, or replace the form with <LeadForm>.`,
    )
  } else if (mailing.length || usesLeadForm) {
    ok('Lead capture reaches the portal', usesLeadForm && !mailing.length
      ? '<LeadForm> posts directly to the central store.'
      : `${relayed.length} form route${relayed.length === 1 ? '' : 's'} relay to the central store.`)
  } else {
    warn('Lead capture reaches the portal', 'No form route and no <LeadForm> found — this site captures no enquiries.')
  }
}

// ── 3. Editor bridge ─────────────────────────────────────────────────────────
if (!has('components/NgfEditBridge.tsx')) {
  fail('NgfEditBridge present', 'Missing — the portal editor cannot enter edit mode on this site.')
} else {
  ok('NgfEditBridge present')
  const mounted = FILES.some((f) => /app[\\/]layout\.tsx?$/.test(f.path) && /<NgfEditBridge\s*\/?>/.test(f.src))
  mounted
    ? ok('NgfEditBridge mounted')
    : fail('NgfEditBridge mounted', 'Not rendered in app/layout.tsx — the bridge only works when mounted in the root layout.')

  // Presence + mounting are not enough: a hand-written STUB passes both and then
  // silently does nothing. The sidebar still populates (the portal scrapes raw
  // HTML, not the running bridge), so the site looks fully wired while every
  // click is dead. Check the bridge actually implements the protocol.
  const bridge = read('components/NgfEditBridge.tsx') ?? ''
  const BRIDGE_MIN_BYTES = 20000 // canonical is ~43 KB; the smallest real one shipped is ~24 KB
  const required = ['ngfReady', 'setEditMode', 'contentUpdate', 'fieldClick', 'ngfDefault']
  const missingHandlers = required.filter((h) => !bridge.includes(h))
  const versionMatch = bridge.match(/NGF_BRIDGE_VERSION\s*=\s*['"]([^'"]+)['"]/)

  if (missingHandlers.length) {
    fail(
      'NgfEditBridge is the real bridge',
      `Missing protocol handler(s): ${missingHandlers.join(', ')}. This looks like a stub or a ` +
        `hand-written reimplementation. Run 'npm run sync-ngf' — a partial bridge fails SILENTLY ` +
        `(sidebar populates, clicking does nothing), which is worse than none.`,
    )
  } else if (bridge.length < BRIDGE_MIN_BYTES) {
    fail(
      'NgfEditBridge is the real bridge',
      `Only ${bridge.length} bytes — the canonical bridge is ~43 KB. This is a truncated or partial copy. ` +
        `Run 'npm run sync-ngf'.`,
    )
  } else if (!versionMatch) {
    // Every synced bridge exports NGF_BRIDGE_VERSION. Its absence means this copy
    // predates versioning, i.e. it was copied before drift was detectable at all.
    warn(
      'NgfEditBridge is the real bridge',
      `${(bridge.length / 1024).toFixed(0)} KB and structurally complete, but it exports no ` +
        `NGF_BRIDGE_VERSION — so it predates version tracking and cannot be checked for drift. ` +
        `Run 'npm run sync-ngf' to pull the current canonical copy.`,
    )
  } else {
    ok('NgfEditBridge is the real bridge', `v${versionMatch[1]}, ${(bridge.length / 1024).toFixed(0)} KB, all protocol handlers present.`)
  }
}

// ── 2b2. Cookie consent wiring ───────────────────────────────────────────────
// GA4 sets cookies, so it must be gated behind hasCookieConsent(). But the banner
// only renders when NEXT_PUBLIC_COOKIE_ANALYTICS === '1' — so a site that gates
// analytics WITHOUT setting that var can never obtain consent, and analytics
// silently never load. The two settings are a pair; neither works alone.
{
  const envExample = read('.env.local.example') ?? ''
  // The canonical CookieConsent component itself contains every string below —
  // hasCookieConsent, resetCookieConsent, NEXT_PUBLIC_COOKIE_ANALYTICS — in its
  // definitions and its own doc comments. Scanning it would make every check
  // self-satisfying and pass a site that wires up none of it. Exclude it and look
  // only at how the REST of the site uses the API.
  const CONSENT_SRC = /components[\\/]CookieConsent\.tsx?$/
  const consumers = FILES.filter((f) => !CONSENT_SRC.test(f.path))

  const usesGa = consumers.some((f) => /NEXT_PUBLIC_GA_ID|googletagmanager/.test(f.src))
  const gatesConsent = consumers.some((f) => /hasCookieConsent/.test(f.src))
  const hasBanner = has('components/CookieConsent.tsx')
  const declaresVar = /NEXT_PUBLIC_COOKIE_ANALYTICS/.test(envExample) ||
    consumers.some((f) => /NEXT_PUBLIC_COOKIE_ANALYTICS/.test(f.src))

  if (!usesGa) {
    ok('Cookie consent wiring', 'No cookie-based analytics on this site.')
  } else if (!hasBanner) {
    fail(
      'Cookie consent wiring',
      'This site loads GA4 but has no components/CookieConsent.tsx. Cookie-based analytics must not ' +
        "run before consent. Run 'npm run sync-ngf'.",
    )
  } else if (!gatesConsent) {
    fail(
      'Cookie consent wiring',
      'GA4 is present but nothing calls hasCookieConsent() — analytics load before the visitor agrees. ' +
        "Gate the analytics component: `if (!id || !hasCookieConsent()) return null`.",
    )
  } else if (!declaresVar) {
    fail(
      'Cookie consent wiring',
      'GA4 is correctly gated behind hasCookieConsent(), but NEXT_PUBLIC_COOKIE_ANALYTICS is declared ' +
        'nowhere. The banner only renders when it is "1", so consent can never be granted and analytics ' +
        'will NEVER load — silently. Add it to .env.local.example and set it to 1 in Vercel.',
    )
  } else {
    ok('Cookie consent wiring', 'GA4 gated behind consent, banner env var declared.')
  }

  // Consent must be as easy to withdraw as to give. The banner only shows when no
  // choice is stored, so without a reset control the first click is permanent.
  if (hasBanner && usesGa) {
    const canWithdraw = consumers.some((f) => /resetCookieConsent/.test(f.src))
    canWithdraw
      ? ok('Consent can be withdrawn')
      : warn(
          'Consent can be withdrawn',
          'Nothing calls resetCookieConsent(). Once a visitor accepts or declines, the banner never ' +
            'returns and they can never change their mind. Add a "Cookie settings" control in the footer ' +
            'or privacy page.',
        )
  }
}

// ── 2c. Honeypot naming ──────────────────────────────────────────────────────
// A honeypot must be NON-SEMANTIC. Browsers and password managers autofill by
// field name, so a hidden input called "company" / "website" / "address2" gets
// populated for real users — and the form then discards their enquiry as spam.
// Silent, and it looks like the form simply doesn't work.
{
  const SEMANTIC = ['company', 'website', 'url', 'address2', 'phone2', 'fax', 'organization', 'business']
  const offenders = []
  for (const f of FILES) {
    if (!/\.(tsx?|jsx?)$/.test(f.path)) continue
    // Only consider inputs that look deliberately hidden (i.e. a honeypot).
    if (!/honeypot|sr-only|display:\s*none|hidden|left-\[-9999px\]|opacity-0/i.test(f.src)) continue
    for (const name of SEMANTIC) {
      const re = new RegExp(`name=["'\`]${name}["'\`]`, 'i')
      if (re.test(f.src)) offenders.push(`${f.path} (name="${name}")`)
    }
  }
  if (offenders.length) {
    warn(
      'Honeypot is non-semantic',
      `Possible honeypot using an autofill-able name: ${offenders.join(', ')}. Browsers and password ` +
        `managers fill by field name, so real users populate it and their enquiry is silently discarded ` +
        `as spam. Rename to a non-semantic value — the standard is "_gotcha". (If this is a REAL visible ` +
        `field rather than a honeypot, ignore this.)`,
    )
  } else {
    ok('Honeypot is non-semantic')
  }
}

// ── 3bb. No local copy of the standards doc ──────────────────────────────────
// The canonical doc lives in ngf-client-starter and is fetched over a raw URL.
// A fork inherits the file, and from that moment it is a stale snapshot that a
// future session will read INSTEAD of the canonical one. That is exactly how
// three client repos ended up carrying a 604-line copy whose only unique content
// was the withdrawn "copy the bridge from a reference site" instruction.
// The starter itself is the one legitimate holder, so exempt it.
{
  const isStarter = (() => {
    try { return read('.git/config')?.includes('ngf-client-starter') ?? false } catch { return false }
  })()
  if (has('NGF-STANDARDS.md') && !isStarter) {
    const local = read('NGF-STANDARDS.md') ?? ''
    // A short pointer stub is fine — it exists to redirect, not to be read as the standard.
    const isStub = local.length < 3000 && /raw\.githubusercontent\.com/.test(local)
    if (isStub) {
      ok('No local standards copy', 'Pointer stub only.')
    } else {
      fail(
        'No local standards copy',
        `This repo carries its own NGF-STANDARDS.md (${local.split('\n').length} lines). It is stale by ` +
          `definition — the canonical doc lives in ngf-client-starter and is fetched over a raw URL. ` +
          `Delete it, or replace it with a short stub linking to the canonical copy.`,
      )
    }
  } else if (!isStarter) {
    ok('No local standards copy')
  }
}

// ── 3c. Canonical files are syncable, not hand-maintained ────────────────────
// The bridge and friends are copied per-site rather than installed, which is how
// 7 of 9 live sites ended up on a drifted bridge. sync-ngf.mjs makes the copy
// reproducible and 'npm run sync-ngf:check' makes drift detectable in CI.
if (!has('scripts/sync-ngf.mjs')) {
  warn(
    'Canonical files are syncable',
    "No scripts/sync-ngf.mjs — this site's bridge/LeadForm/doctor can only be updated by hand-copying, " +
      "which is how sites drift. Copy it from ngf-client-starter and add \"sync-ngf\": \"node scripts/sync-ngf.mjs\".",
  )
} else {
  ok('Canonical files are syncable', "Run 'npm run sync-ngf:check' to verify against canonical.")
}

// ── 3b. Portal binding marker (the site must be BINDABLE) ────────────────────
// Setting client_configs.site_url is gated server-side: the admin fetches the
// site and refuses with 422 unless the HTML carries an NGF marker. site_url is
// the ONLY string joining a portal account to a website, so failing this means
// the site can never be attached to a client — no content, no editor, ever.
// Annotated fields now count as markers, so a properly annotated site passes
// either way; the meta tag is what saves a site with no annotations yet.
{
  const layout = FILES.find((f) => /app[\\/]layout\.tsx?$/.test(f.path))
  const annotated = FILES.some((f) => /data-ngf-(field|group)/.test(f.src))
  const hasMeta = layout ? /ngf-public-api/.test(layout.src) : false

  if (hasMeta) {
    ok('Portal binding marker', "app/layout.tsx declares 'ngf-public-api'.")
  } else if (annotated) {
    warn(
      'Portal binding marker',
      "app/layout.tsx has no 'ngf-public-api' meta tag. Binding still works (data-ngf-* markup " +
        'counts), but add it to metadata.other so the site stays bindable even before any field is annotated.',
    )
  } else {
    fail(
      'Portal binding marker',
      "No 'ngf-public-api' meta tag in app/layout.tsx and no data-ngf-* markup anywhere. The admin " +
        'cannot set this client\'s site_url (422), so the site can never be bound to a portal account. ' +
        "Add to app/layout.tsx: metadata.other = { 'ngf-public-api': 'https://app.ngfsystems.com/api/public/content' }",
    )
  }
}

// ── 4. CSP / security headers ────────────────────────────────────────────────
const cfg = read('next.config.ts') ?? read('next.config.js') ?? read('next.config.mjs')
if (!cfg) {
  fail('next.config present', 'No next.config found.')
} else {
  /frame-ancestors[^;]*app\.ngfsystems\.com/.test(cfg)
    ? ok('CSP frame-ancestors', 'Portal editor can iframe this site.')
    : fail('CSP frame-ancestors', "Missing the app.ngfsystems.com allowance — the editor's live preview will be blocked by the browser.")

  // Next.js assembles headers into a plain object — set-cookie is the only key
  // that accumulates, everything else is last-write-wins across ALL rules. Two
  // Content-Security-Policy entries therefore ship as ONE header and one policy
  // is destroyed with no warning: either the security baseline or frame-ancestors,
  // depending on order. Verified empirically against a real `next start`.
  const cspEntries = (cfg.match(/['"]Content-Security-Policy['"]/g) ?? []).length
  if (cspEntries > 1) {
    fail(
      'One CSP header only',
      `${cspEntries} Content-Security-Policy entries in next.config. Next emits only the LAST one — the ` +
        `other policy is silently dropped (baseline directives or frame-ancestors, depending on order). ` +
        `Merge them: frame-ancestors is a DIRECTIVE inside the single policy, not a second header.`,
    )
  } else if (cspEntries === 1) {
    // A lone frame-ancestors policy is a legal CSP, so nothing errors — the site
    // just has no baseline. 5 of 9 audited sites were in exactly this state.
    const baseline = ['default-src', 'object-src', 'base-uri', 'form-action']
    const missing = baseline.filter((d) => !cfg.includes(d))
    missing.length
      ? warn(
          'CSP baseline directives',
          `CSP has frame-ancestors but is missing ${missing.join(', ')}. The site is iframe-protected but ` +
            `otherwise unrestricted. Copy the full policy from NGF-STANDARDS "Security baseline".`,
        )
      : ok('CSP baseline directives')
  }

  for (const [key, label] of [
    ['X-Content-Type-Options', 'X-Content-Type-Options'],
    ['Referrer-Policy', 'Referrer-Policy'],
    ['Permissions-Policy', 'Permissions-Policy'],
  ]) {
    cfg.includes(key) ? ok(`Security header ${label}`) : warn(`Security header ${label}`, 'Missing from next.config headers().')
  }
}

// ── 5. SEO launch gate ───────────────────────────────────────────────────────
has('app/sitemap.ts') || has('app/sitemap.js')
  ? ok('app/sitemap.ts')
  : fail('app/sitemap.ts', 'Missing — hard blocker in the SEO launch gate.')
has('app/robots.ts') || has('app/robots.js')
  ? ok('app/robots.ts')
  : fail('app/robots.ts', 'Missing — hard blocker in the SEO launch gate.')

const hasJsonLd = FILES.some((f) => /application\/ld\+json/.test(f.src))
hasJsonLd ? ok('Structured data (JSON-LD)') : warn('Structured data (JSON-LD)', 'No LocalBusiness JSON-LD found — required by the SEO launch gate before launch.')

// ── 6. Build cost discipline ─────────────────────────────────────────────────
const vercelJson = read('vercel.json')
if (!vercelJson) {
  warn('vercel.json ignoreCommand', 'No vercel.json — every commit (including docs-only) burns a build.')
} else if (!/ignoreCommand/.test(vercelJson)) {
  warn('vercel.json ignoreCommand', 'No ignoreCommand — docs-only commits still trigger builds.')
} else {
  ok('vercel.json ignoreCommand')
}

// ── 6a2. The repo must be connected to a remote ──────────────────────────────
// A folder under GitHub/ is not necessarily a clone. One live client site was a
// DETACHED snapshot: no .git at all, while a public repo of the same name existed
// and was ahead of it. Edits there go nowhere — the live site keeps serving the
// old code — and `git init` + push would fork or clobber the real repo. Catch it
// before any work is done rather than after.
{
  if (!has('.git')) {
    fail(
      'Repo is connected to a remote',
      'No .git directory — this folder is NOT a clone. Check GitHub for a repo of the same name before ' +
        'editing anything: if one exists, this is a detached snapshot and your changes will never reach ' +
        'the live site. Clone the real repo and work there. Do NOT `git init` this folder — that forks ' +
        'or clobbers the remote.',
    )
  } else {
    const gitCfg = read('.git/config') ?? ''
    // Assigned to a variable deliberately: a line starting with `/` after an
    // expression is parsed as division, not a regex literal (ASI trap).
    const hasRemote = /\[remote /.test(gitCfg)
    hasRemote
      ? ok('Repo is connected to a remote')
      : fail(
          'Repo is connected to a remote',
          'This is a git repo with NO remote configured. Nothing you commit here reaches the live site. ' +
            'Add the correct origin — do not create a new repo if one already exists on GitHub.',
        )
  }
}

// ── 6b. The doctor itself must live in this repo ─────────────────────────────
// A `doctor` script pointing at ../ngf-client-starter resolves on the machine
// that wrote it and nowhere else — not on Vercel, not in a fresh clone, not in
// CI. The launch gate then silently cannot run in the only environment where it
// matters. Auditing a sibling repo from the CLI is fine; leaving it in
// package.json is not.
{
  const pkgRaw = read('package.json')
  if (!pkgRaw) {
    fail('Doctor is self-contained', 'No package.json found.')
  } else {
    let doctorScript = ''
    try {
      doctorScript = (JSON.parse(pkgRaw).scripts ?? {}).doctor ?? ''
    } catch {
      /* malformed package.json is reported elsewhere */
    }
    if (!doctorScript) {
      warn('Doctor is self-contained', 'No "doctor" script in package.json — add "doctor": "node scripts/ngf-doctor.mjs".')
    } else if (doctorScript.includes('..')) {
      fail(
        'Doctor is self-contained',
        `"doctor": "${doctorScript}" points outside the repo. It does not resolve on Vercel or in a fresh ` +
          `clone, so the launch gate cannot run in CI. Copy scripts/ngf-doctor.mjs into this repo and use ` +
          `"doctor": "node scripts/ngf-doctor.mjs".`,
      )
    } else if (!has('scripts/ngf-doctor.mjs')) {
      fail('Doctor is self-contained', 'scripts/ngf-doctor.mjs is missing from this repo.')
    } else {
      ok('Doctor is self-contained')
    }
  }
}

// ── 7. Content fallback correctness (?? vs ||) ───────────────────────────────
const nullishHits = []
for (const f of FILES) {
  const re = /content\[[^\]]+\]\s*\?\?/g
  const n = (f.src.match(re) || []).length
  if (n) nullishHits.push(`${f.path} (${n})`)
}
nullishHits.length
  ? fail('Fallbacks use || not ??', `?? after a content[...] lookup in: ${nullishHits.join(', ')}. Published '' will render blank instead of falling back.`)
  : ok('Fallbacks use || not ??')

// ── 8. Annotation correctness (the scraper silently drops bad fields) ────────
const OPEN_TAG = /<[a-zA-Z][^>]*data-ngf-field[^>]*>/g
let missingAttrs = 0
let fieldCount = 0
for (const f of FILES) {
  for (const tag of f.src.match(OPEN_TAG) || []) {
    fieldCount++
    if (!/data-ngf-label/.test(tag) || !/data-ngf-section/.test(tag)) missingAttrs++
  }
}
if (fieldCount === 0) {
  warn('Editable fields annotated', 'No data-ngf-field elements found — nothing on this site is editable from the portal.')
} else if (missingAttrs) {
  fail('Annotation completeness', `${missingAttrs} of ${fieldCount} data-ngf-field elements are missing data-ngf-label or data-ngf-section. The scraper SILENTLY skips these — they will never appear in the editor.`)
} else {
  ok('Annotation completeness', `${fieldCount} editable fields, all with label + section.`)
}

// Repeatable groups: declared once, and exactly two path segments deep.
//
// The value may be a string literal, a template literal with interpolation
// (`property.${slug}.images`), or a bare JSX identifier (data-ngf-group={g}).
// For template literals we substitute a placeholder for each ${...} so the
// SEGMENT COUNT is still checked — that is what actually matters. A bare
// identifier can't be resolved statically, so it is surfaced for manual review
// rather than silently passing.
// The bridge is library code the site copies verbatim — it CONTAINS selector
// strings like `[data-ngf-group="${e.data.group}"]` which are not annotations.
// Scanning it produces phantom findings, so exclude it from markup checks.
const MARKUP_FILES = FILES.filter((f) => !/NgfEditBridge\.tsx?$/.test(f.path))

const groupDecls = new Map()
const dynamicGroups = new Set()
const dupWithinFile = new Set()
for (const f of MARKUP_FILES) {
  const seenHere = new Map()
  // literal:  data-ngf-group="a.b"  |  data-ngf-group={`a.${x}.b`}
  for (const m of f.src.matchAll(/data-ngf-group=(?:["']([^"']+)["']|\{`([^`]+)`\})/g)) {
    const raw = m[1] ?? m[2]
    const path = raw.replace(/\$\{[^}]*\}/g, '_')
    groupDecls.set(path, (groupDecls.get(path) ?? 0) + 1)
    // The duplicate rule is about ONE PAGE declaring a group twice (the classic
    // desktop + mobile layout mistake), which makes the editor show two
    // identical sidebar sections. The SAME group legitimately appears on
    // several pages — e.g. a team list rendered on both / and /team — and the
    // scraper only ever reads one page, so counting across files is a false
    // positive. Track per-file.
    seenHere.set(path, (seenHere.get(path) ?? 0) + 1)
    if (seenHere.get(path) === 2) dupWithinFile.add(`${f.path} → ${path}`)
  }
  // bare identifier: data-ngf-group={someVar}
  for (const m of f.src.matchAll(/data-ngf-group=\{([A-Za-z_$][\w$]*)\}/g)) {
    dynamicGroups.set?.(m[1]) ?? dynamicGroups.add(`${f.path} → {${m[1]}}`)
  }
}
if (dynamicGroups.size) {
  warn('Group path is computed at runtime', `${[...dynamicGroups].join(', ')} — cannot be checked statically. Verify by hand that the resolved value is EXACTLY two segments (section.array); if it is deeper, add/remove/reorder silently no-op.`)
}
dupWithinFile.size
  ? fail('One data-ngf-group per list', `Declared twice in the SAME file: ${[...dupWithinFile].join(', ')}. The editor sidebar will show duplicate sections — usually a desktop and a mobile layout both carrying the attribute. Declare the group once; individual field annotations on both layouts are fine.`)
  : ok('One data-ngf-group per list')

const badDepth = [...groupDecls.keys()].filter((p) => p.split('.').length !== 2)
badDepth.length
  ? fail('Group paths are 2 segments', `${badDepth.join(', ')} — add/remove/reorder controls silently no-op unless the path is exactly section.array.`)
  : ok('Group paths are 2 segments')

// next/image with fill on an annotated element — bridge can't reach the <img>.
for (const f of FILES) {
  if (/<Image[^>]*\bfill\b[^>]*data-ngf-field/s.test(f.src) || /<Image[^>]*data-ngf-field[^>]*\bfill\b/s.test(f.src)) {
    fail('Image fields use plain <img>', `${f.path} annotates a next/image with fill — the bridge cannot read or write its src. Use a plain <img>.`)
  }
}

// ── 9. Env wiring ────────────────────────────────────────────────────────────
const envExample = read('.env.local.example') ?? read('.env.example') ?? ''
const envDocs = envExample + (read('README.md') ?? '')
const siteUrlDocumented = /NEXT_PUBLIC_SITE_URL/.test(envDocs)
if (siteUrlDocumented) {
  ok('NEXT_PUBLIC_SITE_URL documented')
} else {
  warn('NEXT_PUBLIC_SITE_URL documented', 'Not mentioned in .env.local.example — it MUST match client_configs.site_url exactly or the site renders only fallbacks.')
}

// ── Report ───────────────────────────────────────────────────────────────────
const COLOR = { PASS: '\x1b[32m', WARN: '\x1b[33m', FAIL: '\x1b[31m', reset: '\x1b[0m' }
const ICON = { PASS: '✓', WARN: '!', FAIL: '✕' }

console.log(`\nngf-doctor — ${relative(process.cwd(), ROOT) || '.'}\n`)
for (const level of ['FAIL', 'WARN', 'PASS']) {
  for (const r of results.filter((x) => x.level === level)) {
    const c = COLOR[r.level]
    console.log(`${c}${ICON[r.level]}${COLOR.reset} ${r.name}${r.detail ? `\n    ${r.detail}` : ''}`)
  }
}

const fails = results.filter((r) => r.level === 'FAIL').length
const warns = results.filter((r) => r.level === 'WARN').length
const passes = results.filter((r) => r.level === 'PASS').length
console.log(`\n${passes} passed · ${warns} warning${warns === 1 ? '' : 's'} · ${fails} failure${fails === 1 ? '' : 's'}\n`)

if (fails > 0 || (STRICT && warns > 0)) {
  console.log('Not launch-ready. See NGF-STANDARDS.md for each rule.\n')
  process.exit(1)
}
process.exit(0)
