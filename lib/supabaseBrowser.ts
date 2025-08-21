// lib/supabaseBrowser.ts
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export function browserSupabase() {
    if (typeof window !== 'undefined') {
        console.log('[DEBUG] origin =', window.location.origin);
        console.log('[DEBUG] NEXT_PUBLIC_SUPABASE_URL =', process.env.NEXT_PUBLIC_SUPABASE_URL);
    }
    return createClientComponentClient();
}
