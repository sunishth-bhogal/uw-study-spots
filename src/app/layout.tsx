import type { Metadata } from 'next'
import Image from 'next/image'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import 'leaflet/dist/leaflet.css'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'
import { ThemeToggle } from '@/components/ThemeToggle'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'UW Study Spots',
  description:
    'Real-time occupancy for every study spot on UW campus. See how packed DC Library, Tatham, and more are right now.',
  icons: {
    icon: '/lightmode.png',
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
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen bg-zinc-950 text-zinc-100`}>
        <ThemeProvider>
          <nav className="sticky top-0 z-50 border-b border-zinc-800 bg-white/80 backdrop-blur-md dark:bg-zinc-950/80">
            <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-4">
              <a href="/" className="flex shrink-0 items-center gap-2">
                <div className="relative h-16 w-16 overflow-hidden">
                  <Image
                    src="/lightmode.png"
                    alt="UW Study Spots logo"
                    fill
                    className="object-contain scale-[1.9] dark:hidden"
                    priority
                  />
                  <Image
                    src="/darkmode.png"
                    alt="UW Study Spots logo"
                    fill
                    className="hidden object-contain scale-[1.9] dark:block"
                    priority
                  />
                </div>

                <span className="text-2xl font-bold leading-none text-zinc-900 dark:text-zinc-100">
                  UW <span className="text-gold-500">Study Spots</span>
                </span>
              </a>

              <div className="flex items-center gap-3">
                <span className="hidden text-xs text-zinc-500 sm:inline">
                  Updated every 10 min
                </span>
                <ThemeToggle />
              </div>
            </div>
          </nav>

          <main className="mx-auto max-w-6xl px-4 py-8">
            {children}
          </main>

          <footer className="mt-12 border-t border-zinc-800 py-6 text-center text-xs text-zinc-600">
            Built by Sunishth Bhogal · Data from Waitz and UW student reports · Not affiliated with UWaterloo
          </footer>

          <Analytics />
          <SpeedInsights />
        </ThemeProvider>
      </body>
    </html>
  )
}