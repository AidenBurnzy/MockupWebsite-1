'use client'
import { useState } from 'react'
import { ProductModal } from '@/components/ui/ProductModal'
import type { Product, ProductVariant } from '@/lib/site-data'

const METALS = ['Gold', 'Silver', 'Pearl', 'Rose Gold', 'Diamond']
const TYPES  = ['Necklaces', 'Earrings', 'Bracelets', 'Rings', 'Engravable']

interface ModalState {
  productId: string
  name: string
  description: string
  price: string
  image: string
  images?: string[]
  variants?: ProductVariant[]
  variantType?: string
}

function filterProducts(products: Product[], metals: Set<string>, types: Set<string>): Product[] {
  return products.filter((p) => {
    const metalMatch = metals.size === 0 || [...metals].some((m) =>
      p.metals?.some((metal) => metal.toLowerCase() === m.toLowerCase())
    )
    const typeMatch = types.size === 0 || [...types].some((t) =>
      t === 'Engravable' ? p.customizable === true : p.category === t
    )
    return metalMatch && typeMatch
  })
}

interface ShopByCategoryProps {
  products: Product[]
}

export function ShopByCategory({ products }: ShopByCategoryProps) {
  const [activeMetals, setActiveMetals] = useState<Set<string>>(new Set())
  const [activeTypes,  setActiveTypes]  = useState<Set<string>>(new Set())
  const [modal,        setModal]        = useState<ModalState | null>(null)

  const toggleMetal = (m: string) =>
    setActiveMetals((prev) => {
      const next = new Set(prev)
      next.has(m) ? next.delete(m) : next.add(m)
      return next
    })

  const toggleType = (t: string) =>
    setActiveTypes((prev) => {
      const next = new Set(prev)
      next.has(t) ? next.delete(t) : next.add(t)
      return next
    })

  const showStrip = activeMetals.size > 0 || activeTypes.size > 0
  const filtered  = filterProducts(products, activeMetals, activeTypes)

  const viewAllParams = new URLSearchParams()
  if (activeMetals.size > 0) viewAllParams.set('metals', [...activeMetals].join(','))
  if (activeTypes.size  > 0) viewAllParams.set('types',  [...activeTypes].join(','))
  const viewAllHref = `/products?${viewAllParams.toString()}`

  const filterLabel = [
    activeMetals.size > 0 ? [...activeMetals].join(', ') : null,
    activeTypes.size  > 0 ? [...activeTypes].join(', ')  : null,
  ].filter(Boolean).join(' · ')

  const pillStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '10px 18px',
    borderRadius: '12px',
    border: isActive ? '1.5px solid var(--accent)' : '1px solid rgba(31,27,22,0.18)',
    background: isActive ? 'var(--beige)' : '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    fontSize: '0.78rem',
    fontWeight: isActive ? 700 : 500,
    color: isActive ? 'var(--accent)' : 'var(--ink)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 160ms ease',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  })

  return (
    <>
      {/* Pill groups */}
      <div className="category-groups">

        {/* Metals */}
        <div className="category-group">
          <p className="eyebrow">Metals</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
            {METALS.map((m) => {
              const isActive = activeMetals.has(m)
              const count    = filterProducts(products, new Set([m]), new Set()).length
              return (
                <button key={m} style={pillStyle(isActive)} onClick={() => toggleMetal(m)}>
                  <span style={{ flex: 1, textAlign: 'left' }}>{m}</span>
                  {count > 0 ? (
                    <span style={{
                      fontSize: '0.7rem',
                      background: isActive ? 'var(--accent)' : 'rgba(31,27,22,0.08)',
                      color: isActive ? '#fff' : 'var(--muted)',
                      borderRadius: '999px', padding: '2px 7px',
                      fontWeight: 600, letterSpacing: 0, textTransform: 'none',
                    }}>{count}</span>
                  ) : (
                    <span style={{ fontSize: '0.65rem', color: 'var(--muted)', fontWeight: 400, letterSpacing: 0, textTransform: 'none' }}>soon</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Types */}
        <div className="category-group">
          <p className="eyebrow">Types</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
            {TYPES.map((t) => {
              const isActive = activeTypes.has(t)
              const count    = filterProducts(products, new Set(), new Set([t])).length
              return (
                <button key={t} style={pillStyle(isActive)} onClick={() => toggleType(t)}>
                  <span style={{ flex: 1, textAlign: 'left' }}>{t}</span>
                  {count > 0 ? (
                    <span style={{
                      fontSize: '0.7rem',
                      background: isActive ? 'var(--accent)' : 'rgba(31,27,22,0.08)',
                      color: isActive ? '#fff' : 'var(--muted)',
                      borderRadius: '999px', padding: '2px 7px',
                      fontWeight: 600, letterSpacing: 0, textTransform: 'none',
                    }}>{count}</span>
                  ) : (
                    <span style={{ fontSize: '0.65rem', color: 'var(--muted)', fontWeight: 400, letterSpacing: 0, textTransform: 'none' }}>soon</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Product preview strip */}
      {showStrip && (
        <div style={{
          marginTop: '28px', padding: '24px',
          background: 'rgba(255,255,255,0.85)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          animation: 'fadeSlideIn 220ms ease',
        }}>
          <style>{`
            @keyframes fadeSlideIn {
              from { opacity: 0; transform: translateY(8px); }
              to   { opacity: 1; transform: translateY(0); }
            }
          `}</style>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px', gap: '12px' }}>
            <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
              {filterLabel}
              <span style={{ fontWeight: 400, color: 'var(--muted)', marginLeft: '6px', textTransform: 'none', letterSpacing: 0 }}>
                &mdash; {filtered.length} {filtered.length === 1 ? 'piece' : 'pieces'}
              </span>
            </p>
            {filtered.length > 0 && (
              <a href={viewAllHref} style={{ fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 600, letterSpacing: '0.04em', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                View all &rarr;
              </a>
            )}
          </div>

          {filtered.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0, padding: '12px 0' }}>
              No pieces match that combination yet &mdash; coming soon.
            </p>
          ) : (
            <div className="category-strip-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
              {filtered.slice(0, 4).map((product) => (
                <button
                  key={product.id}
                  onClick={() => setModal({ productId: product.id, name: product.name, description: product.description, price: product.price, image: product.image, images: product.images, variants: product.variants, variantType: product.variantType })}
                  style={{
                    border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden',
                    background: '#fff', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                    padding: 0, transition: 'transform 160ms ease, box-shadow 160ms ease',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.05)',
                  }}
                  onMouseEnter={e => { ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 32px rgba(0,0,0,0.1)' }}
                  onMouseLeave={e => { ;(e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.05)' }}
                >
                  <div style={{ aspectRatio: '1/1', overflow: 'hidden', background: 'var(--beige)' }}>
                    <img src={product.image} alt={product.name} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </div>
                  <div style={{ padding: '10px 12px 12px' }}>
                    <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--ink)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.name}</p>
                    <p style={{ fontSize: '0.82rem', color: 'var(--accent)', fontWeight: 700, margin: '2px 0 0' }}>{product.price}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {modal && (
        <ProductModal
          productId={modal.productId} name={modal.name} description={modal.description}
          price={modal.price} image={modal.image} images={modal.images}
          variants={modal.variants} variantType={modal.variantType}
          onClose={() => setModal(null)}
        />
      )}
    </>
  )
}
