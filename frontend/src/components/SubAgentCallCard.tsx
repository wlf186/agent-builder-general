"use client";

/**
 * @userGuide
 * @title.en Sub-Agent Call Card
 * @title.zh 子智能体调用卡片
 * @category reference
 * @description.en Displays real-time status, results, and statistics of sub-agent calls. Shows each call with status indicators (running, completed, timeout, failed), duration, token usage, and summary statistics.
 * @description.zh 显示子智能体调用的实时状态、结果和统计信息。展示每个调用的状态指示器（运行中、完成、超时、失败）、耗时、Token使用量和摘要统计。
 * @tips.en
 *   - Status colors indicate call progress: blue (running), green (completed), orange (timeout), red (failed)
 *   - Token usage and duration are displayed when available
 *   - Summary shows total duration and success rate
 * @tips.zh
 *   - 状态颜色指示调用进度：蓝色（运行中）、绿色（完成）、橙色（超时）、红色（失败）
 *   - 可用时显示Token使用量和耗时
 *   - 摘要显示总耗时和成功率
 */
import { Bot, Clock, Hash, Loader2 } from "lucide-react";
import { SubAgentCallRecord } from "@/types";
import { cn } from "@/lib/utils";

interface SubAgentCallCardProps {
  calls: SubAgentCallRecord[];
  locale?: string;
}

/**
 * SubAgentCallCard - 子 Agent 调用状态卡片组件
 *
 * 显示子 Agent 调用的实时状态、结果和统计信息
 */
export function SubAgentCallCard({ calls, locale = "zh" }: SubAgentCallCardProps) {
  if (!calls || calls.length === 0) return null;

  const zh = locale === "zh";

  /**
   * 根据状态获取样式配置
   */
  const getStatusStyle = (status: SubAgentCallRecord["status"]) => {
    switch (status) {
      case "running":
        return {
          color: "text-blue-400",
          bgColor: "bg-blue-500/20",
          borderColor: "border-blue-500/50",
          icon: <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />,
          label: zh ? "运行中" : "Running",
        };
      case "completed":
        return {
          color: "text-green-400",
          bgColor: "bg-green-500/20",
          borderColor: "border-green-500/50",
          icon: <span className="text-green-400">✓</span>,
          label: zh ? "完成" : "Completed",
        };
      case "timeout":
        return {
          color: "text-orange-400",
          bgColor: "bg-orange-500/20",
          borderColor: "border-orange-500/50",
          icon: <span className="text-orange-400">⏱</span>,
          label: zh ? "超时" : "Timeout",
        };
      case "failed":
        return {
          color: "text-red-400",
          bgColor: "bg-red-500/20",
          borderColor: "border-red-500/50",
          icon: <span className="text-red-400">✗</span>,
          label: zh ? "失败" : "Failed",
        };
      default:
        return {
          color: "text-gray-400",
          bgColor: "bg-gray-500/20",
          borderColor: "border-gray-500/50",
          icon: <span className="text-gray-400">○</span>,
          label: zh ? "等待" : "Pending",
        };
    }
  };

  /**
   * 渲染单个调用卡片
   */
  const renderCallCard = (call: SubAgentCallRecord) => {
    const style = getStatusStyle(call.status);

    return (
      <div
        key={call.id}
        className={cn(
          "flex items-start gap-2 px-2 py-1.5 rounded border transition-all",
          style.bgColor,
          style.borderColor
        )}
      >
        {/* 状态图标 */}
        <div className="flex-shrink-0 mt-0.5">{style.icon}</div>

        {/* 调用详情 */}
        <div className="flex-1 min-w-0">
          {/* Agent 名称和标签 */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("text-xs font-medium", style.color)}>
              {call.agentName}
            </span>

            {/* 状态标签 */}
            <span
              className={cn(
                "text-[10px] px-1 py-0.5 rounded",
                style.bgColor,
                style.color
              )}
            >
              {style.label}
            </span>

            {/* 耗时 */}
            {call.durationMs !== undefined && (
              <span className="text-[10px] text-gray-500">
                {call.durationMs}ms
              </span>
            )}

            {/* Token 统计 */}
            {call.tokens && (
              <span className="text-[10px] text-gray-500 flex items-center gap-0.5">
                <Hash className="w-2.5 h-2.5" />
                {call.tokens.total}t
              </span>
            )}
          </div>

          {/* 调用消息预览 */}
          <p className="text-[10px] text-gray-500 truncate mt-0.5">
            {call.message}
          </p>

          {/* 调用结果（完成后显示） */}
          {call.result && call.status === "completed" && (
            <p className="text-[10px] text-gray-400 line-clamp-2 mt-1">
              {call.result}
            </p>
          )}

          {/* 错误信息 */}
          {call.error && (call.status === "failed" || call.status === "timeout") && (
            <p className="text-[10px] text-red-400 mt-1">
              {call.error}
            </p>
          )}
        </div>
      </div>
    );
  };

  /**
   * 渲染统计摘要
   */
  const renderSummary = () => {
    const completedCalls = calls.filter(
      (c) => c.status === "completed" || c.status === "timeout" || c.status === "failed"
    );

    if (completedCalls.length === 0) return null;

    // 计算总耗时
    const totalDuration = calls
      .filter((c) => c.durationMs !== undefined)
      .reduce((sum, c) => sum + (c.durationMs || 0), 0);

    // 计算总 Token
    const totalTokens = calls
      .filter((c) => c.tokens?.total)
      .reduce((sum, c) => sum + (c.tokens?.total || 0), 0);

    // 计算成功率
    const successCount = calls.filter((c) => c.status === "completed").length;

    return (
      <div className="mt-2 pt-2 border-t border-indigo-500/30">
        <div className="flex items-center gap-3 text-[10px] text-gray-500">
          {/* 总耗时 */}
          {totalDuration > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {totalDuration}ms
            </span>
          )}

          {/* 总 Token */}
          {totalTokens > 0 && (
            <span className="flex items-center gap-1">
              <Hash className="w-3 h-3" />
              {totalTokens}t
            </span>
          )}

          {/* 成功率 */}
          {successCount < calls.length && (
            <span>
              {successCount}/{calls.length} {zh ? "成功" : "success"}
            </span>
          )}

          {/* 全部成功时显示绿色提示 */}
          {successCount === calls.length && successCount > 0 && (
            <span className="text-green-400">
              ✓ {zh ? "全部成功" : "All succeeded"}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="border-l-2 border-indigo-500/50 pl-2 py-1">
      {/* 标题栏 */}
      <div className="flex items-center gap-1 text-xs mb-1">
        <Bot className="w-3 h-3 text-indigo-400" />
        <span className="text-indigo-400 font-medium">
          {zh ? "子 Agent 调用" : "Sub-Agent Calls"}
        </span>
        <span className="text-gray-500 text-[10px]">({calls.length})</span>
      </div>

      {/* 调用列表 */}
      <div className="space-y-1">{calls.map(renderCallCard)}</div>

      {/* 统计摘要 */}
      {renderSummary()}
    </div>
  );
}
