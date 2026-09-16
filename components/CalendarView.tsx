'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'

interface CalendarViewProps {
  filterType?: 'ALL' | 'BOOKING' | 'BORROW'
}

interface CalendarEvent {
  id: string
  title: string
  startDate: string
  endDate: string
  timeText: string
  type: 'BOOKING' | 'BORROW'
  details?: {
    itemName: string
    quantity?: number
    timeInfo: string
  }
}

export default function CalendarView({ filterType = 'ALL' }: CalendarViewProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true)
      let combinedEvents: CalendarEvent[] = []

      if (filterType === 'ALL' || filterType === 'BOOKING') {
        const { data: bookings, error: bookingErr } = await supabase
          .from('booking_requests')
          .select('id, booking_date, start_time, end_time, status, room_id')
          .eq('status', 'APPROVED')

        if (!bookingErr && bookings) {
          const { data: rooms } = await supabase.from('rooms').select('id, name')
          const roomMap = new Map(rooms?.map((r) => [r.id, r.name]) || [])

          const formattedBookings: CalendarEvent[] = bookings.map((b) => {
            const roomName = roomMap.get(b.room_id) || 'ห้องประชุม'
            const startTimeStr = b.start_time?.slice(0, 5) || '00:00'
            const endTimeStr = b.end_time?.slice(0, 5) || '23:59'

            return {
              id: `booking-${b.id}`,
              title: `🏫 ${roomName}`,
              startDate: b.booking_date,
              endDate: b.booking_date,
              timeText: `${startTimeStr} - ${endTimeStr} น.`,
              type: 'BOOKING',
              details: {
                itemName: roomName,
                timeInfo: `เวลา ${startTimeStr} - ${endTimeStr} น.`,
              },
            }
          })
          combinedEvents = [...combinedEvents, ...formattedBookings]
        }
      }

      if (filterType === 'ALL' || filterType === 'BORROW') {
        const { data: borrows, error: borrowErr } = await supabase
          .from('borrow_requests')
          .select('id, borrow_date, return_date, quantity, status, resource_id')
          .eq('status', 'APPROVED')

        if (!borrowErr && borrows) {
          const { data: resources } = await supabase.from('resources').select('id, name')
          const resourceMap = new Map(resources?.map((r) => [r.id, r.name]) || [])

          const formattedBorrows: CalendarEvent[] = borrows.map((b) => {
            const resourceName = resourceMap.get(b.resource_id) || 'อุปกรณ์'
            const startDate = b.borrow_date
            const endDate = b.return_date || b.borrow_date
            const isSameDay = startDate === endDate

            const timeText = isSameDay
              ? `ยืม 08:30 - คืนก่อน 16:00 น.`
              : `ยืม ${startDate} ถึง ${endDate} (คืนก่อน 16:00 น.)`

            return {
              id: `borrow-${b.id}`,
              title: `📦 ${resourceName} (${b.quantity})`,
              startDate,
              endDate,
              timeText,
              type: 'BORROW',
              details: {
                itemName: resourceName,
                quantity: b.quantity,
                timeInfo: isSameDay
                  ? `ยืมวันที่ ${startDate} (รับ 08:30 น. - คืนภายใน 16:00 น.)`
                  : `ยืมตั้งแต่วันที่ ${startDate} ถึง ${endDate} (ต้องคืนภายในเวลา 16:00 น. ของวันที่ ${endDate})`,
              },
            }
          })
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'booking_requests' }, () => fetchEvents())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'borrow_requests' }, () => fetchEvents())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchEvents])

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))

  const monthNames = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ]

  const calendarWeeks = useMemo(() => {
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)

    const startDate = new Date(firstDay)
    startDate.setDate(startDate.getDate() - firstDay.getDay())

    const weeks: { date: Date; dateStr: string; isCurrentMonth: boolean }[][] = []
    let currentWeek: { date: Date; dateStr: string; isCurrentMonth: boolean }[] = []

    let tempDate = new Date(startDate)
    while (tempDate <= lastDay || currentWeek.length > 0) {
      const y = tempDate.getFullYear()
      const m = String(tempDate.getMonth() + 1).padStart(2, '0')
      const d = String(tempDate.getDate()).padStart(2, '0')
      const dateStr = `${y}-${m}-${d}`

      currentWeek.push({
        date: new Date(tempDate),
        dateStr,
        isCurrentMonth: tempDate.getMonth() === month,
      })

      if (currentWeek.length === 7) {
        weeks.push(currentWeek)
        if (tempDate > lastDay) break
        currentWeek = []
      }

      tempDate.setDate(tempDate.getDate() + 1)
    }

    return weeks
  }, [year, month])

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 select-none relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-gray-800">
            📅 {monthNames[month]} {year + 543}
          </h2>
          {loading && <span className="text-xs text-gray-400">กำลังอัปเดต...</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-2 border rounded-lg hover:bg-gray-50 text-sm font-semibold">
            ← เดือนก่อน
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-2 border rounded-lg hover:bg-gray-50 text-sm font-semibold text-blue-600"
          >
            วันนี้
          </button>
          <button onClick={nextMonth} className="p-2 border rounded-lg hover:bg-gray-50 text-sm font-semibold">
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

      {/* ตารางแสดงผลปฏิทินแบบปลอดภัยไม่ล้นกรอบ */}
      <div className="border-t border-l border-gray-200 rounded-lg overflow-hidden">
        {calendarWeeks.map((week, weekIndex) => (
          <div key={`week-${weekIndex}`} className="grid grid-cols-7">
            {week.map((day) => {
              const dayEvents = events.filter(
                (e) => day.dateStr >= e.startDate && day.dateStr <= e.endDate
              )

              return (
                <div
                  key={day.dateStr}
                  className={`min-h-[120px] max-h-[120px] border-r border-b border-gray-200 p-1.5 flex flex-col overflow-hidden ${
                    day.isCurrentMonth ? 'bg-white' : 'bg-gray-50/50 text-gray-300'
                  }`}
                >
                  <span
                    className={`text-xs font-semibold mb-1 shrink-0 ${
                      day.isCurrentMonth ? 'text-gray-700' : 'text-gray-300'
                    }`}
                  >
                    {day.date.getDate()}
                  </span>

                  <div className="flex-1 overflow-y-auto space-y-1 pr-0.5 custom-scrollbar">
                    {dayEvents.map((event) => (
                      <div
                        key={`${event.id}-${day.dateStr}`}
                        onClick={() => setSelectedEvent(event)}
                        className={`px-1.5 py-0.5 text-[10px] font-medium rounded truncate cursor-pointer transition hover:opacity-80 shadow-2xs ${
                          event.type === 'BOOKING'
                            ? 'bg-blue-100 text-blue-900 border border-blue-200'
                            : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                        }`}
                        title={`${event.title} (${event.timeText})`}
                      >
                        {event.title}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Modal สรุปข้อมูลเมื่อคลิกแถบปฏิทิน */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-lg border border-gray-100">
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-lg font-bold text-gray-800">{selectedEvent.title}</h3>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2 text-sm text-gray-600">
              <p>
                <span className="font-semibold text-gray-700">ประเภท:</span>{' '}
                {selectedEvent.type === 'BOOKING' ? 'จองห้องประชุม' : 'ยืมอุปกรณ์'}
              </p>
              <p>
                <span className="font-semibold text-gray-700">ช่วงเวลา:</span>{' '}
                {selectedEvent.details?.timeInfo}
              </p>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}