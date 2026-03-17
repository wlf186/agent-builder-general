/**
 * 知识库 API 客户端
 * Knowledge Base API Client
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:20881';

// Types
export interface KnowledgeBase {
  kb_id: string;
  name: string;
  description: string;
  embedding_model: string;
  created_at: string;
  updated_at: string;
  doc_count: number;
  chunk_count: number;
  total_size: number;
}

export interface Document {
  doc_id: string;
  kb_id: string;
  filename: string;
  file_size: number;
  file_path: string;
  mime_type: string;
  chunk_count: number;
  char_count: number;
  status: 'processing' | 'ready' | 'failed';
  uploaded_at: string;
  processed_at?: string;
  error_message?: string;
}

export interface RetrievalResult {
  content: string;
  doc_id: string;
  filename: string;
  score: number;
  chunk_index: number;
}

export interface CreateKBRequest {
  name: string;
  description: string;
  embedding_model?: string;
}

export interface SearchRequest {
  query: string;
  top_k?: number;
  score_threshold?: number;
}

// API Functions

/**
 * 获取所有知识库列表
 */
export async function listKnowledgeBases(): Promise<KnowledgeBase[]> {
  const response = await fetch(`${API_BASE}/api/knowledge-bases`);
  if (!response.ok) {
    throw new Error(`Failed to list knowledge bases: ${response.statusText}`);
  }
  const data = await response.json();
  return data.knowledge_bases || [];
}

/**
 * 获取单个知识库详情
 */
export async function getKnowledgeBase(kbId: string): Promise<KnowledgeBase> {
  const response = await fetch(`${API_BASE}/api/knowledge-bases/${kbId}`);
  if (!response.ok) {
    throw new Error(`Failed to get knowledge base: ${response.statusText}`);
  }
  return response.json();
}

/**
 * 创建知识库
 */
export async function createKnowledgeBase(req: CreateKBRequest): Promise<KnowledgeBase> {
  const response = await fetch(`${API_BASE}/api/knowledge-bases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to create knowledge base');
  }
  return response.json();
}

/**
 * 删除知识库
 */
export async function deleteKnowledgeBase(kbId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/knowledge-bases/${kbId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Failed to delete knowledge base: ${response.statusText}`);
  }
}

/**
 * 获取知识库文档列表
 */
export async function listDocuments(kbId: string): Promise<Document[]> {
  const response = await fetch(`${API_BASE}/api/knowledge-bases/${kbId}/documents`);
  if (!response.ok) {
    throw new Error(`Failed to list documents: ${response.statusText}`);
  }
  const data = await response.json();
  return data.documents || [];
}

/**
 * 上传文档到知识库
 */
export async function uploadDocument(
  kbId: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<Document> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error(`Upload failed: ${xhr.statusText}`));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Upload failed'));
    });

    xhr.open('POST', `${API_BASE}/api/knowledge-bases/${kbId}/documents`);
    xhr.send(formData);
  });
}

/**
 * 删除文档
 */
export async function deleteDocument(kbId: string, docId: string): Promise<void> {
  const response = await fetch(
    `${API_BASE}/api/knowledge-bases/${kbId}/documents/${docId}`,
    { method: 'DELETE' }
  );
  if (!response.ok) {
    throw new Error(`Failed to delete document: ${response.statusText}`);
  }
}

/**
 * 检索知识库
 */
export async function searchKnowledgeBase(
  kbId: string,
  req: SearchRequest
): Promise<RetrievalResult[]> {
  const response = await fetch(`${API_BASE}/api/knowledge-bases/${kbId}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!response.ok) {
    throw new Error(`Search failed: ${response.statusText}`);
  }
  const data = await response.json();
  return data.results || [];
}

/**
 * 获取知识库统计信息
 */
export async function getKnowledgeBaseStats(kbId: string): Promise<{
  doc_count: number;
  chunk_count: number;
  total_size: number;
}> {
  const response = await fetch(`${API_BASE}/api/knowledge-bases/${kbId}/stats`);
  if (!response.ok) {
    throw new Error(`Failed to get stats: ${response.statusText}`);
  }
  return response.json();
}
