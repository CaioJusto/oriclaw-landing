/**
 * Next.js API route: /api/credits
 *
 * Proxies credit-related requests to the OriClaw backend.
 * POST forwards to /api/credits/purchase (Stripe Hosted Checkout).
 */
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get('authorization') || '';
  try {
    const upstream = await fetch(`${BACKEND_URL}/api/credits`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
    });
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Credits proxy error';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get('authorization') || '';
  try {
    const body = await req.json();
    const upstream = await fetch(`${BACKEND_URL}/api/credits/purchase`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify(body),
    });
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Credits proxy error';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
