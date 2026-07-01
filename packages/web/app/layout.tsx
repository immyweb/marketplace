import './globals.css'
import type { Metadata } from 'next'
import { Nav } from '@/components/nav'

export const metadata: Metadata = {
  title: { default: 'Marketplace', template: '%s | Marketplace' },
  description: 'Quality clothing and accessories.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main id="main-content">{children}</main>
      </body>
    </html>
  )
}
