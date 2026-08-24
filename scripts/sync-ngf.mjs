#!/usr/bin/env node
/**
 * sync-ngf — fetch the canonical NGF integration files into this repo.
 *
 * WHY THIS EXISTS
 * ---------------
 * NGF-STANDARDS.md can describe how the editor bridge behaves, but it cannot
 * carry 43 KB of source. Every site therefore *copied* the bridge, and copies
 * drift: an audit of 9 live sites found 7 on a stale bridge (9.9 KB to 38.6 KB
 * against a ~43 KB canonical), each failing in a different, silent way.
 *
 * The failure mode is the nastiest one available. The portal builds its editor
 * sidebar by scraping the site's raw HTML, NOT by talking to the bridge — so a
 * stub or half-version bridge produces a sidebar that populates perfectly and an
 * editor where nothing happens when you click. It reads as "the editor is
 * broken", not "this site is wrong".
 *
 * So: these files are never hand-written and never hand-edited. They are synced.
 * This turns "copy the bridge verbatim from the starter" — an instruction a
 * human or an agent can only follow if they happen to have the starter checked
 * out — into a command anyone can run.
 *
 * USAGE
 *   node scripts/sync-ngf.mjs              # write canonical files into place
 *   node scripts/sync-ngf.mjs --check      # verify only; exit 1 if anything drifted
 *   node scripts/sync-ngf.mjs --dry-run    # show what would change, write nothing
 *   node scripts/sync-ngf.mjs --ref=v2     # pin to a branch, tag or commit sha
 *   node scripts/sync-ngf.mjs --from=../ngf-client-starter   # copy from a local clone (offline)
 *
 * Zero dependencies, Node 18+ (global fetch). Same constraint as ngf-doctor:
 * it has to run in a repo that has not npm-installed anything yet.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const ROOT = process.cwd()
const args = process.argv.slice(2)
const flag = (name) => args.some((a) => a === `--${name}`)
const value = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : null
}

const CHECK = flag('check')
const DRY = flag('dry-run')
const REF = value('ref') || 'main'
const FROM = value('from')

const REPO = 'Nick-NGFsystems/ngf-client-starter'
const RAW = `https://raw.githubusercontent.com/${REPO}/${REF}`

/**
 * mode 'canonical' — byte-identical on every NGF site. Always overwritten, and
 *                    verified by --check. Hand-edits here are bugs.
 * mode 'once'      — a starting point that each site then customizes. Written
 *                    only when absent; never overwritten, never checked.
 */
const MANIFEST = [
  { path: 'components/NgfEditBridge.tsx', mode: 'canonical', note: 'editor bridge — the one that must never drift' },
  { path: 'components/LeadForm.tsx',      mode: 'canonical', note: 'lead capture, posts to the central store' },
  { path: 'components/CookieConsent.tsx', mode: 'canonical', note: 'consent gate + hasCookieConsent()' },
  { path: 'lib/ngf.ts',                   mode: 'canonical', note: 'getNgfContent / getItems / ngfEndpoints' },
  { path: 'lib/ngf-lead.ts',              mode: 'canonical', note: 'relayLeadToNgf() for retrofit sites' },
  { path: 'app/api/revalidate/route.ts',  mode: 'canonical', note: 'instant publish; must fail closed' },
  { path: 'lib/ngf-order.ts',             mode: 'canonical', note: 'order contract + reportOrderToNgf — a drifted copy mis-reports real money' },
  { path: 'lib/ngf-store.ts',             mode: 'canonical', note: 'client-owned shipping/tax + the quote formula NGF re-checks' },
  { path: 'scripts/ngf-verify-orders.mjs', mode: 'canonical', note: 'proves payment wiring before a real order' },
  { path: 'lib/square-checkout.ts',       mode: 'once',      note: 'Square adapter — replace wholesale for another provider' },
  { path: 'scripts/ngf-doctor.mjs',       mode: 'canonical', note: 'the launch gate' },
  { path: 'scripts/sync-ngf.mjs',         mode: 'canonical', note: 'this script' },
  { path: 'app/privacy/page.tsx',         mode: 'once',      note: 'privacy policy — adapt to your layout components' },
]

const C = process.stdout.isTTY
  ? { g: '\x1b[32m', r: '\x1b[31m', y: '\x1b[33m', d: '\x1b[2m', b: '\x1b[1m', x: '\x1b[0m' }
  : { g: '', r: '', y: '', d: '', b: '', x: '' }

// A token is only needed while ngf-client-starter is a private repo. Read from
// the environment; never accept one as a CLI arg (it would land in shell history
// and in CI logs).
const TOKEN = process.env.NGF_SYNC_TOKEN || process.env.GITHUB_TOKEN || process.env.GH_TOKEN || ''

let sawAuthFailure = false

async function fetchOne(path) {
  if (FROM) {
    const local = resolve(ROOT, FROM, path)
    if (!existsSync(local)) throw new Error(`not found in --from source: ${local}`)
    return readFileSync(local, 'utf8')
  }
  const headers = TOKEN
    ? { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github.raw' }
    : {}
  // With a token, go through the API (raw.githubusercontent does not accept
  // bearer tokens for private repos); without one, plain raw is fine and fast.
  const url = TOKEN
    ? `https://api.github.com/repos/${REPO}/contents/${path}?ref=${encodeURIComponent(REF)}`
    : `${RAW}/${path}`
  const res = await fetch(url, { headers })
  if (!res.ok) {
    if (res.status === 404 || res.status === 401 || res.status === 403) sawAuthFailure = true
    throw new Error(`HTTP ${res.status} fetching ${path}`)
  }
  return res.text()
}

// Normalize line endings before comparing. Git checkouts on Windows convert LF
// to CRLF, which would otherwise report every file as drifted on every run.
const norm = (s) => s.replace(/\r\n/g, '\n')

function bridgeVersion(src) {
  const m = src && src.match(/NGF_BRIDGE_VERSION\s*=\s*['"]([^'"]+)['"]/)
  return m ? m[1] : null
}

async function main() {
  if (!existsSync(join(ROOT, 'package.json'))) {
    console.error(`${C.r}✕${C.x} No package.json in ${ROOT}.`)
    console.error(`  Run this from the root of the site repo.`)
    process.exit(1)
  }

  // Syncing the starter from itself would overwrite in-progress edits to the
  // very files it is the source of truth for. Detect it by git remote — the
  // starter's package.json is named "ngf-client-site" (it becomes a site), so
  // the package name cannot be used for this.
  let isStarter = false
  if (!FROM) {
    try {
      isStarter = readFileSync(join(ROOT, '.git', 'config'), 'utf8').includes('ngf-client-starter')
    } catch { /* not a git checkout — treat as a normal site */ }
  }

  console.log(`${C.b}sync-ngf${C.x} ${C.d}${FROM ? `from ${FROM}` : `${REPO}@${REF}`}${C.x}`)
  if (isStarter) {
    console.log(`${C.y}!${C.x} This IS the starter — it is the source of truth, nothing to sync.`)
    console.log(`  ${C.d}Edit the files here directly; other repos sync FROM this one.${C.x}`)
    process.exit(0)
  }
  console.log('')

  const changed = []
  const drifted = []
  const failed = []
  const seeded = [] // 'once' files created fresh — these need adapting, see below

  for (const item of MANIFEST) {
    const dest = join(ROOT, item.path)
    const exists = existsSync(dest)

    if (item.mode === 'once' && exists) {
      console.log(`${C.d}·${C.x} ${item.path} ${C.d}— kept (customized per site)${C.x}`)
      continue
    }

    let remote
    try {
      remote = await fetchOne(item.path)
    } catch (err) {
      failed.push({ path: item.path, err: err.message })
      console.log(`${C.r}✕${C.x} ${item.path} ${C.d}— ${err.message}${C.x}`)
      continue
    }

    const local = exists ? readFileSync(dest, 'utf8') : null
    const same = local !== null && norm(local) === norm(remote)

    if (same) {
      const v = bridgeVersion(remote)
      console.log(`${C.g}✓${C.x} ${item.path}${v ? ` ${C.d}(v${v})${C.x}` : ''}`)
      continue
    }

    // Drifted or missing.
    const label = exists ? 'DRIFTED' : 'missing'
    if (item.mode === 'canonical') drifted.push({ ...item, exists })

    if (CHECK || DRY) {
      const delta = exists ? `${local.length} → ${remote.length} bytes` : `would create, ${remote.length} bytes`
      console.log(`${C.r}✕${C.x} ${item.path} ${C.d}— ${label} (${delta})${C.x}`)
      continue
    }

    mkdirSync(dirname(dest), { recursive: true })
    writeFileSync(dest, remote)
    changed.push(item.path)
    if (item.mode === 'once') seeded.push(item.path)
    const v = bridgeVersion(remote)
    console.log(`${C.y}↻${C.x} ${item.path} ${C.d}— ${exists ? 'updated' : 'created'}${v ? `, v${v}` : ''}${C.x}`)
  }

  console.log('')

  if (failed.length) {
    console.error(`${C.r}${failed.length} file(s) could not be fetched.${C.x}`)
    if (sawAuthFailure && !TOKEN) {
      console.error('')
      console.error(`  ${C.b}${REPO} is private, so an unauthenticated fetch gets a 404.${C.x}`)
      console.error(`  Pick one:`)
      console.error(`    ${C.d}1. Sync from a local clone:  node scripts/sync-ngf.mjs --from=../ngf-client-starter${C.x}`)
      console.error(`    ${C.d}2. Export a token with read access, then re-run:${C.x}`)
      console.error(`       ${C.d}NGF_SYNC_TOKEN=<token> npm run sync-ngf${C.x}`)
      console.error(`    ${C.d}3. Make the starter repo public — then this command needs no auth at all.${C.x}`)
    } else if (sawAuthFailure && TOKEN) {
      console.error(`  ${C.d}A token was supplied but rejected. Check it has 'repo' read scope and has not expired.${C.x}`)
    } else if (!FROM) {
      console.error(`  ${C.d}No network? Use a local clone:  node scripts/sync-ngf.mjs --from=../ngf-client-starter${C.x}`)
    }
    process.exit(1)
  }

  if (CHECK) {
    if (drifted.length) {
      console.error(`${C.r}✕ ${drifted.length} canonical file(s) drifted from ${REPO}@${REF}.${C.x}`)
      console.error(`  ${C.d}Fix:  npm run sync-ngf${C.x}`)
      console.error(`  ${C.d}These files are never hand-edited — a drifted bridge fails SILENTLY.${C.x}`)
      process.exit(1)
    }
    console.log(`${C.g}✓ All canonical files match ${REPO}@${REF}.${C.x}`)
    return
  }

  if (DRY) {
    console.log(drifted.length ? `${drifted.length} file(s) would change.` : 'Nothing would change.')
    return
  }

  if (!changed.length) {
    console.log(`${C.g}✓ Already up to date.${C.x}`)
    return
  }

  console.log(`${C.g}✓ Synced ${changed.length} file(s).${C.x}`)
  console.log(`  ${C.d}Review with 'git diff', then run 'npm run doctor'.${C.x}`)
  if (changed.includes('components/NgfEditBridge.tsx')) {
    console.log(`  ${C.d}Bridge changed — redeploy before testing the portal editor.${C.x}`)
  }

  // A freshly-seeded 'once' file is canonical boilerplate that has NOT been
  // adapted to this site yet. It imports the starter's layout components with
  // the starter's prop signatures, so it will usually fail to typecheck until
  // you wire it up. Saying so here turns a confusing build error into an
  // expected next step.
  if (seeded.length) {
    console.log('')
    console.log(`${C.y}!${C.x} ${C.b}${seeded.length} file(s) were seeded and still need adapting:${C.x}`)
    for (const p of seeded) console.log(`    ${p}`)
    console.log(`  ${C.d}These are starting points, not drop-ins — they reference the starter's layout${C.x}`)
    console.log(`  ${C.d}components and prop shapes. Expect typecheck errors until you wire them to${C.x}`)
    console.log(`  ${C.d}this site's own components. They are yours now; sync-ngf will not touch them again.${C.x}`)
    console.log(`  ${C.d}Run 'npx tsc --noEmit' to see what needs changing.${C.x}`)
  }
}

main().catch((err) => {
  console.error(`${C.r}sync-ngf failed:${C.x} ${err.message}`)
  process.exit(1)
})
