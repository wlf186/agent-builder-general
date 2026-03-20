/**
 * @userGuide
 * @title.en Knowledge Base Selector
 * @title.zh 知识库选择器
 * @category core
 * @description.en Select which knowledge bases your agent can search for relevant information.
 * @description.zh 选择智能体可以搜索的知识库，以获取相关信息。
 * @related KnowledgeBaseDialog, DocumentUploader
 */
"use client";

import { useState, useEffect } from "react";
import { Database } from "lucide-react";
import { MultiSelectPanel } from "@/components/ui/MultiSelectPanel";
import { kbApi, KnowledgeBase } from "@/lib/kbApi";

interface KnowledgeBaseSelectorProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  /** Callback to create new knowledge base */
  onCreateNew?: () => void;
  /** Callback to view knowledge base details */
  onItemClick?: (kb: KnowledgeBase) => void;
}

export function KnowledgeBaseSelector({
  selectedIds,
  onChange,
  disabled = false,
  onCreateNew,
  onItemClick,
}: KnowledgeBaseSelectorProps) {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
    loadKnowledgeBases();
  }, []);

  return (
    <MultiSelectPanel<KnowledgeBase>
      title="知识库配置"
      icon={<Database size={16} />}
      color="emerald"
      hint="选择知识库后，智能体将基于私有文档内容回答问题"
      items={knowledgeBases}
      selectedIds={selectedIds}
      onChange={onChange}
      getId={(kb) => kb.kb_id}
      getTitle={(kb) => kb.name}
      getDescription={(kb) => kb.description || "暂无描述"}
      getBadges={(kb) => [
        { label: `${kb.doc_count} 文档` },
        { label: `${kb.chunk_count} 分块` },
      ]}
      getItemIcon={() => <Database size={14} className="text-emerald-400" />}
      searchPlaceholder="搜索知识库..."
      emptyMessage="还没有知识库，请先创建"
      onCreateNew={onCreateNew}
      onItemClick={onItemClick}
      disabled={disabled}
      loading={loading}
      defaultExpanded={selectedIds.length > 0}
    />
  );
}
