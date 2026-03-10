/**
 * 会话列表 API 代理
 * GET /api/agents/{name}/conversations
 * POST /api/agents/{name}/conversations
 */
import { NextRequest } from 'next/server';

const BACKEND_URL = 'http://localhost:20881';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  const res = await fetch(`${BACKEND_URL}/api/agents/${encodeURIComponent(name)}/conversations`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    return new Response(JSON.stringify({ error: 'Backend error' }), {
      status: res.status,
    });
  }

  const data = await res.json();
  return Response.json(data);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const body = await request.json();

  const res = await fetch(`${BACKEND_URL}/api/agents/${encodeURIComponent(name)}/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    return new Response(JSON.stringify({ error: 'Backend error' }), {
      status: res.status,
    });
  }

  const data = await res.json();
  return Response.json(data);
}
