import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function GET(
  req: NextRequest,
  { params }: { params: { customerId: string } }
): Promise<NextResponse> {
  try {
    // ── Auth validation ──────────────────────────────────────────────────────
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    }

    // Forward Authorization header so backend can validate JWT and ownership
    const authHeader = req.headers.get('authorization') || '';
    const res = await fetch(`${BACKEND_URL}/api/instances/${params.customerId}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: 'Not found' }));
      return NextResponse.json(body, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Proxy error';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
