"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  Search,
  Check,
  AlertTriangle,
  Sparkles,
  ChevronDown,
  ChevronUp,
  X,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/LocaleContext";
import { SubAgentInfo, CycleDependencyError } from "@/types";

interface SubAgentSelectorProps {
  /** 所有可用的 Agent 列表 */
  availableAgents: SubAgentInfo[];
  /** 当前 Agent 名称（不能选择自己） */
  currentAgentName?: string;
  /** 已选择的子 Agent 名称列表 */
  selectedAgents: string[];
  /** 选择变化回调 */
  onSelectionChange: (agents: string[]) => void;
  /** 循环依赖错误（从 API 返回） */
  cycleError?: CycleDependencyError | null;
  /** 是否禁用（保存中） */
  disabled?: boolean;
}

/**
 * SubAgentSelector - 子 Agent 选择器组件
 *
 * 功能：
 * - 多选 Agent 列表
 * - 搜索过滤
 * - 显示 Agent persona
 * - 循环依赖提示
 * - 排除当前 Agent（不能挂载自己）
 */
export function SubAgentSelector({
  availableAgents,
  currentAgentName = "",
  selectedAgents,
  onSelectionChange,
  cycleError,
  disabled = false,
}: SubAgentSelectorProps) {
  const { locale } = useLocale();
  const [searchQuery, setSearchQuery] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);

  // 过滤可选择的 Agent（排除当前 Agent 和已选择的）
  const filterableAgents = useMemo(() => {
    return availableAgents.filter((agent) => {
      // 排除当前 Agent
      if (agent.name === currentAgentName) return false;
      // 排除已选择的
      if (selectedAgents.includes(agent.name)) return false;
      // 搜索过滤
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          agent.name.toLowerCase().includes(query) ||
          agent.persona.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [availableAgents, currentAgentName, selectedAgents, searchQuery]);

  // 获取已选择的 Agent 详细信息
  const selectedAgentDetails = useMemo(() => {
    return availableAgents.filter((agent) =>
      selectedAgents.includes(agent.name)
    );
  }, [availableAgents, selectedAgents]);

  // 处理选择变化
  const handleToggle = (agentName: string) => {
    if (disabled) return;

    if (selectedAgents.includes(agentName)) {
      // 取消选择
      onSelectionChange(selectedAgents.filter((name) => name !== agentName));
    } else {
      // 添加选择
      onSelectionChange([...selectedAgents, agentName]);
    }
  };

  // 移除已选择的 Agent
  const handleRemove = (agentName: string) => {
    if (disabled) return;
    onSelectionChange(selectedAgents.filter((name) => name !== agentName));
  };

  const zh = locale === "zh";

  return (
    <Card className="overflow-hidden border-white/[0.08] bg-white/[0.02]">
      {/* Header */}
      <div
        className={cn(
          "px-5 py-4 border-b border-white/[0.05] flex items-center gap-3 bg-white/[0.02] cursor-pointer transition-colors",
          !disabled && "hover:bg-white/[0.04]"
        )}
        onClick={() => !disabled && setIsExpanded(!isExpanded)}
      >
        <Bot size={16} className="text-indigo-400" />
        <span className="font-medium text-sm text-gray-300 flex-1">
          {zh ? "子 Agent 配置" : "Sub-Agent Configuration"}
        </span>
        <div className="flex items-center gap-2">
          {selectedAgents.length > 0 && (
            <span className="text-xs bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-lg">
              {selectedAgents.length}
            </span>
          )}
          {isExpanded ? (
            <ChevronUp size={16} className="text-gray-500" />
          ) : (
            <ChevronDown size={16} className="text-gray-500" />
          )}
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CardContent className="p-5 space-y-4">
              {/* 说明文字 */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                <Sparkles size={14} className="text-indigo-400 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-gray-400">
                  {zh
                    ? "选择此 Agent 可以调用的子 Agent。主 Agent 可以将任务委派给子 Agent 处理，适合多角色协作场景。"
                    : "Select sub-agents that this agent can call. The main agent can delegate tasks to sub-agents for multi-role collaboration."}
                </div>
              </div>

              {/* 循环依赖错误提示 */}
              {cycleError && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <AlertTriangle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-sm text-red-400 font-medium mb-1">
                      {cycleError.message || (zh ? "检测到循环依赖" : "Circular dependency detected")}
                    </div>
                    {cycleError.cycle_path && cycleError.cycle_path.length > 0 && (
                      <div className="text-xs text-gray-500 font-mono">
                        {cycleError.cycle_path.join(" → ")}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 已选择的 Agent */}
              {selectedAgentDetails.length > 0 && (
                <div>
                  <div className="text-xs text-gray-500 mb-2">
                    {zh ? "已选择的子 Agent" : "Selected Sub-Agents"}
                  </div>
                  <div className="space-y-2">
                    {selectedAgentDetails.map((agent) => (
                      <div
                        key={agent.name}
                        className="flex items-start gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20"
                      >
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                          <Bot size={14} className="text-emerald-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-emerald-300">
                              {agent.name}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                              {agent.model_service || zh ? "无模型" : "No model"}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 line-clamp-1 mt-1">
                            {agent.persona}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemove(agent.name)}
                          disabled={disabled}
                          className="h-7 w-7 p-0 hover:bg-red-500/20 text-gray-400 hover:text-red-400"
                        >
                          <X size={14} />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 搜索框 */}
              {filterableAgents.length > 0 && (
                <div className="relative">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                  />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={zh ? "搜索 Agent 名称或人设..." : "Search agent name or persona..."}
                    className="pl-9 h-9 bg-white/5 border-white/10 text-sm text-white placeholder:text-gray-600"
                  />
                </div>
              )}

              {/* 可选择的 Agent 列表 */}
              {filterableAgents.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mx-auto mb-3">
                    <Bot size={20} className="text-gray-600" />
                  </div>
                  <p className="text-sm text-gray-500">
                    {searchQuery
                      ? zh
                        ? "没有找到匹配的 Agent"
                        : "No matching agents found"
                      : zh
                        ? "没有可用的 Agent"
                        : "No available agents"}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                  {filterableAgents.map((agent) => (
                    <label
                      key={agent.name}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all border",
                        disabled
                          ? "opacity-50 cursor-not-allowed"
                          : "hover:bg-white/[0.04]",
                        "bg-white/[0.02] border-white/[0.05]"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={false}
                        onChange={() => handleToggle(agent.name)}
                        disabled={disabled}
                        className="mt-0.5 accent-indigo-500 w-4 h-4 rounded flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm text-gray-200">
                            {agent.name}
                          </span>
                          {agent.model_service ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
                              {agent.model_service}
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-500/20 text-gray-400">
                              {zh ? "无模型" : "No model"}
                            </span>
                          )}
                          {agent.sub_agents && agent.sub_agents.length > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">
                              {agent.sub_agents.length} {zh ? "个子" : "sub"}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-2 mt-1">
                          {agent.persona}
                        </p>
                        {/* 显示关联的技能和 MCP 服务 */}
                        <div className="flex items-center gap-2 mt-2">
                          {agent.skills.length > 0 && (
                            <span className="text-[10px] text-gray-600">
                              🔧 {agent.skills.length} {zh ? "技能" : "skills"}
                            </span>
                          )}
                          {agent.mcp_services.length > 0 && (
                            <span className="text-[10px] text-gray-600">
                              🔌 {agent.mcp_services.length} {zh ? "服务" : "services"}
                            </span>
                          )}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {/* 提示信息 */}
              <div className="text-xs text-gray-600 flex items-center gap-1.5 pt-2 border-t border-white/[0.05]">
                <AlertTriangle size={12} className="text-amber-500/60" />
                {zh
                  ? "注意：子 Agent 的工具和技能将作为主 Agent 的扩展能力可用"
                  : "Note: Sub-agent tools and skills will be available to the main agent"}
              </div>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
