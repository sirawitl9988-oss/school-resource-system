import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      toEmail,
      requesterEmail,
      title,
      requesterName,
      department,
      details,
      status,
      note,
    } = body

    const userEmail = (requesterEmail || toEmail || '').trim()
    
    // เพิ่มอีเมลแอดมินทั้ง 3 คน (รวมคุณสิรวิชญ์) ตรงนี้
    const adminEmails = [
      'tingdaiwa@utd.ac.th',
      'toonvivat252811@utd.ac.th',
      'sirawit.l9988@gmail.com'
    ]
    const senderName = 'ระบบบริการโรงเรียน'

    // 1. กรณีแจ้งเตือนเมื่อมีคำขอเข้ามาใหม่
    if (!status) {
      // 1.1 ส่งแจ้งเตือนหา Admin ทั้ง 3 คนพร้อมกัน
      await transporter.sendMail({
        from: `"${senderName}" <${process.env.GMAIL_USER}>`,
        to: adminEmails.join(', '), // ส่งหาแอดมินหลายคนโดยคั่นด้วยเครื่องหมายจุลภาค (,)
        subject: `[คำขอใหม่] ${title}`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px;">
            <h2 style="color: #2563eb; margin-top: 0;">${title}</h2>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 16px 0;" />
            <p><strong>ผู้ขอ/ผู้จอง:</strong> ${requesterName}</p>
            <p><strong>อีเมลผู้ขอ:</strong> ${userEmail || 'ไม่ได้ระบุ'}</p>
            <p><strong>หน่วยงาน/สังกัด:</strong> ${department || 'ไม่ได้ระบุ'}</p>
            <p><strong>รายละเอียด:</strong> ${details}</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 16px 0;" />
            <p style="font-size: 12px; color: #64748b;">อีเมลนี้แจ้งเตือนอัตโนมัติถึง Admin ทุกท่าน</p>
          </div>
        `,
      })

      // 1.2 ส่งยืนยันกลับไปหาผู้ยืม/ผู้จอง
      if (userEmail) {
        await transporter.sendMail({
          from: `"${senderName}" <${process.env.GMAIL_USER}>`,
          to: userEmail,
          subject: `[ยืนยันคำขอ] ${title}`,
          html: `
            <div style="font-family: sans-serif; padding: 20px; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px;">
              <h2 style="color: #2563eb; margin-top: 0;">${title}</h2>
              <p style="font-size: 15px;">เรียนคุณ <strong>${requesterName}</strong>,</p>
              <p style="color: #4b5563;">ระบบได้รับคำขอของคุณเรียบร้อยแล้ว รายละเอียดดังนี้:</p>
              <hr style="border: 0; border-top: 1px solid #eee; margin: 16px 0;" />
              <p><strong>รายละเอียด:</strong> ${details}</p>
              <hr style="border: 0; border-top: 1px solid #eee; margin: 16px 0;" />
              <p style="font-size: 12px; color: #64748b;">อีเมลนี้เป็นการยืนยันคำขออัตโนมัติ (สถานะ: รอการพิจารณา)</p>
            </div>
          `,
        })
      }

      return NextResponse.json({ success: true })
    }

    // 2. กรณีแจ้งเตือนผู้ใช้งาน เมื่อ Admin อนุมัติ (APPROVED) หรือ ปฏิเสธ (REJECTED)
    if (userEmail) {
      const isApproved = status === 'APPROVED'
      const statusText = isApproved ? 'อนุมัติ' : 'ไม่อนุมัติ / ปฏิเสธ'
      const statusColor = isApproved ? '#16a34a' : '#dc2626'

      await transporter.sendMail({
        from: `"${senderName}" <${process.env.GMAIL_USER}>`,
        to: userEmail,
        subject: `[แจ้งผลการพิจารณา] ${title} - ${statusText}`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px;">
            <h2 style="color: #1e293b; margin-top: 0;">ผลการพิจารณาคำขอ</h2>
            <p style="font-size: 15px;">เรียนคุณ <strong>${requesterName || 'ผู้ใช้บริการ'}</strong>,</p>
            
            <div style="padding: 12px 16px; background-color: #f8fafc; border-left: 4px solid ${statusColor}; margin: 16px 0; border-radius: 4px;">
              <p style="margin: 0; font-size: 16px; font-weight: bold; color: ${statusColor};">
                สถานะ: ${statusText}
              </p>
            </div>

            <p><strong>รายการ:</strong> ${title}</p>
            <p><strong>รายละเอียด:</strong> ${details}</p>
            ${note ? `<p><strong>หมายเหตุจาก Admin:</strong> ${note}</p>` : ''}
            
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #64748b;">อีเมลนี้เป็นการแจ้งเตือนอัตโนมัติจากระบบบริการโรงเรียน</p>
          </div>
        `,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const err = error as Error
    console.error('Send Email Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}