/**
 * Next.js API route: /api/proxy/[...path]
 *
 * Forwards dashboard requests to the OriClaw backend proxy routes,
 * injecting the backend API secret server-side.
 *
 * The client sends: Authorization: Bearer <supabase_access_token>
 * We forward that token to the backend which validates it against Supabase.
 */
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

async function handler(
  req: NextRequest,
  { params }: { params: { path: string[] } }
): Promise<NextResponse> {
  const pathStr = params.path.join('/');
  const targetUrl = `${BACKEND_URL}/api/proxy/${pathStr}`;

  const authHeader = req.headers.get('authorization') ?? '';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: authHeader,
  };

  const init: RequestInit = {
    method: req.method,
    headers,
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const body = await req.text();
    if (body) init.body = body;
  }

  try {
    const upstream = await fetch(targetUrl, init);
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Proxy error';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

export { handler as GET, handler as POST, handler as DELETE };
