import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Final 14 Builder',
  description: 'V2 multijoueur temps réel pour sélectionner 14 titres parmi 50.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
