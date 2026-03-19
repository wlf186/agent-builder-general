"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Database } from "lucide-react";
import { KnowledgeBase } from "@/lib/kbApi";

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
  return (
    <div className="mb-4">
      {/* Header */}
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
        <Database className="w-4 h-4 text-emerald-600" />
        <span>Knowledge</span>
        {knowledgeBases.length > 0 && (
          <span className="ml-auto bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full">
            {knowledgeBases.length}
          </span>
        )}
      </button>

      {/* Knowledge Base List */}
      {expanded && (
        <div className="mt-1 ml-4 space-y-1">
          {knowledgeBases.map((kb) => (
            <button
              key={kb.kb_id}
              onClick={() => onSelectKb(kb)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                selectedKbId === kb.kb_id
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <span className="truncate">{kb.name}</span>
              <span className="ml-auto text-xs text-gray-400">
                {kb.doc_count} docs
              </span>
            </button>
          ))}

          {/* Create Button */}
          <button
            onClick={onCreateKb}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-dashed border-gray-200 hover:border-emerald-300"
          >
            <Plus className="w-4 h-4" />
            <span>Create Knowledge Base</span>
          </button>
        </div>
      )}
    </div>
  );
}
