'use client'
import { useState } from 'react'
import { ProductModal } from '@/components/ui/ProductModal'
import type { Product } from '@/lib/site-data'
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

type SortKey = 'featured' | 'price-asc' | 'price-desc'

function parsePrice(p: string) {
  return Number(p.replace(/[^0-9.]/g, '')) || 0
}

// ── Per-card component — owns modal state ─────────────────────────────────────
function ProductCard({ product, index }: {
  product: Product
  index: number
}) {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <>
      <button
        className="mini-card"
        onClick={() => setModalOpen(true)}
        style={{ border: '1px solid var(--border)', fontFamily: 'inherit' }}
      >
        <div className="mini-image">
          <img
            src={product.image}
            alt={product.name}
            loading={index < 4 ? 'eager' : 'lazy'}
            decoding="async"
            data-ngf-field={`products.items.${index}.image`}
            data-ngf-label="Product Image"
            data-ngf-type="image"
            data-ngf-section="Products"
          />
        </div>
        <div className="mini-body">
          {product.badge && (
            <p
              className="eyebrow"
              style={{ fontSize: '0.85rem', letterSpacing: '0.12em', marginBottom: '2px' }}
            >
              {product.badge}
            </p>
          )}
          <h3
            style={{ fontSize: '1.2rem', margin: 0 }}
            data-ngf-field={`products.items.${index}.name`}
            data-ngf-label="Product Name"
            data-ngf-type="text"
            data-ngf-section="Products"
          >
            {product.name}
          </h3>
          <p className="product-card-desc" style={{ margin: 0, fontSize: '0.85rem', color: 'var(--muted)' }}>
            {product.description.length > 72
              ? product.description.slice(0, product.description.lastIndexOf(' ', 72)) + '…'
              : product.description}
          </p>

          {product.variants && product.variants.length > 1 ? (
            <div style={{ marginTop: '2px' }}>
              <span className="price">
                {product.variants[0].price}
                <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: '0.9rem' }}>
                  {' – '}{product.variants[product.variants.length - 1].price}
                </span>
              </span>
              <p style={{
                fontSize: '0.68rem', color: 'var(--muted)', letterSpacing: '0.08em',
                textTransform: 'uppercase', margin: '3px 0 0', fontWeight: 600,
              }}>
                {product.variantType === 'Length'
                  ? `${product.variants.length} lengths`
                  : product.variantType === 'Style'
                  ? 'blank or engraved'
                  : `${product.variants.length} sizes`}
              </p>
            </div>
          ) : (
            <div className="price-row">
              <span
                className="price"
                data-ngf-field={`products.items.${index}.price`}
                data-ngf-label="Price"
                data-ngf-type="text"
                data-ngf-section="Products"
              >
                {product.price}
              </span>
              {product.comparePrice && (
                <span className="price-compare">{product.comparePrice}</span>
              )}
              {(product.badge === 'Sale' || (product.comparePrice && product.comparePrice !== product.price)) && (
                <span className="sale-tag">Sale</span>
              )}
            </div>
          )}
        </div>
      </button>

      {modalOpen && (
        <ProductModal
          productId={product.id}
          name={product.name}
          description={product.description}
          price={product.price}
          image={product.image}
          images={product.images}
          variants={product.variants}
          variantType={product.variantType}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  )
}

// ── Main grid component ───────────────────────────────────────────────────────
export function ProductGrid({ products, content, initialMetals = [], initialTypes = [] }: ProductGridProps) {
  const [activeMetals, setActiveMetals] = useState<Set<string>>(new Set(initialMetals))
  const [activeTypes,  setActiveTypes]  = useState<Set<string>>(new Set(initialTypes))
  const [sort,  setSort]  = useState<SortKey>('featured')
  const [filtersOpen, setFiltersOpen] = useState(initialMetals.length > 0 || initialTypes.length > 0)

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
  const filterCount = activeMetals.size + activeTypes.size

  return (
    <>
      {/* ── Filter bar ── */}
      <div style={{ marginBottom: '36px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* Mobile: compact control bar — filter pill + sort select (hidden on desktop via CSS) */}
        <div className="mobile-control-bar">
          <button
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              padding: '9px 14px', borderRadius: '999px',
              border: '1px solid var(--border)', background: 'rgba(255,255,255,0.85)',
              fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.06em',
              textTransform: 'uppercase', color: 'var(--ink)',
              cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
            }}
            onClick={() => setFiltersOpen(v => !v)}
          >
            {filtersOpen ? 'Hide' : 'Filter'}
            {filterCount > 0 && !filtersOpen && (
              <span style={{ background: 'var(--accent)', color: '#fff', borderRadius: '999px', padding: '1px 7px', fontSize: '0.68rem' }}>
                {filterCount}
              </span>
            )}
            <span style={{ fontSize: '0.65rem', opacity: 0.5 }}>{filtersOpen ? '▲' : '▼'}</span>
          </button>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="Sort products"
            style={{
              flex: 1, minWidth: 0, padding: '9px 10px', borderRadius: '999px',
              border: '1px solid var(--border)', background: 'rgba(255,255,255,0.85)',
              fontSize: '0.78rem', fontWeight: 600, color: 'var(--ink)',
              fontFamily: 'inherit', cursor: 'pointer',
            }}
          >
            <option value="featured">Featured</option>
            <option value="price-asc">Price ↑</option>
            <option value="price-desc">Price ↓</option>
          </select>
          <span style={{ fontSize: '0.74rem', color: 'var(--muted)', whiteSpace: 'nowrap', marginLeft: 'auto' }}>
            {sorted.length} {sorted.length === 1 ? 'piece' : 'pieces'}
          </span>
          {hasFilters && (
            <button
              onClick={() => { setActiveMetals(new Set()); setActiveTypes(new Set()) }}
              style={{ fontSize: '0.7rem', color: 'var(--accent)', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', padding: 0, whiteSpace: 'nowrap' }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Metal + Type side by side — collapsible on mobile */}
        <div className={`filter-groups-wrap${filtersOpen ? ' filter-groups-open' : ''}`}>
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
        </div>

        {/* Sort row + count — desktop only (hidden on mobile via CSS) */}
        <div className="desktop-sort-row" style={{
          alignItems: 'center', justifyContent: 'space-between',
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
        className="product-grid"
        data-ngf-group="products.items"
        data-ngf-item-label="Product"
        data-ngf-min-items="1"
        data-ngf-max-items="24"
        data-ngf-item-fields='[{"key":"image","label":"Product Image","type":"image"},{"key":"name","label":"Product Name","type":"text"},{"key":"category","label":"Category","type":"text"},{"key":"price","label":"Price","type":"text"},{"key":"description","label":"Description","type":"textarea"}]'
      >
        {sorted.map((product, i) => (
          <ProductCard
            key={product.id}
            product={product}
            index={i}
          />
        ))}

        {sorted.length === 0 && (
          <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--muted)', padding: '48px 0' }}>
            No products match your filters.
          </p>
        )}
      </div>
    </>
  )
}
