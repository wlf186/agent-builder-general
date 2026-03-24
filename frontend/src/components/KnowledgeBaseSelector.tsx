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
import { useLocale } from "@/lib/LocaleContext";

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
  const { locale } = useLocale();
  const zh = locale === "zh";
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadKnowledgeBases = async () => {
      setLoading(true);
      try {
        const data = await kbApi.listKnowledgeBases();
        setKnowledgeBases(data);
      } catch (error) {
        console.error(zh ? "加载知识库失败:" : "Failed to load knowledge bases:", error);
      } finally {
        setLoading(false);
      }
    };
    loadKnowledgeBases();
  }, [zh]);

  return (
    <MultiSelectPanel<KnowledgeBase>
      title={zh ? "知识库工具" : "Knowledge Tools"}
      icon={<Database size={16} />}
      color="emerald"
      hint={zh
        ? "检索私有文档，让 Agent 基于你的资料回答"
        : "Search private documents to answer based on your data"
      }
      items={knowledgeBases}
      selectedIds={selectedIds}
      onChange={onChange}
      getId={(kb) => kb.kb_id}
      getTitle={(kb) => kb.name}
      getDescription={(kb) => kb.description || (zh ? "暂无描述" : "No description")}
      getBadges={(kb) => [
        { label: `${kb.doc_count} ${zh ? "文档" : "docs"}` },
        { label: `${kb.chunk_count} ${zh ? "分块" : "chunks"}` },
      ]}
      getItemIcon={() => <Database size={14} className="text-emerald-400" />}
      searchPlaceholder={zh ? "搜索知识库..." : "Search knowledge bases..."}
      emptyMessage={zh ? "还没有知识库，请先创建" : "No knowledge bases yet, please create one"}
      onCreateNew={onCreateNew}
      onItemClick={onItemClick}
      disabled={disabled}
      loading={loading}
      defaultExpanded={selectedIds.length > 0}
    />
  );
}
