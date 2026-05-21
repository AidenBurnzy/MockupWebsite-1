export type NgfSiteContent = Record<string, string>

function getDomain() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    'localhost:3000'
  )
}

export async function getNgfContent(): Promise<NgfSiteContent> {
  try {
    const domain = getDomain()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '')
    const url = `${process.env.NGF_APP_URL || 'https://app.ngfsystems.com'}/api/public/content?domain=${encodeURIComponent(domain)}`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return {}
    const data = (await res.json()) as { content?: NgfSiteContent }
    return data.content ?? {}
  } catch {
    return {}
  }
}

/**
 * Extract a dynamic array from flat dot-notation keys.
 * getItems(content, 'bestSellers.items') returns
 * [{ name: '...', price: '...' }, ...] from keys like
 * 'bestSellers.items.0.name', 'bestSellers.items.1.price', etc.
 */
export function getItems(
  content: NgfSiteContent,
  prefix: string,
): Record<string, string>[] {
  const prefixDot = prefix + '.'
  const keys = Object.keys(content).filter((k) => k.startsWith(prefixDot))
  if (keys.length === 0) return []
  const indices = new Set<number>()
  for (const key of keys) {
    const rest = key.slice(prefixDot.length)
    const idx = parseInt(rest.split('.')[0])
    if (!isNaN(idx)) indices.add(idx)
  }
  return Array.from(indices)
    .sort((a, b) => a - b)
    .map((i) => {
      const item: Record<string, string> = {}
      for (const key of keys) {
        const rest = key.slice(prefixDot.length)
        const [idxStr, ...subParts] = rest.split('.')
        if (parseInt(idxStr) === i && subParts.length > 0) {
          item[subParts.join('.')] = content[key]
        }
      }
      return item
    })
}
