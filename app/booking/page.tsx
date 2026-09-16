'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import CalendarView from '@/components/CalendarView'

interface Room {
  id: number
  name: string
  building?: string
}

interface BookingItem {
  room_id: string
  selected_dates: string[] // เก็บเป็น Array ของวันที่เลือก เช่น ['2026-09-21', '2026-09-23', '2026-09-26']
  start_time: string
  end_time: string
}

interface BookingForm {
  requester_name: string
  requester_email: string
  position: string
  requester_department: string
  purpose: string
  items: BookingItem[]
}

const INITIAL_ITEM: BookingItem = {
  room_id: '',
  selected_dates: [],
  start_time: '',
  end_time: '',
}

const INITIAL_FORM_STATE: BookingForm = {
  requester_name: '',
  requester_email: '',
  position: 'ครู',
  requester_department: '',
  purpose: '',
  items: [INITIAL_ITEM],
}

export default function BookingPage() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<BookingForm>(INITIAL_FORM_STATE)

  // ควบคุมการเปิด/ปิดป๊อปอัป
  const [activePicker, setActivePicker] = useState<{ index: number; type: 'start_time' | 'end_time' | 'date_picker' } | null>(null)
  const pickerRef = useRef<HTMLDivElement>(null)

  // State สำหรับจัดการหน้าปฏิทิน (Month/Year View)
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth())
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())

  useEffect(() => {
    const fetchRooms = async () => {
      const { data, error } = await supabase.from('rooms').select('*')
      if (error) {
        console.error('Error fetching rooms:', error.message)
      } else {
        setRooms(data || [])
      }
    }
    fetchRooms()

    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setActivePicker(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleGeneralChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleItemChange = (index: number, field: keyof BookingItem, value: any) => {
    const updatedItems = [...form.items]
    updatedItems[index] = { ...updatedItems[index], [field]: value }
    setForm((prev) => ({ ...prev, items: updatedItems }))
  }

  const handleAddItem = () => {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { ...INITIAL_ITEM }],
    }))
  }

  const handleRemoveItem = (index: number) => {
    if (form.items.length === 1) {
      alert('ต้องมีรายการห้องอย่างน้อย 1 ห้อง')
      return
    }
    const updatedItems = form.items.filter((_, i) => i !== index)
    setForm((prev) => ({ ...prev, items: updatedItems }))
  }

  const handleSetTime = (index: number, type: 'start_time' | 'end_time', hour: string, min: string) => {
    const timeStr = `${hour}:${min}`
    const updatedItems = [...form.items]
    if (type === 'start_time') {
      updatedItems[index].start_time = timeStr
    } else {
      updatedItems[index].end_time = timeStr
    }
    setForm((prev) => ({ ...prev, items: updatedItems }))
    setActivePicker(null)
  }

  // ฟังก์ชันกดเลือก/ยกเลิกเลือกวันแบบอิสระทีละวัน
  const handleToggleDate = (index: number, dateStr: string) => {
    const updatedItems = [...form.items]
    let currentDates = [...updatedItems[index].selected_dates]

    if (currentDates.includes(dateStr)) {
      // ถ้าเลือกไว้แล้ว ให้เอาออก (Unselect)
      currentDates = currentDates.filter((d) => d !== dateStr)
    } else {
      // ถ้ายังไม่เลือก ให้เพิ่มเข้าไป แล้วเรียงลำดับจากน้อยไปมากเสมอ
      currentDates.push(dateStr)
      currentDates.sort()
    }

    updatedItems[index].selected_dates = currentDates
    setForm((prev) => ({ ...prev, items: updatedItems }))
  }

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return ''
    const [y, m, d] = dateStr.split('-')
    return `${d}/${m}/${y}`
  }

  const getSummaryDateText = (dates: string[]) => {
    if (!dates || dates.length === 0) return 'เลือกวันที่ต้องการใช้งาน (กดเลือกได้หลายวัน)'
    if (dates.length === 1) return formatDateDisplay(dates[0])
    
    // เรียงจากน้อยไปมาก วันแรกถึงวันสุดท้าย
    const sorted = [...dates].sort()
    return `${formatDateDisplay(sorted[0])} ถึง ${formatDateDisplay(sorted[sorted.length - 1])} (${dates.length} วัน)`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    for (let i = 0; i < form.items.length; i++) {
      const item = form.items[i]
      if (!item.room_id) {
        alert(`กรุณาเลือกห้องในรายการที่ ${i + 1}`)
        return
      }
      if (!item.selected_dates || item.selected_dates.length === 0) {
        alert(`กรุณาเลือกอย่างน้อย 1 วัน ในรายการที่ ${i + 1}`)
        return
      }
      if (!item.start_time || !item.end_time) {
        alert(`กรุณากรอกเวลาเริ่มและเวลาสิ้นสุดให้ครบถ้วนในรายการที่ ${i + 1}`)
        return
      }
      if (item.start_time >= item.end_time) {
        alert(`เวลาสิ้นสุดต้องมาหลังเวลาเริ่มใช้งาน ในรายการที่ ${i + 1}`)
        return
      }
    }

    setLoading(true)

    try {
      for (let i = 0; i < form.items.length; i++) {
        const item = form.items[i]
        const selectedRoomId = Number(item.room_id)

        // ตรวจสอบการจองซ้ำในทุกวันที่ผู้ใช้เลือกไว้
        for (const bookingDate of item.selected_dates) {
          const { data: existingBookings, error: checkError } = await supabase
            .from('booking_requests')
            .select('*')
            .eq('room_id', selectedRoomId)
            .eq('booking_date', bookingDate)
            .in('status', ['PENDING', 'APPROVED'])
            .lt('start_time', item.end_time)
            .gt('end_time', item.start_time)

          if (checkError) {
            throw new Error('เกิดข้อผิดพลาดในการตรวจสอบสถานะห้อง: ' + checkError.message)
          }

          if (existingBookings && existingBookings.length > 0) {
            const roomObj = rooms.find((r) => r.id === selectedRoomId)
            const roomName = roomObj ? roomObj.name : `ห้องรหัส ${selectedRoomId}`
            throw new Error(
              `❌ ไม่สามารถจอง "${roomName}" ได้! เนื่องจากติดช่วงเวลาจองซ้ำในวันที่ ${bookingDate}`
            )
          }
        }

        // บันทึกข้อมูลลงฐานข้อมูลแยกตามรายวัน
        for (const bookingDate of item.selected_dates) {
          const payload = {
            requester_name: form.requester_name.trim(),
            requester_email: form.requester_email.trim(),
            position: form.position,
            student_id: null,
            requester_department: form.requester_department.trim(),
            room_id: selectedRoomId,
            booking_date: bookingDate,
            start_time: item.start_time,
            end_time: item.end_time,
            purpose: form.purpose ? form.purpose.trim() : null,
            status: 'PENDING',
          }

          const { data, error: insertError } = await supabase
            .from('booking_requests')
            .insert([payload])
            .select()

          if (insertError) throw insertError

          if (data && data.length > 0) {
            const roomObj = rooms.find((r) => r.id === selectedRoomId)
            const roomName = roomObj ? roomObj.name : `ห้องรหัส ${selectedRoomId}`

            try {
              await fetch('/api/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  title: `คำขอจองห้องใหม่: ${roomName} (${bookingDate})`,
                  requesterName: `${form.requester_name} (${form.position})`,
                  requesterEmail: form.requester_email,
                  department: form.requester_department,
                  details: `ห้อง: ${roomName} | วันที่: ${bookingDate} | เวลา: ${item.start_time} - ${item.end_time} น.`,
                }),
              })
            } catch (emailErr) {
              console.error('Failed to send email notification:', emailErr)
            }
          }
        }
      }

      alert('✅ ส่งคำขอจองห้องเรียบร้อยแล้ว! รอการอนุมัติจาก Admin')
      setForm(INITIAL_FORM_STATE)
    } catch (err: any) {
      console.error('Booking Error:', err)
      alert(err.message || 'เกิดข้อผิดพลาดในการส่งคำขอ')
    } finally {
      setLoading(false)
    }
  }

  const hoursList = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
  const minutesList = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55']

  const monthNames = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ]

  const renderCustomCalendar = (index: number) => {
    const item = form.items[index]
    const firstDay = new Date(currentYear, currentMonth, 1).getDay()
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()

    const days = []
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-8 w-8"></div>)
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const monthStr = String(currentMonth + 1).padStart(2, '0')
      const dayStr = String(d).padStart(2, '0')
      const dateStr = `${currentYear}-${monthStr}-${dayStr}`

      const isSelected = item.selected_dates.includes(dateStr)

      days.push(
        <button
          type="button"
          key={dateStr}
          onClick={() => handleToggleDate(index, dateStr)}
          className={`h-8 w-8 text-xs rounded-lg flex items-center justify-center transition font-medium ${
            isSelected
              ? 'bg-pink-600 text-white font-bold shadow-md shadow-pink-500/30'
              : 'hover:bg-gray-100 text-gray-800'
          }`}
        >
          {d}
        </button>
      )
    }

    return (
      <div className="absolute z-50 mt-1 bg-white border border-gray-200 rounded-2xl shadow-2xl p-4 w-72">
        <div className="flex justify-between items-center mb-3">
          <button
            type="button"
            onClick={() => {
              if (currentMonth === 0) {
                setCurrentMonth(11)
                setCurrentYear(currentYear - 1)
              } else {
                setCurrentMonth(currentMonth - 1)
              }
            }}
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-600 text-xs font-bold"
          >
            ◀
          </button>
          <span className="text-sm font-bold text-gray-800">
            {monthNames[currentMonth]} {currentYear + 543}
          </span>
          <button
            type="button"
            onClick={() => {
              if (currentMonth === 11) {
                setCurrentMonth(0)
                setCurrentYear(currentYear + 1)
              } else {
                setCurrentMonth(currentMonth + 1)
              }
            }}
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-600 text-xs font-bold"
          >
            ▶
          </button>
        </div>

        <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-gray-400 mb-2">
          <span>อา</span><span>จ</span><span>อ</span><span>พ</span><span>พฤ</span><span>ศ</span><span>ส</span>
        </div>

        <div className="grid grid-cols-7 gap-1 justify-items-center">
          {days}
        </div>

        <div className="mt-3 pt-2 border-t border-gray-100 flex justify-between items-center text-xs">
          <span className="text-gray-500">
            เลือกแล้ว {item.selected_dates.length} วัน
          </span>
          <button
            type="button"
            onClick={() => setActivePicker(null)}
            className="text-pink-600 font-bold hover:underline"
          >
            เสร็จสิ้น
          </button>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <Link
          href="/"
          className="inline-flex items-center text-sm text-gray-600 hover:text-pink-600 font-medium transition"
        >
          ← กลับสู่หน้าหลัก โรงเรียนอุตรดิตถ์
        </Link>

        <div className="bg-white rounded-2xl shadow-sm border border-pink-100 p-6 md:p-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="w-12 h-12 bg-gradient-to-tr from-blue-600 to-pink-500 rounded-xl flex items-center justify-center text-2xl shadow-md shadow-pink-500/20 text-white">
              🏫
            </span>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                แบบฟอร์มขอจองใช้งานห้อง (สำหรับครู/บุคลากร)
              </h1>
              <p className="text-xs text-gray-500">
                คลิกเลือกวันที่ต้องการใช้งานอิสระได้หลายวันในช่องเดียว และเพิ่มหลายห้องพร้อมกันได้
              </p>
            </div>
          </div>

          <hr className="my-5 border-gray-100" />

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ชื่อ-นามสกุล *
                </label>
                <input
                  type="text"
                  name="requester_name"
                  required
                  value={form.requester_name}
                  onChange={handleGeneralChange}
                  placeholder="ครูสมชาย ใจดี"
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm text-gray-900 bg-white placeholder-gray-400 focus:ring-2 focus:ring-pink-500 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  อีเมล (สำหรับรับผลอนุมัติ) *
                </label>
                <input
                  type="email"
                  name="requester_email"
                  required
                  value={form.requester_email}
                  onChange={handleGeneralChange}
                  placeholder="somchai@school.ac.th"
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm text-gray-900 bg-white placeholder-gray-400 focus:ring-2 focus:ring-pink-500 outline-none transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ตำแหน่ง *
                </label>
                <select
                  name="position"
                  value={form.position}
                  onChange={handleGeneralChange}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-pink-500 outline-none transition"
                >
                  <option value="ครู">ครู / อาจารย์</option>
                  <option value="หัวหน้ากลุ่มสาระ">หัวหน้ากลุ่มสาระ</option>
                  <option value="เจ้าหน้าที่">เจ้าหน้าที่บุคลากร</option>
                  <option value="ผู้บริหาร">ผู้บริหาร</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  สังกัด / กลุ่มสาระการเรียนรู้ *
                </label>
                <input
                  type="text"
                  name="requester_department"
                  required
                  value={form.requester_department}
                  onChange={handleGeneralChange}
                  placeholder="กลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี"
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm text-gray-900 bg-white placeholder-gray-400 focus:ring-2 focus:ring-pink-500 outline-none transition"
                />
              </div>
            </div>

            <hr className="my-4 border-gray-100" />

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-base font-bold text-gray-800">
                  รายการห้องที่ต้องการจอง *
                </label>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="px-3 py-1.5 bg-pink-50 text-pink-600 hover:bg-pink-100 border border-pink-200 rounded-lg text-xs font-semibold transition flex items-center gap-1 shadow-sm"
                >
                  + เพิ่มห้องที่จะจอง
                </button>
              </div>

              {form.items.map((item, index) => {
                const currentStartHour = item.start_time ? item.start_time.split(':')[0] : '08'
                const currentStartMin = item.start_time ? item.start_time.split(':')[1] : '00'
                const currentEndHour = item.end_time ? item.end_time.split(':')[0] : '16'
                const currentEndMin = item.end_time ? item.end_time.split(':')[1] : '00'

                return (
                  <div
                    key={index}
                    className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3 relative transition"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-gray-600 bg-white px-2 py-1 border border-gray-200 rounded-md shadow-2xs">
                        ห้องที่ {index + 1}
                      </span>
                      {form.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="text-xs text-red-500 hover:text-red-700 font-medium transition"
                        >
                          ลบรายการนี้ ✕
                        </button>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        เลือกห้อง *
                      </label>
                      <select
                        required
                        value={item.room_id}
                        onChange={(e) => handleItemChange(index, 'room_id', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-pink-500 outline-none transition"
                      >
                        <option value="" className="text-gray-500">
                          -- เลือกห้อง --
                        </option>
                        {rooms.map((room) => (
                          <option key={room.id} value={room.id} className="text-gray-900">
                            {room.name} {room.building ? `(${room.building})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {/* ช่องเลือกวันที่แบบอิสระ */}
                      <div className="relative">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          วันที่ใช้งาน * (คลิกเลือกหลายวันอิสระ)
                        </label>
                        <div
                          onClick={() =>
                            setActivePicker(
                              activePicker?.index === index && activePicker?.type === 'date_picker'
                                ? null
                                : { index, type: 'date_picker' }
                            )
                          }
                          className="w-full border border-gray-300 rounded-lg p-2.5 text-sm text-gray-900 bg-white cursor-pointer flex justify-between items-center focus:ring-2 focus:ring-pink-500 transition truncate"
                        >
                          <span className="truncate">{getSummaryDateText(item.selected_dates)}</span>
                          <span className="text-gray-400 shrink-0 ml-2">📅</span>
                        </div>

                        {activePicker?.index === index && activePicker?.type === 'date_picker' && (
                          <div ref={pickerRef}>
                            {renderCustomCalendar(index)}
                          </div>
                        )}
                      </div>

                      {/* เวลาเริ่ม */}
                      <div className="relative">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          เวลาเริ่ม *
                        </label>
                        <div
                          onClick={() =>
                            setActivePicker(
                              activePicker?.index === index && activePicker?.type === 'start_time'
                                ? null
                                : { index, type: 'start_time' }
                            )
                          }
                          className="w-full border border-gray-300 rounded-lg p-2.5 text-sm text-gray-900 bg-white cursor-pointer flex justify-between items-center focus:ring-2 focus:ring-pink-500 transition"
                        >
                          <span>{item.start_time ? `${item.start_time} น.` : 'เลือกเวลาเริ่ม'}</span>
                          <span className="text-gray-400">🕒</span>
                        </div>

                        {activePicker?.index === index && activePicker?.type === 'start_time' && (
                          <div
                            ref={pickerRef}
                            className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl p-3 flex gap-2"
                          >
                            <div className="flex-1">
                              <div className="text-[10px] font-semibold text-gray-500 mb-1 text-center">ชม.</div>
                              <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                                {hoursList.map((h) => (
                                  <div
                                    key={h}
                                    onClick={() => handleSetTime(index, 'start_time', h, currentStartMin)}
                                    className={`p-1 text-center text-xs rounded cursor-pointer transition ${
                                      currentStartHour === h ? 'bg-pink-600 text-white font-bold' : 'hover:bg-gray-100 text-gray-800'
                                    }`}
                                  >
                                    {h}
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="flex-1">
                              <div className="text-[10px] font-semibold text-gray-500 mb-1 text-center">นาที</div>
                              <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                                {minutesList.map((m) => (
                                  <div
                                    key={m}
                                    onClick={() => handleSetTime(index, 'start_time', currentStartHour, m)}
                                    className={`p-1 text-center text-xs rounded cursor-pointer transition ${
                                      currentStartMin === m ? 'bg-pink-600 text-white font-bold' : 'hover:bg-gray-100 text-gray-800'
                                    }`}
                                  >
                                    {m}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* เวลาสิ้นสุด */}
                      <div className="relative">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          เวลาสิ้นสุด *
                        </label>
                        <div
                          onClick={() =>
                            setActivePicker(
                              activePicker?.index === index && activePicker?.type === 'end_time'
                                ? null
                                : { index, type: 'end_time' }
                            )
                          }
                          className="w-full border border-gray-300 rounded-lg p-2.5 text-sm text-gray-900 bg-white cursor-pointer flex justify-between items-center focus:ring-2 focus:ring-pink-500 transition"
                        >
                          <span>{item.end_time ? `${item.end_time} น.` : 'เลือกเวลาสิ้นสุด'}</span>
                          <span className="text-gray-400">🕒</span>
                        </div>

                        {activePicker?.index === index && activePicker?.type === 'end_time' && (
                          <div
                            ref={pickerRef}
                            className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl p-3 flex gap-2"
                          >
                            <div className="flex-1">
                              <div className="text-[10px] font-semibold text-gray-500 mb-1 text-center">ชม.</div>
                              <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                                {hoursList.map((h) => (
                                  <div
                                    key={h}
                                    onClick={() => handleSetTime(index, 'end_time', h, currentEndMin)}
                                    className={`p-1 text-center text-xs rounded cursor-pointer transition ${
                                      currentEndHour === h ? 'bg-pink-600 text-white font-bold' : 'hover:bg-gray-100 text-gray-800'
                                    }`}
                                  >
                                    {h}
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="flex-1">
                              <div className="text-[10px] font-semibold text-gray-500 mb-1 text-center">นาที</div>
                              <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                                {minutesList.map((m) => (
                                  <div
                                    key={m}
                                    onClick={() => handleSetTime(index, 'end_time', currentEndHour, m)}
                                    className={`p-1 text-center text-xs rounded cursor-pointer transition ${
                                      currentEndMin === m ? 'bg-pink-600 text-white font-bold' : 'hover:bg-gray-100 text-gray-800'
                                    }`}
                                  >
                                    {m}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <hr className="my-4 border-gray-100" />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                วัตถุประสงค์การใช้งาน (ใช้ร่วมกันทุกรายการ)
              </label>
              <textarea
                name="purpose"
                rows={3}
                value={form.purpose}
                onChange={handleGeneralChange}
                placeholder="อบรมเชิงปฏิบัติการ, จัดประชุมกลุ่มสาระ..."
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm text-gray-900 bg-white placeholder-gray-400 focus:ring-2 focus:ring-pink-500 outline-none transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-pink-500 hover:from-blue-700 hover:to-pink-600 text-white font-bold py-3.5 rounded-xl transition duration-200 shadow-lg shadow-pink-500/20 disabled:opacity-50 mt-4"
            >
              {loading ? 'กำลังส่งคำขอ...' : 'ส่งคำขอจองห้องทั้งหมด'}
            </button>
          </form>
        </div>

        <CalendarView filterType="BOOKING" />
      </div>
    </main>
  )
}