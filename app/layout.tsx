import './globals.css'
import Link from 'next/link'

export const metadata = {
  title: 'School Resource Management System',
  description: 'ระบบยืมอุปกรณ์ จองห้องประชุม และแจ้งซ่อม โรงเรียนอุตรดิตถ์',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="th">
      <body className="bg-gray-50 min-h-screen text-gray-800">
        {/* Navigation Bar ส่วนกลางสำหรับทุกหน้า */}
        <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 font-bold text-lg hover:text-blue-400 transition">
              <span>🏫</span> School Resource System
            </Link>
            <nav className="flex items-center gap-2 md:gap-3 text-xs md:text-sm">
              <Link href="/" className="px-3 py-1.5 rounded-lg hover:bg-slate-800 text-gray-300 hover:text-white transition">
                🏠 หน้าแรก
              </Link>
              <Link href="/borrow" className="px-3 py-1.5 rounded-lg hover:bg-slate-800 text-gray-300 hover:text-white transition">
                📦 ยืมอุปกรณ์
              </Link>
              <Link href="/booking" className="px-3 py-1.5 rounded-lg hover:bg-slate-800 text-gray-300 hover:text-white transition">
                🏫 จองห้อง
              </Link>
              <Link href="/maintenance" className="px-3 py-1.5 rounded-lg hover:bg-slate-800 text-gray-300 hover:text-white transition">
                🛠️ แจ้งซ่อม
              </Link>
              <Link href="/admin" className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-gray-200 hover:text-white transition font-medium">
                ⚙️ Admin
              </Link>
            </nav>
          </div>
        </header>

        {/* เนื้อหาของแต่ละหน้า */}
        {children}
      </body>
    </html>
  )
}