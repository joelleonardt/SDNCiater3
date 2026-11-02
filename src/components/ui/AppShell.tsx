import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/uiStore'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { ToastProvider } from './Toast'

interface AppShellProps {
  children: React.ReactNode
}

/**
 * Layout wrapper untuk semua halaman terautentikasi.
 *
 * Desktop (≥1024px):
 *   - Sidebar di kiri, bisa di-collapse via uiStore
 *   - Topbar di atas area konten utama
 *
 * Mobile (<1024px):
 *   - Sidebar tersembunyi by default
 *   - Hamburger button di Topbar membuka/menutup sidebar sebagai drawer overlay
 *   - Tap di luar drawer menutup drawer (Requirements: 3.2)
 *
 * Requirements: 3.1, 3.2, 3.3
 */
export default function AppShell({ children }: AppShellProps) {
  // sidebarCollapsed is used by Sidebar internally via uiStore; AppShell subscribes
  // so it re-renders when sidebar toggles, keeping the layout in sync.
  useUIStore((s) => s.sidebarCollapsed)
  // Mobile drawer state (terpisah dari sidebarCollapsed yang mengontrol desktop)
  const [mobileOpen, setMobileOpen] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)
  const location = useLocation()

  // Tutup drawer saat navigasi (Requirements: 3.2)
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  // Tutup drawer saat klik di luar (Requirements: 3.2)
  useEffect(() => {
    if (!mobileOpen) return

    function handleOutsideClick(e: MouseEvent) {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setMobileOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [mobileOpen])

  // Tutup drawer saat Escape
  useEffect(() => {
    if (!mobileOpen) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [mobileOpen])

  return (
    // min-w-0 ensures the shell itself never forces viewport narrower than 320px
    // max-w-screen-2xl + mx-auto centers content on very wide screens (≥1536px / ~1920px)
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* ── Desktop sidebar (lg+) ── */}
      <div className="hidden lg:flex lg:shrink-0">
        <Sidebar />
      </div>

      {/* ── Mobile drawer overlay (backdrop) ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          aria-hidden="true"
        />
      )}

      {/* ── Mobile sidebar drawer ── */}
      <div
        ref={drawerRef}
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex lg:hidden',
          'transform transition-transform duration-300 ease-in-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Menu navigasi"
      >
        <Sidebar />
      </div>

      {/* ── Main area: topbar + content ── */}
      {/* min-w-0 prevents flex children from overflowing on narrow viewports (320px) */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar
          onMobileMenuToggle={() => setMobileOpen((prev) => !prev)}
        />

        {/* Page content
            - p-4 on mobile (fits 320px+), p-6 on lg+
            - w-full ensures content fills available space
            - max-w-[1920px] and mx-auto keep content centered on ultra-wide displays
            Requirements: 15.5
        */}
        <main
          id="main-content"
          className="mx-auto w-full max-w-[1920px] flex-1 overflow-y-auto p-4 lg:p-6"
          role="main"
        >
          {children}
        </main>
      </div>

      {/* Toast provider — portal ke document.body, posisi top-right (Requirements 14.1, 14.9) */}
      <ToastProvider />
    </div>
  )
}
