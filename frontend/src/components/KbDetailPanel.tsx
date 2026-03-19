"use client";

import { useState, useEffect, useRef } from "react";
import { X, Upload, FileText, Trash2, Search, Loader2 } from "lucide-react";
import { kbApi, KnowledgeBase, Document } from "@/lib/kbApi";

interface KbDetailPanelProps {
  knowledgeBase: KnowledgeBase;
  onClose: () => void;
  onUpdate: () => void;
}

export function KbDetailPanel({ knowledgeBase, onClose, onUpdate }: KbDetailPanelProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    setUploading(true);
    try {
      for (const file of files) {
        await kbApi.uploadDocument(knowledgeBase.kb_id, file);
      }
      await loadDocuments();
      onUpdate();
    } catch (error) {
      alert("上传失败: " + (error instanceof Error ? error.message : "未知错误"));
    } finally {
      setUploading(false);
    }
  };

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const docs = await kbApi.listDocuments(knowledgeBase.kb_id);
      setDocuments(docs);
    } catch (error) {
      console.error("Failed to load documents:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [knowledgeBase.kb_id]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await kbApi.uploadDocument(knowledgeBase.kb_id, file);
      }
      await loadDocuments();
      onUpdate();
    } catch (error) {
      alert("上传失败: " + (error instanceof Error ? error.message : "未知错误"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm("确定要删除这个文档吗？")) return;
    try {
      await kbApi.deleteDocument(knowledgeBase.kb_id, docId);
      await loadDocuments();
      onUpdate();
    } catch (error) {
      alert("删除失败: " + (error instanceof Error ? error.message : "未知错误"));
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await kbApi.search(knowledgeBase.kb_id, {
        query: searchQuery,
        top_k: 3,
        score_threshold: 0.6,
      });
      setSearchResults(results);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setSearching(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const styles: Record<string, string> = {
      ready: "bg-green-100 text-green-700",
      processing: "bg-yellow-100 text-yellow-700",
      failed: "bg-red-100 text-red-700",
    };

    const labels: Record<string, string> = {
      ready: "Ready",
      processing: "Processing",
      failed: "Failed",
    };

    return (
      <span className={`text-xs px-2 py-0.5 rounded ${styles[status] || styles.ready}`}>
        {labels[status] || status}
      </span>
    );
  };

  return (
    <div className="fixed inset-y-0 right-0 w-[480px] bg-white shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{knowledgeBase.name}</h2>
          <p className="text-sm text-gray-500">{knowledgeBase.description || "暂无描述"}</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 p-4 border-b bg-gray-50">
        <div className="text-center">
          <p className="text-2xl font-semibold text-gray-900">{knowledgeBase.doc_count}</p>
          <p className="text-xs text-gray-500">文档</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-semibold text-gray-900">{knowledgeBase.chunk_count}</p>
          <p className="text-xs text-gray-500">文档块</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-semibold text-gray-900">{formatFileSize(knowledgeBase.total_size)}</p>
          <p className="text-xs text-gray-500">总大小</p>
        </div>
      </div>

      {/* Upload */}
      <div className="p-4 border-b">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt,.md"
          multiple
          onChange={handleFileUpload}
          className="hidden"
        />
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`w-full flex flex-col items-center justify-center gap-1 px-4 py-6 border-2 border-dashed rounded-lg transition-colors cursor-pointer ${
            isDragging
              ? "border-emerald-500 bg-emerald-50"
              : "border-gray-300 hover:border-emerald-500 hover:bg-emerald-50"
          } ${uploading ? "opacity-50 pointer-events-none" : ""}`}
        >
          {uploading ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
              <span className="text-sm text-gray-600">上传中...</span>
            </>
          ) : (
            <>
              <Upload className="w-6 h-6 text-gray-400" />
              <span className="text-sm text-gray-600">拖拽文件到此处或点击上传</span>
              <span className="text-xs text-gray-400">支持 PDF/DOCX/TXT/MD</span>
            </>
          )}
        </div>
      </div>

      {/* Search Test */}
      <div className="p-4 border-b">
        <h3 className="text-sm font-medium text-gray-700 mb-2">检索测试</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="输入测试问题..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            onClick={handleSearch}
            disabled={searching}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
          >
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </button>
        </div>
        {searchResults.length > 0 && (
          <div className="mt-3 space-y-2">
            {searchResults.map((result, i) => (
              <div key={i} className="p-2 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500">{result.filename}</span>
                  <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">
                    {(result.score * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="text-sm text-gray-700 line-clamp-2">{result.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Documents List */}
      <div className="flex-1 overflow-auto">
        <div className="p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">文档列表 ({documents.length})</h3>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>还没有上传文档</p>
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.doc_id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 truncate">{doc.filename}</p>
                        <StatusBadge status={doc.status} />
                      </div>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(doc.file_size)} · {doc.chunk_count} 个文档块
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteDocument(doc.doc_id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
