/**
 * 会话卡片组件
 * 显示单个会话的预览信息，支持选择、重命名、删除操作
 */
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { MessageSquare, Pencil, Trash2, Check, X } from "lucide-react";
import { useLocale } from "@/lib/LocaleContext";
import { cn } from "@/lib/utils";

export interface Conversation {
  id: string;
  title: string;
  preview?: string;
  message_count?: number;
  created_at: string;
  updated_at: string;
}

interface ConversationCardProps {
  conversation: Conversation;
  isActive: boolean;
  onSelect: () => void;
  onRename: (newTitle: string) => void;
  onDelete: () => void;
}

export function ConversationCard({
  conversation,
  isActive,
  onSelect,
  onRename,
  onDelete,
}: ConversationCardProps) {
  const { locale } = useLocale();
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(conversation.title);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return locale === "zh" ? "刚刚" : "Just now";
    } else if (diffMins < 60) {
      return locale === "zh" ? `${diffMins}分钟前` : `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return locale === "zh" ? `${diffHours}小时前` : `${diffHours}h ago`;
    } else if (diffDays === 1) {
      return locale === "zh" ? "昨天" : "Yesterday";
    } else if (diffDays < 7) {
      return locale === "zh" ? `${diffDays}天前` : `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US");
    }
  };

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditTitle(conversation.title);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (editTitle.trim() && editTitle !== conversation.title) {
      onRename(editTitle.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditTitle(conversation.title);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveEdit();
    } else if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  const handleStartDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    onDelete();
    setShowDeleteConfirm(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "group mx-3 p-3 rounded-xl cursor-pointer transition-all border",
        isActive
          ? "bg-emerald-500/10 border-emerald-500/30"
          : "bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.05]"
      )}
      onClick={() => !isEditing && !showDeleteConfirm && onSelect()}
    >
      {/* 标题行 */}
      <div className="flex items-start gap-2">
        <MessageSquare className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                autoFocus
              />
              <button
                onClick={handleSaveEdit}
                className="p-1 hover:bg-emerald-500/20 rounded transition-colors"
              >
                <Check className="w-4 h-4 text-emerald-400" />
              </button>
              <button
                onClick={handleCancelEdit}
                className="p-1 hover:bg-white/10 rounded transition-colors"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-200 truncate flex-1">
                {conversation.title}
              </h3>
              {/* 操作按钮 */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={handleStartEdit}
                  className="p-1 hover:bg-white/10 rounded transition-colors"
                  title={locale === "zh" ? "重命名" : "Rename"}
                >
                  <Pencil className="w-3.5 h-3.5 text-gray-400" />
                </button>
                <button
                  onClick={handleStartDelete}
                  className="p-1 hover:bg-red-500/20 rounded transition-colors"
                  title={locale === "zh" ? "删除" : "Delete"}
                >
                  <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-400" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 预览和元信息 */}
      {!isEditing && (
        <>
          {conversation.preview && (
            <p className="text-xs text-gray-500 mt-1.5 line-clamp-2 ml-6">
              {conversation.preview}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1.5 ml-6">
            <span className="text-xs text-gray-600">
              {formatDate(conversation.updated_at)}
            </span>
            {conversation.message_count !== undefined && conversation.message_count > 0 && (
              <>
                <span className="text-gray-700">·</span>
                <span className="text-xs text-gray-600">
                  {conversation.message_count} {locale === "zh" ? "条消息" : "messages"}
                </span>
              </>
            )}
            {isActive && (
              <>
                <span className="text-gray-700">·</span>
                <span className="text-xs text-emerald-400">
                  {locale === "zh" ? "当前" : "Current"}
                </span>
              </>
            )}
          </div>
        </>
      )}

      {/* 删除确认框 */}
      {showDeleteConfirm && (
        <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg" onClick={(e) => e.stopPropagation()}>
          <p className="text-xs text-gray-300 mb-2">
            {locale === "zh" ? "确定删除此会话？删除后无法恢复。" : "Delete this conversation? This cannot be undone."}
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleConfirmDelete}
              className="px-3 py-1 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors"
            >
              {locale === "zh" ? "删除" : "Delete"}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-3 py-1 text-xs bg-white/10 text-gray-300 rounded hover:bg-white/20 transition-colors"
            >
              {locale === "zh" ? "取消" : "Cancel"}
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
