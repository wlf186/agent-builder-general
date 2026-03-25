/**
 * 上下文窗口状态栏组件
 *
 * 显示当前 LLM 上下文窗口使用情况：
 * - 格式：X.XK / X.XK（已用 / 总量）
 * - 颜色指示：绿色 <50%，黄色 50-80%，红色 >80%
 */
'use client';

import { useMemo } from 'react';
import { useLocale } from '@/lib/LocaleContext';

interface ContextStatusBarProps {
  inputTokens: number;
  outputTokens: number;
  contextWindow: number;
}

export function ContextStatusBar({
  inputTokens,
  outputTokens,
  contextWindow,
}: ContextStatusBarProps) {
  const { t } = useLocale();

  const status = useMemo(() => {
    // 处理无效数据
    if (!contextWindow || contextWindow === 0) {
      return {
        display: '--K / --K',
        colorClass: 'text-gray-400',
        percent: 0,
        hasData: false,
      };
    }

    const usedTokens = inputTokens + outputTokens;
    const percent = (usedTokens / contextWindow) * 100;

    // 格式化为 K 单位
    const formatK = (n: number): string => {
      if (n === 0) return '0K';
      const k = n / 1000;
      // 如果是整数，不显示小数点
      return k % 1 === 0 ? `${k}K` : `${k.toFixed(1)}K`;
    };

    // 确定颜色
    let colorClass: string;
    if (percent < 50) {
      colorClass = 'text-green-500';
    } else if (percent < 80) {
      colorClass = 'text-yellow-500';
    } else {
      colorClass = 'text-red-500';
    }

    return {
      display: `${formatK(usedTokens)} / ${formatK(contextWindow)}`,
      colorClass,
      percent,
      hasData: true,
    };
  }, [inputTokens, outputTokens, contextWindow]);

  return (
    <div
      className="flex items-center gap-2 px-4 py-1.5 border-b dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 text-xs"
      title={
        status.hasData
          ? t('contextUsage').replace('{percent}', status.percent.toFixed(1))
          : t('contextUsageNotSupported')
      }
    >
      <span className={status.colorClass}>●</span>
      <span className="text-gray-600 dark:text-gray-400">{status.display}</span>
    </div>
  );
}
