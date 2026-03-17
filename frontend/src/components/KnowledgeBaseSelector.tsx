"use client";

import { useState, useEffect } from "react";
import { kbApi, KnowledgeBase } from "@/lib/kbApi";
import { ChevronDown, Check } from "lucide-react";

interface KnowledgeBaseSelectorProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

export function KnowledgeBaseSelector({
  selectedIds,
  onChange,
  disabled = false,
}: KnowledgeBaseSelectorProps) {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const loadKnowledgeBases = async () => {
    setLoading(true);
    try {
      const data = await kbApi.listKnowledgeBases();
      setKnowledgeBases(data);
    } catch (error) {
      console.error("加载知识库失败:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKnowledgeBases();
  }, []);

  const handleToggle = (kbId: string) => {
    if (selectedIds.includes(kbId)) {
      onChange(selectedIds.filter((id) => id !== kbId));
    } else {
      onChange([...selectedIds, kbId]);
    }
  };

  const getSelectedNames = () => {
    return knowledgeBases
      .filter((kb) => selectedIds.includes(kb.kb_id))
      .map((kb) => kb.name);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={disabled}
        className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="text-gray-700">
          {selectedIds.length === 0
            ? "选择知识库..."
            : `已选择 ${selectedIds.length} 个知识库`}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-400" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
            {loading ? (
              <div className="p-3 text-center text-gray-500">加载中...</div>
            ) : knowledgeBases.length === 0 ? (
              <div className="p-3 text-center text-gray-500">
                还没有知识库，请先创建
              </div>
            ) : (
              <div>
                {knowledgeBases.map((kb) => {
                  const isSelected = selectedIds.includes(kb.kb_id);
                  return (
                    <button
                      key={kb.kb_id}
                      type="button"
                      onClick={() => handleToggle(kb.kb_id)}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1 text-left">
                        <p className="font-medium text-gray-900">{kb.name}</p>
                        <p className="text-xs text-gray-500">{kb.description || "暂无描述"}</p>
                      </div>
                      {isSelected && (
                        <Check className="w-5 h-5 text-emerald-600" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* 已选知识库标签 */}
      {selectedIds.length > 0 && !open && (
        <div className="flex flex-wrap gap-2 mt-2">
          {getSelectedNames().map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-sm"
            >
              {name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
