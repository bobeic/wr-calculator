import type { Lane } from '@wr-calc/data'

/** Small line icons, one stroke weight (1.6 on a 24 grid), drawn for this site. */
const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

export function ArrowIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" {...stroke} /></svg>
}

// Lanes as a map: Baron top-left, Dragon bottom-right, Mid the diagonal, Jungle the river bend, Support a shield.
const LANE_PATHS: Record<Lane, string> = {
  top: 'M4 20V4h16M8 20V8h12',
  jungle: 'M12 3c-3 4-6 6-6 10a6 6 0 0 0 12 0c0-4-3-6-6-10zM12 21v-8',
  mid: 'M4 4h5l11 11v5h-5L4 9zM8 16l-4 4',
  adc: 'M20 4v16H4M16 4v12H4',
  support: 'M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z',
}

export function LaneIcon({ lane }: { lane: Lane }) {
  return <svg className="lane-icon" viewBox="0 0 24 24" aria-hidden="true"><path d={LANE_PATHS[lane]} {...stroke} /></svg>
}
