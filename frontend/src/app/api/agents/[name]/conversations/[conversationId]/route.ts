/**
 * 会话详情 API 代理
 * GET /api/agents/{name}/conversations/{conversationId}
 * PUT /api/agents/{name}/conversations/{conversationId}
 * DELETE /api/agents/{name}/conversations/{conversationId}
 */
import { NextRequest } from 'next/server';

const BACKEND_URL = 'http://localhost:20881';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string; conversationId: string }> }
) {
  const { name, conversationId } = await params;

  const res = await fetch(`${BACKEND_URL}/api/agents/${encodeURIComponent(name)}/conversations/${encodeURIComponent(conversationId)}`, {
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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ name: string; conversationId: string }> }
) {
  const { name, conversationId } = await params;
  const body = await request.json();

  const res = await fetch(`${BACKEND_URL}/api/agents/${encodeURIComponent(name)}/conversations/${encodeURIComponent(conversationId)}`, {
    method: 'PUT',
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ name: string; conversationId: string }> }
) {
  const { name, conversationId } = await params;

  const res = await fetch(`${BACKEND_URL}/api/agents/${encodeURIComponent(name)}/conversations/${encodeURIComponent(conversationId)}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    return new Response(JSON.stringify({ error: 'Backend error' }), {
      status: res.status,
    });
  }

  const data = await res.json();
  return Response.json(data);
}
