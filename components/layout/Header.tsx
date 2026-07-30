'use client'
import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useCart } from '@/components/CartProvider'

interface HeaderProps {
  announcementText: string
}

export function Header({ announcementText }: HeaderProps) {
  const [navOpen, setNavOpen]       = useState(false)
  const [visible, setVisible]       = useState(true)
  const [activeHref, setActiveHref] = useState('')
  const pathname        = usePathname()
  const { totalQty }    = useCart()
  const suppressUntil   = useRef(0) // timestamp — suppress hide until this time

  // ── Hide on scroll down, show on scroll up ──────────────────────────────
  useEffect(() => {
    let lastY      = window.scrollY
    let accumulated = 0

    function onScroll() {
      const y     = window.scrollY
      const delta = y - lastY
      lastY = y

      // Always show when near the top
      if (y < 80) {
        setVisible(true)
        accumulated = 0
        return
      }

      // Don't hide while a nav-link scroll animation is running
      if (Date.now() < suppressUntil.current) {
        accumulated = 0
        return
      }

      if (delta > 0) {
        // Scrolling down — accumulate; hide once past threshold
        accumulated += delta
        if (accumulated > 80) {
          setVisible(false)
          setNavOpen(false)
        }
      } else {
        // Any upward movement → show immediately
        setVisible(true)
        accumulated = 0
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // ── Scroll-spy: active nav link ──────────────────────────────────────────
  useEffect(() => {
    // Only watch sections that actually exist on the current page.
    // This prevents cross-page contamination (e.g. products sections
    // matching while on the home page).
    const SECTIONS =
      pathname === '/products'
        ? [
            { id: 'shop',      href: '/products' },
            { id: 'bundles',   href: '/products#bundles' },
            { id: 'engraving', href: '/products#engraving' },
          ]
        : [
            { id: 'home',    href: '/#home' },
            { id: 'reviews', href: '/#reviews' },
          ]

    const fallback = pathname === '/products' ? '/products' : '/#home'
    setActiveHref(fallback)

    function update() {
      // A section is "active" once its top edge has scrolled above
      // the midpoint of the viewport. We take the deepest one that qualifies.
      const line = window.innerHeight * 0.5
      let active = fallback

      for (const { id, href } of SECTIONS) {
        const el = document.getElementById(id)
        if (!el) continue
        if (el.getBoundingClientRect().top <= line) {
          active = href
        }
      }

      setActiveHref(active)
    }

    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [pathname])

  // ── Close nav on Escape ──────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setNavOpen(false) }
    window.addEventListener('keyup', handler)
    return () => window.removeEventListener('keyup', handler)
  }, [])

  // ── Lock body scroll when mobile nav open ───────────────────────────────
  useEffect(() => {
    document.body.classList.toggle('overflow-hidden', navOpen)
    return () => document.body.classList.remove('overflow-hidden')
  }, [navOpen])

  const navLinks = [
    { href: '/#home',              label: 'Home' },
    { href: '/#reviews',           label: 'Reviews' },
    { href: '/products#engraving', label: 'Engraving' },
    { href: '/products#bundles',   label: 'Bundles' },
    { href: '/products',           label: 'Shop All' },
  ]

  // Suppress hide for 1 s after clicking a nav link so the scroll
  // animation doesn't trigger the hide behaviour.
  function onNavClick() {
    suppressUntil.current = Date.now() + 1000
  }

  return (
    <>
      <div
        id="site-chrome"
        style={{
          position:   'fixed',
          top:        0,
          left:       0,
          right:      0,
          zIndex:     30,
          transform:  visible ? 'translateY(0)' : 'translateY(-100%)',
          transition: 'transform 300ms ease',
        }}
      >
        {/* ── Announcement banner ── */}
        <div
          className="flex items-center justify-start overflow-hidden"
          style={{
            background:   'linear-gradient(135deg, #8b2f39 0%, #6f2730 100%)',
            height:       'var(--banner-height)',
            fontSize:     '0.9rem',
            letterSpacing:'0.04em',
            boxShadow:    '0 4px 16px rgba(0,0,0,0.16)',
            color:        '#ffffff',
          }}
          data-ngf-field="brand.announcementText"
          data-ngf-label="Announcement Banner"
          data-ngf-type="text"
          data-ngf-section="Brand"
        >
          <div className="banner-track pointer-events-none select-none font-medium">
            <span className="banner-sequence">
              <span>{announcementText}</span>
              <span aria-hidden="true">·</span>
              <span aria-hidden="true">{announcementText}</span>
              <span aria-hidden="true">·</span>
              <span aria-hidden="true">{announcementText}</span>
            </span>
            <span className="banner-sequence" aria-hidden="true">
              <span>{announcementText}</span>
              <span>·</span>
              <span>{announcementText}</span>
              <span>·</span>
              <span>{announcementText}</span>
            </span>
          </div>
        </div>

        {/* ── Main header ── */}
        <header className="header-inner">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-3 shrink-0 brand-link">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/logos/noma-logo-v3.png"
              alt="NOMA Designs"
              className="brand-logo"
            />
            <span className="sr-only">NOMA Fine Jewelry</span>
          </Link>

          {/* Desktop nav — class controls visibility via CSS media query (not Tailwind) */}
          <nav aria-label="Primary" className="desktop-nav">
            <ul className="flex items-center list-none" style={{ gap: '20px' }}>
              {navLinks.map(({ href, label }) => {
                const isActive = activeHref === href
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      className="nav-link"
                      onClick={onNavClick}
                      style={{
                        fontSize:      '0.9rem',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        padding:       '10px 12px',
                        borderRadius:  '999px',
                        transition:    'color 160ms ease, background 160ms ease',
                        display:       'block',
                        background:    isActive ? 'var(--accent)' : undefined,
                        color:         isActive ? '#fff' : undefined,
                        fontWeight:    isActive ? '700' : undefined,
                      }}
                    >
                      {label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>

          {/* Actions */}
          <div className="flex items-center" style={{ gap: '8px' }}>
            <Link href="/cart" className="btn-solid header-cart">
              Cart{totalQty > 0 ? ` (${totalQty})` : ''}
            </Link>
            <button
              className="mobile-menu-btn"
              aria-label="Toggle navigation"
              aria-expanded={navOpen}
              aria-controls="mobile-nav"
              onClick={() => setNavOpen(v => !v)}
            >
              {navOpen ? '✕' : '☰'}
            </button>
          </div>
        </header>

        {/* ── Mobile nav ── */}
        {navOpen && (
          <nav
            id="mobile-nav"
            className="md:hidden"
            style={{
              position:      'absolute',
              top:           'calc(var(--banner-height) + var(--header-height) + 8px)',
              left:          '16px',
              right:         '16px',
              background:    'rgba(255,255,255,0.96)',
              border:        '1px solid var(--border)',
              borderRadius:  'calc(var(--radius) + 6px)',
              padding:       '16px',
              display:       'flex',
              flexDirection: 'column',
              gap:           '6px',
              boxShadow:     '0 18px 52px rgba(0,0,0,0.16)',
              backdropFilter:'blur(10px)',
              zIndex:        10,
            }}
          >
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                style={{
                  padding:       '12px 14px',
                  borderRadius:  '12px',
                  background:    'rgba(0,0,0,0.02)',
                  display:       'block',
                  textAlign:     'center',
                  fontSize:      '0.9rem',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  fontWeight:    '600',
                  color:         'var(--ink)',
                }}
                onClick={() => { onNavClick(); setNavOpen(false) }}
              >
                {label}
              </Link>
            ))}
          </nav>
        )}
      </div>

      {/* Mobile nav backdrop */}
      {navOpen && (
        <div
          className="md:hidden"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.32)', zIndex: 29 }}
          onClick={() => setNavOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  )
}
