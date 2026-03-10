/**
 * 添加消息到会话 API 代理
 * POST /api/agents/{name}/conversations/{conversationId}/messages
 */
import { NextRequest } from 'next/server';

const BACKEND_URL = 'http://localhost:20881';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string; conversationId: string }> }
) {
  const { name, conversationId } = await params;
  const body = await request.json();

  const res = await fetch(`${BACKEND_URL}/api/agents/${encodeURIComponent(name)}/conversations/${encodeURIComponent(conversationId)}/messages`, {
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
