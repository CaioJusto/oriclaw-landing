/**
 * Next.js API route: /api/admin/[...path]
 *
 * Proxies admin requests to the OriClaw backend admin routes.
 * Auth is validated both here (Supabase JWT) and on the backend (requireSuperAdmin).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

async function handler(
  req: NextRequest,
  { params }: { params: { path: string[] } }
): Promise<NextResponse> {
  const supabase = createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  const pathSegments = params.path as string[];

  if (pathSegments.some(s => s === '..' || s === '.' || s.includes('/'))) {
    return NextResponse.json({ error: 'Path inválido.' }, { status: 400 });
  }

  const pathStr = pathSegments.join('/');
  const queryString = req.nextUrl.search;
  const targetUrl = `${BACKEND_URL}/api/admin/${pathStr}${queryString}`;

  const authHeader = req.headers.get('authorization') ?? '';

  const init: RequestInit = {
    method: req.method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
    },
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const body = await req.text();
    if (body) init.body = body;
  }

  try {
    const upstream = await fetch(targetUrl, init);
    const contentType = upstream.headers.get('content-type') ?? '';

    if (contentType.includes('application/json')) {
      const data = await upstream.json();
      return NextResponse.json(data, { status: upstream.status });
    }

    const text = await upstream.text();
    try {
      const data = JSON.parse(text);
      return NextResponse.json(data, { status: upstream.status });
    } catch {
      return new NextResponse(text, {
        status: upstream.status,
        headers: { 'Content-Type': contentType || 'text/plain' },
      });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Admin proxy error';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

export { handler as GET, handler as POST, handler as PUT };
