import type { Metadata } from 'next'
import { getNgfContent } from '@/lib/ngf'
import { PRODUCTS, BUNDLES } from '@/lib/site-data'
import { ProductGrid } from '@/components/products/ProductGrid'
import { EngravingPreview } from '@/components/products/EngravingPreview'

export const metadata: Metadata = {
  title: 'Shop All',
  description: 'Browse the full NOMA collection — rings, necklaces, earrings, and bracelets.',
}

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams
  const initialMetals = params.metals ? params.metals.split(',') : []
  const initialTypes  = params.types  ? params.types.split(',')  : []
  const content = await getNgfContent()

  const productsEyebrow = content['products.eyebrow'] || 'The NOMA Edit'
  const productsLede =
    content['products.lede'] ||
    'A curated selection of refined essentials designed to layer, gift, and keep.'

  const engravingEyebrow = content['engraving.eyebrow'] || 'Personalize Your Piece'
  const engravingHeadline = content['engraving.headline'] || 'Custom Engraving'
  const engravingLede =
    content['engraving.lede'] ||
    'Add your message, a name, or a date — complimentary with every purchase. Up to 10 characters.'

  const bundlesEyebrow = content['bundles.eyebrow'] || 'Get More, For Less'
  const bundlesHeadline = content['bundles.headline'] || 'Bundle savings on curated sets.'

  return (
    <main style={{ padding: '0 0 120px' }}>

      {/* ── Products hero ── */}
      <div className="products-hero-header" id="shop">
        <h1
          data-ngf-field="products.eyebrow"
          data-ngf-label="Page Headline"
          data-ngf-type="text"
          data-ngf-section="Products"
          style={{ marginBottom: '16px' }}
        >
          {productsEyebrow}
        </h1>
        <p
          style={{ margin: '0 auto', fontSize: '1.1rem', color: 'var(--muted)', maxWidth: '52ch' }}
          data-ngf-field="products.lede"
          data-ngf-label="Page Lede"
          data-ngf-type="textarea"
          data-ngf-section="Products"
        >
          {productsLede}
        </p>
      </div>

      {/* ── Product grid ── */}
      <div className="products-grid-wrapper">
        <ProductGrid products={PRODUCTS} content={content} initialMetals={initialMetals} initialTypes={initialTypes} />
      </div>

      {/* ── Bundles ── */}
      <section className="section bundles" id="bundles">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px' }}>
          <p className="eyebrow">{bundlesEyebrow}</p>
          <h2>{bundlesHeadline}</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '18px' }}>
          {BUNDLES.map((bundle) => (
            <article key={bundle.id} className="bundle-card">
              {bundle.badge && (
                <span className="bundle-badge">{bundle.badge}</span>
              )}
              <h3>{bundle.name}</h3>
              <p>{bundle.description}</p>
              <div className="price-row">
                <span className="price">{bundle.price}</span>
                <span className="price-compare">{bundle.comparePrice}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ── Engraving ── */}
      <section
        className="section engraving-showcase"
        id="engraving"
        style={{ background: 'linear-gradient(135deg, #fbf9f6 0%, #f7f4ef 60%, #efe8df 100%)' }}
      >
        <EngravingPreview
          eyebrow={engravingEyebrow}
          headline={engravingHeadline}
          lede={engravingLede}
        />
      </section>

    </main>
  )
}
