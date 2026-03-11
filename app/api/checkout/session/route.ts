import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? '';
  const body = await req.json();

  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';

  const res = await fetch(`${backendUrl}/api/checkout/session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
