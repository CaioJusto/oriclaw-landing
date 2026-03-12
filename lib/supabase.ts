import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// createBrowserClient stores session in cookies (not localStorage),
// enabling server-side auth checks in Next.js middleware.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
