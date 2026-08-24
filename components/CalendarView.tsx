'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'

interface CalendarViewProps {
  filterType?: 'ALL' | 'BOOKING' | 'BORROW'
}

interface CalendarEvent {
  id: string
  title: string
  date: string // Format: YYYY-MM-DD
  time?: string
  type: 'BOOKING' | 'BORROW'
  status: string
}

export default function CalendarView({ filterType = 'ALL' }: CalendarViewProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true)
      let combinedEvents: CalendarEvent[] = []

      // 1. ดึงข้อมูลการจองห้อง
      if (filterType === 'ALL' || filterType === 'BOOKING') {
        const { data: bookings, error: bookingErr } = await supabase
          .from('booking_requests')
          .select('id, booking_date, start_time, end_time, status, room_id')
          .eq('status', 'APPROVED')

        if (!bookingErr && bookings) {
          const { data: rooms } = await supabase.from('rooms').select('id, name')
          const roomMap = new Map(rooms?.map((r) => [r.id, r.name]) || [])

          const formattedBookings: CalendarEvent[] = bookings.map((b) => ({
            id: `booking-${b.id}`,
            title: `🏫 ${roomMap.get(b.room_id) || 'ห้องประชุม'}`,
            date: b.booking_date,
            time: `${b.start_time?.slice(0, 5)} - ${b.end_time?.slice(0, 5)}`,
            type: 'BOOKING',
            status: b.status,
          }))
          combinedEvents = [...combinedEvents, ...formattedBookings]
        }
      }

      // 2. ดึงข้อมูลการยืมอุปกรณ์
      if (filterType === 'ALL' || filterType === 'BORROW') {
        const { data: borrows, error: borrowErr } = await supabase
          .from('borrow_requests')
          .select('id, borrow_date, return_date, quantity, status, resource_id')
          .eq('status', 'APPROVED')

        if (!borrowErr && borrows) {
          const { data: resources } = await supabase.from('resources').select('id, name')
          const resourceMap = new Map(resources?.map((r) => [r.id, r.name]) || [])

          const formattedBorrows: CalendarEvent[] = borrows.map((b) => ({
            id: `borrow-${b.id}`,
            title: `📦 ${resourceMap.get(b.resource_id) || 'อุปกรณ์'} (${b.quantity})`,
            date: b.borrow_date,
            time: `คืน ${b.return_date}`,
            type: 'BORROW',
            status: b.status,
          }))
          combinedEvents = [...combinedEvents, ...formattedBorrows]
        }
      }

      setEvents(combinedEvents)
    } catch (err) {
      console.error('Error fetching calendar events:', err)
    } finally {
      setLoading(false)
    }
  }, [filterType])

  useEffect(() => {
    fetchEvents()

    const channel = supabase
      .channel('calendar-grid-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'booking_requests' },
        () => fetchEvents()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'borrow_requests' },
        () => fetchEvents()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchEvents])

  // คำนวณวันในปฏิทิน
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const firstDayOfMonth = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))

  const monthNames = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ]

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      {/* Header ปฏิทิน */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-gray-800">
            📅 {monthNames[month]} {year + 543}
          </h2>
          {loading && <span className="text-xs text-gray-400">กำลังอัปเดต...</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="p-2 border rounded-lg hover:bg-gray-50 text-sm font-semibold"
          >
            ← เดือนก่อน
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-2 border rounded-lg hover:bg-gray-50 text-sm font-semibold text-blue-600"
          >
            วันนี้
          </button>
          <button
            onClick={nextMonth}
            className="p-2 border rounded-lg hover:bg-gray-50 text-sm font-semibold"
          >
            เดือนถัดไป →
          </button>
        </div>
      </div>

      {/* หัวตารางวัน */}
      <div className="grid grid-cols-7 text-center font-bold text-sm text-gray-600 mb-2">
        <div className="text-red-500 py-2">อา</div>
        <div className="py-2">จ</div>
        <div className="py-2">อ</div>
        <div className="py-2">พ</div>
        <div className="py-2">พฤ</div>
        <div className="py-2">ศ</div>
        <div className="text-blue-500 py-2">ส</div>
      </div>

      {/* ช่องตารางวันที่ */}
      <div className="grid grid-cols-7 border-t border-l border-gray-200">
        {/* ช่องว่างก่อนวันที่ 1 */}
        {Array.from({ length: firstDayOfMonth }).map((_, index) => (
          <div key={`empty-${index}`} className="min-h-[110px] border-r border-b border-gray-200 bg-gray-50/50" />
        ))}

        {/* ช่องวันที่ 1 ถึง สิ้นเดือน */}
        {Array.from({ length: daysInMonth }).map((_, index) => {
          const dayNum = index + 1
          const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
          const dayEvents = events.filter((e) => e.date === dateString)

          return (
            <div
              key={`day-${dayNum}`}
              className="min-h-[110px] border-r border-b border-gray-200 p-1.5 flex flex-col justify-start bg-white"
            >
              <span className="text-xs font-semibold text-gray-700 mb-1">
                {dayNum}
              </span>

              {/* รายการ Events ในแต่ละวัน */}
              <div className="space-y-1 overflow-y-auto max-h-[85px]">
                {dayEvents.map((event) => (
                  <div
                    key={event.id}
                    className={`text-[10px] p-1 rounded font-medium truncate ${
                      event.type === 'BOOKING'
                        ? 'bg-blue-100 text-blue-800 border border-blue-200'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    }`}
                    title={`${event.title} (${event.time})`}
                  >
                    <div className="font-bold truncate">{event.title}</div>
                    <div className="opacity-80 text-[9px]">{event.time}</div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}