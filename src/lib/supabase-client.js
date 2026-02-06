//src/lib/supabase-client.js
import { createClient } from '@supabase/supabase-js'

// Estas variables deben estar en tu .env.local
// NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
// NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_clave_anonima_publica

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)