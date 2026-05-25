'use client'
import { useState } from 'react'
import { BestSellersGrid } from './BestSellersGrid'
import { ShopByCategory } from './ShopByCategory'
import { getItems } from '@/lib/ngf'
import type { Product, Bundle } from '@/lib/site-data'
import type { NgfSiteContent } from '@/lib/ngf'

type Tab = 'bestsellers' | 'bundles'

interface ShopSectionProps {
  bestSellers: Product[]
  products: Product[]
  bundles: Bundle[]
  content: NgfSiteContent
}

export function ShopSection({ bestSellers, products, bundles, content }: ShopSectionProps) {
  const [activeTab, setActiveTab]   = useState<Tab>('bestsellers')
  const bundleItems = getItems(content, 'bundles.items')

  const tabs: { id: Tab; label: string }[] = [
    { id: 'bestsellers', label: 'Best Sellers' },
    { id: 'bundles',     label: 'Bundles'      },
  ]

  const tabStyle = (id: Tab): React.CSSProperties => ({
    padding: '10px 20px',
    borderRadius: '999px',
    border: 'none',
    background: activeTab === id ? 'var(--ink)' : 'transparent',
    color: activeTab === id ? '#fff' : 'var(--muted)',
    fontFamily: 'inherit',
    fontSize: '0.82rem',
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    transition: 'all 180ms ease',
    whiteSpace: 'nowrap',
  })

  return (
    <section className="section shop-section" id="shop">

      {/* Centered header */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <p className="eyebrow" style={{ margin: '0 auto 10px', textAlign: 'center' }}>The Collection</p>
        <h2 style={{ maxWidth: '500px', margin: '0 auto', textAlign: 'center' }}>Find your perfect piece.</h2>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '4px',
        marginBottom: '36px',
        padding: '5px',
        background: 'rgba(255,255,255,0.6)',
        borderRadius: '999px',
        border: '1px solid var(--border)',
        width: 'fit-content',
        margin: '0 auto 36px',
      }}>
        {tabs.map(({ id, label }) => (
          <button key={id} style={tabStyle(id)} onClick={() => setActiveTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div key={activeTab} style={{ animation: 'tabFade 200ms ease' }}>
        <style>{`
          @keyframes tabFade {
            from { opacity: 0; transform: translateY(5px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>

        {activeTab === 'bestsellers' && (
          <BestSellersGrid products={bestSellers} content={content} />
        )}

        {activeTab === 'bundles' && (
          <div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '18px' }}
            data-ngf-group="bundles.items"
            data-ngf-item-label="Bundle"
            data-ngf-min-items="1"
            data-ngf-max-items="8"
            data-ngf-item-fields='[{"key":"badge","label":"Badge","type":"text"},{"key":"name","label":"Bundle Name","type":"text"},{"key":"description","label":"Description","type":"textarea"},{"key":"price","label":"Price","type":"text"},{"key":"comparePrice","label":"Compare Price","type":"text"}]'
          >
            {bundles.map((bundle, i) => {
              const bi          = bundleItems[i] ?? {}
              const name        = bi.name         || bundle.name
              const description = bi.description  || bundle.description
              const price       = bi.price        || bundle.price
              const comparePrice = bi.comparePrice || bundle.comparePrice
              const badge       = bi.badge        || bundle.badge
              return (
                <article key={bundle.id} className="bundle-card">
                  {badge && (
                    <span className="bundle-badge"
                      data-ngf-field={`bundles.items.${i}.badge`}
                      data-ngf-label="Badge" data-ngf-type="text" data-ngf-section="Bundles"
                    >{badge}</span>
                  )}
                  <h3 data-ngf-field={`bundles.items.${i}.name`} data-ngf-label="Bundle Name" data-ngf-type="text" data-ngf-section="Bundles">{name}</h3>
                  <p data-ngf-field={`bundles.items.${i}.description`} data-ngf-label="Description" data-ngf-type="textarea" data-ngf-section="Bundles">{description}</p>
                  <div className="price-row">
                    <span className="price" data-ngf-field={`bundles.items.${i}.price`} data-ngf-label="Price" data-ngf-type="text" data-ngf-section="Bundles">{price}</span>
                    <span className="price-compare" data-ngf-field={`bundles.items.${i}.comparePrice`} data-ngf-label="Compare Price" data-ngf-type="text" data-ngf-section="Bundles">{comparePrice}</span>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>

      {/* Shop All CTA */}
      <div className="section-actions" style={{ marginTop: '28px' }}>
        <a href="/products" className="btn-solid">Shop All Pieces</a>
      </div>

      {/* ── Browse by metal & type ── */}
      <div style={{ marginTop: '48px', borderTop: '1px solid var(--border)', paddingTop: '40px', textAlign: 'center' }}>
        <p className="eyebrow" style={{ margin: '0 auto 10px', textAlign: 'center' }}>Filter</p>
        <h2 className="shop-filter-heading" style={{ margin: '0 auto 28px', textAlign: 'center' }}>Browse by metal &amp; type</h2>
        <div style={{ textAlign: 'left' }}>
          <ShopByCategory products={products} />
        </div>
      </div>

    </section>
  )
}
