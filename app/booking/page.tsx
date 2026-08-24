'use client'

import { useEffect, useState } from 'react'
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
  }, [])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  // ฟังก์ชันแปลงรูปแบบเวลาเป็น HH.MM
  const formatTimeText = (timeStr: string) => {
    if (!timeStr) return ''
    const [hours, minutes] = timeStr.split(':')
    return `${hours}.${minutes}`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.room_id) {
      alert('กรุณาเลือกห้องที่ต้องการจอง')
      return
    }

    if (form.start_time >= form.end_time) {
      alert('เวลาสิ้นสุดต้องมาหลังเวลาเริ่มใช้งาน')
      return
    }

    setLoading(true)

    try {
      const selectedRoomId = Number(form.room_id)

      // 1. 🔍 เช็กการจองซ้ำ/เวลาชน ในฐานข้อมูล
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

      // 2. 📝 บันทึกข้อมูลคำขอจอง
      const payload = {
        requester_name: form.requester_name.trim(),
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

      if (insertError) {
        throw insertError
      }

      if (data && data.length > 0) {
        alert('✅ ส่งคำขอจองห้องเรียบร้อยแล้ว! รอการอนุมัติจาก Admin')
        setForm(INITIAL_FORM_STATE)
      } else {
        alert('⚠️ บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
      }
    } catch (err: any) {
      console.error('Insert Error:', err)
      alert('เกิดข้อผิดพลาดในการส่งคำขอ: ' + (err.message || 'Error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <Link
          href="/"
          className="inline-flex items-center text-sm text-gray-600 hover:text-blue-600 font-medium transition"
        >
          ← กลับสู่หน้าหลัก โรงเรียนอุตรดิตถ์
        </Link>

        {/* ฟอร์มขอจองใช้งานห้อง */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">🏫</span>
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
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm text-gray-900 bg-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ตำแหน่ง *
                </label>
                <select
                  name="position"
                  value={form.position}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="ครู">ครู / อาจารย์</option>
                  <option value="หัวหน้ากลุ่มสาระ">หัวหน้ากลุ่มสาระ</option>
                  <option value="เจ้าหน้าที่">เจ้าหน้าที่บุคลากร</option>
                  <option value="ผู้บริหาร">ผู้บริหาร</option>
                </select>
              </div>
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
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm text-gray-900 bg-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 outline-none"
              />
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
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
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
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  เวลาเริ่ม * (00.00 - 23.59)
                </label>
                <input
                  type="time"
                  name="start_time"
                  min="00:00"
                  max="23:59"
                  step="60"
                  required
                  value={form.start_time}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  เวลาสิ้นสุด * (00.00 - 23.59)
                </label>
                <input
                  type="time"
                  name="end_time"
                  min="00:00"
                  max="23:59"
                  step="60"
                  required
                  value={form.end_time}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
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
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm text-gray-900 bg-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition duration-200 shadow-md disabled:opacity-50 mt-4"
            >
              {loading ? 'กำลังส่งคำขอ...' : 'ส่งคำขอจองห้อง'}
            </button>
          </form>
        </div>

        {/* ปฏิทินแสดงตารางการจองห้องอย่างเดียว */}
        <CalendarView filterType="BOOKING" />
      </div>
    </main>
  )
}