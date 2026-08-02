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

// ── 3. Editor bridge ─────────────────────────────────────────────────────────
if (!has('components/NgfEditBridge.tsx')) {
  fail('NgfEditBridge present', 'Missing — the portal editor cannot enter edit mode on this site.')
} else {
  ok('NgfEditBridge present')
  const mounted = FILES.some((f) => /app[\\/]layout\.tsx?$/.test(f.path) && /<NgfEditBridge\s*\/?>/.test(f.src))
  mounted
    ? ok('NgfEditBridge mounted')
    : fail('NgfEditBridge mounted', 'Not rendered in app/layout.tsx — the bridge only works when mounted in the root layout.')
}

// ── 4. CSP / security headers ────────────────────────────────────────────────
const cfg = read('next.config.ts') ?? read('next.config.js') ?? read('next.config.mjs')
if (!cfg) {
  fail('next.config present', 'No next.config found.')
} else {
  /frame-ancestors[^;]*app\.ngfsystems\.com/.test(cfg)
    ? ok('CSP frame-ancestors', 'Portal editor can iframe this site.')
    : fail('CSP frame-ancestors', "Missing the app.ngfsystems.com allowance — the editor's live preview will be blocked by the browser.")

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
for (const f of MARKUP_FILES) {
  // literal:  data-ngf-group="a.b"  |  data-ngf-group={`a.${x}.b`}
  for (const m of f.src.matchAll(/data-ngf-group=(?:["']([^"']+)["']|\{`([^`]+)`\})/g)) {
    const raw = m[1] ?? m[2]
    const path = raw.replace(/\$\{[^}]*\}/g, '_')
    groupDecls.set(path, (groupDecls.get(path) ?? 0) + 1)
  }
  // bare identifier: data-ngf-group={someVar}
  for (const m of f.src.matchAll(/data-ngf-group=\{([A-Za-z_$][\w$]*)\}/g)) {
    dynamicGroups.set?.(m[1]) ?? dynamicGroups.add(`${f.path} → {${m[1]}}`)
  }
}
if (dynamicGroups.size) {
  warn('Group path is computed at runtime', `${[...dynamicGroups].join(', ')} — cannot be checked statically. Verify by hand that the resolved value is EXACTLY two segments (section.array); if it is deeper, add/remove/reorder silently no-op.`)
}
const dupGroups = [...groupDecls.entries()].filter(([, n]) => n > 1).map(([p]) => p)
dupGroups.length
  ? fail('One data-ngf-group per list', `Declared more than once: ${dupGroups.join(', ')}. The editor sidebar will show duplicate sections (usually a desktop+mobile layout both carrying the attribute).`)
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
