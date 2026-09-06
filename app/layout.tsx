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
        {/* Navigation Bar ธีมสีน้ำเงิน-ชมพู โรงเรียนอุตรดิตถ์ */}
        <header className="bg-[#00247D] text-white border-b-2 border-[#DE5C8E] sticky top-0 z-50 shadow-lg">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            {/* เปลี่ยนข้อความเป็นภาษาไทย และปรับขนาด text ให้ตอบสนองกับหน้าจอมือถือ (responsive) */}
            <Link href="/" className="flex items-center gap-2 font-bold text-base md:text-lg hover:text-pink-300 transition">
              <span>🏫</span> ระบบบริหารจัดการทรัพยากรโรงเรียน
            </Link>
            <nav className="flex items-center gap-2 md:gap-3 text-xs md:text-sm">
              <Link href="/" className="px-3 py-1.5 rounded-lg hover:bg-blue-900/80 text-gray-200 hover:text-white transition">
                🏠 หน้าแรก
              </Link>
              <Link href="/borrow" className="px-3 py-1.5 rounded-lg hover:bg-blue-900/80 text-gray-200 hover:text-white transition">
                📦 ยืมอุปกรณ์
              </Link>
              <Link href="/booking" className="px-3 py-1.5 rounded-lg hover:bg-blue-900/80 text-gray-200 hover:text-white transition">
                🏫 จองห้อง
              </Link>
              <Link href="/maintenance" className="px-3 py-1.5 rounded-lg hover:bg-blue-900/80 text-gray-200 hover:text-white transition">
                🛠️ แจ้งซ่อม
              </Link>
              <Link href="/admin" className="px-3 py-1.5 rounded-lg bg-[#DE5C8E] hover:bg-[#c44b77] text-white transition font-medium shadow-md shadow-pink-900/30">
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