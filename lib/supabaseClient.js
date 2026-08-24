import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Supabase URL หรือ Anon Key ไม่ถูกต้องในไฟล์ .env.local')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)