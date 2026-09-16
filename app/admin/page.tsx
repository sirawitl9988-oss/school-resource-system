'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

// Types Definition
interface Resource {
  id: number
  name: string
  available_quantity: number
}

interface Room {
  id: number
  name: string
  building?: string
}

interface BorrowRequest {
  id: number
  requester_name: string
  email?: string
  requester_email?: string
  position: string
  requester_department: string
  resource_id: number
  quantity: number
  borrow_date: string
  return_date: string
  created_at: string
  status: string
  resources: Resource | null
}

interface BookingRequest {
  id: number
  requester_name: string
  email?: string
  requester_email?: string
  position: string
  requester_department: string
  room_id: number
  booking_date: string
  start_time: string
  end_time: string
  created_at: string
  status: string
  rooms: Room | null
}

interface MaintenanceRequest {
  id: number
  type: 'EQUIPMENT' | 'ROOM_ITEM'
  title: string
  description: string
  reporter_name: string
  reporter_department: string
  created_at: string
  image_url?: string
  status: string
}

interface NotificationAlert {
  id: number
  title: string
  message: string
  type: 'borrow' | 'booking' | 'maintenance'
}

export default function AdminDashboard() {
  const router = useRouter()
  const [adminUser, setAdminUser] = useState<{ name: string; username: string } | null>(null)

  const [activeTab, setActiveTab] = useState<'borrow' | 'booking' | 'maintenance'>('borrow')
  const [borrowRequests, setBorrowRequests] = useState<BorrowRequest[]>([])
  const [bookingRequests, setBookingRequests] = useState<BookingRequest[]>([])
  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  const [notification, setNotification] = useState<NotificationAlert | null>(null)

  // State สำหรับเลือกเดือนและปี พ.ศ. ของแต่ละแท็บ
  const [borrowYear, setBorrowYear] = useState<number | null>(null)
  const [borrowMonthNum, setBorrowMonthNum] = useState<number | null>(null)
  const [showAllBorrow, setShowAllBorrow] = useState<boolean>(true)

  const [bookingYear, setBookingYear] = useState<number | null>(null)
  const [bookingMonthNum, setBookingMonthNum] = useState<number | null>(null)
  const [showAllBookings, setShowAllBookings] = useState<boolean>(true)

  const [maintYear, setMaintYear] = useState<number | null>(null)
  const [maintMonthNum, setMaintMonthNum] = useState<number | null>(null)
  const [showAllMaint, setShowAllMaint] = useState<boolean>(true)

  const printMonth = (bookingYear && bookingMonthNum) 
    ? `${bookingYear}-${String(bookingMonthNum).padStart(2, '0')}` 
    : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`

  const [showPreviewModal, setShowPreviewModal] = useState(false)

  const generateYearsList = () => {
    const currentYear = new Date().getFullYear()
    const years = []
    for (let y = currentYear; y <= currentYear + 50; y++) {
      years.push(y)
    }
    return years
  }

  const formatDateTime = (dateString: string) => {
    if (!dateString) return '-'

    const formattedStr = (dateString.endsWith('Z') || dateString.includes('+'))
      ? dateString
      : `${dateString}Z`

    const date = new Date(formattedStr)

    return (
      date.toLocaleString('th-TH', {
        timeZone: 'Asia/Bangkok',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }) + ' น.'
    )
  }

  const isBookingExpired = (bookingDate: string, endTime: string) => {
    if (!bookingDate || !endTime) return false
    try {
      const endDateTime = new Date(`${bookingDate}T${endTime}+07:00`)
      return new Date() > endDateTime
    } catch {
      return false
    }
  }

  const sendStatusEmail = async (params: {
    requesterEmail?: string
    requesterName: string
    title: string
    details: string
    status: string
  }) => {
    if (!params.requesterEmail) return
    try {
      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toEmail: params.requesterEmail,
          requesterEmail: params.requesterEmail,
          requesterName: params.requesterName,
          title: params.title,
          details: params.details,
          status: params.status,
        }),
      })
    } catch (err) {
      console.error('Failed to send status email:', err)
    }
  }

  const fetchBorrowRequests = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('borrow_requests')
        .select('*, resources(*)')
        .order('id', { ascending: false })

      if (error) throw error
      setBorrowRequests((data as unknown as BorrowRequest[]) || [])
    } catch (err: unknown) {
      const error = err as Error
      console.error('Borrow Fetch Error:', error.message)
    }
  }, [])

  const fetchBookingRequests = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('booking_requests')
        .select('*, rooms(*)')
        .order('id', { ascending: false })

      if (error) throw error
      setBookingRequests((data as unknown as BookingRequest[]) || [])
    } catch (err: unknown) {
      const error = err as Error
      console.error('Booking Fetch Error:', error.message)
    }
  }, [])

  const fetchMaintenanceRequests = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('maintenance_requests')
        .select('*')
        .order('id', { ascending: false })

      if (error) throw error
      setMaintenanceRequests((data as MaintenanceRequest[]) || [])
    } catch (err: unknown) {
      const error = err as Error
      console.error('Maintenance Fetch Error:', error.message)
    }
  }, [])

  const fetchAllData = useCallback(async () => {
    setLoading(true)
    await Promise.all([fetchBorrowRequests(), fetchBookingRequests(), fetchMaintenanceRequests()])
    setLoading(false)
  }, [fetchBorrowRequests, fetchBookingRequests, fetchMaintenanceRequests])

  useEffect(() => {
    const session = localStorage.getItem('adminSession')
    if (!session) {
      router.push('/admin/login')
      return
    }

    try {
      setAdminUser(JSON.parse(session))
      fetchAllData()
    } catch {
      localStorage.removeItem('adminSession')
      router.push('/admin/login')
      return
    }

    const channel = supabase
      .channel('admin-realtime-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'borrow_requests' },
        (payload) => {
          const newReq = payload.new as BorrowRequest
          setNotification({
            id: Date.now(),
            title: '📦 มีคำขอยืมอุปกรณ์ใหม่!',
            message: `ผู้ขอยืม: ${newReq.requester_name} (${newReq.requester_department})`,
            type: 'borrow',
          })
          fetchBorrowRequests()
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'booking_requests' },
        (payload) => {
          const newReq = payload.new as BookingRequest
          setNotification({
            id: Date.now(),
            title: '🏫 มีรายการขอจองห้องใหม่!',
            message: `ผู้ขอจอง: ${newReq.requester_name} (วันที่ ${newReq.booking_date})`,
            type: 'booking',
          })
          fetchBookingRequests()
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'maintenance_requests' },
        (payload) => {
          const newReq = payload.new as MaintenanceRequest
          setNotification({
            id: Date.now(),
            title: '🛠️ มีการแจ้งซ่อมใหม่!',
            message: `หัวข้อ: ${newReq.title} โดย ${newReq.reporter_name}`,
            type: 'maintenance',
          })
          fetchMaintenanceRequests()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [router, fetchAllData, fetchBorrowRequests, fetchBookingRequests, fetchMaintenanceRequests])

  const handleLogout = () => {
    if (confirm('คุณต้องการออกจากระบบหรือไม่?')) {
      localStorage.removeItem('adminSession')
      router.push('/admin/login')
    }
  }

  const handleApproveBorrow = async (req: BorrowRequest) => {
    const { data: latestResource, error: resFetchErr } = await supabase
      .from('resources')
      .select('available_quantity')
      .eq('id', req.resource_id)
      .single()

    if (resFetchErr || !latestResource) {
      alert('ไม่สามารถดึงข้อมูลสต็อกล่าสุดได้')
      return
    }

    const currentAvailable = latestResource.available_quantity

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

      const userEmail = req.email || req.requester_email
      await sendStatusEmail({
        requesterEmail: userEmail,
        requesterName: req.requester_name,
        title: `คำขอยืมอุปกรณ์: ${req.resources?.name || 'อุปกรณ์'}`,
        details: `จำนวน ${req.quantity} ชิ้น (กำหนดคืนวันที่ ${req.return_date})`,
        status: 'APPROVED',
      })

      alert('✅ อนุมัติคำขอและส่งอีเมลแจ้งผู้ใช้เรียบร้อยแล้ว!')
      await fetchBorrowRequests()
    } catch (err: unknown) {
      const error = err as Error
      alert('เกิดข้อผิดพลาด: ' + error.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleReturnBorrow = async (req: BorrowRequest) => {
    if (!confirm(`ยืนยันรับคืนอุปกรณ์จาก คุณ${req.requester_name}?`)) return

    setActionLoading(req.id)
    try {
      const { data: latestResource } = await supabase
        .from('resources')
        .select('available_quantity')
        .eq('id', req.resource_id)
        .single()

      const currentAvailable = latestResource?.available_quantity || 0

      const { error: updateError } = await supabase
        .from('borrow_requests')
        .update({ status: 'RETURNED' })
        .eq('id', req.id)

      if (updateError) throw updateError

      const newQuantity = currentAvailable + req.quantity
      const { error: resourceError } = await supabase
        .from('resources')
        .update({ available_quantity: newQuantity })
        .eq('id', req.resource_id)

      if (resourceError) throw resourceError

      alert('✅ รับคืนอุปกรณ์และคืนสต็อกเรียบร้อยแล้ว!')
      await fetchBorrowRequests()
    } catch (err: unknown) {
      const error = err as Error
      alert('เกิดข้อผิดพลาดในการคืนอุปกรณ์: ' + error.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleRejectBorrow = async (req: BorrowRequest) => {
    if (!confirm('ยืนยันการปฏิเสธคำขอยืมอุปกรณ์นี้?')) return

    setActionLoading(req.id)
    try {
      const { error } = await supabase
        .from('borrow_requests')
        .update({ status: 'REJECTED' })
        .eq('id', req.id)

      if (error) throw error

      const userEmail = req.email || req.requester_email
      await sendStatusEmail({
        requesterEmail: userEmail,
        requesterName: req.requester_name,
        title: `คำขอยืมอุปกรณ์: ${req.resources?.name || 'อุปกรณ์'}`,
        details: `รายการยืมจำนวน ${req.quantity} ชิ้น ถูกปฏิเสธ`,
        status: 'REJECTED',
      })

      alert('ปฏิเสธคำขอและส่งอีเมลแจ้งผู้ใช้เรียบร้อยแล้ว')
      await fetchBorrowRequests()
    } catch (err: unknown) {
      const error = err as Error
      alert('เกิดข้อผิดพลาด: ' + error.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleApproveBooking = async (req: BookingRequest) => {
    if (!confirm(`ยืนยันการอนุมัติการจองห้องของ คุณ${req.requester_name}?`)) return

    setActionLoading(req.id)
    try {
      const { error } = await supabase
        .from('booking_requests')
        .update({ status: 'APPROVED' })
        .eq('id', req.id)

      if (error) throw error

      const userEmail = req.email || req.requester_email
      await sendStatusEmail({
        requesterEmail: userEmail,
        requesterName: req.requester_name,
        title: `คำขอจองห้อง: ${req.rooms?.name || 'ห้องประชุม'}`,
        details: `วันที่ใช้งาน ${req.booking_date} เวลา ${req.start_time?.slice(0, 5)} - ${req.end_time?.slice(0, 5)} น.`,
        status: 'APPROVED',
      })

      alert('✅ อนุมัติการจองห้องและส่งอีเมลแจ้งผู้ใช้เรียบร้อยแล้ว!')
      await fetchBookingRequests()
    } catch (err: unknown) {
      const error = err as Error
      alert('เกิดข้อผิดพลาด: ' + error.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleRejectBooking = async (req: BookingRequest) => {
    if (!confirm('ยืนยันการปฏิเสธคำขอจองห้องนี้?')) return

    setActionLoading(req.id)
    try {
      const { error } = await supabase
        .from('booking_requests')
        .update({ status: 'REJECTED' })
        .eq('id', req.id)

      if (error) throw error

      const userEmail = req.email || req.requester_email
      await sendStatusEmail({
        requesterEmail: userEmail,
        requesterName: req.requester_name,
        title: `คำขอจองห้อง: ${req.rooms?.name || 'ห้องประชุม'}`,
        details: `รายการจองห้องในวันที่ ${req.booking_date} ถูกปฏิเสธ`,
        status: 'REJECTED',
      })

      alert('ปฏิเสธคำขอและส่งอีเมลแจ้งผู้ใช้เรียบร้อยแล้ว')
      await fetchBookingRequests()
    } catch (err: unknown) {
      const error = err as Error
      alert('เกิดข้อผิดพลาด: ' + error.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleCancelBooking = async (req: BookingRequest) => {
    if (!confirm(`ยืนยันการยกเลิกการจองห้องของ คุณ${req.requester_name}? (จะไม่มีการส่งอีเมลแจ้งเตือน)`)) return

    setActionLoading(req.id)
    try {
      const { error } = await supabase
        .from('booking_requests')
        .update({ status: 'CANCELLED' })
        .eq('id', req.id)

      if (error) throw error

      alert('🚫 ยกเลิกการจองห้องเรียบร้อยแล้ว! ช่วงเวลานี้ว่างสำหรับผู้ใช้อื่นทันที')
      await fetchBookingRequests()
    } catch (err: unknown) {
      const error = err as Error
      alert('เกิดข้อผิดพลาด: ' + error.message)
    } finally {
      setActionLoading(null)
    }
  }

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
    } catch (err: unknown) {
      const error = err as Error
      alert('เกิดข้อผิดพลาด: ' + error.message)
    } finally {
      setActionLoading(null)
    }
  }

  // ฟังก์ชันกรองข้อมูลแต่ละแท็บ
  const getFilteredBorrowRequests = () => {
    if (showAllBorrow) return borrowRequests
    if (!borrowYear || !borrowMonthNum) return borrowRequests
    return borrowRequests.filter((item) => {
      if (!item.borrow_date) return false
      const [bYear, bMonth] = item.borrow_date.split('-').map(Number)
      return bYear === borrowYear && bMonth === borrowMonthNum
    })
  }

  const getFilteredBookingsForTable = () => {
    if (showAllBookings) return bookingRequests
    if (!bookingYear || !bookingMonthNum) return bookingRequests
    return bookingRequests.filter((item) => {
      if (!item.booking_date) return false
      const [bYear, bMonth] = item.booking_date.split('-').map(Number)
      return bYear === bookingYear && bMonth === bookingMonthNum
    })
  }

  const getFilteredMaintenanceRequests = () => {
    if (showAllMaint) return maintenanceRequests
    if (!maintYear || !maintMonthNum) return maintenanceRequests
    return maintenanceRequests.filter((item) => {
      if (!item.created_at) return false
      const datePart = item.created_at.split('T')[0]
      const [mYear, mMonth] = datePart.split('-').map(Number)
      return mYear === maintYear && mMonth === maintMonthNum
    })
  }

  const getFilteredBookingsForReport = () => {
    const [yearStr, monthStr] = printMonth.split('-')
    const targetYear = parseInt(yearStr)
    const targetMonth = parseInt(monthStr)

    return bookingRequests.filter((item) => {
      if (!item.booking_date) return false
      const isApproved = item.status === 'APPROVED' || item.status === 'อนุมัติแล้ว'
      if (!isApproved) return false

      const [bYear, bMonth] = item.booking_date.split('-').map(Number)
      return bYear === targetYear && bMonth === targetMonth
    })
  }

  const getReportTitle = () => {
    const [yearStr, monthStr] = printMonth.split('-')
    const targetYear = parseInt(yearStr)
    const targetMonth = parseInt(monthStr)
    const monthNamesThai = [
      '', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ]
    const thaiYear = targetYear + 543
    return `รายงานตารางการจองห้องประชุม ประจำเดือน ${monthNamesThai[targetMonth]} พ.ศ. ${thaiYear}`
  }

  const handleDownloadPDF = () => {
    const filteredBookings = getFilteredBookingsForReport()
    const reportTitle = getReportTitle()

    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert('กรุณาอนุญาตให้เบราว์เซอร์เปิดหน้าต่าง Pop-up')
      return
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${reportTitle}</title>
          <meta charset="utf-8" />
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap');
            body { font-family: 'Sarabun', sans-serif; padding: 20px; color: #111; line-height: 1.5; }
            h2 { text-align: center; margin-bottom: 5px; font-weight: 700; color: #111; }
            p.subtitle { text-align: center; font-size: 13px; color: #333; margin-bottom: 25px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; color: #111; }
            th, td { border: 1px solid #999; padding: 8px 10px; text-align: left; vertical-align: middle; color: #111; }
            th { background-color: #e6e6e6 !important; -webkit-print-color-adjust: exact; text-align: center; font-weight: 700; color: #111; }
            td.center { text-align: center; }
            @media print {
              body { padding: 0; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <h2>โรงเรียนอุตรดิตถ์</h2>
          <h2>${reportTitle}</h2>
          <p class="subtitle">ระบบบริหารจัดการทรัพยากรโรงเรียน - พิมพ์เมื่อวันที่ ${new Date().toLocaleDateString('th-TH')}</p>
          
          <table>
            <thead>
              <tr>
                <th style="width: 8%;">ลำดับ</th>
                <th style="width: 27%;">ผู้จอง / สังกัด</th>
                <th style="width: 25%;">ห้องที่จอง</th>
                <th style="width: 20%;">วันที่ใช้งาน</th>
                <th style="width: 20%;">ช่วงเวลา</th>
              </tr>
            </thead>
            <tbody>
              ${
                filteredBookings.length === 0
                  ? `<tr><td colspan="5" style="text-align: center; padding: 20px; color: #333;">ไม่พบรายการจองที่อนุมัติแล้วในเดือนนี้</td></tr>`
                  : filteredBookings.map((item, idx) => `
                      <tr>
                        <td class="center">${idx + 1}</td>
                        <td>
                          <b style="color: #000;">${item.requester_name}</b><br/>
                          <span style="font-size: 11px; color: #222;">${item.position} | ${item.requester_department}</span>
                        </td>
                        <td>${item.rooms?.name || 'ห้องประชุม'}</td>
                        <td class="center">${item.booking_date}</td>
                        <td class="center">${item.start_time?.slice(0, 5)} - ${item.end_time?.slice(0, 5)} น.</td>
                      </tr>
                    `).join('')
              }
            </tbody>
          </table>
          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  return (
    <main className="min-h-screen bg-gray-100 p-6 relative" lang="th">
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce">
          <div className="bg-white border-l-4 border-blue-600 shadow-2xl rounded-xl p-4 max-w-sm flex flex-col gap-2 border border-gray-100">
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-800 text-sm flex items-center gap-1">
                🔔 {notification.title}
              </span>
              <button
                onClick={() => setNotification(null)}
                className="text-gray-400 hover:text-gray-600 text-xs font-bold"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-gray-600">{notification.message}</p>
            <div className="flex justify-end gap-2 mt-1">
              <button
                onClick={() => {
                  setActiveTab(notification.type)
                  setNotification(null)
                }}
                className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition"
              >
                ดูรายการนี้
              </button>
            </div>
          </div>
        </div>
      )}

      {showPreviewModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b bg-gray-50">
              <h3 className="font-bold text-lg text-gray-900">📄 ตัวอย่างเอกสารรายงานก่อนพิมพ์ / บันทึก PDF</h3>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="text-gray-500 hover:text-gray-800 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-8 overflow-y-auto bg-gray-100 flex-1">
              <div 
                className="bg-white p-8 shadow-md rounded-lg max-w-3xl mx-auto border border-gray-300 text-gray-900"
                style={{ fontFamily: "'Sarabun', sans-serif", lineHeight: 1.6 }}
              >
                <div className="text-center mb-6">
                  <h2 className="text-xl font-bold text-gray-900" style={{ lineHeight: '1.4' }}>โรงเรียนอุตรดิตถ์</h2>
                  <h2 className="text-lg font-bold text-gray-900 mt-1" style={{ lineHeight: '1.4' }}>{getReportTitle()}</h2>
                  <p className="text-xs font-medium text-gray-700 mt-1" style={{ lineHeight: '1.4' }}>ระบบบริหารจัดการทรัพยากรโรงเรียน</p>
                </div>

                <table className="w-full border-collapse text-sm text-gray-900">
                  <thead>
                    <tr className="bg-gray-200 border border-gray-400 text-gray-900 font-bold">
                      <th className="border border-gray-400 p-2 text-center w-12 text-gray-900">ลำดับ</th>
                      <th className="border border-gray-400 p-2 text-gray-900">ผู้จอง / สังกัด</th>
                      <th className="border border-gray-400 p-2 text-gray-900">ห้องที่จอง</th>
                      <th className="border border-gray-400 p-2 text-center text-gray-900">วันที่ใช้งาน</th>
                      <th className="border border-gray-400 p-2 text-center text-gray-900">ช่วงเวลา</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getFilteredBookingsForReport().length === 0 ? (
                      <tr>
                        <td colSpan={5} className="border border-gray-300 p-6 text-center text-gray-700 font-medium">
                          ไม่พบรายการจองที่อนุมัติแล้วในเดือนนี้
                        </td>
                      </tr>
                    ) : (
                      getFilteredBookingsForReport().map((item, idx) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="border border-gray-300 p-2 text-center text-gray-900 font-medium">{idx + 1}</td>
                          <td className="border border-gray-300 p-2 text-gray-900" style={{ lineHeight: '1.5' }}>
                            <div className="font-bold text-gray-900">{item.requester_name}</div>
                            <div className="text-xs font-medium text-gray-700" style={{ marginTop: '2px' }}>{item.position} | {item.requester_department}</div>
                          </td>
                          <td className="border border-gray-300 p-2 text-gray-900 font-medium">{item.rooms?.name || 'ห้องประชุม'}</td>
                          <td className="border border-gray-300 p-2 text-center text-gray-900 font-medium">{item.booking_date}</td>
                          <td className="border border-gray-300 p-2 text-center text-gray-900 font-medium">{item.start_time?.slice(0, 5)} - {item.end_time?.slice(0, 5)} น.</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">
              <button
                onClick={() => setShowPreviewModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition text-sm font-medium"
              >
                ปิดหน้าต่าง
              </button>
              <button
                onClick={() => {
                  setShowPreviewModal(false)
                  handleDownloadPDF()
                }}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm font-semibold shadow-sm flex items-center gap-2"
              >
                🖨️ พิมพ์ / บันทึกเป็น PDF
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-md p-6">
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

        <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('borrow')}
            className={`py-3 px-6 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === 'borrow'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            📦 คำขอยืมอุปกรณ์ ({borrowRequests.filter((r) => r.status === 'PENDING' || r.status === 'รออนุมัติ').length} รออนุมัติ)
          </button>

          <button
            onClick={() => setActiveTab('booking')}
            className={`py-3 px-6 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === 'booking'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            🏫 คำขอจองห้อง ({bookingRequests.filter((r) => r.status === 'PENDING' || r.status === 'รออนุมัติ').length} รออนุมัติ)
          </button>

          <button
            onClick={() => setActiveTab('maintenance')}
            className={`py-3 px-6 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === 'maintenance'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            🛠️ รายการแจ้งซ่อม ({maintenanceRequests.filter((r) => r.status === 'PENDING' || r.status === 'รอดำเนินการ').length} รอดำเนินการ)
          </button>
        </div>

        {loading ? (
          <div className="text-center py-10 text-gray-500">กำลังโหลดข้อมูล...</div>
        ) : (
          <>
            {activeTab === 'borrow' && (
              <div>
                <div className="flex flex-col sm:flex-row justify-between items-center bg-blue-50/60 border border-blue-100 p-4 rounded-xl mb-6 gap-3">
                  <div className="text-sm font-semibold text-blue-900">
                    📦 กรองรายการขอยืมอุปกรณ์ตามเดือนและปี
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => {
                        setShowAllBorrow(true)
                        setBorrowMonthNum(null)
                        setBorrowYear(null)
                      }}
                      className={`text-sm font-semibold px-4 py-1.5 rounded-lg transition shadow-sm ${
                        showAllBorrow
                          ? 'bg-blue-700 text-white shadow'
                          : 'bg-white text-blue-700 border border-blue-300 hover:bg-blue-50'
                      }`}
                    >
                      📋 แสดงทั้งหมด
                    </button>

                    <select
                      value={borrowMonthNum ?? ''}
                      onChange={(e) => {
                        setBorrowMonthNum(e.target.value ? Number(e.target.value) : null)
                        setShowAllBorrow(false)
                      }}
                      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white text-gray-800 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-medium"
                    >
                      <option value="" disabled>โปรดเลือกเดือน</option>
                      <option value={1}>มกราคม</option>
                      <option value={2}>กุมภาพันธ์</option>
                      <option value={3}>มีนาคม</option>
                      <option value={4}>เมษายน</option>
                      <option value={5}>พฤษภาคม</option>
                      <option value={6}>มิถุนายน</option>
                      <option value={7}>กรกฎาคม</option>
                      <option value={8}>สิงหาคม</option>
                      <option value={9}>กันยายน</option>
                      <option value={10}>ตุลาคม</option>
                      <option value={11}>พฤศจิกายน</option>
                      <option value={12}>ธันวาคม</option>
                    </select>

                    <select
                      value={borrowYear ?? ''}
                      onChange={(e) => {
                        setBorrowYear(e.target.value ? Number(e.target.value) : null)
                        setShowAllBorrow(false)
                      }}
                      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white text-gray-800 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-medium"
                    >
                      <option value="" disabled>โปรดเลือกปี</option>
                      {generateYearsList().map((y) => (
                        <option key={y} value={y}>
                          พ.ศ. {y + 543}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {getFilteredBorrowRequests().length === 0 ? (
                  <div className="text-center py-10 text-gray-500">ยังไม่มีรายการขอยืมอุปกรณ์ตามเงื่อนไขที่เลือก</div>
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
                        {getFilteredBorrowRequests().map((item) => (
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
                              {(item.status === 'PENDING' || item.status === 'รออนุมัติ') && (
                                <span className="px-2.5 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold">
                                  รออนุมัติ
                                </span>
                              )}
                              {(item.status === 'APPROVED' || item.status === 'อนุมัติแล้ว') && (
                                <span className="px-2.5 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
                                  อนุมัติแล้ว (กำลังยืม)
                                </span>
                              )}
                              {(item.status === 'RETURNED' || item.status === 'คืนแล้ว') && (
                                <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                                  คืนแล้ว
                                </span>
                              )}
                              {(item.status === 'REJECTED' || item.status === 'ปฏิเสธ') && (
                                <span className="px-2.5 py-1 bg-red-100 text-red-800 rounded-full text-xs font-semibold">
                                  ปฏิเสธ
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              {(item.status === 'PENDING' || item.status === 'รออนุมัติ') && (
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
                                    onClick={() => handleRejectBorrow(item)}
                                    className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs font-medium transition disabled:opacity-50"
                                  >
                                    ปฏิเสธ
                                  </button>
                                </div>
                              )}
                              {(item.status === 'APPROVED' || item.status === 'อนุมัติแล้ว') && (
                                <button
                                  disabled={actionLoading === item.id}
                                  onClick={() => handleReturnBorrow(item)}
                                  className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs font-medium transition disabled:opacity-50"
                                >
                                  📦 รับคืนอุปกรณ์
                                </button>
                              )}
                              {((item.status === 'RETURNED' || item.status === 'คืนแล้ว') || (item.status === 'REJECTED' || item.status === 'ปฏิเสธ')) && (
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

            {activeTab === 'booking' && (
              <div>
                <div className="flex flex-col sm:flex-row justify-between items-center bg-blue-50/60 border border-blue-100 p-4 rounded-xl mb-6 gap-3">
                  <div className="text-sm font-semibold text-blue-900">
                    📅 กรองหรือพิมพ์รายงานการจองห้อง
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => {
                        setShowAllBookings(true)
                        setBookingMonthNum(null)
                        setBookingYear(null)
                      }}
                      className={`text-sm font-semibold px-4 py-1.5 rounded-lg transition shadow-sm ${
                        showAllBookings
                          ? 'bg-blue-700 text-white shadow'
                          : 'bg-white text-blue-700 border border-blue-300 hover:bg-blue-50'
                      }`}
                    >
                      📋 แสดงทั้งหมด
                    </button>

                    <select
                      value={bookingMonthNum ?? ''}
                      onChange={(e) => {
                        setBookingMonthNum(e.target.value ? Number(e.target.value) : null)
                        setShowAllBookings(false)
                      }}
                      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white text-gray-800 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-medium"
                    >
                      <option value="" disabled>โปรดเลือกเดือน</option>
                      <option value={1}>มกราคม</option>
                      <option value={2}>กุมภาพันธ์</option>
                      <option value={3}>มีนาคม</option>
                      <option value={4}>เมษายน</option>
                      <option value={5}>พฤษภาคม</option>
                      <option value={6}>มิถุนายน</option>
                      <option value={7}>กรกฎาคม</option>
                      <option value={8}>สิงหาคม</option>
                      <option value={9}>กันยายน</option>
                      <option value={10}>ตุลาคม</option>
                      <option value={11}>พฤศจิกายน</option>
                      <option value={12}>ธันวาคม</option>
                    </select>

                    <select
                      value={bookingYear ?? ''}
                      onChange={(e) => {
                        setBookingYear(e.target.value ? Number(e.target.value) : null)
                        setShowAllBookings(false)
                      }}
                      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white text-gray-800 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-medium"
                    >
                      <option value="" disabled>โปรดเลือกปี</option>
                      {generateYearsList().map((y) => (
                        <option key={y} value={y}>
                          พ.ศ. {y + 543}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => setShowPreviewModal(true)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition shadow-sm flex items-center gap-1.5 whitespace-nowrap"
                    >
                      👁️ ดูตัวอย่าง / พิมพ์เอกสาร
                    </button>
                  </div>
                </div>

                {getFilteredBookingsForTable().length === 0 ? (
                  <div className="text-center py-10 text-gray-500">ไม่พบรายการขอจองห้องตามเงื่อนไขที่เลือก</div>
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
                        {getFilteredBookingsForTable().map((item) => {
                          const expired = isBookingExpired(item.booking_date, item.end_time)

                          return (
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
                                  {item.start_time?.slice(0, 5)} - {item.end_time?.slice(0, 5)} น.
                                </div>
                              </td>
                              <td className="p-3 text-xs text-gray-500 whitespace-nowrap font-mono">
                                {formatDateTime(item.created_at)}
                              </td>
                              <td className="p-3 text-center">
                                {(item.status === 'APPROVED' || item.status === 'อนุมัติแล้ว') && expired ? (
                                  <span className="px-2.5 py-1 bg-slate-200 text-slate-700 rounded-full text-xs font-semibold">
                                    สิ้นสุดแล้ว
                                  </span>
                                ) : (item.status === 'PENDING' || item.status === 'รออนุมัติ') ? (
                                  <span className="px-2.5 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold">
                                    รออนุมัติ
                                  </span>
                                ) : (item.status === 'APPROVED' || item.status === 'อนุมัติแล้ว') ? (
                                  <span className="px-2.5 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
                                    อนุมัติแล้ว
                                  </span>
                                ) : (item.status === 'REJECTED' || item.status === 'ปฏิเสธ') ? (
                                  <span className="px-2.5 py-1 bg-red-100 text-red-800 rounded-full text-xs font-semibold">
                                    ปฏิเสธ
                                  </span>
                                ) : (item.status === 'CANCELLED' || item.status === 'ยกเลิกแล้ว') ? (
                                  <span className="px-2.5 py-1 bg-gray-200 text-gray-700 rounded-full text-xs font-semibold">
                                    ยกเลิกแล้ว
                                  </span>
                                ) : null}
                              </td>
                              <td className="p-3 text-center">
                                <div className="flex justify-center items-center gap-1.5">
                                  {(item.status === 'PENDING' || item.status === 'รออนุมัติ') && (
                                    <>
                                      <button
                                        disabled={actionLoading === item.id}
                                        onClick={() => handleApproveBooking(item)}
                                        className="px-2.5 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs font-medium transition disabled:opacity-50"
                                      >
                                        อนุมัติ
                                      </button>
                                      <button
                                        disabled={actionLoading === item.id}
                                        onClick={() => handleRejectBooking(item)}
                                        className="px-2.5 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs font-medium transition disabled:opacity-50"
                                      >
                                        ปฏิเสธ
                                      </button>
                                    </>
                                  )}

                                  {((item.status === 'PENDING' || item.status === 'รออนุมัติ') || ((item.status === 'APPROVED' || item.status === 'อนุมัติแล้ว') && !expired)) && (
                                    <button
                                      disabled={actionLoading === item.id}
                                      onClick={() => handleCancelBooking(item)}
                                      className="px-2.5 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-xs font-medium transition disabled:opacity-50"
                                      title="ยกเลิกการจองโดยไม่ส่งอีเมล"
                                    >
                                      ❌ ยกเลิก
                                    </button>
                                  )}

                                  {((item.status === 'REJECTED' || item.status === 'ปฏิเสธ') || (item.status === 'CANCELLED' || item.status === 'ยกเลิกแล้ว') || ((item.status === 'APPROVED' || item.status === 'อนุมัติแล้ว') && expired)) && (
                                    <span className="text-xs text-gray-400">-</span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'maintenance' && (
              <div>
                <div className="flex flex-col sm:flex-row justify-between items-center bg-blue-50/60 border border-blue-100 p-4 rounded-xl mb-6 gap-3">
                  <div className="text-sm font-semibold text-blue-900">
                    🛠️ กรองรายการแจ้งซ่อมตามเดือนและปี
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => {
                        setShowAllMaint(true)
                        setMaintMonthNum(null)
                        setMaintYear(null)
                      }}
                      className={`text-sm font-semibold px-4 py-1.5 rounded-lg transition shadow-sm ${
                        showAllMaint
                          ? 'bg-blue-700 text-white shadow'
                          : 'bg-white text-blue-700 border border-blue-300 hover:bg-blue-50'
                      }`}
                    >
                      📋 แสดงทั้งหมด
                    </button>

                    <select
                      value={maintMonthNum ?? ''}
                      onChange={(e) => {
                        setMaintMonthNum(e.target.value ? Number(e.target.value) : null)
                        setShowAllMaint(false)
                      }}
                      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white text-gray-800 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-medium"
                    >
                      <option value="" disabled>โปรดเลือกเดือน</option>
                      <option value={1}>มกราคม</option>
                      <option value={2}>กุมภาพันธ์</option>
                      <option value={3}>มีนาคม</option>
                      <option value={4}>เมษายน</option>
                      <option value={5}>พฤษภาคม</option>
                      <option value={6}>มิถุนายน</option>
                      <option value={7}>กรกฎาคม</option>
                      <option value={8}>สิงหาคม</option>
                      <option value={9}>กันยายน</option>
                      <option value={10}>ตุลาคม</option>
                      <option value={11}>พฤศจิกายน</option>
                      <option value={12}>ธันวาคม</option>
                    </select>

                    <select
                      value={maintYear ?? ''}
                      onChange={(e) => {
                        setMaintYear(e.target.value ? Number(e.target.value) : null)
                        setShowAllMaint(false)
                      }}
                      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white text-gray-800 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-medium"
                    >
                      <option value="" disabled>โปรดเลือกปี</option>
                      {generateYearsList().map((y) => (
                        <option key={y} value={y}>
                          พ.ศ. {y + 543}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {getFilteredMaintenanceRequests().length === 0 ? (
                  <div className="text-center py-10 text-gray-500">ยังไม่มีรายการแจ้งซ่อมตามเงื่อนไขที่เลือก</div>
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
                        {getFilteredMaintenanceRequests().map((item) => (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="p-3 font-mono text-gray-400">#{item.id}</td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-1 rounded text-xs font-semibold ${
                                  item.type === 'EQUIPMENT'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-purple-100 text-purple-700'
                                }`}
                              >
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
                              <span
                                className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                  item.status === 'FIXED' || item.status === 'REPLACED' || item.status === 'ซ่อมเสร็จแล้ว' || item.status === 'เปลี่ยนของใหม่'
                                    ? 'bg-green-100 text-green-800'
                                    : item.status === 'IN_PROGRESS' || item.status === 'กำลังซ่อม'
                                    ? 'bg-blue-100 text-blue-800'
                                    : item.status === 'CANCELLED' || item.status === 'ยกเลิก'
                                    ? 'bg-gray-100 text-gray-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}
                              >
                                {(item.status === 'PENDING' || item.status === 'รอดำเนินการ') && '⏳ รอดำเนินการ'}
                                {(item.status === 'IN_PROGRESS' || item.status === 'กำลังซ่อม') && '🔧 กำลังซ่อม'}
                                {(item.status === 'FIXED' || item.status === 'ซ่อมเสร็จแล้ว') && '✅ ซ่อมเสร็จแล้ว'}
                                {(item.status === 'REPLACED' || item.status === 'เปลี่ยนของใหม่') && '🔄 เปลี่ยนของใหม่'}
                                {(item.status === 'CANCELLED' || item.status === 'ยกเลิก') && '❌ ยกเลิก'}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <select
                                value={item.status}
                                disabled={actionLoading === item.id}
                                onChange={(e) =>
                                  handleUpdateMaintenanceStatus(
                                    item.id,
                                    e.target.value
                                  )
                                }
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