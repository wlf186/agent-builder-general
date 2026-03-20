"use client";

import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { KnowledgeBase } from "@/lib/kbApi";
import { useLocale } from "@/lib/LocaleContext";

interface KnowledgeBaseSidebarProps {
  knowledgeBases: KnowledgeBase[];
  selectedKbId: string | null;
  onSelectKb: (kb: KnowledgeBase) => void;
  onCreateKb: () => void;
  expanded: boolean;
  onToggleExpand: () => void;
}

export function KnowledgeBaseSidebar({
  knowledgeBases,
  selectedKbId,
  onSelectKb,
  onCreateKb,
  expanded,
  onToggleExpand,
}: KnowledgeBaseSidebarProps) {
  const { locale } = useLocale();
  const zh = locale === "zh";

  return (
    <div className="px-5 py-4 border-t border-white/[0.05]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={onToggleExpand}
          className="flex items-center gap-2 text-xs text-gray-500 uppercase tracking-wider hover:text-gray-400 transition-colors"
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          {zh ? "知识库" : "Knowledge"}
          <span className="text-gray-600 normal-case">({knowledgeBases.length})</span>
        </button>
        <button
          onClick={onCreateKb}
          className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
        >
          <Plus size={12} className="text-gray-400" />
        </button>
      </div>

      {/* Knowledge Base List */}
      {expanded && (
        <div className="space-y-1.5">
          {knowledgeBases.length === 0 ? (
            <div className="text-xs text-gray-600 py-2">
              {zh ? "暂无知识库" : "No knowledge bases"}
            </div>
          ) : (
            knowledgeBases.map((kb) => (
              <div
                key={kb.kb_id}
                className={`rounded-lg hover:bg-white/5 cursor-pointer ${
                  selectedKbId === kb.kb_id ? "bg-white/5" : ""
                }`}
              >
                <div
                  className="flex items-center justify-between py-2 px-3"
                  onClick={() => onSelectKb(kb)}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        selectedKbId === kb.kb_id
                          ? "bg-emerald-500 shadow-lg shadow-emerald-500/50"
                          : "bg-gray-500"
                      }`}
                    />
                    <span className="text-sm text-gray-300 truncate">{kb.name}</span>
                  </div>
                  <span className="text-xs text-gray-600">
                    {kb.doc_count} {zh ? "篇" : "docs"}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
