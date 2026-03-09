import { NextRequest } from 'next/server';

const BACKEND_URL = 'http://localhost:20881';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const body = await request.json();

  console.log(`[STREAM] 请求: ${name}`);

  const res = await fetch(`${BACKEND_URL}/api/agents/${encodeURIComponent(name)}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  if (!res.ok) {
    return new Response(JSON.stringify({ error: 'Backend error' }), {
      status: res.status,
    });
  }

  // 直接透传流式响应
  return new Response(res.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Accel-Buffering': 'no',
    },
  });
}
