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
  console.log(`[API] ${message}`, data || '');
}

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const agentPath = path.join('/');
  const backendUrl = `${BACKEND_URL}/api/${agentPath}`;

  log('GET 请求', { agentPath, backendUrl });

  const res = await fetch(backendUrl);
  const data = await res.json();

  log('GET 响应', { status: res.status });

  return Response.json(data);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const agentPath = path.join('/');
  const body = await request.json();

  const backendUrl = `${BACKEND_URL}/api/${agentPath}`;
  log('POST 请求', { agentPath, backendUrl });

  const res = await fetch(backendUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  log('POST 响应', { status: res.status, contentType: res.headers.get('content-type') });

  // 如果是流式响应
  if (res.headers.get('content-type')?.includes('text/event-stream')) {
    log('流式透传');
    return new Response(res.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Accel-Buffering': 'no',
      },
    });
  }

  // 普通响应
  const data = await res.json();
  return Response.json(data);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const agentPath = path.join('/');
  const body = await request.json();

  const backendUrl = `${BACKEND_URL}/api/${agentPath}`;
  log('PUT 请求', { agentPath });

  const res = await fetch(backendUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return Response.json(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const agentPath = path.join('/');
  const backendUrl = `${BACKEND_URL}/api/${agentPath}`;

  log('DELETE 请求', { agentPath });

  const res = await fetch(backendUrl, { method: 'DELETE' });
  const data = await res.json();
  return Response.json(data);
}
