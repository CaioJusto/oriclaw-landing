/**
 * Next.js API route: /api/proxy/[...path]
 *
 * Forwards dashboard requests to the OriClaw backend proxy routes,
 * injecting the backend API secret server-side.
 *
 * The client sends: Authorization: Bearer <supabase_access_token>
 * We validate the JWT server-side with Supabase, then forward to the backend.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

// UUID pattern for instance IDs — the backend validates ownership
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whitelist of allowed first path segments */
function isPathAllowed(firstSegment: string): boolean {
  // Instance ID paths (UUID) — backend validates ownership
  if (UUID_PATTERN.test(firstSegment)) return true;
  return false;
}

async function handler(
  req: NextRequest,
  { params }: { params: { path: string[] } }
): Promise<NextResponse> {
  // ── Auth validation ──────────────────────────────────────────────────────
  const supabase = createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  const pathSegments = params.path as string[];

  // Bloquear path traversal
  if (pathSegments.some(segment => segment === '..' || segment === '.' || segment.includes('/'))) {
    return NextResponse.json({ error: 'Path inválido.' }, { status: 400 });
  }

  // ── Whitelist validation ─────────────────────────────────────────────────
  if (pathSegments.length === 0 || !isPathAllowed(pathSegments[0])) {
    return NextResponse.json({ error: 'Path não permitido.' }, { status: 403 });
  }

  const pathStr = pathSegments.join('/');
  const queryString = req.nextUrl.search; // includes leading '?' if present
  const targetUrl = `${BACKEND_URL}/api/proxy/${pathStr}${queryString}`;

  // Forward the validated token from the original request
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

    // Handle non-JSON responses gracefully
    const contentType = upstream.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const data = await upstream.json();
      return NextResponse.json(data, { status: upstream.status });
    }

    // Non-JSON: try to parse as JSON, fall back to text
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
    const msg = err instanceof Error ? err.message : 'Proxy error';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

export { handler as GET, handler as POST, handler as DELETE };
