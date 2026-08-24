'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import CalendarView from '@/components/CalendarView'

interface Resource {
  id: number
  name: string
  available_quantity: number
}

interface BorrowForm {
  requester_name: string
  position: string
  requester_department: string
  resource_id: string
  quantity: number
  borrow_date: string
  return_date: string
  purpose: string
}

const INITIAL_FORM_STATE: BorrowForm = {
  requester_name: '',
  position: 'ครู',
  requester_department: '',
  resource_id: '',
  quantity: 1,
  borrow_date: '',
  return_date: '',
  purpose: '',
}

export default function BorrowPage() {
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<BorrowForm>(INITIAL_FORM_STATE)

  useEffect(() => {
    const fetchResources = async () => {
      const { data, error } = await supabase.from('resources').select('*')
      if (error) {
        console.error('Error fetching resources:', error.message)
      } else {
        setResources(data || [])
      }
    }
    fetchResources()
  }, [])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.resource_id) {
      alert('กรุณาเลือกอุปกรณ์ที่ต้องการยืม')
      return
    }

    const selectedResource = resources.find(
      (r) => r.id === Number(form.resource_id)
    )

    if (selectedResource && Number(form.quantity) > selectedResource.available_quantity) {
      alert(`อุปกรณ์นี้มีคงเหลือเพียง ${selectedResource.available_quantity} ชิ้น`)
      return
    }

    if (new Date(form.return_date) < new Date(form.borrow_date)) {
      alert('กำหนดวันคืนต้องไม่เป็นวันที่ก่อนวันยืมอุปกรณ์')
      return
    }

    setLoading(true)

    const payload = {
      requester_name: form.requester_name,
      position: form.position,
      student_id: null,
      requester_department: form.requester_department,
      resource_id: Number(form.resource_id),
      quantity: Number(form.quantity),
      borrow_date: form.borrow_date,
      return_date: form.return_date,
      purpose: form.purpose,
      status: 'PENDING',
    }

    const { error } = await supabase.from('borrow_requests').insert([payload])

    setLoading(false)

    if (error) {
      alert('เกิดข้อผิดพลาดในการส่งคำขอ: ' + error.message)
    } else {
      alert('ส่งคำขอยืมอุปกรณ์เรียบร้อยแล้ว! รอการอนุมัติจาก Admin')
      setForm(INITIAL_FORM_STATE)
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

        {/* ฟอร์มขอยืมอุปกรณ์ */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">📦</span>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                แบบฟอร์มขอยืมอุปกรณ์
              </h1>
              <p className="text-xs text-gray-500">
                โรงเรียนอุตรดิตถ์ - สำหรับครูและบุคลากร
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
                เลือกอุปกรณ์ที่ต้องการยืม *
              </label>
              <select
                name="resource_id"
                required
                value={form.resource_id}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="" className="text-gray-500">
                  -- เลือกอุปกรณ์ --
                </option>
                {resources.map((item) => (
                  <option key={item.id} value={item.id} className="text-gray-900">
                    {item.name} (คงเหลือในคลัง: {item.available_quantity} ชิ้น)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  จำนวนที่ยืม *
                </label>
                <input
                  type="number"
                  name="quantity"
                  min="1"
                  required
                  value={form.quantity}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  วันที่ยืม *
                </label>
                <input
                  type="date"
                  name="borrow_date"
                  required
                  value={form.borrow_date}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  กำหนดคืน *
                </label>
                <input
                  type="date"
                  name="return_date"
                  required
                  value={form.return_date}
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
                placeholder="ใช้ในการจัดการเรียนการสอน รายวิชา..."
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm text-gray-900 bg-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition duration-200 shadow-md disabled:opacity-50 mt-4"
            >
              {loading ? 'กำลังส่งข้อมูล...' : 'ส่งคำขอยืมอุปกรณ์'}
            </button>
          </form>
        </div>

        {/* ปฏิทินแสดงตารางการยืมอุปกรณ์อย่างเดียว */}
        <CalendarView filterType="BORROW" />
      </div>
    </main>
  )
}