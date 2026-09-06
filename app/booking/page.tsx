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

interface BookingForm {
  requester_name: string
  requester_email: string
  position: string
  requester_department: string
  room_id: string
  booking_date: string
  start_time: string
  end_time: string
  purpose: string
}

const INITIAL_FORM_STATE: BookingForm = {
  requester_name: '',
  requester_email: '',
  position: 'ครู',
  requester_department: '',
  room_id: '',
  booking_date: '',
  start_time: '',
  end_time: '',
  purpose: '',
}

export default function BookingPage() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<BookingForm>(INITIAL_FORM_STATE)

  // State สำหรับควบคุมการเปิด/ปิด ป๊อปอัปเลือกเวลา
  const [showStartPicker, setShowStartPicker] = useState(false)
  const [showEndPicker, setShowEndPicker] = useState(false)
  const [selectedStartHour, setSelectedStartHour] = useState('08')
  const [selectedStartMin, setSelectedStartMin] = useState('00')
  const [selectedEndHour, setSelectedEndHour] = useState('16')
  const [selectedEndMin, setSelectedEndMin] = useState('00')

  const startPickerRef = useRef<HTMLDivElement>(null)
  const endPickerRef = useRef<HTMLDivElement>(null)

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

    // ปิดป๊อปอัปเวลาเมื่อคลิกพื้นที่นอกกล่อง
    const handleClickOutside = (event: MouseEvent) => {
      if (startPickerRef.current && !startPickerRef.current.contains(event.target as Node)) {
        setShowStartPicker(false)
      }
      if (endPickerRef.current && !endPickerRef.current.contains(event.target as Node)) {
        setShowEndPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSetStartTime = (hour: string, min: string) => {
    const timeStr = `${hour}:${min}`
    setSelectedStartHour(hour)
    setSelectedStartMin(min)
    setForm((prev) => ({ ...prev, start_time: timeStr }))
    setShowStartPicker(false)
  }

  const handleSetEndTime = (hour: string, min: string) => {
    const timeStr = `${hour}:${min}`
    setSelectedEndHour(hour)
    setSelectedEndMin(min)
    setForm((prev) => ({ ...prev, end_time: timeStr }))
    setShowEndPicker(false)
  }

  const formatTimeText = (timeStr: string) => {
    if (!timeStr) return ''
    return timeStr.replace(':', '.')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.room_id) {
      alert('กรุณาเลือกห้องที่ต้องการจอง')
      return
    }

    if (!form.start_time || !form.end_time) {
      alert('กรุณาเลือกเวลาเริ่มและเวลาสิ้นสุด')
      return
    }

    if (form.start_time >= form.end_time) {
      alert('เวลาสิ้นสุดต้องมาหลังเวลาเริ่มใช้งาน')
      return
    }

    setLoading(true)

    try {
      const selectedRoomId = Number(form.room_id)

      // 1. เช็กการจองซ้ำ
      const { data: existingBookings, error: checkError } = await supabase
        .from('booking_requests')
        .select('*')
        .eq('room_id', selectedRoomId)
        .eq('booking_date', form.booking_date)
        .in('status', ['PENDING', 'APPROVED'])
        .lt('start_time', form.end_time)
        .gt('end_time', form.start_time)

      if (checkError) {
        alert('เกิดข้อผิดพลาดในการตรวจสอบสถานะห้อง: ' + checkError.message)
        setLoading(false)
        return
      }

      if (existingBookings && existingBookings.length > 0) {
        const conflict = existingBookings[0]
        const startTimeDisplay = formatTimeText(conflict.start_time)
        const endTimeDisplay = formatTimeText(conflict.end_time)

        alert(
          `❌ ไม่สามารถจองได้! ห้องนี้มีการขอจองในช่วงเวลานี้แล้ว (${startTimeDisplay} - ${endTimeDisplay} น.)`
        )
        setLoading(false)
        return
      }

      // 2. บันทึกข้อมูลคำขอจองลง Supabase
      const payload = {
        requester_name: form.requester_name.trim(),
        requester_email: form.requester_email.trim(),
        position: form.position,
        student_id: null,
        requester_department: form.requester_department.trim(),
        room_id: selectedRoomId,
        booking_date: form.booking_date,
        start_time: form.start_time,
        end_time: form.end_time,
        purpose: form.purpose ? form.purpose.trim() : null,
        status: 'PENDING',
      }

      const { data, error: insertError } = await supabase
        .from('booking_requests')
        .insert([payload])
        .select()

      if (insertError) throw insertError

      if (data && data.length > 0) {
        // 3. ส่งอีเมลแจ้งเตือน Admin
        const roomObj = rooms.find((r) => r.id === selectedRoomId)
        const roomName = roomObj ? roomObj.name : `ห้องรหัส ${selectedRoomId}`

        try {
          await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: `คำขอจองห้องใหม่: ${roomName}`,
              requesterName: `${form.requester_name} (${form.position})`,
              requesterEmail: form.requester_email,
              department: form.requester_department,
              details: `ห้อง: ${roomName} | วันที่: ${form.booking_date} | เวลา: ${form.start_time} - ${form.end_time} น.`,
            }),
          })
        } catch (emailErr) {
          console.error('Failed to send email notification:', emailErr)
        }

        alert('✅ ส่งคำขอจองห้องเรียบร้อยแล้ว! รอการอนุมัติจาก Admin')
        setForm(INITIAL_FORM_STATE)
      }
    } catch (err: any) {
      console.error('Insert Error:', err)
      alert('เกิดข้อผิดพลาดในการส่งคำขอ: ' + (err.message || 'Error'))
    } finally {
      setLoading(false)
    }
  }

  // สร้างรายการชั่วโมง (00 ถึง 23) และนาที (00, 15, 30, 45 หรือทีละนาที)
  const hoursList = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
  const minutesList = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55']

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
                กรอกข้อมูลเพื่อส่งคำขอจองห้องประชุม หรือห้องเรียนปฏิบัติการ
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
                  onChange={handleChange}
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
                  onChange={handleChange}
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
                  onChange={handleChange}
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
                  onChange={handleChange}
                  placeholder="กลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี"
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm text-gray-900 bg-white placeholder-gray-400 focus:ring-2 focus:ring-pink-500 outline-none transition"
                />
              </div>
            </div>

            <hr className="my-4 border-gray-100" />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                เลือกห้องที่ต้องการจอง *
              </label>
              <select
                name="room_id"
                required
                value={form.room_id}
                onChange={handleChange}
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  วันที่ใช้งาน *
                </label>
                <input
                  type="date"
                  name="booking_date"
                  required
                  value={form.booking_date}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-pink-500 outline-none transition"
                />
              </div>

              {/* ช่องเลือกเวลาเริ่ม (Custom Time Picker 24 Hrs) */}
              <div className="relative" ref={startPickerRef}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  เวลาเริ่ม * (00:00 - 23:59)
                </label>
                <div
                  onClick={() => setShowStartPicker(!showStartPicker)}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm text-gray-900 bg-white cursor-pointer flex justify-between items-center focus:ring-2 focus:ring-pink-500 transition"
                >
                  <span>{form.start_time ? `${form.start_time} น.` : 'เลือกเวลาเริ่ม'}</span>
                  <span className="text-gray-400">🕒</span>
                </div>

                {showStartPicker && (
                  <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl p-3 flex gap-2">
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-gray-500 mb-1 text-center">ชั่วโมง</div>
                      <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                        {hoursList.map((h) => (
                          <div
                            key={h}
                            onClick={() => handleSetStartTime(h, selectedStartMin)}
                            className={`p-1.5 text-center text-sm rounded cursor-pointer transition ${
                              selectedStartHour === h ? 'bg-pink-600 text-white font-bold' : 'hover:bg-gray-100 text-gray-800'
                            }`}
                          >
                            {h}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-gray-500 mb-1 text-center">นาที</div>
                      <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                        {minutesList.map((m) => (
                          <div
                            key={m}
                            onClick={() => handleSetStartTime(selectedStartHour, m)}
                            className={`p-1.5 text-center text-sm rounded cursor-pointer transition ${
                              selectedStartMin === m ? 'bg-pink-600 text-white font-bold' : 'hover:bg-gray-100 text-gray-800'
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

              {/* ช่องเลือกเวลาสิ้นสุด (Custom Time Picker 24 Hrs) */}
              <div className="relative" ref={endPickerRef}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  เวลาสิ้นสุด * (00:00 - 23:59)
                </label>
                <div
                  onClick={() => setShowEndPicker(!showEndPicker)}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm text-gray-900 bg-white cursor-pointer flex justify-between items-center focus:ring-2 focus:ring-pink-500 transition"
                >
                  <span>{form.end_time ? `${form.end_time} น.` : 'เลือกเวลาสิ้นสุด'}</span>
                  <span className="text-gray-400">🕒</span>
                </div>

                {showEndPicker && (
                  <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl p-3 flex gap-2">
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-gray-500 mb-1 text-center">ชั่วโมง</div>
                      <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                        {hoursList.map((h) => (
                          <div
                            key={h}
                            onClick={() => handleSetEndTime(h, selectedEndMin)}
                            className={`p-1.5 text-center text-sm rounded cursor-pointer transition ${
                              selectedEndHour === h ? 'bg-pink-600 text-white font-bold' : 'hover:bg-gray-100 text-gray-800'
                            }`}
                          >
                            {h}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-gray-500 mb-1 text-center">นาที</div>
                      <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                        {minutesList.map((m) => (
                          <div
                            key={m}
                            onClick={() => handleSetEndTime(selectedEndHour, m)}
                            className={`p-1.5 text-center text-sm rounded cursor-pointer transition ${
                              selectedEndMin === m ? 'bg-pink-600 text-white font-bold' : 'hover:bg-gray-100 text-gray-800'
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                วัตถุประสงค์การใช้งาน
              </label>
              <textarea
                name="purpose"
                rows={3}
                value={form.purpose}
                onChange={handleChange}
                placeholder="อบรมเชิงปฏิบัติการ, จัดประชุมกลุ่มสาระ..."
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm text-gray-900 bg-white placeholder-gray-400 focus:ring-2 focus:ring-pink-500 outline-none transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-pink-500 hover:from-blue-700 hover:to-pink-600 text-white font-bold py-3.5 rounded-xl transition duration-200 shadow-lg shadow-pink-500/20 disabled:opacity-50 mt-4"
            >
              {loading ? 'กำลังส่งคำขอ...' : 'ส่งคำขอจองห้อง'}
            </button>
          </form>
        </div>

        <CalendarView filterType="BOOKING" />
      </div>
    </main>
  )
}