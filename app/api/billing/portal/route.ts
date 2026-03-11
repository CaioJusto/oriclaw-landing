import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? '';

  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';

  const res = await fetch(`${backendUrl}/api/billing/portal`, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
