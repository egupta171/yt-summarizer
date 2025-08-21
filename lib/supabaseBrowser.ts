// lib/supabaseBrowser.ts
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export function browserSupabase() {
    return createClientComponentClient();
}
