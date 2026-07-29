'use client'
import { useState, useEffect } from 'react'

export function LogoSizer() {
  const [logoH, setLogoH] = useState(40)
  const [headerH, setHeaderH] = useState(60)

  useEffect(() => {
    let tag = document.getElementById('__logo-sizer') as HTMLStyleElement | null
    if (!tag) {
      tag = document.createElement('style')
      tag.id = '__logo-sizer'
      document.head.appendChild(tag)
    }
    tag.textContent = `
      .brand-logo { height: ${logoH}px !important; width: auto !important; display: block !important; max-height: none !important; }
      .header-inner { height: ${headerH}px !important; min-height: unset !important; }
    `
    document.documentElement.style.setProperty('--header-height', `${headerH}px`)
  }, [logoH, headerH])

  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20, zIndex: 9999,
      background: 'white', border: '1px solid #ccc', borderRadius: 12,
      padding: '14px 18px', fontSize: 13, boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      display: 'flex', flexDirection: 'column', gap: 10, minWidth: 220,
    }}>
      <strong style={{ fontSize: 12, color: '#888', letterSpacing: '0.05em' }}>LOGO SIZER</strong>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 88, flexShrink: 0 }}>Logo: <b>{logoH}px</b></span>
        <input type="range" min={20} max={120} value={logoH}
          onChange={e => setLogoH(Number(e.target.value))} style={{ flex: 1 }} />
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 88, flexShrink: 0 }}>Header: <b>{headerH}px</b></span>
        <input type="range" min={44} max={140} value={headerH}
          onChange={e => setHeaderH(Number(e.target.value))} style={{ flex: 1 }} />
      </label>
      <p style={{ margin: 0, fontSize: 11, color: '#aaa' }}>Tell me these numbers when happy ↑</p>
    </div>
  )
}
