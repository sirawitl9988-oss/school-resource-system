'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

export default function MaintenancePage() {
  const [reportType, setReportType] = useState<'EQUIPMENT' | 'ROOM_ITEM'>('EQUIPMENT')
  const [resources, setResources] = useState<any[]>([])
  const [rooms, setRooms] = useState<any[]>([])
  const [file, setFile] = useState<File | null>(null)
  
  const [formData, setFormData] = useState({
    target_id: '',
    title: '',
    description: '',
    reporter_name: '',
    reporter_department: '',
    email: '',
  })
  
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      const { data: resData } = await supabase.from('resources').select('id, name')
      const { data: roomData } = await supabase.from('rooms').select('id, name, building')
      if (resData) setResources(resData)
      if (roomData) setRooms(roomData)
    }
    loadData()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.target_id || !formData.title || !formData.reporter_name) {
      alert('กรุณากรอกข้อมูลสำคัญให้ครบถ้วน')
      return
    }

    if (!formData.email || !formData.email.includes('@')) {
      alert('กรุณากรอกอีเมลให้ถูกต้องเพื่อรับแจ้งเตือนสถานะ')
      return
    }

    setSubmitting(true)
    try {
      let imageUrl = null

      // อัปโหลดรูปภาพเข้า Supabase Storage (ถ้ามีการแนบไฟล์)
      if (file) {
        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}_${Math.random()}.${fileExt}`
        const filePath = `reports/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('maintenance-images')
          .upload(filePath, file)

        if (uploadError) throw uploadError

        // ดึง Public URL ของรูปที่อัปโหลด
        const { data: publicUrlData } = supabase.storage
          .from('maintenance-images')
          .getPublicUrl(filePath)
        
        imageUrl = publicUrlData.publicUrl
      }

      // บันทึกข้อมูลลง Database
      const { data, error } = await supabase
        .from('maintenance_requests')
        .insert([
          {
            type: reportType,
            item_type: reportType === 'EQUIPMENT' ? 'RESOURCE' : 'ROOM',
            target_id: Number(formData.target_id),
            title: formData.title.trim(),
            description: formData.description ? formData.description.trim() : null,
            reporter_name: formData.reporter_name.trim(),
            reporter_department: formData.reporter_department ? formData.reporter_department.trim() : null,
            reporter_email: formData.email.trim(),
            image_url: imageUrl,
            status: 'PENDING',
          },
        ])
        .select()

      if (error) throw error

      if (data && data.length > 0) {
        // ค้นหาชื่อของอุปกรณ์หรือห้อง
        let targetName = ''
        const targetIdNum = Number(formData.target_id)
        if (reportType === 'EQUIPMENT') {
          const resObj = resources.find((r) => r.id === targetIdNum)
          targetName = resObj ? resObj.name : `อุปกรณ์รหัส ${targetIdNum}`
        } else {
          const roomObj = rooms.find((rm) => rm.id === targetIdNum)
          targetName = roomObj ? `${roomObj.name}${roomObj.building ? ` (${roomObj.building})` : ''}` : `ห้องรหัส ${targetIdNum}`
        }

        // ส่งอีเมลแจ้งเตือน
        try {
          await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: `รายการแจ้งซ่อมใหม่: ${formData.title.trim()}`,
              requesterName: formData.reporter_name.trim(),
              requesterEmail: formData.email.trim(),
              department: formData.reporter_department ? formData.reporter_department.trim() : 'ไม่ได้ระบุ',
              details: `ประเภท: ${reportType === 'EQUIPMENT' ? 'อุปกรณ์' : 'ของชำรุดในห้อง'} | เป้าหมาย: ${targetName} | อาการ/ปัญหา: ${formData.title.trim()} | รายละเอียด: ${formData.description ? formData.description.trim() : 'ไม่ได้ระบุ'}`,
            }),
          })
        } catch (emailErr) {
          console.error('Failed to send email notification:', emailErr)
        }

        alert('✅ บันทึกการแจ้งซ่อม/แจ้งชำรุดเรียบร้อยแล้ว! ระบบจะแจ้งเตือนผ่านอีเมลเมื่อมีการอัปเดตสถานะ')
        setFormData({ target_id: '', title: '', description: '', reporter_name: '', reporter_department: '', email: '' })
        setFile(null)
      } else {
        alert('⚠️ บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
      }
    } catch (err: unknown) {
      const error = err as Error
      alert('เกิดข้อผิดพลาด: ' + (error.message || 'Error'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4 flex justify-center items-center">
      <div className="max-w-xl w-full space-y-6">
        <Link
          href="/"
          className="inline-flex items-center text-sm text-gray-600 hover:text-pink-600 font-medium transition"
        >
          ← กลับสู่หน้าหลัก โรงเรียนอุตรดิตถ์
        </Link>

        <div className="bg-white rounded-2xl shadow-sm border border-pink-100 p-6 md:p-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="w-12 h-12 bg-gradient-to-tr from-blue-600 to-pink-500 rounded-xl flex items-center justify-center text-2xl shadow-md shadow-pink-500/20 text-white">
              🛠️
            </span>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-800">
                แจ้งซ่อม / แจ้งสิ่งของชำรุด
              </h1>
              <p className="text-xs text-gray-500">
                แจ้งเปลี่ยนอุปกรณ์ หรือแจ้งสิ่งของเสียหายภายในห้องเรียน/ห้องประชุม
              </p>
            </div>
          </div>

          <hr className="my-5 border-gray-100" />

          {/* เลือกประเภทการแจ้ง */}
          <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => { setReportType('EQUIPMENT'); setFormData({ ...formData, target_id: '' }) }}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition ${
                reportType === 'EQUIPMENT' ? 'bg-white shadow-sm text-pink-600' : 'text-gray-500'
              }`}
            >
              📦 เปลี่ยน/ซ่อม อุปกรณ์
            </button>
            <button
              type="button"
              onClick={() => { setReportType('ROOM_ITEM'); setFormData({ ...formData, target_id: '' }) }}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition ${
                reportType === 'ROOM_ITEM' ? 'bg-white shadow-sm text-pink-600' : 'text-gray-500'
              }`}
            >
              🏫 ของชำรุดในห้อง
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-sm">
            {/* เลือก อุปกรณ์ หรือ ห้อง */}
            <div>
              <label className="block font-medium text-gray-700 mb-1">
                {reportType === 'EQUIPMENT' ? 'เลือกอุปกรณ์ที่ต้องการแจ้ง' : 'เลือกห้องพบสิ่งของชำรุด'} *
              </label>
              <select
                required
                value={formData.target_id}
                onChange={(e) => setFormData({ ...formData, target_id: e.target.value })}
                className="w-full border border-gray-300 rounded-lg p-2.5 bg-white text-gray-900 focus:ring-2 focus:ring-pink-500 outline-none transition"
              >
                <option value="" className="text-gray-500">-- กรุณาเลือก --</option>
                {reportType === 'EQUIPMENT'
                  ? resources.map((r) => <option key={r.id} value={r.id} className="text-gray-900">{r.name}</option>)
                  : rooms.map((rm) => <option key={rm.id} value={rm.id} className="text-gray-900">{rm.name} ({rm.building || 'ไม่ระบุอาคาร'})</option>
                )}
              </select>
            </div>

            {/* หัวข้อปัญหา */}
            <div>
              <label className="block font-medium text-gray-700 mb-1">
                {reportType === 'EQUIPMENT' ? 'อาการเสีย / สาเหตุที่ขอเปลี่ยน' : 'รายการสิ่งของที่ชำรุด'} *
              </label>
              <input
                type="text"
                required
                placeholder={reportType === 'EQUIPMENT' ? 'เช่น สาย HDMI ขาด, เปิดไม่ติด' : 'เช่น รีโมตแอร์เสีย, หลอดไฟพัง'}
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full border border-gray-300 rounded-lg p-2.5 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-pink-500 outline-none transition"
              />
            </div>

            {/* รายละเอียดเพิ่มเติม */}
            <div>
              <label className="block font-medium text-gray-700 mb-1">รายละเอียดเพิ่มเติม</label>
              <textarea
                rows={3}
                placeholder="ระบุตำแหน่งที่ตั้ง หรือรายละเอียดเพิ่มเติม (ถ้ามี)"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full border border-gray-300 rounded-lg p-2.5 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-pink-500 outline-none transition"
              />
            </div>

            {/* แนบรูปภาพประกอบ */}
            <div>
              <label className="block font-medium text-gray-700 mb-1">📷 แนบรูปถ่ายจุดชำรุด/สายเสีย (ถ้ามี)</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full border border-gray-300 rounded-lg p-2 text-gray-700 bg-gray-50 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-pink-50 file:text-pink-700 hover:file:bg-pink-100 transition"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-gray-700 mb-1">ชื่อผู้แจ้ง *</label>
                <input
                  type="text"
                  required
                  placeholder="ชื่อ-นามสกุล"
                  value={formData.reporter_name}
                  onChange={(e) => setFormData({ ...formData, reporter_name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-pink-500 outline-none transition"
                />
              </div>
              <div>
                <label className="block font-medium text-gray-700 mb-1">หน่วยงาน/สังกัด</label>
                <input
                  type="text"
                  placeholder="เช่น กลุ่มสาระ..."
                  value={formData.reporter_department}
                  onChange={(e) => setFormData({ ...formData, reporter_department: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-pink-500 outline-none transition"
                />
              </div>
            </div>

            {/* ช่องกรอกอีเมล */}
            <div>
              <label className="block font-medium text-gray-700 mb-1">อีเมลผู้แจ้ง (สำหรับรับแจ้งเตือนสถานะ) *</label>
              <input
                type="email"
                required
                placeholder="example@ut.ac.th"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full border border-gray-300 rounded-lg p-2.5 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-pink-500 outline-none transition"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-4 bg-gradient-to-r from-blue-600 to-pink-500 hover:from-blue-700 hover:to-pink-600 text-white font-semibold py-3 rounded-xl transition duration-200 shadow-lg shadow-pink-500/20 disabled:opacity-50"
            >
              {submitting ? 'กำลังอัปโหลดและส่งข้อมูล...' : 'ส่งรายการแจ้งซ่อม'}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}