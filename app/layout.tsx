import type { Metadata } from 'next'
import { Cormorant_Garamond, Manrope } from 'next/font/google'
import './globals.css'
import NgfEditBridge from '@/components/NgfEditBridge'
import { CartProvider } from '@/components/CartProvider'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { getNgfContent } from '@/lib/ngf'

const cormorant = Cormorant_Garamond({
  variable: '--font-cormorant',
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
})

const manrope = Manrope({
  variable: '--font-manrope',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  metadataBase: new URL('https://noma-jewelry.com'),
  other: {
    'ngf-public-api': 'https://app.ngfsystems.com/api/public/content',
  },
  title: {
    default: 'NOMA | Fine Jewelry',
    template: '%s | NOMA',
  },
  description:
    'Everyday waterproof fine jewelry designed to last. Shop rings, necklaces, earrings, and bracelets with a lifetime color warranty.',
  keywords: ['fine jewelry', 'waterproof jewelry', 'gold jewelry', 'jewelry online', 'NOMA jewelry'],
  authors: [{ name: 'NOMA' }],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'NOMA Fine Jewelry',
    title: 'NOMA | Fine Jewelry',
    description: 'Everyday waterproof jewelry designed to last. Rings, necklaces, earrings, and bracelets.',
  },
  robots: { index: true, follow: true },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const content = await getNgfContent()

  const announcementText =
    content['brand.announcementText'] ||
    'Complimentary shipping over $100 | Personalization available'

  const footerTagline = content['brand.footerTagline'] || 'Fine jewelry, crafted with care.'

  return (
    <html lang="en">
      <body
        suppressHydrationWarning
        className={`${cormorant.variable} ${manrope.variable} antialiased`}
      >
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <NgfEditBridge />
        <CartProvider>
<Header announcementText={announcementText} />
          <div id="main-content" style={{ paddingTop: 'calc(var(--banner-height) + var(--header-height))' }}>{children}</div>
          <Footer tagline={footerTagline} />
        </CartProvider>
      </body>
    </html>
  )
}
