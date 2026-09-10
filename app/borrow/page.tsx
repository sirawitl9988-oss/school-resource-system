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

interface BorrowItem {
  resource_id: string
  quantity: number
}

interface BorrowForm {
  requester_name: string
  position: string
  requester_department: string
  email: string
  items: BorrowItem[]
  borrow_date: string
  return_date: string
  purpose: string
}

const INITIAL_FORM_STATE: BorrowForm = {
  requester_name: '',
  position: 'ครู',
  requester_department: '',
  email: '',
  items: [{ resource_id: '', quantity: 1 }],
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

  // จัดการการเปลี่ยนค่าของอุปกรณ์ พร้อมเช็กไม่ให้เลือกซ้ำ
  const handleItemChange = (index: number, field: 'resource_id' | 'quantity', value: string | number) => {
    if (field === 'resource_id') {
      const isAlreadySelected = form.items.some(
        (item, i) => i !== index && item.resource_id === value && value !== ''
      )
      if (isAlreadySelected) {
        alert('❌ คุณได้เลือกอุปกรณ์นี้ไปแล้วในรายการอื่น กรุณาเพิ่มจำนวนในแถวเดิมแทน')
        return
      }
    }

    const updatedItems = [...form.items]
    updatedItems[index] = { ...updatedItems[index], [field]: value }
    setForm((prev) => ({ ...prev, items: updatedItems }))
  }

  // เพิ่มแถวอุปกรณ์
  const handleaddItem = () => {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { resource_id: '', quantity: 1 }],
    }))
  }

  // ลบแถวอุปกรณ์
  const handleRemoveItem = (index: number) => {
    if (form.items.length === 1) {
      alert('ต้องมีรายการอุปกรณ์อย่างน้อย 1 รายการ')
      return
    }
    const updatedItems = form.items.filter((_, i) => i !== index)
    setForm((prev) => ({ ...prev, items: updatedItems }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    for (const [index, item] of form.items.entries()) {
      if (!item.resource_id) {
        alert(`กรุณาเลือกอุปกรณ์ในรายการที่ ${index + 1}`)
        return
      }
      const selectedResource = resources.find((r) => r.id === Number(item.resource_id))
      if (selectedResource) {
        if (Number(item.quantity) > selectedResource.available_quantity) {
          alert(`❌ อุปกรณ์ "${selectedResource.name}" มีคงเหลือเพียง ${selectedResource.available_quantity} ชิ้นเท่านั้น ไม่สามารถยืมเกินจำนวนได้`)
          return
        }
      }
    }

    if (!form.email || !form.email.includes('@')) {
      alert('กรุณากรอกอีเมลให้ถูกต้องเพื่อรับแจ้งเตือนสถานะ')
      return
    }

    if (new Date(form.return_date) < new Date(form.borrow_date)) {
      alert('กำหนดวันคืนต้องไม่เป็นวันที่ก่อนวันยืมอุปกรณ์')
      return
    }

    setLoading(true)

    try {
      let successCount = 0
      const summaryDetails: string[] = []

      for (const item of form.items) {
        const selectedResource = resources.find((r) => r.id === Number(item.resource_id))
        const resourceName = selectedResource ? selectedResource.name : `อุปกรณ์รหัส ${item.resource_id}`

        const payload = {
          requester_name: form.requester_name.trim(),
          position: form.position,
          student_id: null,
          requester_department: form.requester_department.trim(),
          email: form.email.trim(),
          resource_id: Number(item.resource_id),
          quantity: Number(item.quantity),
          borrow_date: form.borrow_date,
          return_date: form.return_date,
          purpose: form.purpose ? form.purpose.trim() : null,
          status: 'PENDING',
        }

        const { data, error } = await supabase
          .from('borrow_requests')
          .insert([payload])
          .select()

        if (!error && data) {
          successCount++
          summaryDetails.push(`${resourceName} (${item.quantity} ชิ้น)`)
        }
      }

      if (successCount > 0) {
        try {
          await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: `คำขอยืมอุปกรณ์ใหม่ (${successCount} รายการ)`,
              requesterName: `${form.requester_name} (${form.position})`,
              requesterEmail: form.email.trim(),
              department: form.requester_department,
              details: `รายการอุปกรณ์: ${summaryDetails.join(', ')} | วันที่ยืม: ${form.borrow_date} | กำหนดคืน: ${form.return_date} | วัตถุประสงค์: ${form.purpose || 'ไม่ได้ระบุ'}`,
            }),
          })
        } catch (emailErr) {
          console.error('Failed to send email notification:', emailErr)
        }

        alert('✅ ส่งคำขอยืมอุปกรณ์เรียบร้อยแล้ว! ระบบจะแจ้งเตือนผ่านอีเมลเมื่อมีการอัปเดตสถานะ')
        setForm(INITIAL_FORM_STATE)
      } else {
        alert('⚠️ บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
      }
    } catch (err: unknown) {
      const error = err as Error
      console.error('Insert Error:', error)
      alert('เกิดข้อผิดพลาดในการส่งคำขอ: ' + (error.message || 'Error'))
    } finally {
      setLoading(false)
    }
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

        {/* ฟอร์มขอยืมอุปกรณ์ */}
        <div className="bg-white rounded-2xl shadow-sm border border-pink-100 p-6 md:p-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="w-12 h-12 bg-gradient-to-tr from-blue-600 to-pink-500 rounded-xl flex items-center justify-center text-2xl shadow-md shadow-pink-500/20 text-white">
              📦
            </span>
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
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm text-gray-900 bg-white placeholder-gray-400 focus:ring-2 focus:ring-pink-500 outline-none transition"
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
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-pink-500 outline-none transition"
                >
                  <option value="ครู">ครู / อาจารย์</option>
                  <option value="หัวหน้ากลุ่มสาระ">หัวหน้ากลุ่มสาระ</option>
                  <option value="เจ้าหน้าที่">เจ้าหน้าที่บุคลากร</option>
                  <option value="ผู้บริหาร">ผู้บริหาร</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  อีเมล (สำหรับรับแจ้งเตือนสถานะ) *
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  value={form.email}
                  onChange={handleChange}
                  placeholder="somchai@ut.ac.th"
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm text-gray-900 bg-white placeholder-gray-400 focus:ring-2 focus:ring-pink-500 outline-none transition"
                />
              </div>
            </div>

            <hr className="my-4 border-gray-100" />

            {/* ส่วนเลือกอุปกรณ์พร้อมปุ่มเพิ่มรายการ */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="block text-sm font-medium text-gray-700">
                  รายการอุปกรณ์ที่ต้องการยืม *
                </label>
                <button
                  type="button"
                  onClick={handleaddItem}
                  className="text-xs bg-pink-50 text-pink-600 hover:bg-pink-100 font-semibold px-3 py-1.5 rounded-lg border border-pink-200 transition flex items-center gap-1"
                >
                  ➕ เพิ่มรายการอุปกรณ์
                </button>
              </div>

              {form.items.map((item, index) => {
                const selectedRes = resources.find((r) => r.id === Number(item.resource_id))
                const maxQty = selectedRes ? selectedRes.available_quantity : 999

                return (
                  <div key={index} className="flex gap-2 items-center bg-gray-50 p-3 rounded-xl border border-gray-200">
                    <div className="flex-1">
                      <select
                        required
                        value={item.resource_id}
                        onChange={(e) => handleItemChange(index, 'resource_id', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-pink-500 outline-none transition"
                      >
                        <option value="" className="text-gray-500">
                          -- เลือกอุปกรณ์ --
                        </option>
                        {resources.map((res) => {
                          const isPickedElsewhere = form.items.some(
                            (otherItem, otherIdx) => otherIdx !== index && otherItem.resource_id === String(res.id)
                          )
                          return (
                            <option key={res.id} value={res.id} disabled={isPickedElsewhere} className="text-gray-900">
                              {res.name} (คงเหลือ: {res.available_quantity} ชิ้น) {isPickedElsewhere ? ' - (เลือกไปแล้ว)' : ''}
                            </option>
                          )
                        })}
                      </select>
                    </div>

                    <div className="w-32">
                      <input
                        type="number"
                        min="1"
                        max={maxQty}
                        required
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', Number(e.target.value))}
                        placeholder="จำนวน"
                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-pink-500 outline-none transition"
                      />
                    </div>

                    {form.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="bg-red-50 hover:bg-red-100 text-red-600 p-2.5 rounded-lg transition text-sm"
                        title="ลบรายการนี้"
                      >
                        ❌
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
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
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-pink-500 outline-none transition"
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
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-pink-500 outline-none transition"
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
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm text-gray-900 bg-white placeholder-gray-400 focus:ring-2 focus:ring-pink-500 outline-none transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-pink-500 hover:from-blue-700 hover:to-pink-600 text-white font-bold py-3.5 rounded-xl transition duration-200 shadow-lg shadow-pink-500/20 disabled:opacity-50 mt-4"
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