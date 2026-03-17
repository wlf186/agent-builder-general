'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  listKnowledgeBases,
  createKnowledgeBase,
  deleteKnowledgeBase,
  KnowledgeBase
} from '@/lib/knowledgeBaseApi';

export default function KnowledgeBasesPage() {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newKBName, setNewKBName] = useState('');
  const [newKBDescription, setNewKBDescription] = useState('');
  const [creating, setCreating] = useState(false);

  // Load knowledge bases
  const loadKnowledgeBases = async () => {
    try {
      setLoading(true);
      const kbs = await listKnowledgeBases();
      setKnowledgeBases(kbs);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load knowledge bases');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKnowledgeBases();
  }, []);

  // Create knowledge base
  const handleCreate = async () => {
    if (!newKBName.trim()) {
      alert('请输入知识库名称');
      return;
    }

    try {
      setCreating(true);
      await createKnowledgeBase({
        name: newKBName,
        description: newKBDescription,
      });
      setShowCreateDialog(false);
      setNewKBName('');
      setNewKBDescription('');
      await loadKnowledgeBases();
    } catch (err) {
      alert(err instanceof Error ? err.message : '创建失败');
    } finally {
      setCreating(false);
    }
  };

  // Delete knowledge base
  const handleDelete = async (kb: KnowledgeBase) => {
    if (!confirm(`确定要删除知识库 "${kb.name}" 吗？此操作不可恢复。`)) {
      return;
    }

    try {
      await deleteKnowledgeBase(kb.kb_id);
      await loadKnowledgeBases();
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败');
    }
  };

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">知识库管理</h1>
            <p className="text-gray-500 mt-1">管理文档知识库，为智能体提供检索增强生成能力</p>
          </div>
          <button
            onClick={() => setShowCreateDialog(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            创建知识库
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
            <p className="text-gray-500 mt-4">加载中...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && knowledgeBases.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg border">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900">暂无知识库</h3>
            <p className="text-gray-500 mt-2">创建第一个知识库，开始为智能体提供知识检索能力</p>
            <button
              onClick={() => setShowCreateDialog(true)}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              创建知识库
            </button>
          </div>
        )}

        {/* Knowledge Base List */}
        {!loading && knowledgeBases.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {knowledgeBases.map((kb) => (
              <div key={kb.kb_id} className="bg-white rounded-lg border hover:shadow-md transition-shadow">
                <Link href={`/knowledge-bases/${kb.kb_id}`} className="block p-5">
                  <h3 className="font-semibold text-gray-900 text-lg">{kb.name}</h3>
                  <p className="text-gray-500 text-sm mt-1 line-clamp-2">{kb.description || '暂无描述'}</p>
                  
                  <div className="flex items-center gap-4 mt-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      {kb.doc_count} 文档
                    </span>
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                      </svg>
                      {kb.chunk_count} 块
                    </span>
                    <span>{formatSize(kb.total_size)}</span>
                  </div>
                </Link>

                <div className="border-t px-5 py-3 flex justify-end gap-2">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      handleDelete(kb);
                    }}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Dialog */}
        {showCreateDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
              <div className="p-6">
                <h2 className="text-lg font-semibold mb-4">创建知识库</h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      知识库名称 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newKBName}
                      onChange={(e) => setNewKBName(e.target.value)}
                      placeholder="例如：人力资源库"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      描述
                    </label>
                    <textarea
                      value={newKBDescription}
                      onChange={(e) => setNewKBDescription(e.target.value)}
                      placeholder="描述知识库包含的内容，帮助 AI 判断何时使用此知识库"
                      rows={3}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      描述信息将作为 LLM 判断是否调用此知识库的依据
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => setShowCreateDialog(false)}
                    className="px-4 py-2 text-gray-700 hover:text-gray-900"
                    disabled={creating}
                  >
                    取消
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={creating}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {creating ? '创建中...' : '创建'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
