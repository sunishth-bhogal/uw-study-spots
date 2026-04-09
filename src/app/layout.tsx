import type { Metadata } from 'next'
import Image from 'next/image'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import 'leaflet/dist/leaflet.css'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'UW Study Spots',
  description:
    'Real-time occupancy for every study spot on UW campus. See how packed DC Library, Tatham, and more are right now.',
  icons: {
    icon: '/uwaterloo-logo.png',
  },
  openGraph: {
    title: 'UW Study Spots',
    description: 'Real-time occupancy for every study spot on UW campus.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-zinc-950 text-zinc-100 min-h-screen`}>
        <nav className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
            <a href="/" className="flex items-center gap-3 shrink-0">
              <div className="relative h-9 w-9">
                <Image
                  src="/uwaterloo-logo.png"
                  alt="University of Waterloo logo"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
              <span className="font-bold text-zinc-100 text-xl leading-none">
                UW <span className="text-gold-500">Study Spots</span>
              </span>
            </a>

            <span className="text-xs text-zinc-500">Updated every 10 min</span>
          </div>
        </nav>

        <main className="max-w-6xl mx-auto px-4 py-8">
          {children}
        </main>

        <footer className="border-t border-zinc-800 mt-12 py-6 text-center text-xs text-zinc-600">
          Built by Sunishth Bhogal · Data from Waitz and UW student reports · Not affiliated with UWaterloo
        </footer>

        <Analytics />
      </body>
    </html>
  )
}