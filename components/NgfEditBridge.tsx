'use client'
import { useEffect } from 'react'

/**
 * Canonical version of this file. Bump when the postMessage contract changes.
 *
 * This exists so drift is detectable. The bridge is copied per-site rather than
 * installed, and an audit found 7 of 9 live sites running a stale copy (9.9 KB
 * to 38.6 KB against the canonical ~43 KB) with no way to tell from the outside.
 * `npm run doctor` reads this constant; `npm run sync-ngf` refreshes the file.
 *
 * DO NOT hand-edit this file in a client site. Run `npm run sync-ngf` instead —
 * local edits are overwritten and the version then lies about what the code does.
 */
export const NGF_BRIDGE_VERSION = '1.2.0'

/**
 * NgfEditBridge — enables the NGF portal's live preview and click-to-edit.
 * Must be included in app/layout.tsx. Do not remove.
 */
export default function NgfEditBridge() {
  useEffect(() => {
    let editMode = false

    const style = document.createElement('style')
    style.id = 'ngf-edit-styles'
    style.textContent = `
      [data-ngf-edit="true"] [data-ngf-field] {
        outline: 1.5px dashed rgba(59,130,246,0.45) !important;
        border-radius: 3px;
        cursor: pointer !important;
      }
      [data-ngf-edit="true"] [data-ngf-field]:hover {
        outline-color: #3b82f6 !important;
        background-color: rgba(59,130,246,0.06) !important;
      }
      /* Empty field placeholder — keeps blank fields clickable in edit mode */
      [data-ngf-edit="true"] [data-ngf-field]:empty {
        min-height: 1.2em;
        min-width: 60px;
        display: inline-block;
      }
      [data-ngf-edit="true"] [data-ngf-field]:empty::before {
        content: attr(data-ngf-label);
        color: #94a3b8;
        font-style: italic;
        pointer-events: none;
      }
      /* Toggle (show/hide) section that is OFF — only inside the editor it
         stays visible but dimmed + badged so the client can switch it back on.
         On the live site it's display:none (set inline by applyToggleState). */
      [data-ngf-edit="true"] [data-ngf-type="toggle"][data-ngf-hidden="true"] {
        position: relative;
        opacity: 0.5 !important;
        outline: 2px dashed #f59e0b !important;
        outline-offset: -2px;
      }
      [data-ngf-edit="true"] [data-ngf-type="toggle"][data-ngf-hidden="true"]::after {
        content: "Hidden on your live site";
        position: absolute;
        top: 8px;
        left: 50%;
        transform: translateX(-50%);
        background: #f59e0b;
        color: #fff;
        font-size: 12px;
        font-weight: 600;
        padding: 3px 10px;
        border-radius: 999px;
        z-index: 5;
        pointer-events: none;
        font-family: system-ui, -apple-system, sans-serif;
        white-space: nowrap;
      }

      /* Pulse highlight when editor scrolls to a field */
      [data-ngf-field].ngf-field-focus {
        animation: ngfFieldFocus 1.6s ease-out;
      }
      @keyframes ngfFieldFocus {
        0%   { outline-color: #3b82f6 !important; background-color: rgba(59,130,246,0.25) !important; }
        100% { outline-color: rgba(59,130,246,0.45) !important; background-color: transparent !important; }
      }

      /* Dropdown toggle hint — make it obvious dropdown triggers still work
         in edit mode (they do; the click handler below lets them through). */
      [data-ngf-edit="true"] [aria-haspopup],
      [data-ngf-edit="true"] [aria-expanded] {
        cursor: pointer !important;
      }

      /* Force-reveal the desktop More dropdown in edit mode so its items are clickable */
      [data-ngf-edit="true"] #desktop-more-menu {
        pointer-events: auto !important;
        opacity: 1 !important;
        transform: translateY(0) !important;
      }

      /* Navigation popup injected by NgfEditBridge */
      #ngf-nav-popup {
        position: fixed;
        z-index: 2147483647;
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        box-shadow: 0 4px 24px rgba(0,0,0,0.14), 0 1px 4px rgba(0,0,0,0.08);
        padding: 6px;
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 170px;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        pointer-events: auto !important;
      }
      #ngf-nav-popup-label {
        font-size: 11px;
        color: #94a3b8;
        padding: 4px 10px 2px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 200px;
      }
      #ngf-nav-popup .ngf-nav-btn {
        all: unset;
        display: block;
        width: 100%;
        box-sizing: border-box;
        padding: 7px 10px;
        border-radius: 7px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.12s;
        white-space: nowrap;
        pointer-events: auto !important;
      }
      #ngf-nav-popup .ngf-go-btn {
        color: #1d4ed8;
        background: #eff6ff;
      }
      #ngf-nav-popup .ngf-go-btn:hover {
        background: #dbeafe;
      }
      #ngf-nav-popup .ngf-edit-btn {
        color: #0f172a;
        background: transparent;
      }
      #ngf-nav-popup .ngf-edit-btn:hover {
        background: #f3f4f6;
      }

      /* Image field overlay button — permanent visible affordance for image
         replacement. Solves the discoverability gap: clients don't always
         realize they can click an image to change it. Positioned by JS on
         scroll/resize via requestAnimationFrame. */
      .ngf-image-edit-btn {
        position: fixed;
        z-index: 2147483646;
        padding: 8px 14px;
        background: rgba(15, 23, 42, 0.92);
        color: #fff;
        border: none;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 600;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        box-shadow: 0 4px 14px rgba(0,0,0,0.3), 0 1px 3px rgba(0,0,0,0.2);
        pointer-events: auto !important;
        transition: background 0.15s, transform 0.1s;
        -webkit-backdrop-filter: blur(6px);
        backdrop-filter: blur(6px);
        line-height: 1;
        user-select: none;
      }
      .ngf-image-edit-btn:hover {
        background: rgba(15, 23, 42, 1);
        transform: scale(1.04);
      }
      .ngf-image-edit-btn:active {
        transform: scale(0.96);
      }
      .ngf-image-edit-btn svg {
        width: 14px;
        height: 14px;
        flex-shrink: 0;
      }

      /* Image-delete X button — only appears on images inside repeatable
         groups (those that can actually be removed). Top-left corner, red. */
      .ngf-image-delete-btn {
        position: fixed;
        z-index: 2147483646;
        width: 32px;
        height: 32px;
        padding: 0;
        background: rgba(220, 38, 38, 0.95);
        color: #fff;
        border: none;
        border-radius: 50%;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 14px rgba(0,0,0,0.3), 0 1px 3px rgba(0,0,0,0.2);
        pointer-events: auto !important;
        transition: background 0.15s, transform 0.1s;
        -webkit-backdrop-filter: blur(6px);
        backdrop-filter: blur(6px);
        user-select: none;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      .ngf-image-delete-btn:hover {
        background: rgba(185, 28, 28, 1);
        transform: scale(1.08);
      }
      .ngf-image-delete-btn:active {
        transform: scale(0.92);
      }
      .ngf-image-delete-btn svg {
        width: 16px;
        height: 16px;
      }

      /* Drag-to-reorder cursor and visual states on image group items. */
      [data-ngf-edit="true"] [data-ngf-field][data-ngf-draggable="true"] {
        cursor: grab;
      }
      [data-ngf-edit="true"] [data-ngf-field][data-ngf-draggable="true"]:active {
        cursor: grabbing;
      }
      /* Source: image being dragged dims out so user sees what's moving */
      [data-ngf-edit="true"] [data-ngf-field].ngf-dragging {
        opacity: 0.35 !important;
        outline: 2px dashed #3b82f6 !important;
      }
      /* Target: image being dragged over gets a bold blue ring */
      [data-ngf-edit="true"] [data-ngf-field].ngf-drag-target {
        outline: 3px solid #2563eb !important;
        outline-offset: 2px;
        background-color: rgba(37, 99, 235, 0.08) !important;
      }
    `
    document.head.appendChild(style)

    // ── Nav popup helpers ──────────────────────────────────────────────────────
    let navPopup: HTMLDivElement | null = null

    function dismissNavPopup() {
      navPopup?.remove()
      navPopup = null
    }

    type EditTarget = {
      section: string
      field: string
      value: string
      fieldType: string   // data-ngf-type value — sent so editor doesn't rely on schema alone
      rect: DOMRect
    }

    function postFieldClick(t: EditTarget) {
      window.parent.postMessage(
        {
          type:    'fieldClick',
          section: t.section,
          field:   t.field,
          currentValue: t.value,
          fieldType: t.fieldType,
          elementRect: {
            top:    t.rect.top,
            left:   t.rect.left,
            bottom: t.rect.bottom,
            right:  t.rect.right,
            width:  t.rect.width,
            height: t.rect.height,
          },
        },
        trustedOrigin ?? 'https://app.ngfsystems.com',
      )
    }

    function showNavPopup(
      href: string,
      label: string,
      clientX: number,
      clientY: number,
      editTarget?: EditTarget,
    ) {
      dismissNavPopup()

      const popup = document.createElement('div')
      popup.id = 'ngf-nav-popup'

      const lbl = document.createElement('div')
      lbl.id = 'ngf-nav-popup-label'
      lbl.textContent = label || 'Link'
      popup.appendChild(lbl)

      const goBtn = document.createElement('button')
      goBtn.className = 'ngf-nav-btn ngf-go-btn'
      goBtn.textContent = '→  Go to page'
      goBtn.addEventListener('click', (ev) => {
        ev.stopPropagation()
        dismissNavPopup()
        window.location.href = href
      })
      popup.appendChild(goBtn)

      if (editTarget) {
        const editBtn = document.createElement('button')
        editBtn.className = 'ngf-nav-btn ngf-edit-btn'
        editBtn.textContent = '✎  Edit'
        editBtn.addEventListener('click', (ev) => {
          ev.stopPropagation()
          dismissNavPopup()
          postFieldClick(editTarget)
        })
        popup.appendChild(editBtn)
      }

      popup.style.visibility = 'hidden'
      document.body.appendChild(popup)
      navPopup = popup

      const pw = popup.offsetWidth || 180
      const ph = popup.offsetHeight || 110
      const vw = window.innerWidth
      const vh = window.innerHeight
      let left = clientX
      let top = clientY + 10
      if (left + pw + 8 > vw) left = vw - pw - 8
      if (top + ph + 8 > vh) top = clientY - ph - 10
      popup.style.left = `${Math.max(8, left)}px`
      popup.style.top = `${Math.max(8, top)}px`
      popup.style.visibility = ''
    }

    // ── Default-value cache ───────────────────────────────────────────────────
    // Capture each annotated field's original server-rendered value on first
    // sight. For <img> or data-ngf-type="image" we cache the src; everything
    // else caches textContent. Stored on the element itself so it survives
    // later DOM mutations and so the editor can send '' to mean "restore".
    function isImageField(el: HTMLElement) {
      return el.tagName?.toLowerCase() === 'img' || el.getAttribute('data-ngf-type') === 'image'
    }
    function isToggleField(el: HTMLElement) {
      return el.getAttribute('data-ngf-type') === 'toggle'
    }

    function isGalleryField(el: HTMLElement) {
      return el.getAttribute('data-ngf-type') === 'gallery'
    }

    /**
     * Live-preview a gallery: the value is a JSON array of image URLs held in one
     * scalar field, and the annotated element is the CONTAINER, not an <img>.
     *
     * Mirrors addGroupItem's clone-the-last-child approach — grow by cloning the
     * final child, shrink by removing extras, then rewrite every <img> src. The
     * site owns the markup of one tile; we only ever repeat it, so a site can
     * style tiles however it likes and this still works.
     *
     * An empty value means "restore the server-rendered default", exactly as it
     * does for text and images — so a cleared gallery repaints the original
     * photos rather than emptying the section.
     */
    function applyGalleryState(container: HTMLElement, raw: string) {
      if (container.dataset.ngfGalleryDefault === undefined) {
        container.dataset.ngfGalleryDefault = container.innerHTML
      }
      if (raw === '') {
        container.innerHTML = container.dataset.ngfGalleryDefault
        return
      }

      let urls: string[] = []
      try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          urls = parsed
            .map(e => (typeof e === 'string' ? e : e && typeof e === 'object' ? (e as { src?: string }).src : null))
            .filter((u): u is string => typeof u === 'string' && u.trim() !== '')
        }
      } catch {
        return // Malformed mid-edit: leave the DOM alone rather than blanking it.
      }
      if (urls.length === 0) {
        container.innerHTML = container.dataset.ngfGalleryDefault
        return
      }

      const template = container.lastElementChild as HTMLElement | null
      if (!template) return

      while (container.children.length > urls.length) container.lastElementChild?.remove()
      while (container.children.length < urls.length) {
        container.appendChild(template.cloneNode(true) as HTMLElement)
      }

      urls.forEach((url, i) => {
        const child = container.children[i] as HTMLElement | undefined
        if (!child) return
        const img = (child.tagName === 'IMG' ? child : child.querySelector('img')) as HTMLImageElement | null
        if (img) img.setAttribute('src', sanitizeImageUrl(url))
      })
    }
    // Show/hide a whole section from a boolean-ish value: '' or 'true' => shown,
    // 'false' => hidden. On the live site we hard-hide with display:none. Inside
    // the editor we keep the section in view (dimmed + badged via CSS) so the
    // client can switch it back on — never strand a section off-screen.
    function applyToggleState(el: HTMLElement, value: string) {
      const hidden = value === 'false'
      el.dataset.ngfHidden = hidden ? 'true' : 'false'
      if (editMode) {
        el.style.removeProperty('display')
      } else {
        el.style.display = hidden ? 'none' : ''
      }
    }
    function captureDefaults() {
      document.querySelectorAll<HTMLElement>('[data-ngf-field]').forEach(el => {
        if (isToggleField(el)) return   // visibility state, not text — nothing to cache
        if (el.dataset.ngfDefault === undefined) {
          el.dataset.ngfDefault = isImageField(el)
            ? (el as HTMLImageElement).getAttribute('src') ?? ''
            : el.textContent ?? ''
        }
      })
    }
    captureDefaults()

    // ── Image edit-button overlay ─────────────────────────────────────────────
    // Adds a permanent visible "Replace photo" button on every annotated image
    // when edit mode is on. Reposition on scroll/resize via rAF throttling.
    const editButtons = new Map<HTMLElement, HTMLButtonElement>()

    /**
     * True when the element is scrolled far enough out of view that an overlay
     * button for it should not be shown at all.
     *
     * These buttons are `position: fixed` and positioned from
     * getBoundingClientRect(), so they must be hidden rather than clamped into
     * view. Clamping with Math.max(8, …) pins the button to the top of the
     * viewport once the image scrolls above it — the button detaches from its
     * image and, with several images, they stack up at the top of the screen.
     */
    function isOffscreenForOverlay(rect: DOMRect, btnHeight: number): boolean {
      return rect.bottom < btnHeight + 16 || rect.top > window.innerHeight - 8
    }

    function positionEditButton(btn: HTMLButtonElement, img: HTMLElement) {
      const rect = img.getBoundingClientRect()
      // Don't overlay buttons on tiny images (logos / icons).
      if (rect.width < 40 || rect.height < 40) {
        btn.style.display = 'none'
        return
      }
      const btnHeight = btn.offsetHeight || 34
      if (isOffscreenForOverlay(rect, btnHeight)) {
        btn.style.display = 'none'
        return
      }
      btn.style.display = ''
      // 8px inset from the image's top-right. Clamp to the viewport so it stays
      // reachable, but never past the image's own bottom edge — otherwise the
      // button floats away from the image it belongs to.
      const btnWidth = btn.offsetWidth || 140
      const maxTop = Math.min(window.innerHeight - btnHeight - 8, rect.bottom - btnHeight - 8)
      const top  = Math.max(8, Math.min(rect.top + 8, maxTop))
      const left = Math.max(8, Math.min(rect.right - btnWidth - 8, window.innerWidth - btnWidth - 8))
      btn.style.top  = `${top}px`
      btn.style.left = `${left}px`
    }

    function ensureEditButton(el: HTMLElement) {
      if (!isImageField(el)) return
      if (editButtons.has(el)) return
      const btn = document.createElement('button')
      btn.className = 'ngf-image-edit-btn'
      btn.type      = 'button'
      btn.setAttribute('aria-label', 'Replace photo')
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14.74 6.46l-7.55 7.55a2 2 0 0 0-.55 1.06l-.7 3.45 3.45-.7a2 2 0 0 0 1.06-.55l7.55-7.55-3.26-3.26z"/><path d="M16.6 4.6l2.8 2.8"/></svg>Replace photo'
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        e.preventDefault()
        const path = el.getAttribute('data-ngf-field') || ''
        const dot  = path.indexOf('.')
        const section = dot === -1 ? path : path.slice(0, dot)
        const field   = dot === -1 ? ''   : path.slice(dot + 1)
        const value   = (el as HTMLImageElement).getAttribute('src') ?? ''
        postFieldClick({
          section, field, value, fieldType: 'image',
          rect: el.getBoundingClientRect(),
        })
      })
      document.body.appendChild(btn)
      editButtons.set(el, btn)
      // Defer initial positioning until after the button has measured itself.
      requestAnimationFrame(() => positionEditButton(btn, el))
    }

    function injectAllImageButtons() {
      document.querySelectorAll<HTMLElement>('[data-ngf-field]').forEach(ensureEditButton)
    }

    function removeAllImageButtons() {
      editButtons.forEach(btn => btn.remove())
      editButtons.clear()
    }

    // ── Repeatable-group detection ────────────────────────────────────────────
    // For an image element, returns {group, index} if it lives inside a
    // [data-ngf-group] AND its data-ngf-field follows the indexed-item pattern
    // (e.g. "team.members.2.image" inside data-ngf-group="team.members").
    // Returns null for standalone images (hero, logo, etc.) — those can't be
    // reordered or removed.
    function getGroupContext(el: HTMLElement): { group: string; index: number; container: HTMLElement } | null {
      const path = el.getAttribute('data-ngf-field') || ''
      const parts = path.split('.')
      if (parts.length < 3) return null
      // Find the nearest [data-ngf-group] ancestor whose group path is a
      // prefix of this field's path.
      let cursor: HTMLElement | null = el.parentElement
      while (cursor && cursor !== document.documentElement) {
        const groupPath = cursor.getAttribute('data-ngf-group')
        if (groupPath && path.startsWith(groupPath + '.')) {
          const rest = path.slice(groupPath.length + 1)   // "2.image"
          const idxStr = rest.split('.')[0]
          const idx = parseInt(idxStr, 10)
          if (!isNaN(idx)) {
            return { group: groupPath, index: idx, container: cursor }
          }
        }
        cursor = cursor.parentElement
      }
      return null
    }

    // ── Image delete overlay (X button) ───────────────────────────────────────
    // Appears only on images that are part of a repeatable group, since only
    // those can be removed. Top-left corner, red, clicked → confirms via
    // window.confirm → posts removeGroupItem to editor.
    const deleteButtons = new Map<HTMLElement, HTMLButtonElement>()

    function positionDeleteButton(btn: HTMLButtonElement, img: HTMLElement) {
      const rect = img.getBoundingClientRect()
      if (rect.width < 60 || rect.height < 60) {
        btn.style.display = 'none'
        return
      }
      const btnHeight = btn.offsetHeight || 30
      // Same fix as the Replace-photo button: hide when scrolled out of view
      // rather than clamping, or it pins to the top of the viewport.
      if (isOffscreenForOverlay(rect, btnHeight)) {
        btn.style.display = 'none'
        return
      }
      btn.style.display = ''
      // Top-left of image, with 8px inset. Replace photo sits top-right.
      const maxTop = Math.min(window.innerHeight - btnHeight - 8, rect.bottom - btnHeight - 8)
      const top  = Math.max(8, Math.min(rect.top + 8, maxTop))
      const left = Math.max(8, rect.left + 8)
      btn.style.top  = `${top}px`
      btn.style.left = `${left}px`
    }

    function ensureDeleteButton(el: HTMLElement) {
      if (!isImageField(el)) return
      if (deleteButtons.has(el)) return
      const ctx = getGroupContext(el)
      if (!ctx) return   // Not inside a repeatable group — can't delete
      const btn = document.createElement('button')
      btn.className = 'ngf-image-delete-btn'
      btn.type      = 'button'
      btn.setAttribute('aria-label', 'Remove photo')
      btn.setAttribute('title', 'Remove this photo')
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>'
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        e.preventDefault()
        if (!window.confirm('Remove this photo? You can recover it from version history if needed.')) return
        const post = (data: Record<string, unknown>) =>
          window.parent.postMessage(data, trustedOrigin ?? '*')
        post({ type: 'removeGroupItem', group: ctx.group, index: ctx.index })
      })
      document.body.appendChild(btn)
      deleteButtons.set(el, btn)
      requestAnimationFrame(() => positionDeleteButton(btn, el))
    }

    function injectAllDeleteButtons() {
      document.querySelectorAll<HTMLElement>('[data-ngf-field]').forEach(ensureDeleteButton)
    }

    function removeAllDeleteButtons() {
      deleteButtons.forEach(btn => btn.remove())
      deleteButtons.clear()
    }

    // ── Drag-to-reorder ───────────────────────────────────────────────────────
    // HTML5 Drag API. Each image in a repeatable group becomes draggable.
    // Drop on another image in the same group → moveGroupItem postMessage.
    // Visual feedback via .ngf-dragging (source) and .ngf-drag-target (hovered).
    // Touch devices: HTML5 drag doesn't work — falls back to using sidebar arrows.
    let dragSource: { el: HTMLElement; group: string; index: number } | null = null

    function onDragStart(e: DragEvent) {
      const el = e.target as HTMLElement
      const ctx = getGroupContext(el)
      if (!ctx) return
      dragSource = { el, group: ctx.group, index: ctx.index }
      el.classList.add('ngf-dragging')
      e.dataTransfer?.setData('text/plain', `${ctx.group}|${ctx.index}`)
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
    }

    function onDragOver(e: DragEvent) {
      if (!dragSource) return
      const el = e.target as HTMLElement
      const fieldEl = el.closest?.('[data-ngf-field]') as HTMLElement | null
      if (!fieldEl || fieldEl === dragSource.el) return
      const ctx = getGroupContext(fieldEl)
      if (!ctx || ctx.group !== dragSource.group) return
      e.preventDefault()    // signal "drop allowed here"
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
      // Highlight only this target — clear any prior highlights
      document.querySelectorAll('.ngf-drag-target').forEach(n => n.classList.remove('ngf-drag-target'))
      fieldEl.classList.add('ngf-drag-target')
    }

    function onDragLeave(e: DragEvent) {
      const fieldEl = (e.target as HTMLElement).closest?.('[data-ngf-field]') as HTMLElement | null
      if (fieldEl) fieldEl.classList.remove('ngf-drag-target')
    }

    function onDrop(e: DragEvent) {
      if (!dragSource) return
      e.preventDefault()
      const el = e.target as HTMLElement
      const fieldEl = el.closest?.('[data-ngf-field]') as HTMLElement | null
      if (!fieldEl || fieldEl === dragSource.el) {
        cleanupDrag()
        return
      }
      const targetCtx = getGroupContext(fieldEl)
      if (!targetCtx || targetCtx.group !== dragSource.group) {
        cleanupDrag()
        return
      }
      // Send the move request to the editor — editor updates content state,
      // bridge's existing moveGroupItem handler re-orders the DOM.
      window.parent.postMessage(
        { type: 'moveGroupItem', group: dragSource.group, from: dragSource.index, to: targetCtx.index },
        trustedOrigin ?? '*',
      )
      cleanupDrag()
    }

    function cleanupDrag() {
      dragSource?.el.classList.remove('ngf-dragging')
      document.querySelectorAll('.ngf-drag-target').forEach(n => n.classList.remove('ngf-drag-target'))
      dragSource = null
    }

    function enableDrag(el: HTMLElement) {
      if (!isImageField(el)) return
      const ctx = getGroupContext(el)
      if (!ctx) return    // Only images inside repeatable groups
      if (el.dataset.ngfDraggable === 'true') return    // Already wired
      el.setAttribute('draggable', 'true')
      el.dataset.ngfDraggable = 'true'
      el.addEventListener('dragstart', onDragStart)
      el.addEventListener('dragover',  onDragOver)
      el.addEventListener('dragleave', onDragLeave)
      el.addEventListener('drop',      onDrop)
      el.addEventListener('dragend',   cleanupDrag)
    }

    function enableAllDrag() {
      document.querySelectorAll<HTMLElement>('[data-ngf-field]').forEach(enableDrag)
    }

    function disableAllDrag() {
      document.querySelectorAll<HTMLElement>('[data-ngf-draggable="true"]').forEach(el => {
        el.removeAttribute('draggable')
        delete el.dataset.ngfDraggable
        el.removeEventListener('dragstart', onDragStart)
        el.removeEventListener('dragover',  onDragOver)
        el.removeEventListener('dragleave', onDragLeave)
        el.removeEventListener('drop',      onDrop)
        el.removeEventListener('dragend',   cleanupDrag)
        el.classList.remove('ngf-dragging', 'ngf-drag-target')
      })
    }

    function pruneOrphanButtons() {
      // Buttons whose image element is no longer in the DOM (e.g. removed
      // repeatable cards) get cleaned up here on the next animation frame.
      editButtons.forEach((btn, el) => {
        if (!document.contains(el)) {
          btn.remove()
          editButtons.delete(el)
        }
      })
      deleteButtons.forEach((btn, el) => {
        if (!document.contains(el)) {
          btn.remove()
          deleteButtons.delete(el)
        }
      })
    }

    let positionRAF: number | null = null
    function schedulePositionUpdate() {
      if (positionRAF !== null) return
      positionRAF = window.requestAnimationFrame(() => {
        pruneOrphanButtons()
        editButtons.forEach((btn, el) => positionEditButton(btn, el))
        deleteButtons.forEach((btn, el) => positionDeleteButton(btn, el))
        positionRAF = null
      })
    }
    window.addEventListener('scroll', schedulePositionUpdate, { passive: true, capture: true })
    window.addEventListener('resize', schedulePositionUpdate)

    // Track the trusted parent origin once the editor introduces itself.
    // Initially unknown (could be app.ngfsystems.com or a Vercel preview URL).
    let trustedOrigin: string | null = null

    // ngfReady goes to '*' because we don't yet know the parent's origin.
    // After the editor responds with setEditMode we lock in its origin.
    window.parent.postMessage({ type: 'ngfReady' }, '*')

    // Reject image src values that aren't safe — prevents javascript: URIs
    // or other non-HTTP schemes being injected via a rogue contentUpdate.
    function sanitizeImageUrl(url: string): string {
      if (url === '') return ''   // empty = restore default
      if (/^https?:\/\//i.test(url) || url.startsWith('/') || /^data:image\//i.test(url)) {
        return url
      }
      return ''   // silently drop anything else (javascript:, blob: from untrusted, etc.)
    }

    const messageHandler = (e: MessageEvent) => {
      // ── Origin guard ────────────────────────────────────────────────────────
      // Accept messages only from the NGF portal (production or Vercel previews).
      const isNgfOrigin =
        e.origin === 'https://app.ngfsystems.com' ||
        /^https:\/\/[^.]+\.vercel\.app$/.test(e.origin) ||
        /^http:\/\/localhost(:\d+)?$/.test(e.origin)
      if (!isNgfOrigin) return

      // Lock in the trusted origin from the first valid message so outbound
      // postMessages are targeted instead of broadcast to '*'.
      if (!trustedOrigin) trustedOrigin = e.origin

      if (e.data?.type === 'setEditMode') {
        editMode = !!e.data.enabled
        document.documentElement.setAttribute('data-ngf-edit', editMode ? 'true' : 'false')
        // Re-run in case fields were hydrated after initial capture
        captureDefaults()
        // Toggle sections: entering edit mode reveals any the live site hides
        // (so the client can switch them back on); leaving restores the live
        // visibility from the remembered state. The authoritative state arrives
        // moments later via contentUpdate.
        document.querySelectorAll<HTMLElement>('[data-ngf-type="toggle"]').forEach(el => {
          if (editMode) {
            if (el.style.display === 'none' && el.dataset.ngfHidden === undefined) el.dataset.ngfHidden = 'true'
            el.style.removeProperty('display')
          } else {
            el.style.display = el.dataset.ngfHidden === 'true' ? 'none' : ''
          }
        })
        if (editMode) {
          // Add visible "Replace photo" overlay buttons on every image field,
          // delete-X buttons on every image inside a repeatable group, and
          // enable drag-to-reorder for those same images.
          injectAllImageButtons()
          injectAllDeleteButtons()
          enableAllDrag()
        } else {
          removeAllImageButtons()
          removeAllDeleteButtons()
          disableAllDrag()
          dismissNavPopup()
        }
      }

      if (e.data?.type === 'contentUpdate' && e.data.content) {
        const walk = (obj: unknown, path: string) => {
          if (obj === null || obj === undefined) return
          if (typeof obj === 'boolean') {
            // A boolean only carries meaning for a toggle (show/hide) field.
            document.querySelectorAll<HTMLElement>(`[data-ngf-field="${path}"]`).forEach(el => {
              if (isToggleField(el)) applyToggleState(el, obj ? '' : 'false')
            })
            return
          }
          if (typeof obj === 'string') {
            // querySelectorAll, not querySelector — when the same field path
            // is annotated in multiple places (e.g. business name in header
            // AND footer), all instances update together. The schema scraper
            // dedupes by path so the sidebar still shows one entry.
            document.querySelectorAll<HTMLElement>(`[data-ngf-field="${path}"]`).forEach(el => {
              if (isToggleField(el)) {
                applyToggleState(el, obj)
                return
              }
              if (isGalleryField(el)) {
                applyGalleryState(el, obj)
                return
              }
              const next = obj === '' ? (el.dataset.ngfDefault ?? '') : obj
              if (isImageField(el)) {
                el.setAttribute('src', sanitizeImageUrl(next))
              } else {
                el.textContent = next
              }
            })
            return
          }
          if (Array.isArray(obj)) {
            obj.forEach((item, i) => walk(item, `${path}.${i}`))
            return
          }
          if (typeof obj === 'object') {
            for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
              walk(v, path ? `${path}.${k}` : k)
            }
          }
        }
        walk(e.data.content, '')
        // Image src may have changed — update overlay button positions
        if (editMode) schedulePositionUpdate()
      }

      // Editor asks us to scroll the iframe to a specific field + flash it
      if (e.data?.type === 'scrollToField' && typeof e.data.path === 'string') {
        const el = document.querySelector<HTMLElement>(`[data-ngf-field="${e.data.path}"]`)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          el.classList.remove('ngf-field-focus')
          // Restart animation
          void el.offsetWidth
          el.classList.add('ngf-field-focus')
          setTimeout(() => el.classList.remove('ngf-field-focus'), 1700)
        }
      }

      // Editor asks us to append a new card to a repeatable group. We clone
      // the existing last child (the template), re-index every data-ngf-field
      // descendant to the new index, clear textContent so placeholders show,
      // and append. After the user fills and publishes, SSR re-renders the
      // card naturally on next reload.
      if (e.data?.type === 'addGroupItem' && typeof e.data.group === 'string' && typeof e.data.newIndex === 'number') {
        const group = document.querySelector<HTMLElement>(`[data-ngf-group="${e.data.group}"]`)
        if (!group) return
        const children = Array.from(group.children) as HTMLElement[]
        const template = children[children.length - 1]
        if (!template) return

        const clone = template.cloneNode(true) as HTMLElement
        const prefix = `${e.data.group}.`
        // Re-index every [data-ngf-field] inside the clone to newIndex.
        // For text fields: blank textContent so :empty::before placeholder shows.
        // For image fields: keep a neutral grey placeholder data-URI so the user
        // sees "something to click" until they edit the image field.
        const imgPlaceholder =
          'data:image/svg+xml;utf8,' + encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">' +
            '<rect width="400" height="300" fill="#e2e8f0"/>' +
            '<text x="200" y="155" text-anchor="middle" font-family="sans-serif" ' +
            'font-size="16" fill="#94a3b8">Click to set image</text></svg>'
          )
        clone.querySelectorAll<HTMLElement>('[data-ngf-field]').forEach(child => {
          const path = child.getAttribute('data-ngf-field') || ''
          if (path.startsWith(prefix)) {
            const rest = path.slice(prefix.length)       // e.g. "3.name"
            const dot  = rest.indexOf('.')
            if (dot > -1) {
              const subField = rest.slice(dot + 1)       // "name"
              const newPath  = `${prefix}${e.data.newIndex}.${subField}`
              child.setAttribute('data-ngf-field', newPath)
              // Reset default cache and current value for the new slot.
              if (isImageField(child)) {
                child.dataset.ngfDefault = imgPlaceholder
                child.setAttribute('src', imgPlaceholder)
              } else {
                child.dataset.ngfDefault = ''
                child.textContent = ''
              }
            }
          }
        })
        group.appendChild(clone)
        clone.scrollIntoView({ behavior: 'smooth', block: 'center' })
        // Wire up the new card's image fields: edit button + delete button + drag
        if (editMode) {
          injectAllImageButtons()
          injectAllDeleteButtons()
          enableAllDrag()
        }
      }

      // Editor asks us to reorder two cards within a group. Swap the DOM
      // positions of the items and rewrite every descendant data-ngf-field
      // index on both cards (and everything between them) so they stay in
      // sync with the editor's content array order.
      if (e.data?.type === 'moveGroupItem' && typeof e.data.group === 'string' && typeof e.data.from === 'number' && typeof e.data.to === 'number') {
        const group = document.querySelector<HTMLElement>(`[data-ngf-group="${e.data.group}"]`)
        if (!group) return
        const prefix = `${e.data.group}.`
        const children = Array.from(group.children) as HTMLElement[]
        const from = e.data.from
        const to   = e.data.to
        if (from < 0 || from >= children.length || to < 0 || to >= children.length) return

        // Reorder the DOM
        const moved = children[from]
        if (to > from) {
          // insert after children[to]
          group.insertBefore(moved, children[to].nextSibling)
        } else {
          // insert before children[to]
          group.insertBefore(moved, children[to])
        }

        // Re-index every card's data-ngf-field to match its new position.
        const reordered = Array.from(group.children) as HTMLElement[]
        reordered.forEach((card, newIdx) => {
          card.querySelectorAll<HTMLElement>('[data-ngf-field]').forEach(child => {
            const path = child.getAttribute('data-ngf-field') || ''
            if (path.startsWith(prefix)) {
              const rest = path.slice(prefix.length)
              const dot  = rest.indexOf('.')
              if (dot > -1) {
                const subField = rest.slice(dot + 1)
                child.setAttribute('data-ngf-field', `${prefix}${newIdx}.${subField}`)
              }
            }
          })
        })
        if (editMode) schedulePositionUpdate()
      }

      // Editor asks us to remove a card and re-index subsequent siblings.
      if (e.data?.type === 'removeGroupItem' && typeof e.data.group === 'string' && typeof e.data.index === 'number') {
        const group = document.querySelector<HTMLElement>(`[data-ngf-group="${e.data.group}"]`)
        if (!group) return
        const prefix = `${e.data.group}.`
        const removeIdx = e.data.index
        const children = Array.from(group.children) as HTMLElement[]

        // Find and remove the child whose descendants are indexed at removeIdx
        const target = children.find(child =>
          child.querySelector(`[data-ngf-field^="${prefix}${removeIdx}."]`)
        )
        if (target) target.remove()

        // Shift indices for all remaining children whose index > removeIdx
        const remaining = Array.from(group.children) as HTMLElement[]
        remaining.forEach(card => {
          card.querySelectorAll<HTMLElement>('[data-ngf-field]').forEach(child => {
            const path = child.getAttribute('data-ngf-field') || ''
            if (path.startsWith(prefix)) {
              const rest = path.slice(prefix.length)
              const dot  = rest.indexOf('.')
              if (dot > -1) {
                const idxStr = rest.slice(0, dot)
                const idx    = parseInt(idxStr, 10)
                if (!isNaN(idx) && idx > removeIdx) {
                  const subField = rest.slice(dot + 1)
                  const newPath  = `${prefix}${idx - 1}.${subField}`
                  child.setAttribute('data-ngf-field', newPath)
                }
              }
            }
          })
        })
        // Clean up orphan overlay buttons (image elements no longer in DOM)
        if (editMode) schedulePositionUpdate()
      }
    }

    // ── Click handler ─────────────────────────────────────────────────────────
    const clickHandler = (e: MouseEvent) => {
      if (!editMode) return
      // Let our own overlay buttons handle their own clicks. Without this,
      // the capture-phase stopImmediatePropagation below would prevent the
      // overlay button's click listener from firing at all.
      const target = e.target as HTMLElement | null
      if (target?.closest?.('.ngf-image-edit-btn')) return
      if (target?.closest?.('.ngf-image-delete-btn')) return
      if (navPopup && navPopup.contains(e.target as Node)) return
      if (navPopup) dismissNavPopup()

      // Single upward walk finds the nearest anchor AND nearest field.
      let cursor: HTMLElement | null = e.target as HTMLElement | null
      let anchor: HTMLAnchorElement | null = null
      let fieldEl: HTMLElement | null = null
      let buttonEl: HTMLButtonElement | null = null
      let toggleEl: HTMLElement | null = null
      while (cursor && cursor !== document.documentElement) {
        const tag = cursor.tagName?.toLowerCase()
        if (!anchor   && tag === 'a')                                anchor   = cursor as HTMLAnchorElement
        if (!buttonEl && tag === 'button')                           buttonEl = cursor as HTMLButtonElement
        if (!fieldEl  && cursor.getAttribute?.('data-ngf-field'))    fieldEl  = cursor
        // A dropdown/disclosure toggle — has aria-haspopup or aria-expanded.
        if (!toggleEl && cursor.hasAttribute?.('aria-haspopup'))     toggleEl = cursor
        if (!toggleEl && cursor.hasAttribute?.('aria-expanded'))     toggleEl = cursor
        cursor = cursor.parentElement
      }

      // If the click is on a dropdown toggle AND the toggle itself is NOT the
      // editable field, let the site's own React/JS handle it (open/close the
      // menu). The user can click items inside the open menu to edit them.
      // This keeps dropdowns expandable, not always-expanded.
      if (toggleEl && toggleEl !== fieldEl) {
        // Don't preventDefault — let the site's onClick fire.
        return
      }

      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()

      // Build an EditTarget from the field element, if any
      let editTarget: EditTarget | undefined
      if (fieldEl) {
        const attr = fieldEl.getAttribute('data-ngf-field') ?? ''
        const dot = attr.indexOf('.')
        if (dot > -1) {
          const isImg = isImageField(fieldEl)
          const isToggle = isToggleField(fieldEl)
          const ngfType = fieldEl.getAttribute('data-ngf-type') || (isImg ? 'image' : 'text')
          editTarget = {
            section:   attr.substring(0, dot),
            field:     attr.substring(dot + 1),
            value:     isImg
              ? (fieldEl.getAttribute('src') ?? '')
              : isToggle
              ? (fieldEl.dataset.ngfHidden === 'true' ? 'false' : '')
              : (fieldEl.textContent?.trim() ?? ''),
            fieldType: ngfType,
            rect:      fieldEl.getBoundingClientRect(),
          }
        }
      }

      // Precedence:
      //   1. Anchor (internal hash) → scroll, no popup (even if editable — feels disorienting)
      //   2. Anchor (real href) → popup with Go to page + Edit (if editable)
      //   3. Editable field outside any link → fire fieldClick directly
      //   4. Button (no link, no field) → silently block (e.g. mobile menu toggle)

      if (anchor) {
        const href = anchor.getAttribute('href') ?? ''
        if (href.startsWith('#')) {
          const id = href.slice(1)
          document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
          return
        }
        if (href && href !== '#') {
          const isExternal = /^https?:\/\//.test(anchor.href) && !anchor.href.startsWith(window.location.origin)
          if (isExternal) {
            // External links never navigate the editor iframe — if the link
            // wraps an editable field (e.g. a nav label), open the edit
            // popover directly; otherwise block silently.
            if (editTarget) postFieldClick(editTarget)
            return
          }
          const label = anchor.textContent?.trim() || anchor.getAttribute('aria-label') || 'Link'
          showNavPopup(anchor.href, label, e.clientX, e.clientY, editTarget)
          return
        }
        // Anchor with no href — treat as plain editable (if any)
      }

      if (editTarget) {
        postFieldClick(editTarget)
        return
      }

      // Button click with nothing editable — just block
      if (buttonEl) return
    }

    window.addEventListener('message', messageHandler)
    document.addEventListener('click', clickHandler, true)

    return () => {
      window.removeEventListener('message', messageHandler)
      document.removeEventListener('click', clickHandler, true)
      window.removeEventListener('scroll', schedulePositionUpdate, true)
      window.removeEventListener('resize', schedulePositionUpdate)
      if (positionRAF !== null) window.cancelAnimationFrame(positionRAF)
      removeAllImageButtons()
      removeAllDeleteButtons()
      disableAllDrag()
      document.getElementById('ngf-edit-styles')?.remove()
      document.documentElement.removeAttribute('data-ngf-edit')
      dismissNavPopup()
    }
  }, [])

  return null
}

