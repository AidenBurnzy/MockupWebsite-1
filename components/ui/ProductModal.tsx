'use client'
import { useState, useEffect, useRef } from 'react'
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
  imageOnly?: boolean   // desktop: show image carousel only, no product details
  onClose: () => void
}

export function ProductModal({
  productId, name, description, price, image, images,
  variants, variantType = 'Size', imageOnly = false, onClose,
}: ProductModalProps) {
  const { addItem } = useCart()

  // Gallery
  const gallery = (images && images.length > 0) ? images : [image]
  const [selectedImg, setSelectedImg] = useState(0)
  const activeImage = gallery[selectedImg]

  const prevImg = () => setSelectedImg(i => (i - 1 + gallery.length) % gallery.length)
  const nextImg = () => setSelectedImg(i => (i + 1) % gallery.length)

  // Variant selector
  const hasVariants = variants && variants.length > 0
  const [selectedVariant, setSelectedVariant] = useState(0)
  const currentPrice = hasVariants ? variants![selectedVariant].price : price

  // Description expand/collapse — only show toggle when text actually overflows 3 lines
  const [descExpanded, setDescExpanded] = useState(false)
  const [descClamped, setDescClamped] = useState(false)
  const descRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    const el = descRef.current
    if (!el) return
    // scrollHeight > clientHeight means text is being cut off by the clamp
    setDescClamped(el.scrollHeight > el.clientHeight)
  }, [description])

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

  // ── Desktop image-only carousel ───────────────────────────────────────────
  if (imageOnly) {
    const arrowBtn: React.CSSProperties = {
      position: 'absolute', top: '50%', transform: 'translateY(-50%)',
      zIndex: 5, width: '40px', height: '40px', borderRadius: '50%',
      border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(0,0,0,0.45)',
      color: '#fff', fontSize: '1.3rem', cursor: 'pointer', display: 'flex',
      alignItems: 'center', justifyContent: 'center', lineHeight: 1,
      fontFamily: 'inherit', transition: 'background 150ms ease',
    }
    return (
      <div
        role="dialog" aria-modal="true" aria-label={name}
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose()
          if (e.key === 'ArrowLeft') prevImg()
          if (e.key === 'ArrowRight') nextImg()
        }}
        tabIndex={-1}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '32px',
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'relative', width: '100%', maxWidth: '680px',
            borderRadius: '16px', overflow: 'hidden',
            boxShadow: '0 40px 100px rgba(0,0,0,0.5)',
            background: 'var(--beige)',
          }}
        >
          {/* Close */}
          <button onClick={onClose} aria-label="Close" style={{
            position: 'absolute', top: '12px', right: '12px', zIndex: 10,
            width: '34px', height: '34px', borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.4)', background: 'rgba(0,0,0,0.45)',
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '1.1rem', color: '#fff', lineHeight: 1,
          }}>×</button>

          {/* Product name */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, zIndex: 4,
            padding: '14px 52px 14px 18px',
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 100%)',
          }}>
            <p style={{ color: '#fff', fontSize: '1rem', fontWeight: 600, margin: 0, textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>
              {name}
            </p>
          </div>

          {/* Main image */}
          <div style={{ position: 'relative', height: '72vh', background: 'var(--beige)' }}>
            <img
              key={activeImage}
              src={activeImage} alt={name}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
            />

            {/* Prev / Next arrows */}
            {gallery.length > 1 && (
              <>
                <button onClick={prevImg} aria-label="Previous image" style={{ ...arrowBtn, left: '12px' }}>‹</button>
                <button onClick={nextImg} aria-label="Next image"     style={{ ...arrowBtn, right: '12px' }}>›</button>

                {/* Counter */}
                <span style={{
                  position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)',
                  background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: '0.75rem',
                  padding: '3px 10px', borderRadius: '999px', letterSpacing: '0.05em',
                }}>
                  {selectedImg + 1} / {gallery.length}
                </span>
              </>
            )}
          </div>

          {/* Thumbnail strip */}
          {gallery.length > 1 && (
            <div style={{
              display: 'flex', gap: '8px', padding: '10px 14px',
              overflowX: 'auto', background: 'rgba(255,255,255,0.92)',
              borderTop: '1px solid var(--border)', flexShrink: 0,
            }}>
              {gallery.map((src, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImg(i)}
                  aria-label={`View image ${i + 1}`}
                  style={{
                    flexShrink: 0, width: '52px', height: '52px', borderRadius: '8px',
                    overflow: 'hidden', padding: 0, cursor: 'pointer', background: 'var(--beige)',
                    border: i === selectedImg ? '2px solid var(--burgundy)' : '2px solid var(--border)',
                    transition: 'border-color 160ms ease, transform 160ms ease',
                    transform: i === selectedImg ? 'scale(1.08)' : 'scale(1)',
                  }}
                >
                  <img src={src} alt={`${name} ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    )
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

        </div>

        {/* Thumbnail strip — below the image, not overlaying it */}
        {gallery.length > 1 && (
          <div
            style={{
              display: 'flex',
              gap: '8px',
              padding: '10px 14px',
              overflowX: 'auto',
              background: 'var(--beige)',
              borderBottom: '1px solid var(--border)',
              flexShrink: 0,
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
                  border: i === selectedImg ? '2px solid var(--burgundy)' : '2px solid var(--border)',
                  padding: 0,
                  cursor: 'pointer',
                  background: '#fff',
                  transition: 'border-color 160ms ease, transform 160ms ease',
                  transform: i === selectedImg ? 'scale(1.05)' : 'scale(1)',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
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

          <p
            ref={descRef}
            style={{
              fontSize: '1.05rem', color: 'var(--muted)', lineHeight: 1.65, marginTop: '10px',
              ...(!descExpanded ? {
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: 3,
              } : {}),
            }}
          >
            {description}
          </p>
          {descClamped && (
            <button
              onClick={() => setDescExpanded(v => !v)}
              style={{
                background: 'none', border: 'none', padding: '4px 0 0',
                fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent)',
                cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.03em',
              }}
            >
              {descExpanded ? 'Show less ▲' : 'Read more ▼'}
            </button>
          )}

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
