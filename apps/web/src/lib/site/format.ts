/** 0.53876 -> '53.9%'. */
export function pct(fraction: number, digits = 1): string {
  return `${(fraction * 100).toFixed(digits)}%`
}

/** 'blade-of-the-ruined-king' style ids are already URL-safe; this keeps links in one place. */
export const championHref = (id: string): string => `/champions/${id}/`
export const itemHref = (id: string): string => `/items/${id}/`
/** Calculator link with build A set to these items and runes. */
export const calculatorHref = (championId: string, items: string[], runes: string[]): string =>
  `/calculator/?${new URLSearchParams({ champ: championId, a: JSON.stringify({ items, runes, inputs: {} }) })}`
export const patchHref = (id: string): string => `/patches/${id}/`

/** Hotlinked from Tencent's CDN (wrchina.gg), keyed by their numeric hero id. No auth or referer needed. */
export const championIconUrl = (heroId: string): string =>
  `https://wrchina.gg/cdn/images/lgamem/act/lrlib/img/HeadIcon/H_S_${heroId}.png?v=4`

/** The words before a notes line's old value: 'Health per level : 128 → 136' -> 'Health per level:'. */
export function changeLabel(text: string, before: string): string {
  const at = text.indexOf(before)
  const label = (at > 0 ? text.slice(0, at) : text.split(':')[0]).replace(/[\s:]+$/, '')
  return `${label}:`
}
