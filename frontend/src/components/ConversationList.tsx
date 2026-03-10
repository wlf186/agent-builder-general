/**
 * 会话列表组件
 * 按时间分组显示会话列表
 */
"use client";

import { useMemo } from "react";
import { useLocale } from "@/lib/LocaleContext";
import { ConversationCard, Conversation } from "./ConversationCard";

// 重新导出 Conversation 类型供其他组件使用
export type { Conversation };

interface ConversationListProps {
  conversations: Conversation[];
  currentId: string | null;
  isLoading: boolean;
  searchQuery: string;
  onSelect: (id: string) => void;
  onRename: (id: string, newTitle: string) => void;
  onDelete: (id: string) => void;
}

interface GroupedConversations {
  label: string;
  conversations: Conversation[];
}

export function ConversationList({
  conversations,
  currentId,
  isLoading,
  searchQuery,
  onSelect,
  onRename,
  onDelete,
}: ConversationListProps) {
  const { locale } = useLocale();

  // 过滤会话
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    return conversations.filter((conv: Conversation) => {
      const preview = conv.preview || "";
      const title = conv.title.toLowerCase();
      return (
        title.includes(searchQuery.toLowerCase()) ||
        preview.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [conversations, searchQuery]);

  // 按时间分组
  const groupedConversations = useMemo((): GroupedConversations[] => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const last7Days = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);

    const groups: GroupedConversations[] = [];

    // 今天
    const todayConvs = filteredConversations.filter((conv: Conversation) => {
      const date = new Date(conv.updated_at);
      return date >= today;
    });
    if (todayConvs.length > 0) {
      groups.push({
        label: locale === "zh" ? "今天" : "Today",
        conversations: todayConvs
      });
    }

    // 昨天
    const yesterdayConvs = filteredConversations.filter((conv: Conversation) => {
      const date = new Date(conv.updated_at);
      return date >= yesterday && date < today;
    });
    if (yesterdayConvs.length > 0) {
      groups.push({
        label: locale === "zh" ? "昨天" : "Yesterday",
        conversations: yesterdayConvs
      });
    }

    // 7天内
    const last7DaysConvs = filteredConversations.filter((conv: Conversation) => {
      const date = new Date(conv.updated_at);
      return date >= last7Days && date < yesterday;
    });
    if (last7DaysConvs.length > 0) {
      groups.push({
        label: locale === "zh" ? "7天内" : "Last 7 Days",
        conversations: last7DaysConvs
      });
    }

    // 更早
    const earlierConvs = filteredConversations.filter((conv: Conversation) => {
      const date = new Date(conv.updated_at);
      return date < last7Days;
    });
    if (earlierConvs.length > 0) {
      groups.push({
        label: locale === "zh" ? "更早" : "Earlier",
        conversations: earlierConvs
      });
    }

    return groups;
  }, [filteredConversations, locale]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin w-5 h-5 text-gray-400 mr-2" />
        <span className="text-sm text-gray-500">
          {locale === "zh" ? "加载中..." : "Loading..."}
        </span>
      </div>
    );
  }

  if (filteredConversations.length === 0) {
    return null;
  }

  return (
    <div className="space-y-1">
      {groupedConversations.map((group) => (
        <div key={group.label}>
          {/* 日期标题 */}
          <div className="px-4 py-2 sticky top-0 bg-[#0a1f14]/80 z-10">
            <span className="text-xs font-medium text-gray-500">
              {group.label}
            </span>
          </div>
          {/* 会话卡片 */}
          {group.conversations.map((conv) => (
            <ConversationCard
              key={conv.id}
              conversation={conv}
              isActive={currentId === conv.id}
              onSelect={() => onSelect(conv.id)}
              onRename={(newTitle) => onRename(conv.id, newTitle)}
              onDelete={() => onDelete(conv.id)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
