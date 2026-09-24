import type { ReactNode } from 'react'

export const metadata = { title: 'wr-calc debug' }

/** Minimal root layout: no styling, the debug page is intentionally bare. */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
