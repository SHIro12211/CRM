// Composable to create and export a Supabase client instance
import { createClient } from '@supabase/supabase-js'
export function useSupabase() {
    const config= useRuntimeConfig()
    return createClient(
        String(config.public.supabaseUrl),
         String(config.public.supabasePublishableKey)
        )
    }
