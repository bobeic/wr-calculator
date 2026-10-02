/** 0.53876 -> '53.9%'. */
export function pct(fraction: number, digits = 1): string {
  return `${(fraction * 100).toFixed(digits)}%`
}

/** 'blade-of-the-ruined-king' style ids are already URL-safe; this keeps links in one place. */
export const championHref = (id: string): string => `/champions/${id}/`
export const itemHref = (id: string): string => `/items/${id}/`
export const patchHref = (id: string): string => `/patches/${id}/`

/** The words before a notes line's old value: 'Health per level : 128 → 136' -> 'Health per level:'. */
export function changeLabel(text: string, before: string): string {
  const at = text.indexOf(before)
  const label = (at > 0 ? text.slice(0, at) : text.split(':')[0]).replace(/[\s:]+$/, '')
  return `${label}:`
}
