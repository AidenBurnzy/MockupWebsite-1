import Link from 'next/link'
import { getNgfContent } from '@/lib/ngf'

// ─────────────────────────────────────────────────────────────────────────────
// STARTER PRIVACY & COOKIE POLICY — plain-English boilerplate for a small
// business marketing site with a contact/booking/quote form + basic analytics.
//
// ⚠️  This is a template, NOT legal advice. Before launch:
//   1. Update LAST_UPDATED and the business address in the Contact section.
//   2. Trim/keep the "Analytics & cookies" wording to match what the site
//      actually loads (Vercel Analytics = cookieless → no banner needed; Google
//      Analytics = cookies → keep the cookie disclosure + consider a banner).
//   3. Add any extra data practices this specific business has (e-commerce,
//      accounts, SMS, health data, under-13 audiences, EU customers, etc.).
//   4. Have the business owner's attorney review it. NGF provides the template;
//      the client is the data controller and owns the final policy.
// ─────────────────────────────────────────────────────────────────────────────

const LAST_UPDATED = 'June 2026'

export default async function PrivacyPolicyPage() {
  const content = await getNgfContent()
  const businessName = content['brand.businessName'] || 'this business'
  const primaryColor = content['brand.primaryColor'] || '#3B82F6'
  const contactEmail = content['contact.email'] || ''
  const contactPhone = content['contact.phone'] || ''
  const contactAddress = content['contact.address'] || ''
  const contactLine = contactEmail || 'the contact form on this website'

  return (
    <div className="min-h-screen" style={{ color: '#1f2937' }}>
      {/* No header here on purpose: app/layout.tsx already mounts Header and
          Footer for every page, so the starter's seeded <SiteHeader> would be a
          second one. This page is content only. */}

      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Privacy &amp; Cookie Policy</h1>
        <p className="mt-3 text-sm text-gray-500">Last updated: {LAST_UPDATED}</p>

        <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-gray-700">
          <p>
            This policy explains how <strong>{businessName}</strong> (&ldquo;we,&rdquo; &ldquo;us&rdquo;) collects, uses,
            and protects information when you visit this website or contact us through it. We only collect
            what we need to respond to you and run the site.
          </p>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">1. Information we collect</h2>
            <p className="mt-2"><strong>Information you give us.</strong> When you submit a contact, booking, or quote
              form, we collect the details you enter — typically your name, email address, phone number, and your
              message or request.</p>
            <p className="mt-2"><strong>Information collected automatically.</strong> Like most websites, we may
              collect basic technical and usage data — such as your IP address, browser type, the pages you view,
              and the site you came from — through analytics tools and server logs. This helps us understand how the
              site is used and keep it working.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">2. How we use your information</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>To respond to your inquiries and provide the services you request.</li>
              <li>To operate, maintain, and improve this website.</li>
              <li>To keep records of communications and requests.</li>
            </ul>
            <p className="mt-2">We do <strong>not</strong> sell your personal information.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">3. How your information is stored &amp; shared</h2>
            <p className="mt-2">We use trusted service providers to run this site and handle submissions on our behalf.
              They may process your information only to provide services to us:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li><strong>Website &amp; form processing</strong> — NGF Systems, which stores form submissions and
                sends us the notification.</li>
              <li><strong>Email delivery</strong> — Resend, used to email us your submission.</li>
              <li><strong>Website hosting</strong> — Vercel.</li>
              <li><strong>Analytics</strong> — used to measure site traffic and performance.</li>
            </ul>
            <p className="mt-2">We may also disclose information if required by law or to protect our rights.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">4. Cookies &amp; tracking</h2>
            <p className="mt-2">Cookies are small files stored on your device. This site may use:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li><strong>Essential cookies</strong>, needed for the site to function.</li>
              <li><strong>Analytics cookies</strong>, which help us understand site usage (only if analytics that use
                cookies are enabled).</li>
            </ul>
            <p className="mt-2">You can control or delete cookies through your browser settings. Blocking some cookies
              may affect how the site works.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">5. Data retention</h2>
            <p className="mt-2">We keep form submissions for as long as needed to respond to you and for our
              legitimate business records, then delete or anonymize them.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">6. Your choices &amp; rights</h2>
            <p className="mt-2">You may ask us to access, correct, or delete the personal information you&rsquo;ve given
              us. Depending on where you live, you may have additional rights under laws such as the California
              Consumer Privacy Act (CCPA/CPRA). To make a request, contact us using the details below. We do not sell
              your personal information.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">7. Children&rsquo;s privacy</h2>
            <p className="mt-2">This site is not directed to children under 13, and we do not knowingly collect
              personal information from them.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">8. Changes to this policy</h2>
            <p className="mt-2">We may update this policy from time to time. When we do, we&rsquo;ll revise the
              &ldquo;Last updated&rdquo; date above.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">9. Contact us</h2>
            <p className="mt-2">Questions about this policy or your information? Reach {businessName} at {contactLine}
              {contactPhone ? `, or ${contactPhone}` : ''}.</p>
            {contactAddress && <p className="mt-1 whitespace-pre-line">{contactAddress}</p>}
          </section>
        </div>

        <div className="mt-12 border-t border-gray-100 pt-6">
          <Link href="/" className="text-sm font-medium hover:underline" style={{ color: primaryColor }}>
            ← Back to home
          </Link>
        </div>
      </main>

      <footer className="py-8 px-4 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} {businessName}. All rights reserved.
      </footer>
    </div>
  )
}
