'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

interface ItemRow {
  target_id: string
  asset_code: string
  brand: string
  model: string
  serial_number: string
  accessories: string
  title: string
  description: string
  quantity: number
}

interface RoomItemDetailRow {
  name: string
  asset_code: string
  brand: string
  model: string
  serial_number: string
  title: string
  description: string
  quantity: number
}

export default function MaintenancePage() {
  const [reportType, setReportType] = useState<'EQUIPMENT' | 'ROOM_ITEM'>('EQUIPMENT')
  const [resources, setResources] = useState<any[]>([])
  const [rooms, setRooms] = useState<any[]>([])
  const [file, setFile] = useState<File | null>(null)
  
  // ฟอร์มเปลี่ยน/ซ่อม อุปกรณ์
  const [equipmentForm, setEquipmentForm] = useState({
    items: [
      { target_id: '', asset_code: '', brand: '', model: '', serial_number: '', accessories: '', title: '', description: '', quantity: 1 }
    ] as ItemRow[],
  })

  // ฟอร์มของชำรุดในห้อง
  const [roomForm, setRoomForm] = useState({
    target_id: '',
    room_items: [
      { name: '', asset_code: '', brand: '', model: '', serial_number: '', title: '', description: '', quantity: 1 }
    ] as RoomItemDetailRow[],
  })

  // ข้อมูลผู้แจ้ง
  const [reporter, setReporter] = useState({
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

  // ฟังก์ชันจัดการรายการอุปกรณ์
  const handleAddEquipmentItem = () => {
    setEquipmentForm((prev) => ({
      ...prev,
      items: [...prev.items, { target_id: '', asset_code: '', brand: '', model: '', serial_number: '', accessories: '', title: '', description: '', quantity: 1 }]
    }))
  }

  const handleEquipmentItemChange = (index: number, field: keyof ItemRow, value: string | number) => {
    const updated = [...equipmentForm.items]
    updated[index] = { ...updated[index], [field]: value }
    setEquipmentForm((prev) => ({ ...prev, items: updated }))
  }

  const handleRemoveEquipmentItem = (index: number) => {
    if (equipmentForm.items.length === 1) return
    const updated = equipmentForm.items.filter((_, i) => i !== index)
    setEquipmentForm((prev) => ({ ...prev, items: updated }))
  }

  // ฟังก์ชันจัดการรายการของชำรุดในห้อง
  const handleAddRoomItem = () => {
    setRoomForm((prev) => ({
      ...prev,
      room_items: [...prev.room_items, { name: '', asset_code: '', brand: '', model: '', serial_number: '', title: '', description: '', quantity: 1 }]
    }))
  }

  const handleRoomItemChange = (index: number, field: keyof RoomItemDetailRow, value: string | number) => {
    const updated = [...roomForm.room_items]
    updated[index] = { ...updated[index], [field]: value }
    setRoomForm((prev) => ({ ...prev, room_items: updated }))
  }

  const handleRemoveRoomItem = (index: number) => {
    if (roomForm.room_items.length === 1) return
    const updated = roomForm.room_items.filter((_, i) => i !== index)
    setRoomForm((prev) => ({ ...prev, room_items: updated }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!reporter.reporter_name || !reporter.email) {
      alert('กรุณากรอกชื่อผู้แจ้งและอีเมลให้ครบถ้วน')
      return
    }

    if (!reporter.email.includes('@')) {
      alert('กรุณากรอกอีเมลให้ถูกต้องเพื่อรับแจ้งเตือนสถานะ')
      return
    }

    if (reportType === 'EQUIPMENT' && equipmentForm.items.some(i => !i.target_id || !i.title)) {
      alert('กรุณาเลือกอุปกรณ์และระบุอาการชำรุดให้ครบทุกรายการ')
      return
    }

    if (reportType === 'ROOM_ITEM' && (!roomForm.target_id || roomForm.room_items.some(i => !i.name || !i.title))) {
      alert('กรุณาเลือกห้อง ระบุชื่อสิ่งของ และระบุลักษณะอาการชำรุดให้ครบทุกรายการ')
      return
    }

    setSubmitting(true)
    try {
      let imageUrl = null

      if (file) {
        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}_${Math.random()}.${fileExt}`
        const filePath = `reports/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('maintenance-images')
          .upload(filePath, file)

        if (uploadError) throw uploadError

        const { data: publicUrlData } = supabase.storage
          .from('maintenance-images')
          .getPublicUrl(filePath)
        
        imageUrl = publicUrlData.publicUrl
      }

      let payloadTitle = ''
      let payloadDescription = ''
      let targetIdNum = 0
      let targetName = ''

      if (reportType === 'EQUIPMENT') {
        targetIdNum = Number(equipmentForm.items[0]?.target_id || 0)
        const itemsSummary = equipmentForm.items.map((i, idx) => {
          const resObj = resources.find(r => r.id === Number(i.target_id))
          return `[รายการที่ ${idx + 1}] อุปกรณ์: ${resObj?.name || 'ไม่ระบุ'} | จำนวน: ${i.quantity} | อาการ: ${i.title} | ครุภัณฑ์: ${i.asset_code || '-'} | ยี่ห้อ/รุ่น: ${i.brand || '-'} ${i.model || '-'} | S/N: ${i.serial_number || '-'} | อุปกรณ์ประกอบ: ${i.accessories || '-'} | รายละเอียด/ตำแหน่ง: ${i.description || '-'}`
        }).join('\n')

        payloadTitle = `แจ้งซ่อมอุปกรณ์: ${equipmentForm.items[0]?.title || 'หลายรายการ'}`
        payloadDescription = `
รายการอุปกรณ์ที่แจ้งซ่อม:
${itemsSummary}
        `.trim()
      } else {
        targetIdNum = Number(roomForm.target_id)
        const roomObj = rooms.find((rm) => rm.id === targetIdNum)
        targetName = roomObj ? `${roomObj.name}${roomObj.building ? ` (${roomObj.building})` : ''}` : `ห้องรหัส ${targetIdNum}`
        
        const itemsSummary = roomForm.room_items.map((i, idx) => {
          return `[รายการที่ ${idx + 1}] สิ่งของ: ${i.name} | จำนวน: ${i.quantity} | อาการ: ${i.title} | ครุภัณฑ์: ${i.asset_code || '-'} | ยี่ห้อ/รุ่น: ${i.brand || '-'} ${i.model || '-'} | S/N: ${i.serial_number || '-'} | รายละเอียด/ตำแหน่ง: ${i.description || '-'}`
        }).join('\n')

        payloadTitle = `แจ้งของชำรุดในห้อง: ${roomForm.room_items[0]?.name || 'หลายรายการ'}`
        payloadDescription = `
สถานที่: ${targetName}
รายการสิ่งของชำรุด:
${itemsSummary}
        `.trim()
      }

      const { data, error } = await supabase
        .from('maintenance_requests')
        .insert([
          {
            type: reportType,
            item_type: reportType === 'EQUIPMENT' ? 'RESOURCE' : 'ROOM',
            target_id: targetIdNum,
            title: payloadTitle,
            description: payloadDescription,
            reporter_name: reporter.reporter_name.trim(),
            reporter_department: reporter.reporter_department ? reporter.reporter_department.trim() : null,
            reporter_email: reporter.email.trim(),
            image_url: imageUrl,
            status: 'PENDING',
          },
        ])
        .select()

      if (error) throw error

      if (data && data.length > 0) {
        try {
          await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: `รายการแจ้งซ่อมใหม่: ${payloadTitle}`,
              requesterName: reporter.reporter_name.trim(),
              requesterEmail: reporter.email.trim(),
              department: reporter.reporter_department ? reporter.reporter_department.trim() : 'ไม่ได้ระบุ',
              details: `ประเภท: ${reportType === 'EQUIPMENT' ? 'อุปกรณ์' : 'ของชำรุดในห้อง'} | รายละเอียด: ${payloadDescription}`,
            }),
          })
        } catch (emailErr) {
          console.error('Failed to send email notification:', emailErr)
        }

        alert('✅ บันทึกการแจ้งซ่อมเรียบร้อยแล้ว!')
        setEquipmentForm({ items: [{ target_id: '', asset_code: '', brand: '', model: '', serial_number: '', accessories: '', title: '', description: '', quantity: 1 }] })
        setRoomForm({ target_id: '', room_items: [{ name: '', asset_code: '', brand: '', model: '', serial_number: '', title: '', description: '', quantity: 1 }] })
        setReporter({ reporter_name: '', reporter_department: '', email: '' })
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

          {/* สลับแท็บ */}
          <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => setReportType('EQUIPMENT')}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition ${
                reportType === 'EQUIPMENT' ? 'bg-white shadow-sm text-pink-600' : 'text-gray-500'
              }`}
            >
              📦 เปลี่ยน/ซ่อม อุปกรณ์
            </button>
            <button
              type="button"
              onClick={() => setReportType('ROOM_ITEM')}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition ${
                reportType === 'ROOM_ITEM' ? 'bg-white shadow-sm text-pink-600' : 'text-gray-500'
              }`}
            >
              🏫 ของชำรุดในห้อง
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-sm">
            {reportType === 'EQUIPMENT' ? (
              /* ฟอร์มเปลี่ยน/ซ่อม อุปกรณ์ */
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="block font-medium text-gray-700">รายการอุปกรณ์ที่ต้องการแจ้ง *</label>
                  <button
                    type="button"
                    onClick={handleAddEquipmentItem}
                    className="text-xs bg-pink-50 text-pink-600 font-semibold px-2.5 py-1 rounded-lg border border-pink-200 hover:bg-pink-100"
                  >
                    ➕ เพิ่มอุปกรณ์
                  </button>
                </div>

                {equipmentForm.items.map((item, idx) => (
                  <div key={idx} className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-200 relative">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-pink-600">รายการที่ {idx + 1}</span>
                      {equipmentForm.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveEquipmentItem(idx)}
                          className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded-md hover:bg-red-100"
                        >
                          ✕ ลบรายการนี้
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">เลือกอุปกรณ์ *</label>
                        <select
                          required
                          value={item.target_id}
                          onChange={(e) => handleEquipmentItemChange(idx, 'target_id', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg p-2 bg-white text-xs text-gray-900"
                        >
                          <option value="">-- กรุณาเลือก --</option>
                          {resources.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">จำนวน *</label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={item.quantity}
                          onChange={(e) => handleEquipmentItemChange(idx, 'quantity', Number(e.target.value))}
                          className="w-full border border-gray-300 rounded-lg p-2 bg-white text-xs text-gray-900 text-center"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">ลักษณะ/อาการที่ชำรุด (อย่างละเอียด) *</label>
                      <input
                        type="text"
                        required
                        placeholder="เช่น สาย HDMI ขาด, เปิดไม่ติด"
                        value={item.title}
                        onChange={(e) => handleEquipmentItemChange(idx, 'title', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg p-2 bg-white text-xs text-gray-900"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">รหัสครุภัณฑ์ (ถ้ามี)</label>
                        <input
                          type="text"
                          placeholder="เช่น UT-6500-001"
                          value={item.asset_code}
                          onChange={(e) => handleEquipmentItemChange(idx, 'asset_code', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg p-2 bg-white text-xs text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">ยี่ห้อ</label>
                        <input
                          type="text"
                          placeholder="เช่น Epson, Dell"
                          value={item.brand}
                          onChange={(e) => handleEquipmentItemChange(idx, 'brand', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg p-2 bg-white text-xs text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">รุ่น</label>
                        <input
                          type="text"
                          placeholder="เช่น EB-S41"
                          value={item.model}
                          onChange={(e) => handleEquipmentItemChange(idx, 'model', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg p-2 bg-white text-xs text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">หมายเลขเครื่อง (ถ้ามี)</label>
                        <input
                          type="text"
                          placeholder="Serial Number"
                          value={item.serial_number}
                          onChange={(e) => handleEquipmentItemChange(idx, 'serial_number', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg p-2 bg-white text-xs text-gray-900"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">อุปกรณ์ที่ส่งมาพร้อมครุภัณฑ์ (ถ้ามี)</label>
                        <input
                          type="text"
                          placeholder="เช่น สายไฟ, รีโมต, กระเป๋า"
                          value={item.accessories}
                          onChange={(e) => handleEquipmentItemChange(idx, 'accessories', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg p-2 bg-white text-xs text-gray-900"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">รายละเอียดเพิ่มเติม / ตำแหน่งที่ตั้ง ประจำรายการนี้</label>
                      <textarea
                        rows={2}
                        placeholder="ระบุตำแหน่งที่ตั้ง หรือรายละเอียดเพิ่มเติมเฉพาะชิ้นนี้ (ถ้ามี)"
                        value={item.description}
                        onChange={(e) => handleEquipmentItemChange(idx, 'description', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg p-2 bg-white text-xs text-gray-900 outline-none focus:ring-1 focus:ring-pink-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* ฟอร์มของชำรุดในห้อง */
              <div className="space-y-4">
                <div>
                  <label className="block font-medium text-gray-700 mb-1">เลือกห้องพบสิ่งของชำรุด *</label>
                  <select
                    required
                    value={roomForm.target_id}
                    onChange={(e) => setRoomForm({ ...roomForm, target_id: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2.5 bg-white text-gray-900 focus:ring-2 focus:ring-pink-500 outline-none"
                  >
                    <option value="" className="text-gray-500">-- กรุณาเลือกห้อง --</option>
                    {rooms.map((rm) => <option key={rm.id} value={rm.id} className="text-gray-900">{rm.name} ({rm.building || 'ไม่ระบุอาคาร'})</option>)}
                  </select>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="block font-medium text-gray-700">รายการสิ่งของที่ชำรุด *</label>
                    <button
                      type="button"
                      onClick={handleAddRoomItem}
                      className="text-xs bg-pink-50 text-pink-600 font-semibold px-2.5 py-1 rounded-lg border border-pink-200 hover:bg-pink-100"
                    >
                      ➕ เพิ่มรายการ
                    </button>
                  </div>

                  {roomForm.room_items.map((item, idx) => (
                    <div key={idx} className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-200 relative">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-pink-600">รายการที่ {idx + 1}</span>
                        {roomForm.room_items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveRoomItem(idx)}
                            className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded-md hover:bg-red-100"
                          >
                            ✕ ลบรายการนี้
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <div className="md:col-span-2">
                          <label className="block text-xs font-medium text-gray-700 mb-1">ชื่อสิ่งของชำรุด *</label>
                          <input
                            type="text"
                            required
                            placeholder="เช่น รีโมตแอร์, หลอดไฟพัง"
                            value={item.name}
                            onChange={(e) => handleRoomItemChange(idx, 'name', e.target.value)}
                            className="w-full border border-gray-300 rounded-lg p-2 bg-white text-xs text-gray-900"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">จำนวน *</label>
                          <input
                            type="number"
                            min="1"
                            required
                            value={item.quantity}
                            onChange={(e) => handleRoomItemChange(idx, 'quantity', Number(e.target.value))}
                            className="w-full border border-gray-300 rounded-lg p-2 bg-white text-xs text-gray-900 text-center"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">ลักษณะ/อาการที่ชำรุด (อย่างละเอียด) *</label>
                        <input
                          type="text"
                          required
                          placeholder="เช่น เปิดไม่ติด, กระพริบ, แตกหัก"
                          value={item.title}
                          onChange={(e) => handleRoomItemChange(idx, 'title', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg p-2 bg-white text-xs text-gray-900"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">รหัสครุภัณฑ์ (ถ้ามี)</label>
                          <input
                            type="text"
                            placeholder="เช่น UT-6500-001"
                            value={item.asset_code}
                            onChange={(e) => handleRoomItemChange(idx, 'asset_code', e.target.value)}
                            className="w-full border border-gray-300 rounded-lg p-2 bg-white text-xs text-gray-900"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">ยี่ห้อ</label>
                          <input
                            type="text"
                            placeholder="เช่น Panasonic, Philips"
                            value={item.brand}
                            onChange={(e) => handleRoomItemChange(idx, 'brand', e.target.value)}
                            className="w-full border border-gray-300 rounded-lg p-2 bg-white text-xs text-gray-900"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">รุ่น</label>
                          <input
                            type="text"
                            placeholder="รุ่นสิ่งของ"
                            value={item.model}
                            onChange={(e) => handleRoomItemChange(idx, 'model', e.target.value)}
                            className="w-full border border-gray-300 rounded-lg p-2 bg-white text-xs text-gray-900"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">หมายเลขเครื่อง (ถ้ามี)</label>
                          <input
                            type="text"
                            placeholder="Serial Number"
                            value={item.serial_number}
                            onChange={(e) => handleRoomItemChange(idx, 'serial_number', e.target.value)}
                            className="w-full border border-gray-300 rounded-lg p-2 bg-white text-xs text-gray-900"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">รายละเอียดเพิ่มเติม / ตำแหน่งที่ตั้ง ประจำรายการนี้</label>
                        <textarea
                          rows={2}
                          placeholder="ระบุตำแหน่งที่ตั้ง เช่น แอร์ตัวซ้ายมือกระดาน, หลอดไฟแถวหน้าสุด"
                          value={item.description}
                          onChange={(e) => handleRoomItemChange(idx, 'description', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg p-2 bg-white text-xs text-gray-900 outline-none focus:ring-1 focus:ring-pink-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block font-medium text-gray-700 mb-1">📷 แนบรูปถ่ายจุดชำรุด/สายเสีย (ถ้ามี)</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full border border-gray-300 rounded-lg p-2 text-gray-700 bg-gray-50 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-pink-50 file:text-pink-700 hover:file:bg-pink-100 transition"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block font-medium text-gray-700 mb-1">ชื่อผู้แจ้ง *</label>
                <input
                  type="text"
                  required
                  placeholder="ชื่อ-นามสกุล"
                  value={reporter.reporter_name}
                  onChange={(e) => setReporter({ ...reporter, reporter_name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-pink-500 outline-none"
                />
              </div>
              <div>
                <label className="block font-medium text-gray-700 mb-1">หน่วยงาน/สังกัด</label>
                <input
                  type="text"
                  placeholder="เช่น กลุ่มสาระ..."
                  value={reporter.reporter_department}
                  onChange={(e) => setReporter({ ...reporter, reporter_department: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-pink-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-medium text-gray-700 mb-1">อีเมลผู้แจ้ง (สำหรับรับแจ้งเตือนสถานะ) *</label>
              <input
                type="email"
                required
                placeholder="example@ut.ac.th"
                value={reporter.email}
                onChange={(e) => setReporter({ ...reporter, email: e.target.value })}
                className="w-full border border-gray-300 rounded-lg p-2.5 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-pink-500 outline-none"
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