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
  metadataBase: new URL('https://www.noelleandmary.com'),
  other: {
    'ngf-public-api': 'https://app.ngfsystems.com/api/public/content',
  },
  title: {
    default: 'NOMA Designs | Waterproof Fine Jewelry – Grand Rapids, MI',
    template: '%s | NOMA Designs',
  },
  description:
    'Shop NOMA Designs — everyday waterproof fine jewelry in Grand Rapids, Michigan. Gold necklaces, bracelets, rings & earrings in 14k gold, sterling silver & rose gold. Tarnish-free with a lifetime color warranty. Custom engraving available.',
  keywords: [
    // local
    'jewelry Grand Rapids MI',
    'fine jewelry Grand Rapids Michigan',
    'jewelry store Grand Rapids',
    'West Michigan jewelry',
    'Michigan jewelry boutique',
    // jewelry types
    'necklaces',
    'bracelets',
    'rings',
    'earrings',
    'anklets',
    'pendants',
    'charm necklace',
    'layering necklace',
    'hoop earrings',
    'stud earrings',
    'cuff bracelet',
    'tennis bracelet',
    // materials
    '14k gold jewelry',
    '18k gold jewelry',
    'sterling silver jewelry',
    'rose gold jewelry',
    'gold plated jewelry',
    'stainless steel jewelry',
    'tarnish free jewelry',
    // attributes
    'waterproof jewelry',
    'waterproof necklace',
    'waterproof bracelet',
    'waterproof earrings',
    'waterproof rings',
    'dainty jewelry',
    'minimalist jewelry',
    'everyday jewelry',
    'fine jewelry',
    'lifetime warranty jewelry',
    // personalization
    'custom engraving jewelry',
    'personalized necklace',
    'name necklace',
    'engraved bracelet',
    'personalized jewelry gift',
    // brand
    'NOMA Designs',
    'noelleandmary',
  ],
  authors: [{ name: 'NOMA Designs' }],
  alternates: {
    canonical: 'https://www.noelleandmary.com',
  },
  openGraph: {
    type: 'website',
    url: 'https://www.noelleandmary.com',
    locale: 'en_US',
    siteName: 'NOMA Designs',
    title: 'NOMA Designs | Waterproof Fine Jewelry – Grand Rapids, MI',
    description:
      'Everyday waterproof fine jewelry designed to last. Gold necklaces, bracelets, rings & earrings — tarnish-free with custom engraving. Ships from Grand Rapids, MI.',
    images: [{ url: '/assets/logos/noma-logo-v3.png', width: 597, height: 206, alt: 'NOMA Designs' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NOMA Designs | Waterproof Fine Jewelry',
    description: 'Everyday waterproof fine jewelry. Gold, silver & rose gold necklaces, bracelets, rings & earrings. Custom engraving available.',
    images: ['/assets/logos/noma-logo-v3.png'],
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://www.noelleandmary.com/#organization',
      name: 'NOMA Designs',
      url: 'https://www.noelleandmary.com',
      logo: {
        '@type': 'ImageObject',
        url: 'https://www.noelleandmary.com/assets/logos/noma-logo-v3.png',
      },
      description:
        'Everyday waterproof fine jewelry — gold necklaces, bracelets, rings, earrings, and custom engraving. Based in Grand Rapids, Michigan.',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Grand Rapids',
        addressRegion: 'MI',
        addressCountry: 'US',
      },
      areaServed: ['Grand Rapids, MI', 'West Michigan', 'United States'],
    },
    {
      '@type': 'WebSite',
      '@id': 'https://www.noelleandmary.com/#website',
      url: 'https://www.noelleandmary.com',
      name: 'NOMA Designs',
      publisher: { '@id': 'https://www.noelleandmary.com/#organization' },
    },
    {
      '@type': 'Store',
      '@id': 'https://www.noelleandmary.com/#store',
      name: 'NOMA Designs',
      url: 'https://www.noelleandmary.com',
      image: 'https://www.noelleandmary.com/assets/logos/noma-logo-v3.png',
      description:
        'Waterproof fine jewelry — necklaces, bracelets, rings, earrings in 14k gold, sterling silver, and rose gold. Custom engraving available. Based in Grand Rapids, MI.',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Grand Rapids',
        addressRegion: 'MI',
        addressCountry: 'US',
      },
      priceRange: '$$',
      servesCuisine: undefined,
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: 'Fine Jewelry Collection',
        itemListElement: [
          { '@type': 'OfferCatalog', name: 'Necklaces' },
          { '@type': 'OfferCatalog', name: 'Bracelets' },
          { '@type': 'OfferCatalog', name: 'Earrings' },
          { '@type': 'OfferCatalog', name: 'Rings' },
          { '@type': 'OfferCatalog', name: 'Custom Engraving' },
        ],
      },
    },
  ],
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
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
