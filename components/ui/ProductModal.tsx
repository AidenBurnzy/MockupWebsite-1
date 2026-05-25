'use client'
import { useState, useEffect } from 'react'
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
  imageOnly?: boolean
  onClose: () => void
}

export function ProductModal({
  productId, name, description, price, image, images,
  variants, variantType = 'Size', imageOnly = false, onClose,
}: ProductModalProps) {
  const { addItem } = useCart()

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const gallery = (images && images.length > 0) ? images : [image]
  const [selectedImg, setSelectedImg] = useState(0)
  const activeImage = gallery[selectedImg]
  const prevImg = () => setSelectedImg(i => (i - 1 + gallery.length) % gallery.length)
  const nextImg = () => setSelectedImg(i => (i + 1) % gallery.length)

  const hasVariants = variants && variants.length > 0
  const [selectedVariant, setSelectedVariant] = useState(0)
  const currentPrice = hasVariants ? variants![selectedVariant].price : price

  const [descOpen, setDescOpen] = useState(false)
  const [added, setAdded] = useState(false)
  const [lightbox, setLightbox] = useState(false)

  const handleAddToCart = () => {
    const selectedSize = hasVariants ? variants![selectedVariant].size : null
    addItem({
      id: selectedSize ? `${productId}-${selectedSize}` : productId,
      title: selectedSize ? `${name} (${selectedSize})` : name,
      price: currentPrice,
      image,
    })
    setAdded(true)
    setTimeout(() => setAdded(false), 1400)
  }

  // image-only mode
  if (imageOnly) {
    const arrowBtn: React.CSSProperties = {
      position: 'absolute', top: '50%', transform: 'translateY(-50%)',
      zIndex: 5, width: '40px', height: '40px', borderRadius: '50%',
      border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(0,0,0,0.45)',
      color: '#fff', fontSize: '1.3rem', cursor: 'pointer', display: 'flex',
      alignItems: 'center', justifyContent: 'center', lineHeight: 1,
      fontFamily: 'inherit',
    }
    return (
      <div role="dialog" aria-modal="true" aria-label={name} onClick={onClose} tabIndex={-1}
        style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
        <div onClick={e => e.stopPropagation()} style={{ position: 'relative', width: '100%', maxWidth: '680px', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 40px 100px rgba(0,0,0,0.5)', background: 'var(--beige)' }}>
          <button onClick={onClose} aria-label="Close" style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 10, width: '34px', height: '34px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.4)', background: 'rgba(0,0,0,0.45)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', color: '#fff', lineHeight: 1 }}>&times;</button>
          <div style={{ position: 'relative', height: '72vh', background: 'var(--beige)' }}>
            <img key={activeImage} src={activeImage} alt={name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
            {gallery.length > 1 && (<><button onClick={prevImg} aria-label="Previous" style={{ ...arrowBtn, left: '12px' }}>&lsaquo;</button><button onClick={nextImg} aria-label="Next" style={{ ...arrowBtn, right: '12px' }}>&rsaquo;</button></>)}
          </div>
        </div>
      </div>
    )
  }

  // MAIN MODAL
  return (
    <>
      <style>{`
        @keyframes pmFadeUp {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes pmFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        /* Card sizes to content, capped at 90vh, scrolls if needed */
        .pm-card {
          position: relative;
          width: 100%;
          max-width: 460px;
          max-height: 90vh;
          border-radius: 28px;
          overflow-x: hidden;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: contain;
          box-shadow: 0 48px 120px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.07);
          animation: pmFadeUp 300ms cubic-bezier(0.22,1,0.36,1) both;
          display: flex;
          flex-direction: column;
        }
        /* Image section: natural height, capped so it never dominates */
        .pm-hero {
          position: relative;
          flex: 0 0 auto;
          background: var(--beige);
          overflow: hidden;
          cursor: zoom-in;
        }
        .pm-main-img {
          width: 100%;
          height: auto;
          max-height: 55vh;
          object-fit: contain;
          display: block;
        }
        .pm-thumb-btn img { object-fit: cover !important; padding: 0 !important; }
        .pm-thumbs {
          position: absolute; top: 12px; left: 12px;
          display: flex; gap: 6px; z-index: 5;
        }
        .pm-thumb-btn {
          width: 44px; height: 44px; border-radius: 9px; overflow: hidden;
          border: 2px solid transparent; padding: 0; cursor: pointer;
          background: rgba(0,0,0,0.35); backdrop-filter: blur(6px);
          transition: border-color 150ms ease, transform 150ms ease; flex-shrink: 0;
        }
        .pm-thumb-btn.active { border-color: #fff; transform: scale(1.08); }
        .pm-thumb-btn img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .pm-close {
          position: absolute; top: 12px; right: 12px; z-index: 10;
          width: 34px; height: 34px; border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.3); background: rgba(0,0,0,0.45);
          backdrop-filter: blur(8px); color: #fff; font-size: 1.1rem; cursor: pointer;
          display: flex; align-items: center; justify-content: center; line-height: 1;
          transition: background 150ms ease;
        }
        .pm-close:hover { background: rgba(0,0,0,0.7); }
        /* Full circle behind the card — card covers the overlap, arc peeks out */
        .pm-close-corner {
          position: absolute;
          top: -26px;
          right: -26px;
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: rgba(18,14,10,0.92);
          border: none;
          cursor: pointer;
          color: #fff;
          font-size: 1rem;
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: opacity 180ms ease;
          z-index: 1;
        }
        .pm-close-corner:hover { opacity: 0.72; }
        /* Mobile: hide corner tab, show inline close */
        @media (max-width: 640px) {
          .pm-close-corner { display: none; }
          .pm-close { display: flex; }
        }
        /* Desktop: show corner tab, hide inline close */
        @media (min-width: 641px) {
          .pm-close-corner { display: flex; }
          .pm-close { display: none; }
        }
        .pm-arrow {
          position: absolute; top: 50%; transform: translateY(-50%); z-index: 5;
          width: 36px; height: 36px; border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.25); background: rgba(0,0,0,0.4);
          backdrop-filter: blur(6px); color: #fff; font-size: 1.1rem; cursor: pointer;
          display: flex; align-items: center; justify-content: center; line-height: 1;
          font-family: inherit; transition: background 150ms ease;
        }
        .pm-arrow:hover { background: rgba(0,0,0,0.65); }
        /* Panel: natural height, no forced sizing */
        .pm-panel {
          flex: 0 0 auto;
          background: #ffffff;
          padding: 20px 22px 24px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          border-top: 1px solid var(--border);
        }
        .pm-title {
          font-family: var(--font-cormorant,"Cormorant Garamond"),Georgia,serif;
          font-size: clamp(1.6rem, 4vw, 2.2rem);
          font-weight: 700; color: var(--ink);
          line-height: 1.05; letter-spacing: -0.01em; margin: 0;
        }
        .pm-pill {
          padding: 8px 16px; border-radius: 999px;
          border: 1.5px solid rgba(31,27,22,0.18);
          background: #ffffff;
          color: var(--ink);
          font-family: inherit; font-size: 0.82rem; font-weight: 600;
          cursor: pointer; display: flex; flex-direction: column;
          align-items: center; gap: 1px;
          transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
          white-space: nowrap;
        }
        .pm-pill.active {
          background: var(--beige); border-color: var(--accent);
          color: var(--accent);
        }
        .pm-pill span { font-size: 0.7rem; color: var(--muted); }
        .pm-pill.active span { color: var(--accent); }
        .pm-desc-btn {
          background: none; border: none;
          color: var(--muted); font-family: inherit;
          font-size: 0.76rem; font-weight: 600; letter-spacing: 0.05em;
          cursor: pointer; padding: 0; text-align: left;
          transition: color 150ms ease;
        }
        .pm-desc-btn:hover { color: var(--ink); }
        .pm-desc-text {
          font-size: 0.88rem; color: var(--muted); line-height: 1.6; margin: 0;
        }
        .pm-price {
          font-family: var(--font-cormorant,"Cormorant Garamond"),Georgia,serif;
          font-size: 1.7rem; font-weight: 700; color: var(--burgundy); letter-spacing: 0.01em;
        }
        .pm-add-btn {
          flex: 1; padding: 13px 20px; border-radius: 999px; border: none;
          font-family: inherit; font-size: 0.85rem; font-weight: 700;
          letter-spacing: 0.13em; text-transform: uppercase; cursor: pointer;
          transition: background 300ms ease, transform 150ms ease, box-shadow 150ms ease;
        }
        .pm-add-btn:hover { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(0,0,0,0.35); }
        .pm-add-btn:active { transform: scale(0.98); }
      `}</style>

      {/* Backdrop */}
      <div
        role="dialog" aria-modal="true" aria-label={name}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(8,5,3,0.82)',
          backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px',
          animation: 'pmFadeIn 200ms ease both',
          overscrollBehavior: 'contain',
          touchAction: 'none',
        }}
      >
        {/* Card wrapper — relative so corner button floats on the corner */}
        <div style={{ position: 'relative', width: '100%', maxWidth: '460px' }} onClick={e => e.stopPropagation()}>
          <button className="pm-close-corner" onClick={onClose} aria-label="Close">&times;</button>
          <div
            className="pm-card"
            style={{ position: 'relative', zIndex: 2 }}
            onTouchMove={e => e.stopPropagation()}
            onWheel={e => e.stopPropagation()}
          >
          {/* Image */}
          <div className="pm-hero" onClick={() => setLightbox(true)}>
            <img key={activeImage} src={activeImage} alt={name} className="pm-main-img" />

            {gallery.length > 1 && (
              <div className="pm-thumbs">
                {gallery.map((src, i) => (
                  <button key={i} className={`pm-thumb-btn${i === selectedImg ? ' active' : ''}`}
                    onClick={e => { e.stopPropagation(); setSelectedImg(i) }} aria-label={`Image ${i + 1}`}>
                    <img src={src} alt="" />
                  </button>
                ))}
              </div>
            )}

            {gallery.length > 1 && (
              <>
                <button className="pm-arrow" onClick={e => { e.stopPropagation(); prevImg() }} aria-label="Previous" style={{ left: '10px' }}>&lsaquo;</button>
                <button className="pm-arrow" onClick={e => { e.stopPropagation(); nextImg() }} aria-label="Next" style={{ right: '10px' }}>&rsaquo;</button>
              </>
            )}

            <button className="pm-close" onClick={onClose} aria-label="Close">&times;</button>
          </div>

          {/* Info panel */}
          <div className="pm-panel">
            <h2 className="pm-title">{name}</h2>

            <div>
              <button className="pm-desc-btn" onClick={() => setDescOpen(v => !v)}>
                {descOpen ? 'Hide details' : 'Details'}
              </button>
              {descOpen && <p className="pm-desc-text" style={{ marginTop: '8px' }}>{description}</p>}
            </div>

            {hasVariants && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }} onClick={e => e.stopPropagation()}>
                {variants!.map((v, i) => (
                  <button key={v.size}
                    className={`pm-pill${i === selectedVariant ? ' active' : ''}`}
                    onClick={() => { setSelectedVariant(i); setAdded(false) }}>
                    {v.size}<span>{v.price}</span>
                  </button>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '2px' }}>
              <span className="pm-price">{currentPrice}</span>
              <button className="pm-add-btn" onClick={handleAddToCart}
                style={{
                  background: added
                    ? 'linear-gradient(135deg,#2a7a4a,#1e5c38)'
                    : 'linear-gradient(135deg,#1f1b16,#2b241d)',
                  color: '#fff',
                }}>
                {added ? 'Added!' : 'Add to Cart'}
              </button>
            </div>
          </div>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(false)}
          onKeyDown={e => {
            if (e.key === 'Escape') setLightbox(false)
            if (e.key === 'ArrowLeft') { e.stopPropagation(); prevImg() }
            if (e.key === 'ArrowRight') { e.stopPropagation(); nextImg() }
          }}
          tabIndex={-1}
          style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', cursor: 'zoom-out' }}>
          <img src={activeImage} alt={name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 40px 100px rgba(0,0,0,0.6)' }} />
          <button onClick={() => setLightbox(false)} aria-label="Close" style={{ position: 'fixed', top: '16px', right: '16px', width: '40px', height: '40px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: '1.2rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>&times;</button>
          {gallery.length > 1 && (
            <>
              <button onClick={e => { e.stopPropagation(); prevImg() }} aria-label="Previous" style={{ position: 'fixed', left: '16px', top: '50%', transform: 'translateY(-50%)', width: '44px', height: '44px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: '1.4rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>&lsaquo;</button>
              <button onClick={e => { e.stopPropagation(); nextImg() }} aria-label="Next" style={{ position: 'fixed', right: '16px', top: '50%', transform: 'translateY(-50%)', width: '44px', height: '44px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: '1.4rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>&rsaquo;</button>
              <span style={{ position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: '0.8rem', padding: '4px 12px', borderRadius: '999px' }}>{selectedImg + 1} / {gallery.length}</span>
            </>
          )}
        </div>
      )}
    </>
  )
}
