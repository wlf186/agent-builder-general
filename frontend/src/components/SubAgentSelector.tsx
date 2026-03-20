/**
 * @userGuide
 * @title.en Sub-Agent Selector
 * @title.zh 子智能体选择器
 * @category core
 * @description.en Configure which sub-agents this agent can call for task delegation.
 *   Enable multi-role collaboration by allowing agents to delegate specialized tasks.
 * @description.zh 配置此智能体可以调用的子智能体，实现任务委派。
 *   通过允许智能体委派专业任务来实现多角色协作。
 *
 * @steps.en
 *   1. Click the Sub-Agent Configuration section to expand it
 *   2. Use the search box to find agents by name or persona
 *   3. Click on an agent card to add it as a sub-agent
 *   4. Remove sub-agents by clicking the X button on selected items
 *   5. Save your agent configuration to apply changes
 * @steps.zh
 *   1. 点击"子 Agent 配置"区域展开
 *   2. 使用搜索框按名称或人设查找智能体
 *   3. 点击智能体卡片将其添加为子智能体
 *   4. 点击已选项上的 X 按钮移除子智能体
 *   5. 保存智能体配置以应用更改
 *
 * @tips.en
 *   - Sub-agents cannot create circular dependencies
 *   - Each sub-agent can have its own tools and knowledge bases
 *   - Use sub-agents for specialized tasks like document processing
 * @tips.zh
 *   - 子智能体不能创建循环依赖
 *   - 每个子智能体可以有自己的工具和知识库
 *   - 使用子智能体处理专业任务，如文档处理
 *
 * @related AgentChat, KnowledgeBaseSelector
 */
"use client";

import { useMemo } from "react";
import { Bot, AlertTriangle } from "lucide-react";
import { MultiSelectPanel, Badge } from "@/components/ui/MultiSelectPanel";
import { useLocale } from "@/lib/LocaleContext";
import { SubAgentInfo, CycleDependencyError } from "@/types";

interface SubAgentSelectorProps {
  /** All available agents */
  availableAgents: SubAgentInfo[];
  /** Current agent name (cannot select self) */
  currentAgentName?: string;
  /** Selected sub-agent names */
  selectedAgents: string[];
  /** Selection change callback */
  onSelectionChange: (agents: string[]) => void;
  /** Cycle dependency error (from API) */
  cycleError?: CycleDependencyError | null;
  /** Disabled state (during save) */
  disabled?: boolean;
}

/**
 * SubAgentSelector - Sub-agent selector component
 *
 * Features:
 * - Multi-select agent list
 * - Search filtering
 * - Display agent persona
 * - Cycle dependency warning
 * - Exclude current agent (cannot mount self)
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
  const zh = locale === "zh";

  // Filter out current agent from available list
  const filteredAgents = useMemo(() => {
    return availableAgents.filter((agent) => agent.name !== currentAgentName);
  }, [availableAgents, currentAgentName]);

  // Get badges for an agent
  const getAgentBadges = (agent: SubAgentInfo): Badge[] => {
    const badges: Badge[] = [];
    if (agent.model_service) {
      badges.push({ label: agent.model_service, variant: "primary" });
    } else {
      badges.push({ label: zh ? "无模型" : "No model" });
    }
    if (agent.sub_agents && agent.sub_agents.length > 0) {
      badges.push({ label: `${agent.sub_agents.length} ${zh ? "个子" : "sub"}` });
    }
    return badges;
  };

  // Get extra info line (skills/services count)
  const getAgentExtraInfo = (agent: SubAgentInfo): string => {
    const parts: string[] = [];
    if (agent.skills.length > 0) {
      parts.push(`🔧 ${agent.skills.length} ${zh ? "技能" : "skills"}`);
    }
    if (agent.mcp_services.length > 0) {
      parts.push(`🔌 ${agent.mcp_services.length} ${zh ? "服务" : "services"}`);
    }
    return parts.join("  ");
  };

  return (
    <div className="space-y-3">
      {/* Cycle Error - displayed above panel */}
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

      <MultiSelectPanel<SubAgentInfo>
        title={zh ? "子 Agent 配置" : "Sub-Agent Configuration"}
        icon={<Bot size={16} />}
        color="indigo"
        hint={zh
          ? "选择此 Agent 可以调用的子 Agent。主 Agent 可以将任务委派给子 Agent 处理，适合多角色协作场景。"
          : "Select sub-agents that this agent can call. The main agent can delegate tasks to sub-agents for multi-role collaboration."
        }
        items={filteredAgents}
        selectedIds={selectedAgents}
        onChange={onSelectionChange}
        getId={(agent) => agent.name}
        getTitle={(agent) => agent.name}
        getDescription={(agent) => agent.persona}
        getBadges={getAgentBadges}
        getItemIcon={() => <Bot size={14} className="text-indigo-400" />}
        getExtraInfo={getAgentExtraInfo}
        searchPlaceholder={zh ? "搜索 Agent 名称或人设..." : "Search agent name or persona..."}
        emptyMessage={zh ? "没有可用的 Agent" : "No available agents"}
        disabled={disabled}
        defaultExpanded={selectedAgents.length > 0}
      />

      {/* Footer warning */}
      <div className="text-xs text-gray-600 flex items-center gap-1.5">
        <AlertTriangle size={12} className="text-amber-500/60" />
        {zh
          ? "注意：子 Agent 的工具和技能将作为主 Agent 的扩展能力可用"
          : "Note: Sub-agent tools and skills will be available to the main agent"}
      </div>
    </div>
  );
}
