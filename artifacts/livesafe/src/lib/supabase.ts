import { createClient } from '@supabase/supabase-js'
console.log('SUPABASE URL:', import.meta.env.VITE_SUPABASE_URL)
console.log('SUPABASE KEY:', import.meta.env.VITE_SUPABASE_ANON_KEY?.slice(0, 20))
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || supabaseUrl === 'https://YOUR_PROJECT_ID.supabase.co') {
  console.warn(
    '[LiveSafe] VITE_SUPABASE_URL is not configured. ' +
    'Copy .env.example to .env and fill in your Supabase project URL.'
  )
}

if (!supabaseAnonKey || supabaseAnonKey === 'YOUR_SUPABASE_ANON_KEY') {
  console.warn(
    '[LiveSafe] VITE_SUPABASE_ANON_KEY is not configured. ' +
    'The app will use mock data until Supabase is connected.'
  )
}

// Safe fallback so createClient doesn't throw on missing env vars
const safeUrl = supabaseUrl || 'https://placeholder.supabase.co'
const safeKey = supabaseAnonKey || 'placeholder-key'

export const supabase = createClient(safeUrl, safeKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

export const isSupabaseConfigured =
  Boolean(supabaseUrl) &&
  !supabaseUrl.includes('YOUR_PROJECT_ID') &&
  Boolean(supabaseAnonKey) &&
  !supabaseAnonKey.includes('YOUR_SUPABASE_ANON_KEY')
