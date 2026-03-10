/**
 * 会话抽屉组件
 * 从右侧滑出显示历史会话列表，支持搜索、新建、选择、删除等操作
 */
"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Search, Clock } from "lucide-react";
import { useLocale } from "@/lib/LocaleContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConversationList, Conversation } from "./ConversationList";

export interface ConversationDrawerProps {
  open: boolean;
  onClose: () => void;
  agentName: string;
  currentConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
}

export function ConversationDrawer({
  open,
  onClose,
  agentName,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
}: ConversationDrawerProps) {
  const { locale, t } = useLocale();
  const [searchQuery, setSearchQuery] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 加载会话列表
  useEffect(() => {
    if (open && agentName) {
      loadConversations();
    }
  }, [open, agentName]);

  const loadConversations = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/agents/${agentName}/conversations`);
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch (error) {
      console.error("Failed to load conversations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // 过滤会话
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    return conversations.filter((conv) => {
      const preview = conv.preview || "";
      const title = conv.title.toLowerCase();
      return preview.toLowerCase().includes(searchQuery.toLowerCase()) ||
             title.includes(searchQuery.toLowerCase());
    });
  }, [conversations, searchQuery]);

  const handleRename = async (id: string, newTitle: string) => {
    try {
      const res = await fetch(`/api/agents/${agentName}/conversations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      });

      if (res.ok) {
        // 更新本地状态
        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === id
              ? { ...conv, title: newTitle }
              : conv
          )
        );
      }
    } catch (error) {
      console.error("Failed to rename conversation:", error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/agents/${agentName}/conversations/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setConversations((prev) => prev.filter((conv) => conv.id !== id));
      }
    } catch (error) {
      console.error("Failed to delete conversation:", error);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* 遮罩层 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/30 z-40"
            onClick={onClose}
          />

          {/* 抽屉面板 */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-[360px] max-w-[90vw] bg-[#0a0f14] border-l border-white/5 z-50 flex flex-col"
          >
            {/* 头部 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <h2 className="text-sm font-medium text-gray-200">
                {t("historyConversations")}
              </h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onNewConversation}
                  className="text-xs text-emerald-400 hover:text-emerald-300"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  {t("newConversation")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="text-gray-500 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* 搜索框 */}
            <div className="px-4 py-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("searchConversations")}
                  className="pl-9 bg-white/5 border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/10"
                />
              </div>
            </div>

            {/* 会话列表 */}
            <div className="flex-1 overflow-y-auto">
              <ConversationList
                conversations={conversations}
                currentId={currentConversationId}
                isLoading={isLoading}
                searchQuery={searchQuery}
                onSelect={(id) => {
                  onSelectConversation(id);
                  onClose();
                }}
                onRename={handleRename}
                onDelete={handleDelete}
              />
            </div>

            {/* 空状态 */}
            {!isLoading && filteredConversations.length === 0 && (
              <div className="text-center py-12">
                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-6 h-6 text-gray-600" />
                </div>
                <p className="text-sm text-gray-500 mt-3">
                  {t("noConversations")}
                </p>
                <p className="text-xs text-gray-600 mt-2">
                  {t("noConversationsDesc")}
                </p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
