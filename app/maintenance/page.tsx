'use client'

import { useState, useEffect } from 'react'
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
      const { error } = await supabase.from('maintenance_requests').insert([
        {
          type: reportType,
          item_type: reportType === 'EQUIPMENT' ? 'RESOURCE' : 'ROOM',
          target_id: Number(formData.target_id),
          title: formData.title,
          description: formData.description,
          reporter_name: formData.reporter_name,
          reporter_department: formData.reporter_department,
          image_url: imageUrl,
          status: 'PENDING',
        },
      ])

      if (error) throw error

      alert('✅ บันทึกการแจ้งซ่อม/แจ้งชำรุดเรียบร้อยแล้ว!')
      setFormData({ target_id: '', title: '', description: '', reporter_name: '', reporter_department: '' })
      setFile(null)
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6 flex justify-center items-center">
      <div className="max-w-lg w-full bg-white rounded-xl shadow-md p-6">
        <h1 className="text-xl font-bold text-gray-800 mb-2">🛠️ แจ้งซ่อม / แจ้งสิ่งของชำรุด</h1>
        <p className="text-sm text-gray-500 mb-6">แจ้งเปลี่ยนอุปกรณ์ หรือแจ้งสิ่งของเสียหายภายในห้องเรียน/ห้องประชุม</p>

        {/* เลือกประเภทการแจ้ง */}
        <div className="flex bg-gray-100 p-1 rounded-lg mb-6">
          <button
            type="button"
            onClick={() => { setReportType('EQUIPMENT'); setFormData({ ...formData, target_id: '' }) }}
            className={`flex-1 py-2 text-sm font-semibold rounded-md transition ${
              reportType === 'EQUIPMENT' ? 'bg-white shadow text-blue-600' : 'text-gray-500'
            }`}
          >
            📦 เปลี่ยน/ซ่อม อุปกรณ์
          </button>
          <button
            type="button"
            onClick={() => { setReportType('ROOM_ITEM'); setFormData({ ...formData, target_id: '' }) }}
            className={`flex-1 py-2 text-sm font-semibold rounded-md transition ${
              reportType === 'ROOM_ITEM' ? 'bg-white shadow text-blue-600' : 'text-gray-500'
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
              className="w-full border rounded-lg p-2.5 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
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
              className="w-full border rounded-lg p-2.5 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
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
              className="w-full border rounded-lg p-2.5 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* แนบรูปภาพประกอบ */}
          <div>
            <label className="block font-medium text-gray-700 mb-1">📷 แนบรูปถ่ายจุดชำรุด/สายเสีย (ถ้ามี)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full border rounded-lg p-2 text-gray-700 bg-gray-50 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-gray-700 mb-1">ชื่อผู้แจ้ง *</label>
              <input
                type="text"
                required
                placeholder="ชื่อ-นามสกุล"
                value={formData.reporter_name}
                onChange={(e) => setFormData({ ...formData, reporter_name: e.target.value })}
                className="w-full border rounded-lg p-2.5 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block font-medium text-gray-700 mb-1">หน่วยงาน/สังกัด</label>
              <input
                type="text"
                placeholder="เช่น กลุ่มสาระ..."
                value={formData.reporter_department}
                onChange={(e) => setFormData({ ...formData, reporter_department: e.target.value })}
                className="w-full border rounded-lg p-2.5 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-50"
          >
            {submitting ? 'กำลังอัปโหลดและส่งข้อมูล...' : 'ส่งรายการแจ้งซ่อม'}
          </button>
        </form>
      </div>
    </main>
  )
}