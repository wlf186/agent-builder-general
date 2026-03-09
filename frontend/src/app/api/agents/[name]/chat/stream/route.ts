import { NextRequest } from 'next/server';
import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const BACKEND_URL = 'http://localhost:20881';

function log(message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logPath = join(process.cwd(), '..', 'logs');
  if (!existsSync(logPath)) mkdirSync(logPath, { recursive: true });
  const logFile = join(logPath, 'stream-debug.txt');
  const entry = `[${timestamp}] ${message}${data ? ' ' + JSON.stringify(data) : ''}\n`;
  try {
    appendFileSync(logFile, entry);
  } catch (e) {}
  console.log(`[STREAM] ${message}`, data || '');
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  log('=== API Route 被调用 ===');

  const { name } = await params;
  const body = await request.json();

  log('请求参数', { agentName: name, message: body.message });

  const backendUrl = `${BACKEND_URL}/api/agents/${encodeURIComponent(name)}/chat/stream`;
  log('转发到后端', { backendUrl });

  const res = await fetch(backendUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  log('后端响应', { status: res.status, ok: res.ok });

  if (!res.ok) {
    log('后端错误', { status: res.status });
    return new Response(JSON.stringify({ error: 'Backend error' }), {
      status: res.status,
    });
  }

  log('开始流式透传');

  // 直接透传响应体，保持流式
  return new Response(res.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Accel-Buffering': 'no',
    },
  });
}
