'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import CalendarView from '@/components/CalendarView'

export default function Home() {
  const [borrowEvents, setBorrowEvents] = useState<any[]>([])
  const [bookingEvents, setBookingEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<'all' | 'borrow' | 'booking'>('all')
  const [selectedDate, setSelectedDate] = useState<string>('')

  const fetchCalendarData = async () => {
    setLoading(true)
    try {
      const { data: borrowData } = await supabase
        .from('borrow_requests')
        .select('*')
        .eq('status', 'APPROVED')

      const { data: resourceData } = await supabase.from('resources').select('*')

      const formattedBorrows = (borrowData || []).map((item) => {
        const res = (resourceData || []).find((r) => r.id === Number(item.resource_id))
        return {
          id: `borrow-${item.id}`,
          title: `📦 ยืม: ${res?.name || 'อุปกรณ์'} (${item.quantity} ชิ้น)`,
          person: item.requester_name,
          department: item.requester_department,
          date: item.borrow_date,
          returnDate: item.return_date,
          type: 'borrow',
        }
      })

      const { data: bookingData } = await supabase
        .from('booking_requests')
        .select('*')
        .eq('status', 'APPROVED')

      const { data: roomData } = await supabase.from('rooms').select('*')

      const formattedBookings = (bookingData || []).map((item) => {
        const room = (roomData || []).find((r) => r.id === Number(item.room_id))
        return {
          id: `booking-${item.id}`,
          title: `🏫 จอง: ${room?.name || 'ห้องประชุม'}`,
          person: item.requester_name,
          department: item.requester_department,
          date: item.booking_date,
          time: `${item.start_time.slice(0, 5)} - ${item.end_time.slice(0, 5)} น.`,
          type: 'booking',
        }
      })

      setBorrowEvents(formattedBorrows)
      setBookingEvents(formattedBookings)
    } catch (err) {
      console.error('Error loading calendar data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCalendarData()
  }, [])

  const allEvents = [...borrowEvents, ...bookingEvents]
  const filteredEvents = allEvents.filter((item) => {
    const matchType = filterType === 'all' || item.type === filterType
    const matchDate = selectedDate ? item.date === selectedDate : true
    return matchType && matchDate
  })

  return (
    <main className="min-h-screen bg-gray-50 pb-12">
      {/* Banner ส่วนบน */}
      <div className="relative w-full h-[300px] bg-slate-900 text-white flex flex-col items-center justify-center overflow-hidden shadow-lg">
        <img
          src="https://images.unsplash.com/photo-1523050854058-8df90110c9f1?q=80&w=1600&auto=format&fit=crop"
          alt="School Background"
          className="absolute inset-0 w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent"></div>

        <div className="relative z-10 text-center px-4">
          <span className="bg-blue-600/80 text-blue-100 text-xs md:text-sm font-semibold tracking-wider px-3 py-1 rounded-full uppercase border border-blue-400/30">
            Resource Management System
          </span>
          <h1 className="text-3xl md:text-5xl font-extrabold mt-3 drop-shadow-md tracking-tight">
            โรงเรียนอุตรดิตถ์
          </h1>
          <p className="text-gray-200 text-sm md:text-base mt-2 max-w-xl mx-auto font-light">
            ระบบบริการยืม-คืนอุปกรณ์ จองห้องประชุม และแจ้งซ่อมแซมสิ่งของอาคารสถานที่
          </p>
        </div>
      </div>

      {/* เมนูปุ่มกด 3 ปุ่มหลัก */}
      <div className="max-w-6xl mx-auto px-4 -mt-8 relative z-20 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/borrow"
            className="flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white text-lg font-bold py-5 px-6 rounded-2xl shadow-lg transition duration-200 transform hover:-translate-y-1"
          >
            <span className="text-2xl">📦</span>
            <span>ยืมอุปกรณ์</span>
          </Link>

          <Link
            href="/booking"
            className="flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white text-lg font-bold py-5 px-6 rounded-2xl shadow-lg transition duration-200 transform hover:-translate-y-1"
          >
            <span className="text-2xl">🏫</span>
            <span>จองห้อง</span>
          </Link>

          <Link
            href="/maintenance"
            className="flex items-center justify-center gap-3 bg-amber-600 hover:bg-amber-700 text-white text-lg font-bold py-5 px-6 rounded-2xl shadow-lg transition duration-200 transform hover:-translate-y-1"
          >
            <span className="text-2xl">🛠️</span>
            <span>แจ้งซ่อม</span>
          </Link>
        </div>

        {/* ส่วนปฏิทิน FullCalendar */}
        <CalendarView filterType={filterType === 'borrow' ? 'BORROW' : filterType === 'booking' ? 'BOOKING' : 'ALL'} />

        {/* ตารางการใช้งานแบบรายการการ์ดเดิม */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b">
            <div>
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <span>📋</span> รายการอนุมัติล่าสุด
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">ค้นหาและกรองรายการตามวันที่หรือประเภท</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="text-xs border border-gray-300 rounded-lg p-2 bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
              />
              {selectedDate && (
                <button
                  onClick={() => setSelectedDate('')}
                  className="text-xs text-red-500 hover:underline"
                >
                  ล้างวันที่
                </button>
              )}

              <div className="flex bg-gray-100 p-1 rounded-lg text-xs font-medium">
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-3 py-1.5 rounded-md transition ${
                    filterType === 'all' ? 'bg-white shadow text-gray-800' : 'text-gray-500'
                  }`}
                >
                  ทั้งหมด
                </button>
                <button
                  onClick={() => setFilterType('borrow')}
                  className={`px-3 py-1.5 rounded-md transition ${
                    filterType === 'borrow' ? 'bg-white shadow text-blue-600' : 'text-gray-500'
                  }`}
                >
                  📦 ยืมอุปกรณ์
                </button>
                <button
                  onClick={() => setFilterType('booking')}
                  className={`px-3 py-1.5 rounded-md transition ${
                    filterType === 'booking' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'
                  }`}
                >
                  🏫 จองห้อง
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12 text-gray-400">กำลังโหลดตารางการใช้งาน...</div>
          ) : filteredEvents.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              ไม่พบรายการจองหรือการใช้งานตามเงื่อนไขที่เลือก
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredEvents.map((item) => (
                <div
                  key={item.id}
                  className={`p-4 rounded-xl border transition hover:shadow-md ${
                    item.type === 'borrow'
                      ? 'bg-blue-50/50 border-blue-100'
                      : 'bg-indigo-50/50 border-indigo-100'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <span className="font-bold text-gray-800">{item.title}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        item.type === 'borrow'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-indigo-100 text-indigo-700'
                      }`}
                    >
                      {item.type === 'borrow' ? 'การยืม' : 'การจองห้อง'}
                    </span>
                  </div>

                  <div className="text-xs text-gray-600 space-y-1">
                    <div>
                      👤 <b>ผู้จอง/ยืม:</b> คุณ{item.person} ({item.department || '-'})
                    </div>
                    <div>
                      📅 <b>วันที่ใช้งาน:</b> {item.date}
                      {item.returnDate && ` ถึง ${item.returnDate}`}
                    </div>
                    {item.time && (
                      <div>
                        ⏰ <b>เวลา:</b> {item.time}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}