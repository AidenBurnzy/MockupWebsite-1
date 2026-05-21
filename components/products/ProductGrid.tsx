'use client'
import { useState } from 'react'
import { ProductModal } from '@/components/ui/ProductModal'
import type { Product, ProductVariant } from '@/lib/site-data'
import type { NgfSiteContent } from '@/lib/ngf'
import { getItems } from '@/lib/ngf'

const METALS = ['Gold', 'Silver', 'Pearl', 'Rose Gold', 'Diamond']
const TYPES  = ['Necklaces', 'Earrings', 'Bracelets', 'Rings', 'Engravable']

interface ProductGridProps {
  products: Product[]
  content: NgfSiteContent
  initialMetals?: string[]
  initialTypes?: string[]
}

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

type SortKey = 'featured' | 'price-asc' | 'price-desc'

function parsePrice(p: string) {
  return Number(p.replace(/[^0-9.]/g, '')) || 0
}

export function ProductGrid({ products, content, initialMetals = [], initialTypes = [] }: ProductGridProps) {
  const [activeMetals, setActiveMetals] = useState<Set<string>>(new Set(initialMetals))
  const [activeTypes,  setActiveTypes]  = useState<Set<string>>(new Set(initialTypes))
  const [sort,  setSort]  = useState<SortKey>('featured')
  const [modal, setModal] = useState<ModalState | null>(null)

  const contentItems = getItems(content, 'products.items')

  const enriched = products.map((p, i) => {
    const ci = contentItems[i] ?? {}
    return {
      ...p,
      name:        ci.name        || p.name,
      description: ci.description || p.description,
      price:       ci.price       || p.price,
      image:       ci.image       || p.image,
    }
  })

  const toggleMetal = (m: string) =>
    setActiveMetals((prev) => { const n = new Set(prev); n.has(m) ? n.delete(m) : n.add(m); return n })

  const toggleType = (t: string) =>
    setActiveTypes((prev) => { const n = new Set(prev); n.has(t) ? n.delete(t) : n.add(t); return n })

  const filtered = enriched.filter((p) => {
    const metalMatch = activeMetals.size === 0 || [...activeMetals].some((m) =>
      p.metals?.some((metal) => metal.toLowerCase() === m.toLowerCase())
    )
    const typeMatch = activeTypes.size === 0 || [...activeTypes].some((t) =>
      t === 'Engravable' ? p.customizable === true : p.category === t
    )
    return metalMatch && typeMatch
  })

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'price-asc')  return parsePrice(a.price) - parsePrice(b.price)
    if (sort === 'price-desc') return parsePrice(b.price) - parsePrice(a.price)
    return 0
  })

  const pillStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '8px 16px',
    borderRadius: '999px',
    border: isActive ? '1.5px solid var(--accent)' : '1px solid rgba(31,27,22,0.18)',
    background: isActive ? 'var(--beige)' : '#ffffff',
    fontSize: '0.78rem',
    fontWeight: isActive ? 700 : 500,
    letterSpacing: '0.07em',
    textTransform: 'uppercase',
    color: isActive ? 'var(--accent)' : 'var(--ink)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 150ms ease',
    whiteSpace: 'nowrap',
  })

  const sortPillStyle = (id: SortKey): React.CSSProperties => ({
    padding: '8px 16px',
    borderRadius: '999px',
    border: sort === id ? '1.5px solid var(--ink)' : '1px solid rgba(31,27,22,0.18)',
    background: sort === id ? 'var(--ink)' : '#ffffff',
    fontSize: '0.78rem',
    fontWeight: sort === id ? 700 : 500,
    letterSpacing: '0.07em',
    textTransform: 'uppercase',
    color: sort === id ? '#fff' : 'var(--muted)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 150ms ease',
    whiteSpace: 'nowrap',
  })

  const hasFilters = activeMetals.size > 0 || activeTypes.size > 0

  return (
    <>
      {/* ── Filter bar ── */}
      <div style={{ marginBottom: '36px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* Metal + Type side by side */}
        <div className="category-groups">
          <div className="category-group">
            <p className="eyebrow" style={{ marginBottom: '12px' }}>Metal</p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {METALS.map((m) => (
                <button key={m} style={pillStyle(activeMetals.has(m))} onClick={() => toggleMetal(m)}>{m}</button>
              ))}
            </div>
          </div>
          <div className="category-group">
            <p className="eyebrow" style={{ marginBottom: '12px' }}>Type</p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {TYPES.map((t) => (
                <button key={t} style={pillStyle(activeTypes.has(t))} onClick={() => toggleType(t)}>{t}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Sort row + count */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: '12px',
          padding: '14px 20px',
          background: 'rgba(255,255,255,0.85)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <p className="eyebrow" style={{ margin: 0, fontSize: '0.72rem' }}>Sort</p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {([
                { id: 'featured'   as SortKey, label: 'Featured' },
                { id: 'price-asc'  as SortKey, label: 'Price ↑'  },
                { id: 'price-desc' as SortKey, label: 'Price ↓'  },
              ]).map(({ id, label }) => (
                <button key={id} style={sortPillStyle(id)} onClick={() => setSort(id)}>{label}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
              {sorted.length} {sorted.length === 1 ? 'piece' : 'pieces'}
            </span>
            {hasFilters && (
              <button
                onClick={() => { setActiveMetals(new Set()); setActiveTypes(new Set()) }}
                style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0, letterSpacing: '0.04em' }}
              >
                Clear ×
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Product grid ── */}
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '24px' }}
        data-ngf-group="products.items"
        data-ngf-item-label="Product"
        data-ngf-min-items="1"
        data-ngf-max-items="24"
        data-ngf-item-fields='[{"key":"image","label":"Product Image","type":"image"},{"key":"name","label":"Product Name","type":"text"},{"key":"category","label":"Category","type":"text"},{"key":"price","label":"Price","type":"text"},{"key":"description","label":"Description","type":"textarea"}]'
      >
        {sorted.map((product, i) => (
          <button
            key={product.id}
            onClick={() => setModal({ productId: product.id, name: product.name, description: product.description, price: product.price, image: product.image, images: product.images, variants: product.variants, variantType: product.variantType })}
            style={{
              position: 'relative', background: 'var(--panel)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', overflow: 'hidden', boxShadow: '0 24px 70px rgba(15,10,6,0.08)',
              transition: 'transform 200ms ease, box-shadow 200ms ease', cursor: 'pointer',
              textAlign: 'left', fontFamily: 'inherit', width: '100%', padding: 0,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 24px 72px rgba(0,0,0,0.12)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '0 24px 70px rgba(15,10,6,0.08)' }}
          >
            <div style={{ height: '260px', overflow: 'hidden', position: 'relative', background: 'var(--beige)' }}>
              <img
                src={product.image} alt={product.name}
                loading={i < 4 ? 'eager' : 'lazy'} decoding="async"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                data-ngf-field={`products.items.${i}.image`} data-ngf-label="Product Image"
                data-ngf-type="image" data-ngf-section="Products"
              />
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {product.badge && (
                <p className="eyebrow" style={{ fontSize: '0.75rem', letterSpacing: '0.1em', marginBottom: '2px' }}>{product.badge}</p>
              )}
              <h3 style={{ fontSize: '1.2rem', margin: 0 }}
                data-ngf-field={`products.items.${i}.name`} data-ngf-label="Product Name"
                data-ngf-type="text" data-ngf-section="Products"
              >{product.name}</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}
                data-ngf-field={`products.items.${i}.category`} data-ngf-label="Category"
                data-ngf-type="text" data-ngf-section="Products"
              >{product.category}</p>
              {/* Price — show full range when variants exist */}
              {product.variants && product.variants.length > 1 ? (
                <div style={{ marginTop: '4px' }}>
                  <p style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--burgundy)', margin: 0 }}>
                    {product.variants[0].price}
                    <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: '0.95rem' }}> – {product.variants[product.variants.length - 1].price}</span>
                  </p>
                  <p style={{ fontSize: '0.72rem', color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '3px 0 0', fontWeight: 600 }}>
                    {product.variantType === 'Length' ? `${product.variants.length} lengths` : product.variantType === 'Style' ? 'blank or engraved' : `${product.variants.length} sizes`}
                  </p>
                </div>
              ) : (
                <p style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--burgundy)', margin: '4px 0 0' }}
                  data-ngf-field={`products.items.${i}.price`} data-ngf-label="Price"
                  data-ngf-type="text" data-ngf-section="Products"
                >
                  {product.price}
                  {product.comparePrice && (
                    <span style={{ fontSize: '0.95rem', color: 'var(--muted)', textDecoration: 'line-through', marginLeft: '8px', fontWeight: '400' }}>{product.comparePrice}</span>
                  )}
                </p>
              )}
            </div>
          </button>
        ))}

        {sorted.length === 0 && (
          <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--muted)', padding: '48px 0' }}>
            No products match your filters.
          </p>
        )}
      </div>

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
