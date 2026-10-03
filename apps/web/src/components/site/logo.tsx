/**
 * The mark: three item slots climbing a step each, the last one filled: a build path that goes up. Drawn on a 32 grid
 * so it stays crisp at 24px; app/icon.svg is the same shape on the ground colour.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="2" y="21" width="9" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <rect x="11.5" y="11.5" width="9" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <rect x="21" y="1" width="10" height="10" rx="2" fill="currentColor" />
    </svg>
  )
}
