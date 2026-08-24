'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function AdminDashboard() {
  const router = useRouter()
  const [adminUser, setAdminUser] = useState<any>(null)

  const [activeTab, setActiveTab] = useState<'borrow' | 'booking' | 'maintenance'>('borrow')
  const [borrowRequests, setBorrowRequests] = useState<any[]>([])
  const [bookingRequests, setBookingRequests] = useState<any[]>([])
  const [maintenanceRequests, setMaintenanceRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  // ตรวจสอบ Login และโหลดข้อมูล
  useEffect(() => {
    const session = localStorage.getItem('adminSession')
    if (!session) {
      router.push('/admin/login')
    } else {
      setAdminUser(JSON.parse(session))
      fetchAllData()
    }
  }, [])

  const handleLogout = () => {
    if (confirm('คุณต้องการออกจากระบบหรือไม่?')) {
      localStorage.removeItem('adminSession')
      router.push('/admin/login')
    }
  }

  // ฟังก์ชันแปลง Date String เป็น วัน/เดือน/ปี เวลา น.
  const formatDateTime = (dateString: string) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleString('th-TH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }) + ' น.'
  }

  // 1. ดึงข้อมูลคำขอยืมอุปกรณ์
  const fetchBorrowRequests = async () => {
    try {
      const { data: borrowData, error: borrowError } = await supabase
        .from('borrow_requests')
        .select('*')
        .order('id', { ascending: false })

      if (borrowError) throw borrowError

      const { data: resourceData, error: resourceError } = await supabase
        .from('resources')
        .select('*')

      if (resourceError) throw resourceError

      const combined = (borrowData || []).map((req) => {
        const resItem = (resourceData || []).find((r) => r.id === Number(req.resource_id))
        return {
          ...req,
          resources: resItem || null,
        }
      })

      setBorrowRequests(combined)
    } catch (err: any) {
      console.error('Borrow Fetch Error:', err)
    }
  }

  // 2. ดึงข้อมูลคำขอจองห้อง
  const fetchBookingRequests = async () => {
    try {
      const { data: bookingData, error: bookingError } = await supabase
        .from('booking_requests')
        .select('*')
        .order('id', { ascending: false })

      if (bookingError) throw bookingError

      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*')

      if (roomError) throw roomError

      const combined = (bookingData || []).map((req) => {
        const roomItem = (roomData || []).find((r) => r.id === Number(req.room_id))
        return {
          ...req,
          rooms: roomItem || null,
        }
      })

      setBookingRequests(combined)
    } catch (err: any) {
      console.error('Booking Fetch Error:', err)
    }
  }

  // 3. ดึงข้อมูลการแจ้งซ่อม
  const fetchMaintenanceRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('maintenance_requests')
        .select('*')
        .order('id', { ascending: false })

      if (error) throw error
      setMaintenanceRequests(data || [])
    } catch (err: any) {
      console.error('Maintenance Fetch Error:', err)
    }
  }

  const fetchAllData = async () => {
    setLoading(true)
    await Promise.all([fetchBorrowRequests(), fetchBookingRequests(), fetchMaintenanceRequests()])
    setLoading(false)
  }

  // ==================== [จัดการคำขอยืมอุปกรณ์] ====================
  const handleApproveBorrow = async (req: any) => {
    const currentAvailable = req.resources?.available_quantity || 0

    if (currentAvailable < req.quantity) {
      alert(`ไม่สามารถอนุมัติได้! อุปกรณ์เหลือเพียง ${currentAvailable} ชิ้น แต่มีการยืม ${req.quantity} ชิ้น`)
      return
    }

    if (!confirm(`ยืนยันการอนุมัติการยืมอุปกรณ์ของ คุณ${req.requester_name}?`)) return

    setActionLoading(req.id)
    try {
      const { error: updateError } = await supabase
        .from('borrow_requests')
        .update({ status: 'APPROVED' })
        .eq('id', req.id)

      if (updateError) throw updateError

      const newQuantity = currentAvailable - req.quantity
      const { error: resourceError } = await supabase
        .from('resources')
        .update({ available_quantity: newQuantity })
        .eq('id', req.resource_id)

      if (resourceError) throw resourceError

      alert('✅ อนุมัติคำขอและตัดจำนวนอุปกรณ์เรียบร้อยแล้ว!')
      await fetchBorrowRequests()
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleReturnBorrow = async (req: any) => {
    if (!confirm(`ยืนยันรับคืนอุปกรณ์จาก คุณ${req.requester_name}?`)) return

    setActionLoading(req.id)
    try {
      const { error: updateError } = await supabase
        .from('borrow_requests')
        .update({ status: 'RETURNED' })
        .eq('id', req.id)

      if (updateError) throw updateError

      const currentAvailable = req.resources?.available_quantity || 0
      const newQuantity = currentAvailable + req.quantity

      const { error: resourceError } = await supabase
        .from('resources')
        .update({ available_quantity: newQuantity })
        .eq('id', req.resource_id)

      if (resourceError) throw resourceError

      alert('✅ รับคืนอุปกรณ์และคืนสต็อกเรียบร้อยแล้ว!')
      await fetchBorrowRequests()
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการคืนอุปกรณ์: ' + err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleRejectBorrow = async (id: number) => {
    if (!confirm('ยืนยันการปฏิเสธคำขอยืมอุปกรณ์นี้?')) return

    setActionLoading(id)
    try {
      const { error } = await supabase
        .from('borrow_requests')
        .update({ status: 'REJECTED' })
        .eq('id', id)

      if (error) throw error

      alert('ปฏิเสธคำขอเรียบร้อยแล้ว')
      await fetchBorrowRequests()
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message)
    } finally {
      setActionLoading(null)
    }
  }

  // ==================== [จัดการคำขอจองห้อง] ====================
  const handleApproveBooking = async (req: any) => {
    if (!confirm(`ยืนยันการอนุมัติการจองห้องของ คุณ${req.requester_name}?`)) return

    setActionLoading(req.id)
    try {
      const { error } = await supabase
        .from('booking_requests')
        .update({ status: 'APPROVED' })
        .eq('id', req.id)

      if (error) throw error

      alert('✅ อนุมัติการจองห้องเรียบร้อยแล้ว!')
      await fetchBookingRequests()
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleRejectBooking = async (id: number) => {
    if (!confirm('ยืนยันการปฏิเสธคำขอจองห้องนี้?')) return

    setActionLoading(id)
    try {
      const { error } = await supabase
        .from('booking_requests')
        .update({ status: 'REJECTED' })
        .eq('id', id)

      if (error) throw error

      alert('ปฏิเสธคำขอเรียบร้อยแล้ว')
      await fetchBookingRequests()
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message)
    } finally {
      setActionLoading(null)
    }
  }

  // ==================== [จัดการการแจ้งซ่อม] ====================
  const handleUpdateMaintenanceStatus = async (id: number, status: string) => {
    setActionLoading(id)
    try {
      const { error } = await supabase
        .from('maintenance_requests')
        .update({ status })
        .eq('id', id)

      if (error) throw error

      alert('✅ อัปเดตสถานะงานซ่อมเรียบร้อยแล้ว')
      await fetchMaintenanceRequests()
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message)
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-md p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">ระบบจัดการผู้ดูแล (Admin Dashboard)</h1>
            <p className="text-sm text-gray-500">จัดการการอนุมัติยืมอุปกรณ์ จองห้องประชุม และรายการแจ้งซ่อม</p>
          </div>

          <div className="flex items-center gap-3">
            {adminUser && (
              <span className="text-sm font-medium text-gray-600 bg-gray-100 px-3 py-2 rounded-lg border border-gray-200">
                👤 {adminUser.name} ({adminUser.username})
              </span>
            )}
            
            <button
              onClick={fetchAllData}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition text-sm font-medium"
            >
              🔄 รีเฟรชข้อมูล
            </button>

            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition text-sm font-medium"
            >
              🚪 ออกจากระบบ
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('borrow')}
            className={`py-3 px-6 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === 'borrow'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            📦 คำขอยืมอุปกรณ์ ({borrowRequests.filter((r) => r.status === 'PENDING').length} รออนุมัติ)
          </button>

          <button
            onClick={() => setActiveTab('booking')}
            className={`py-3 px-6 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === 'booking'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            🏫 คำขอจองห้อง ({bookingRequests.filter((r) => r.status === 'PENDING').length} รออนุมัติ)
          </button>

          <button
            onClick={() => setActiveTab('maintenance')}
            className={`py-3 px-6 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === 'maintenance'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            🛠️ รายการแจ้งซ่อม ({maintenanceRequests.filter((r) => r.status === 'PENDING').length} รอดำเนินการ)
          </button>
        </div>

        {loading ? (
          <div className="text-center py-10 text-gray-500">กำลังโหลดข้อมูล...</div>
        ) : (
          <>
            {/* ==================== TAB 1: ยืมอุปกรณ์ ==================== */}
            {activeTab === 'borrow' && (
              <div>
                {borrowRequests.length === 0 ? (
                  <div className="text-center py-10 text-gray-500">ยังไม่มีรายการขอยืมอุปกรณ์</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b text-sm font-semibold text-gray-600">
                          <th className="p-3">#</th>
                          <th className="p-3">ผู้ขอยืม / สังกัด</th>
                          <th className="p-3">อุปกรณ์ที่ยืม</th>
                          <th className="p-3 text-center">จำนวน</th>
                          <th className="p-3">วันที่ยืม - กำหนดคืน</th>
                          <th className="p-3">เวลาที่ยืม</th>
                          <th className="p-3 text-center">สถานะ</th>
                          <th className="p-3 text-center">จัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y text-sm text-gray-700">
                        {borrowRequests.map((item) => (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="p-3 font-mono text-gray-400">#{item.id}</td>
                            <td className="p-3">
                              <div className="font-semibold text-gray-800">{item.requester_name}</div>
                              <div className="text-xs text-gray-500">
                                {item.position} | {item.requester_department}
                              </div>
                            </td>
                            <td className="p-3">
                              <span className="font-medium">{item.resources?.name || 'ไม่ทราบชื่ออุปกรณ์'}</span>
                              <div className="text-xs text-gray-400">
                                (คงเหลือในคลัง: {item.resources?.available_quantity ?? '-'})
                              </div>
                            </td>
                            <td className="p-3 text-center font-bold text-blue-600">{item.quantity}</td>
                            <td className="p-3 text-xs whitespace-nowrap">
                              <div><b>ยืม:</b> {item.borrow_date}</div>
                              <div><b>คืน:</b> {item.return_date}</div>
                            </td>
                            <td className="p-3 text-xs text-gray-500 whitespace-nowrap font-mono">
                              {formatDateTime(item.created_at)}
                            </td>
                            <td className="p-3 text-center">
                              {item.status === 'PENDING' && (
                                <span className="px-2.5 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold">
                                  รออนุมัติ
                                </span>
                              )}
                              {item.status === 'APPROVED' && (
                                <span className="px-2.5 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
                                  อนุมัติแล้ว (กำลังยืม)
                                </span>
                              )}
                              {item.status === 'RETURNED' && (
                                <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                                  คืนแล้ว
                                </span>
                              )}
                              {item.status === 'REJECTED' && (
                                <span className="px-2.5 py-1 bg-red-100 text-red-800 rounded-full text-xs font-semibold">
                                  ปฏิเสธ
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              {item.status === 'PENDING' && (
                                <div className="flex justify-center space-x-2">
                                  <button
                                    disabled={actionLoading === item.id}
                                    onClick={() => handleApproveBorrow(item)}
                                    className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs font-medium transition disabled:opacity-50"
                                  >
                                    อนุมัติ
                                  </button>
                                  <button
                                    disabled={actionLoading === item.id}
                                    onClick={() => handleRejectBorrow(item.id)}
                                    className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs font-medium transition disabled:opacity-50"
                                  >
                                    ปฏิเสธ
                                  </button>
                                </div>
                              )}
                              {item.status === 'APPROVED' && (
                                <button
                                  disabled={actionLoading === item.id}
                                  onClick={() => handleReturnBorrow(item)}
                                  className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs font-medium transition disabled:opacity-50"
                                >
                                  📦 รับคืนอุปกรณ์
                                </button>
                              )}
                              {(item.status === 'RETURNED' || item.status === 'REJECTED') && (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ==================== TAB 2: จองห้อง ==================== */}
            {activeTab === 'booking' && (
              <div>
                {bookingRequests.length === 0 ? (
                  <div className="text-center py-10 text-gray-500">ยังไม่มีรายการขอจองห้อง</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b text-sm font-semibold text-gray-600">
                          <th className="p-3">#</th>
                          <th className="p-3">ผู้ขอจอง / สังกัด</th>
                          <th className="p-3">ห้องที่ต้องการจอง</th>
                          <th className="p-3">วันที่และเวลาใช้งาน</th>
                          <th className="p-3">เวลาที่กดจอง</th>
                          <th className="p-3 text-center">สถานะ</th>
                          <th className="p-3 text-center">จัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y text-sm text-gray-700">
                        {bookingRequests.map((item) => (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="p-3 font-mono text-gray-400">#{item.id}</td>
                            <td className="p-3">
                              <div className="font-semibold text-gray-800">{item.requester_name}</div>
                              <div className="text-xs text-gray-500">
                                {item.position} | {item.requester_department}
                              </div>
                            </td>
                            <td className="p-3">
                              <span className="font-medium text-blue-700">
                                {item.rooms?.name || 'ไม่ทราบชื่อห้อง'}
                              </span>
                              {item.rooms?.building && (
                                <div className="text-xs text-gray-400">อาคาร: {item.rooms.building}</div>
                              )}
                            </td>
                            <td className="p-3 text-xs">
                              <div className="font-semibold">{item.booking_date}</div>
                              <div className="font-mono bg-gray-50 rounded px-1.5 py-0.5 inline-block text-gray-600 mt-0.5">
                                {item.start_time.slice(0, 5)} - {item.end_time.slice(0, 5)} น.
                              </div>
                            </td>
                            <td className="p-3 text-xs text-gray-500 whitespace-nowrap font-mono">
                              {formatDateTime(item.created_at)}
                            </td>
                            <td className="p-3 text-center">
                              {item.status === 'PENDING' && (
                                <span className="px-2.5 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold">
                                  รออนุมัติ
                                </span>
                              )}
                              {item.status === 'APPROVED' && (
                                <span className="px-2.5 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
                                  อนุมัติแล้ว
                                </span>
                              )}
                              {item.status === 'REJECTED' && (
                                <span className="px-2.5 py-1 bg-red-100 text-red-800 rounded-full text-xs font-semibold">
                                  ปฏิเสธ
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              {item.status === 'PENDING' && (
                                <div className="flex justify-center space-x-2">
                                  <button
                                    disabled={actionLoading === item.id}
                                    onClick={() => handleApproveBooking(item)}
                                    className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs font-medium transition disabled:opacity-50"
                                  >
                                    อนุมัติ
                                  </button>
                                  <button
                                    disabled={actionLoading === item.id}
                                    onClick={() => handleRejectBooking(item.id)}
                                    className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs font-medium transition disabled:opacity-50"
                                  >
                                    ปฏิเสธ
                                  </button>
                                </div>
                              )}
                              {(item.status === 'APPROVED' || item.status === 'REJECTED') && (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ==================== TAB 3: แจ้งซ่อม ==================== */}
            {activeTab === 'maintenance' && (
              <div>
                {maintenanceRequests.length === 0 ? (
                  <div className="text-center py-10 text-gray-500">ยังไม่มีรายการแจ้งซ่อม</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b text-sm font-semibold text-gray-600">
                          <th className="p-3">#</th>
                          <th className="p-3">ประเภท</th>
                          <th className="p-3">หัวข้อ / รายละเอียดปัญหา</th>
                          <th className="p-3">ผู้แจ้ง / สังกัด</th>
                          <th className="p-3">วันที่/เวลาแจ้ง</th>
                          <th className="p-3 text-center">รูปถ่าย</th>
                          <th className="p-3 text-center">สถานะ</th>
                          <th className="p-3 text-center">เปลี่ยนสถานะ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y text-sm text-gray-700">
                        {maintenanceRequests.map((item) => (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="p-3 font-mono text-gray-400">#{item.id}</td>
                            <td className="p-3">
                              <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                item.type === 'EQUIPMENT' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                              }`}>
                                {item.type === 'EQUIPMENT' ? '📦 อุปกรณ์' : '🏫 ของในห้อง'}
                              </span>
                            </td>
                            <td className="p-3">
                              <div className="font-semibold text-gray-900">{item.title}</div>
                              <div className="text-xs text-gray-500 max-w-xs truncate" title={item.description}>
                                {item.description || 'ไม่มีรายละเอียดเพิ่มเติม'}
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="font-medium text-gray-800">{item.reporter_name}</div>
                              <div className="text-xs text-gray-500">{item.reporter_department || '-'}</div>
                            </td>
                            <td className="p-3 text-xs text-gray-500 whitespace-nowrap font-mono">
                              {formatDateTime(item.created_at)}
                            </td>
                            <td className="p-3 text-center">
                              {item.image_url ? (
                                <a
                                  href={item.image_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 font-medium bg-blue-50 px-2 py-1 rounded border border-blue-200"
                                >
                                  📷 ดูรูป
                                </a>
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                item.status === 'FIXED' || item.status === 'REPLACED' ? 'bg-green-100 text-green-800' :
                                item.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                                item.status === 'CANCELLED' ? 'bg-gray-100 text-gray-800' : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {item.status === 'PENDING' && '⏳ รอดำเนินการ'}
                                {item.status === 'IN_PROGRESS' && '🔧 กำลังซ่อม'}
                                {item.status === 'FIXED' && '✅ ซ่อมเสร็จแล้ว'}
                                {item.status === 'REPLACED' && '🔄 เปลี่ยนของใหม่'}
                                {item.status === 'CANCELLED' && '❌ ยกเลิก'}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <select
                                value={item.status}
                                disabled={actionLoading === item.id}
                                onChange={(e) => handleUpdateMaintenanceStatus(item.id, e.target.value)}
                                className="text-xs border border-gray-300 rounded-lg p-1.5 bg-white text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                              >
                                <option value="PENDING">⏳ รอดำเนินการ</option>
                                <option value="IN_PROGRESS">🔧 กำลังซ่อม</option>
                                <option value="FIXED">✅ ซ่อมเสร็จแล้ว</option>
                                <option value="REPLACED">🔄 เปลี่ยนของใหม่</option>
                                <option value="CANCELLED">❌ ยกเลิก</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}