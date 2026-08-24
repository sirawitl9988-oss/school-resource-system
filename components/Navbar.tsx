'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Navbar() {
  const pathname = usePathname()

  const navItems = [
    { name: '📦 ยืมอุปกรณ์', path: '/' },
    { name: '🏫 จองห้อง', path: '/booking' },
    { name: '🛠️ แจ้งซ่อม', path: '/maintenance' },
    { name: '⚙️ Admin', path: '/admin' },
  ]

  return (
    <nav className="bg-slate-900 text-white shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between">
        {/* โลโก้และชื่อระบบ */}
        <div className="flex items-center space-x-2 font-bold shrink-0">
          <span className="text-2xl">🏫</span>
          <span className="hidden sm:inline text-lg">School Resource System</span>
        </div>

        {/* แถบเมนู navigation */}
        <div className="flex space-x-1 sm:space-x-2 overflow-x-auto py-1">
          {navItems.map((item) => {
            const isActive = pathname === item.path
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {item.name}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}