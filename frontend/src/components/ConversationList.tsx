/**
 * 会话列表组件
 * 按时间分组显示会话列表
 */
"use client";

/**
 * @userGuide
 * @title.en Conversation List
 * @title.zh 会话列表
 * @category core
 * @description.en Displays all conversations grouped by time (Today, Yesterday, Last 7 Days, Earlier). Supports search filtering and conversation management.
 * @description.zh 按时间分组显示所有会话（今天、昨天、7天内、更早），支持搜索过滤和会话管理。
 * @steps.en
 *   1. View conversations grouped by time period
 *   2. Use the search box to filter conversations by title or content
 *   3. Click a conversation to switch to it
 *   4. Hover over a conversation to rename or delete it
 * @steps.zh
 *   1. 查看按时间段分组的会话列表
 *   2. 使用搜索框按标题或内容过滤会话
 *   3. 点击会话切换到该对话
 *   4. 悬停在会话上可重命名或删除
 * @tips.en
 *   - Conversations are automatically grouped by their last update time
 *   - Search matches both conversation titles and message previews
 * @tips.zh
 *   - 会话按最后更新时间自动分组
 *   - 搜索同时匹配会话标题和消息预览
 * @related ConversationCard
 */

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
      const title = (conv.title || "").toLowerCase();
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
      if (!conv.updated_at) return false;
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
      if (!conv.updated_at) return false;
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
      if (!conv.updated_at) return false;
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
      if (!conv.updated_at) return false;
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
