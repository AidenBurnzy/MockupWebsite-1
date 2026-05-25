'use client'
import { useState } from 'react'
import { ProductModal } from '@/components/ui/ProductModal'
import type { Product, ProductVariant } from '@/lib/site-data'
import type { NgfSiteContent } from '@/lib/ngf'
import { getItems } from '@/lib/ngf'

interface BestSellersGridProps {
  products: Product[]
  content: NgfSiteContent
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

export function BestSellersGrid({ products, content }: BestSellersGridProps) {
  const [modal, setModal] = useState<ModalState | null>(null)

  const contentItems = getItems(content, 'bestSellers.items')

  const openModal = (product: Product, idx: number) => {
    const ci = contentItems[idx] ?? {}
    setModal({
      productId: product.id,
      name: ci.name || product.name,
      description: ci.description || product.description,
      price: ci.price || product.price,
      image: ci.image || product.image,
      images: product.images,
      variants: product.variants,
      variantType: product.variantType,
    })
  }

  return (
    <>
      {/* ── Mini-grid ── */}
      <div
        className="best-sellers-grid"
        data-ngf-group="bestSellers.items"
        data-ngf-item-label="Product"
        data-ngf-min-items="1"
        data-ngf-max-items="12"
        data-ngf-item-fields='[{"key":"image","label":"Product Image","type":"image"},{"key":"badge","label":"Badge Text","type":"text"},{"key":"name","label":"Product Name","type":"text"},{"key":"description","label":"Description","type":"textarea"},{"key":"price","label":"Price","type":"text"}]'
      >
        {products.map((product, i) => {
          const ci = contentItems[i] ?? {}
          const name = ci.name || product.name
          const description = ci.description || product.description
          const price = ci.price || product.price
          const comparePrice = product.comparePrice
          const badge = ci.badge || product.badge
          const image = ci.image || product.image

          return (
            <button
              key={product.id}
              className="mini-card"
              onClick={() => openModal(product, i)}
              style={{ border: 'none', fontFamily: 'inherit' }}
            >
              <div className="mini-image">
                <img
                  src={image}
                  alt={name}
                  loading={i < 2 ? 'eager' : 'lazy'}
                  decoding="async"
                  data-ngf-field={`bestSellers.items.${i}.image`}
                  data-ngf-label="Product Image"
                  data-ngf-type="image"
                  data-ngf-section="Best Sellers"
                />
              </div>
              <div className="mini-body">
                {badge && (
                  <p
                    className="eyebrow"
                    style={{ fontSize: '0.85rem', letterSpacing: '0.12em', marginBottom: '2px' }}
                    data-ngf-field={`bestSellers.items.${i}.badge`}
                    data-ngf-label="Badge Text"
                    data-ngf-type="text"
                    data-ngf-section="Best Sellers"
                  >
                    {badge}
                  </p>
                )}
                <h3
                  style={{ fontSize: '1.2rem', margin: 0 }}
                  data-ngf-field={`bestSellers.items.${i}.name`}
                  data-ngf-label="Product Name"
                  data-ngf-type="text"
                  data-ngf-section="Best Sellers"
                >
                  {name}
                </h3>
                <p
                  style={{ margin: 0, fontSize: '0.85rem', color: 'var(--muted)' }}
                  data-ngf-field={`bestSellers.items.${i}.description`}
                  data-ngf-label="Description"
                  data-ngf-type="textarea"
                  data-ngf-section="Best Sellers"
                >
                  {description.length > 72
                    ? description.slice(0, description.lastIndexOf(' ', 72)) + '…'
                    : description}
                </p>
                {product.variants && product.variants.length > 1 ? (
                  <div style={{ marginTop: '2px' }}>
                    <span className="price">
                      {product.variants[0].price}
                      <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: '0.9rem' }}> – {product.variants[product.variants.length - 1].price}</span>
                    </span>
                    <p style={{ fontSize: '0.68rem', color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '3px 0 0', fontWeight: 600 }}>
                      {product.variantType === 'Length' ? `${product.variants.length} lengths` : product.variantType === 'Style' ? 'blank or engraved' : `${product.variants.length} sizes`}
                    </p>
                  </div>
                ) : (
                  <div className="price-row">
                    <span
                      className="price"
                      data-ngf-field={`bestSellers.items.${i}.price`}
                      data-ngf-label="Price"
                      data-ngf-type="text"
                      data-ngf-section="Best Sellers"
                    >
                      {price}
                    </span>
                    {comparePrice && <span className="price-compare">{comparePrice}</span>}
                    {product.badge === 'Sale' || (product.comparePrice && product.comparePrice !== price) ? (
                      <span className="sale-tag">Sale</span>
                    ) : null}
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* ── Shared modal ── */}
      {modal && (
        <ProductModal
          productId={modal.productId}
          name={modal.name}
          description={modal.description}
          price={modal.price}
          image={modal.image}
          images={modal.images}
          variants={modal.variants}
          variantType={modal.variantType}
          onClose={() => setModal(null)}
        />
      )}
    </>
  )
}
