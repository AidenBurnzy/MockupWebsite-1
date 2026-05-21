'use client'
import { useState } from 'react'
import { useCart } from '@/components/CartProvider'
import type { ProductVariant } from '@/lib/site-data'

interface ProductModalProps {
  productId: string
  name: string
  description: string
  price: string
  image: string
  images?: string[]
  variants?: ProductVariant[]
  variantType?: string
  onClose: () => void
}

export function ProductModal({
  productId, name, description, price, image, images,
  variants, variantType = 'Size', onClose,
}: ProductModalProps) {
  const { addItem } = useCart()

  // Gallery
  const gallery = (images && images.length > 0) ? images : [image]
  const [selectedImg, setSelectedImg] = useState(0)
  const activeImage = gallery[selectedImg]

  // Variant selector
  const hasVariants = variants && variants.length > 0
  const [selectedVariant, setSelectedVariant] = useState(0)
  const currentPrice = hasVariants ? variants![selectedVariant].price : price

  // Cart confirmation state — flashes green then resets, modal stays open
  const [added, setAdded] = useState(false)

  // Reset flash when the user switches variants
  const handleVariantChange = (i: number) => {
    setSelectedVariant(i)
    setAdded(false)
  }

  const handleAddToCart = () => {
    const selectedSize = hasVariants ? variants![selectedVariant].size : null
    // Include size in the cart ID so 16" and 18" are tracked as separate line items
    addItem({
      id: selectedSize ? `${productId}-${selectedSize}` : productId,
      title: selectedSize ? `${name} (${selectedSize})` : name,
      price: currentPrice,
      image,
    })
    setAdded(true)
    // Reset button after flash — user can keep adding or switch sizes
    setTimeout(() => setAdded(false), 1400)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={name}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(15,10,6,0.72)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          background: '#ffffff',
          borderRadius: '20px',
          boxShadow: '0 32px 80px rgba(0,0,0,0.22)',
          width: '100%',
          maxWidth: '860px',
          maxHeight: '90vh',
          display: 'flex',       // must be inline — CSS class alone is unreliable in Tailwind v4
          flexDirection: 'column',
        }}
        className="modal-container"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            zIndex: 10,
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            border: '1px solid var(--border)',
            background: 'rgba(255,255,255,0.95)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.1rem',
            color: 'var(--muted)',
            lineHeight: 1,
          }}
        >
          ×
        </button>

        {/* ── Image panel ──
            height/position/overflow all inline — CSS class alone is unreliable in Tailwind v4.
            Image is absolutely positioned to fill the panel; thumbnails overlay at bottom. */}
        <div
          className="modal-image-panel"
          style={{
            position: 'relative',
            overflow: 'hidden',
            background: 'var(--beige)',
            flexGrow: 0,
            flexShrink: 0,
            flexBasis: '45vh',   // inline overrides CSS class flex-basis:45% which was resolving to 0
            height: '45vh',      // fallback for non-flex contexts
            borderRadius: '20px 20px 0 0',
          }}
        >
          <img
            key={activeImage}
            src={activeImage}
            alt={name}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: 'block',
            }}
          />

          {/* Thumbnail strip — overlaid at the bottom of the image */}
          {gallery.length > 1 && (
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                display: 'flex',
                gap: '8px',
                padding: '10px 12px',
                overflowX: 'auto',
                background: 'rgba(255,255,255,0.55)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                borderTop: '1px solid rgba(255,255,255,0.4)',
              }}
            >
              {gallery.map((src, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImg(i)}
                  aria-label={`View image ${i + 1}`}
                  style={{
                    flexShrink: 0,
                    width: '56px',
                    height: '56px',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    border: i === selectedImg ? '2px solid var(--burgundy)' : '2px solid rgba(255,255,255,0.8)',
                    padding: 0,
                    cursor: 'pointer',
                    background: 'var(--beige)',
                    transition: 'border-color 160ms ease, transform 160ms ease',
                    transform: i === selectedImg ? 'scale(1.08)' : 'scale(1)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  }}
                >
                  <img
                    src={src}
                    alt={`${name} view ${i + 1}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Content panel ── */}
        <div
          className="modal-content-panel"
          style={{
            flex: '1 1 auto',
            minHeight: 0,
            overflowY: 'auto',
            padding: '22px 24px 28px',
          }}
        >
          <h2
            style={{
              fontFamily: "var(--font-cormorant, 'Cormorant Garamond'), Georgia, serif",
              fontSize: 'clamp(1.6rem, 3vw, 2.2rem)',
              fontWeight: 700,
              color: 'var(--ink)',
              lineHeight: 1.1,
              letterSpacing: '-0.01em',
            }}
          >
            {name}
          </h2>

          <p style={{ fontSize: '1.05rem', color: 'var(--muted)', lineHeight: 1.65, marginTop: '10px' }}>
            {description}
          </p>

          {/* ── Variant / size selector ── */}
          {hasVariants && (
            <div style={{ marginTop: '22px' }}>
              <p style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                letterSpacing: '0.13em',
                textTransform: 'uppercase',
                color: 'var(--muted)',
                marginBottom: '10px',
              }}>
                {variantType}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {variants!.map((v, i) => {
                  const isActive = i === selectedVariant
                  return (
                    <button
                      key={v.size}
                      onClick={() => handleVariantChange(i)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '2px',
                        padding: '9px 16px',
                        borderRadius: '10px',
                        border: isActive ? '1.5px solid var(--burgundy)' : '1.5px solid var(--border)',
                        background: isActive ? 'rgba(139,47,57,0.07)' : '#ffffff',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        transition: 'border-color 150ms ease, background 150ms ease',
                        minWidth: '62px',
                      }}
                    >
                      <span style={{
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        color: isActive ? 'var(--burgundy)' : 'var(--ink)',
                        lineHeight: 1,
                      }}>
                        {v.size}
                      </span>
                      <span style={{
                        fontSize: '0.75rem',
                        color: isActive ? 'var(--burgundy)' : 'var(--muted)',
                        lineHeight: 1,
                        marginTop: '3px',
                      }}>
                        {v.price}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Price */}
          <p
            style={{
              fontFamily: "var(--font-cormorant, 'Cormorant Garamond'), Georgia, serif",
              fontSize: '2rem',
              fontWeight: 700,
              color: 'var(--burgundy)',
              marginTop: '20px',
            }}
          >
            {currentPrice}
          </p>

          {/* Add to Cart — turns green with checkmark on success */}
          <button
            className="btn-solid"
            onClick={handleAddToCart}
            style={{
              marginTop: '20px',
              width: '100%',
              justifyContent: 'center',
              background: added
                ? 'linear-gradient(135deg, #2a7a4a 0%, #1e5c38 100%)'
                : undefined,
              transition: 'background 300ms ease, transform 160ms ease',
              gap: '8px',
            }}
          >
            {added ? '✓  Added!' : 'Add to Cart'}
          </button>
        </div>
      </div>
    </div>
  )
}
