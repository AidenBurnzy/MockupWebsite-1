'use client'

import { useState, type FormEvent } from 'react'

/**
 * The canonical NGF lead form.
 *
 * WHY THIS EXISTS: the starter shipped no form at all, so every client site
 * hand-rolled its own — which is exactly why every one of them behaved
 * differently, and why some were losing leads outright (email-only routes with
 * no persistence, or a route that swallowed its database error and still
 * returned a success page).
 *
 * This posts to the central NGF lead store, which PERSISTS FIRST and only then
 * emails. That ordering is the whole point: a failed notification must never
 * lose the submission, and a failed SAVE must never show the customer a
 * thank-you. See the "Lead capture: persist first" standard.
 *
 * Drop-in usage (server component supplies the endpoints):
 *
 *   import { ngfEndpoints } from '@/lib/ngf'
 *   const { base, domain } = ngfEndpoints()
 *   <LeadForm base={base} domain={domain} formType="contact" fields={[...]} />
 */

export interface LeadField {
  name: string
  label: string
  type?: 'text' | 'email' | 'tel' | 'textarea' | 'select'
  required?: boolean
  placeholder?: string
  options?: string[]
  /** Full width in the 2-column grid. Textareas are always full width. */
  full?: boolean
}

export interface LeadFormProps {
  base: string
  domain: string
  /** Categorises the submission in the portal inbox, e.g. 'contact' | 'quote'. */
  formType?: string
  /** Omit to get the standard name / email / phone / message set. */
  fields?: LeadField[]
  /** Extra context captured server-side, e.g. { property: 'Lakeshore Retreat' }. */
  hidden?: Record<string, string>
  submitLabel?: string
  successTitle?: string
  successBody?: string
  className?: string
}

const DEFAULT_FIELDS: LeadField[] = [
  { name: 'name', label: 'Name', required: true },
  { name: 'email', label: 'Email', type: 'email', required: true },
  { name: 'phone', label: 'Phone', type: 'tel' },
  { name: 'message', label: 'How can we help?', type: 'textarea', required: true, full: true },
]

export default function LeadForm({
  base,
  domain,
  formType = 'contact',
  fields = DEFAULT_FIELDS,
  hidden,
  submitLabel = 'Send message',
  successTitle = 'Thanks — we got it.',
  successBody = "We'll be in touch shortly.",
  className = '',
}: LeadFormProps) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [gotcha, setGotcha] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const set = (name: string, v: string) => setValues((p) => ({ ...p, [name]: v }))

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return

    const missing = fields.filter((f) => f.required && !(values[f.name] || '').trim())
    if (missing.length) {
      setError(`Please fill in: ${missing.map((f) => f.label).join(', ')}`)
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`${base}/api/public/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain,
          formType,
          payload: { ...hidden, ...values, _gotcha: gotcha },
        }),
      })

      // Only a 2xx counts as captured. Anything else means the submission is
      // NOT safely stored, so the customer must see a retry — never a
      // thank-you. This is the failure mode that lost real leads before.
      let ok = res.ok
      try {
        const json = await res.json()
        if (json && json.ok === false) ok = false
        if (!ok && typeof json?.error === 'string') setError(json.error)
      } catch {
        /* non-JSON body — fall back to the status code */
      }

      if (!ok) {
        setError((prev) => prev ?? 'Something went wrong sending your message. Please try again.')
        return
      }
      setDone(true)
    } catch {
      setError('Could not reach us just now. Please try again, or call instead.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className={`rounded-2xl border border-green-200 bg-green-50 p-8 text-center ${className}`} role="status">
        <h3 className="text-xl font-semibold text-green-800">{successTitle}</h3>
        <p className="mt-2 text-green-700">{successBody}</p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className={`grid gap-4 sm:grid-cols-2 ${className}`} noValidate>
      {fields.map((f) => {
        const id = `lead-${f.name}`
        const isFull = f.full || f.type === 'textarea'
        return (
          <div key={f.name} className={isFull ? 'sm:col-span-2' : ''}>
            <label htmlFor={id} className="mb-1 block text-sm font-medium">
              {f.label}
              {f.required && <span aria-hidden="true" className="ml-0.5 text-red-500">*</span>}
            </label>

            {f.type === 'textarea' ? (
              <textarea
                id={id}
                name={f.name}
                rows={5}
                required={f.required}
                placeholder={f.placeholder}
                value={values[f.name] ?? ''}
                onChange={(e) => set(f.name, e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            ) : f.type === 'select' ? (
              <select
                id={id}
                name={f.name}
                required={f.required}
                value={values[f.name] ?? ''}
                onChange={(e) => set(f.name, e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                <option value="">Please choose…</option>
                {(f.options ?? []).map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            ) : (
              <input
                id={id}
                name={f.name}
                type={f.type ?? 'text'}
                required={f.required}
                placeholder={f.placeholder}
                autoComplete={
                  f.type === 'email' ? 'email' : f.type === 'tel' ? 'tel' : f.name === 'name' ? 'name' : undefined
                }
                value={values[f.name] ?? ''}
                onChange={(e) => set(f.name, e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            )}
          </div>
        )
      })}

      {/*
        Honeypot. Must stay EMPTY — bots fill it, humans never see it. The name
        is deliberately non-semantic: a field called `url`/`company`/`website`
        would be filled by real people and silently drop genuine leads. Hidden
        off-screen rather than display:none so naive bots still see it.
      */}
      <input
        type="text"
        name="_gotcha"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={gotcha}
        onChange={(e) => setGotcha(e.target.value)}
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
      />

      {error && (
        <p role="alert" className="text-sm text-red-600 sm:col-span-2">{error}</p>
      )}

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-gray-900 px-6 py-3 font-semibold text-white transition hover:bg-gray-800 disabled:opacity-50 sm:w-auto"
        >
          {submitting ? 'Sending…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
