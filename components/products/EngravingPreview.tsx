'use client'
import { useState, useEffect, useRef, useCallback } from 'react'

type FontKey = 'clean' | 'elegant' | 'classic'

interface FontDef {
  label: string
  family: string
  italic: boolean
  letterSpacing: string
  textTransform: 'uppercase' | 'none'
  sizeOffset: number
  /** System-font proxy used for canvas measurement */
  canvasFamily: string
}

const FONTS: Record<FontKey, FontDef> = {
  clean: {
    label: 'Open Sans',
    family: "'Open Sans', system-ui, sans-serif",
    italic: false,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    sizeOffset: 0,
    canvasFamily: 'Arial',
  },
  elegant: {
    label: 'Cormorant Italic',
    family: "var(--font-cormorant, 'Cormorant Garamond'), Georgia, serif",
    italic: true,
    letterSpacing: '0.05em',
    textTransform: 'none',
    sizeOffset: 0,
    canvasFamily: 'Georgia',
  },
  classic: {
    label: 'Times New Roman',
    family: "'Times New Roman', Times, serif",
    italic: false,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    sizeOffset: -3,
    canvasFamily: 'Times New Roman',
  },
}

// Maximum font size at BASE_TAG_WIDTH — text always starts here and shrinks to fit width.
// This makes short text (e.g. "LOVE") fill the preview, while long text scales down.
const MAX_FONT_SIZE  = 96
const BASE_TAG_WIDTH = 400

// Measure text width via canvas (system font proxy + safety margin for web font differences).
// Much more reliable than DOM scrollWidth inside a flex container.
const canvas = typeof window !== 'undefined' ? document.createElement('canvas') : null

function measureText(text: string, fontSize: number, def: FontDef): number {
  if (!canvas) return 0
  const ctx = canvas.getContext('2d')!
  ctx.font = `${def.italic ? 'italic ' : ''}bold ${fontSize}px ${def.canvasFamily}`
  const baseWidth = ctx.measureText(text).width
  // Letter-spacing adds (em * fontSize) between each character pair
  const lsEM = parseFloat(def.letterSpacing) || 0
  const spacingExtra = lsEM * fontSize * Math.max(0, text.length - 1)
  // 1.12× safety margin accounts for web font vs system font metric differences
  return (baseWidth + spacingExtra) * 1.12
}

interface EngravingPreviewProps {
  eyebrow: string
  headline: string
  lede: string
}

export function EngravingPreview({ eyebrow, headline, lede }: EngravingPreviewProps) {
  const [text, setText] = useState('')
  const [font, setFont] = useState<FontKey>('clean')
  const [scaledFontSize, setScaledFontSize] = useState(MAX_FONT_SIZE)

  const tagContainerRef = useRef<HTMLDivElement>(null)

  const activeFont  = FONTS[font]
  const displayText = text.trim() ? text.toUpperCase() : 'YOUR TEXT'

  const computeFontSize = useCallback(() => {
    if (!tagContainerRef.current) return
    const containerWidth = tagContainerRef.current.clientWidth
    const def = FONTS[font]

    // Start at max size (scaled to container), then shrink until the text fits.
    // This means short text ("LOVE") stays large and fills the preview,
    // while long text ("WWWWWWWWWW") scales down proportionally.
    let size = Math.max(12, Math.round(MAX_FONT_SIZE * (containerWidth / BASE_TAG_WIDTH)) + def.sizeOffset)

    // Usable width = 68% of container (overlay is 72% wide; inner margin keeps text off the right edge)
    const availableWidth = containerWidth * 0.68

    const measured = measureText(displayText, size, def)
    if (measured > availableWidth) {
      // Jump close in one step, then fine-tune
      size = Math.max(8, Math.floor(size * (availableWidth / measured)))
      while (size > 8 && measureText(displayText, size, def) > availableWidth) {
        size -= 1
      }
    }

    setScaledFontSize(size)
  }, [font, displayText])

  useEffect(() => {
    computeFontSize()
    const el = tagContainerRef.current
    if (!el) return
    const observer = new ResizeObserver(() => computeFontSize())
    observer.observe(el)
    return () => observer.disconnect()
  }, [computeFontSize])

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '80px 32px' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '48px',
          alignItems: 'center',
        }}
      >
        {/* Left: copy + controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <p
            className="eyebrow"
            data-ngf-field="engraving.eyebrow"
            data-ngf-label="Section Eyebrow"
            data-ngf-type="text"
            data-ngf-section="Engraving"
          >
            {eyebrow}
          </p>
          <h2
            data-ngf-field="engraving.headline"
            data-ngf-label="Headline"
            data-ngf-type="text"
            data-ngf-section="Engraving"
          >
            {headline}
          </h2>
          <p
            style={{ maxWidth: '44ch' }}
            data-ngf-field="engraving.lede"
            data-ngf-label="Description"
            data-ngf-type="textarea"
            data-ngf-section="Engraving"
          >
            {lede}
          </p>

          {/* Text input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <label htmlFor="engText" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--ink)' }}>
                Your Text
              </label>
              <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{text.length} / 10</span>
            </div>
            <input
              id="engText"
              type="text"
              maxLength={10}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Your Text"
              autoComplete="off"
              spellCheck={false}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                background: 'white',
                color: 'var(--ink)',
                fontSize: '1rem',
                fontFamily: activeFont.family,
                fontStyle: activeFont.italic ? 'italic' : 'normal',
                letterSpacing: activeFont.letterSpacing,
                outline: 'none',
              }}
            />
          </div>

          {/* Font picker */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--ink)', margin: 0 }}>Font Style</p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {(Object.keys(FONTS) as FontKey[]).map((key) => {
                const def = FONTS[key]
                const isActive = font === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFont(key)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      padding: '12px 20px',
                      borderRadius: '12px',
                      border: isActive ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                      background: isActive ? 'var(--beige)' : 'white',
                      cursor: 'pointer',
                      gap: '4px',
                      minWidth: '80px',
                      fontFamily: 'inherit',
                    }}
                  >
                    <span style={{ fontFamily: def.family, fontStyle: def.italic ? 'italic' : 'normal', fontSize: '1.25rem', color: 'var(--ink)', lineHeight: 1 }}>
                      Aa
                    </span>
                    <span style={{ fontSize: '0.7rem', color: isActive ? 'var(--ink)' : 'var(--muted)', letterSpacing: '0.05em' }}>
                      {def.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right: live preview */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', width: '100%', minWidth: 0 }}>
          <div
            ref={tagContainerRef}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
              width: 'min(400px, 100%)',
              maxWidth: '100%',
              boxSizing: 'border-box',
            }}
          >
            <img
              src="/BlankTAGnoBackground.png"
              alt="Jewelry Tag"
              style={{
                width: '100%',
                height: 'auto',
                filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.15))',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: '11.14%',
                left: 'calc(5.25% + 2px)',
                width: '72%',
                height: '76.58%',
                textAlign: 'center',
                pointerEvents: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              <span
                style={{
                  display: 'block',
                  fontFamily: activeFont.family,
                  fontStyle: activeFont.italic ? 'italic' : 'normal',
                  fontSize: `${scaledFontSize}px`,
                  fontWeight: 700,
                  color: '#3f2d1a',
                  letterSpacing: activeFont.letterSpacing,
                  textTransform: activeFont.textTransform,
                  opacity: 0.68,
                  mixBlendMode: 'multiply',
                  textShadow: '0 -0.9px 0 rgba(255,246,225,0.28), 0 1.4px 0 rgba(58,40,20,0.48), 0 2.6px 3px rgba(28,18,10,0.24), 0 0 0.6px rgba(30,20,11,0.2)',
                  WebkitTextStroke: '0.2px rgba(34,22,12,0.3)',
                  lineHeight: 1.3,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  maxWidth: '100%',
                }}
              >
                {displayText}
              </span>
            </div>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--muted)', letterSpacing: '0.04em', margin: 0, textAlign: 'center' }}>
            Preview
          </p>
        </div>
      </div>
    </div>
  )
}
