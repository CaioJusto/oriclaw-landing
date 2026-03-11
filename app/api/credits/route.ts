/**
 * Next.js API route: /api/credits
 *
 * Proxies credit-related requests to the OriClaw backend.
 */
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

async function handler(req: NextRequest): Promise<NextResponse> {
  const targetUrl = `${BACKEND_URL}/api/credits`;
  const authHeader = req.headers.get('authorization') ?? '';

  const init: RequestInit = {
    method: req.method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
    },
  };

  if (req.method === 'POST') {
    const body = await req.text();
    if (body) init.body = body;
  }

  try {
    const upstream = await fetch(targetUrl, init);
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Credits proxy error';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

export { handler as GET, handler as POST };
