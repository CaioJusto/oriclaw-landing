/**
 * Next.js API route: /api/auth/[...path]
 *
 * Forwards auth requests (OpenAI OAuth etc.) to the OriClaw backend.
 * The client sends: Authorization: Bearer <supabase_access_token>
 */
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

async function handler(
  req: NextRequest,
  { params }: { params: { path: string[] } }
): Promise<NextResponse> {
  const pathSegments = params.path as string[];

  // Block path traversal
  if (pathSegments.some(segment => segment === '..' || segment === '.' || segment.includes('/'))) {
    return NextResponse.json({ error: 'Path inválido.' }, { status: 400 });
  }

  const pathStr = pathSegments.join('/');
  const targetUrl = `${BACKEND_URL}/api/auth/${pathStr}`;

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
    const msg = err instanceof Error ? err.message : 'Auth proxy error';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

export { handler as GET, handler as POST };
