import Image from 'next/image'
import Link from 'next/link'

interface FooterProps {
  tagline: string
}

export function Footer({ tagline }: FooterProps) {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--panel)] mt-24">
      <div className="max-w-6xl mx-auto px-6 py-12 flex flex-col md:flex-row items-center md:items-start gap-8 justify-between">
        {/* Brand */}
        <div className="flex flex-col items-center md:items-start gap-2">
          <Image
            src="/assets/logos/noma-logo-alt.png"
            alt="NOMA Fine Jewelry"
            width={100}
            height={36}
            className="h-8 w-auto object-contain opacity-70"
          />
          <p
            className="text-sm text-[var(--muted)]"
            data-ngf-field="brand.footerTagline"
            data-ngf-label="Footer Tagline"
            data-ngf-type="text"
            data-ngf-section="Brand"
          >
            {tagline}
          </p>
        </div>

        {/* Links */}
        <nav aria-label="Footer navigation" className="flex flex-wrap justify-center md:justify-start gap-x-6 gap-y-2">
          <Link href="/products" className="text-sm text-[var(--muted)] hover:text-[var(--ink)] transition-colors">Shop All</Link>
          <Link href="/#best-sellers" className="text-sm text-[var(--muted)] hover:text-[var(--ink)] transition-colors">Best Sellers</Link>
          <Link href="/#collections" className="text-sm text-[var(--muted)] hover:text-[var(--ink)] transition-colors">Collections</Link>
          <Link href="/products#bundles" className="text-sm text-[var(--muted)] hover:text-[var(--ink)] transition-colors">Bundles</Link>
          <Link href="/#reviews" className="text-sm text-[var(--muted)] hover:text-[var(--ink)] transition-colors">Reviews</Link>
        </nav>

        {/* Legal */}
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
          <span>© 2026 NOMA</span>
          <span className="hover:text-[var(--ink)] cursor-pointer transition-colors">Privacy Policy</span>
          <span className="hover:text-[var(--ink)] cursor-pointer transition-colors">Shipping &amp; Returns</span>
        </div>
      </div>
    </footer>
  )
}
