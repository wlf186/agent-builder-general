/**
 * 模拟进度计算器
 *
 * 用于智能体环境初始化期间的进度展示。
 * 算法基于预设的时间曲线，模拟真实的初始化进度。
 */

export interface MockProgressState {
  progress: number;        // 0-100
  estimatedSeconds: number; // 预估剩余时间
  phase: 'early' | 'middle' | 'late' | 'complete';
}

export class MockProgressCalculator {
  private startTime: number;
  private readonly totalDuration: number; // 总预估时长（毫秒）

  /**
   * @param totalDurationSeconds 总预估时长（秒），默认30秒
   */
  constructor(totalDurationSeconds: number = 30) {
    this.startTime = Date.now();
    this.totalDuration = totalDurationSeconds * 1000;
  }

  /**
   * 获取当前进度状态
   */
  getCurrentState(): MockProgressState {
    const elapsed = Date.now() - this.startTime;
    const progress = this.calculateProgress(elapsed);
    const estimatedSeconds = Math.max(0, Math.ceil((this.totalDuration - elapsed) / 1000));
    const phase = this.determinePhase(progress);

    return { progress, estimatedSeconds, phase };
  }

  /**
   * 进度计算算法
   * - 前5秒: 0% → 30%
   * - 中10秒: 30% → 70%
   * - 后15秒: 70% → 95%
   * - 就绪后: 100%
   */
  private calculateProgress(elapsed: number): number {
    if (elapsed >= this.totalDuration) {
      return 100;
    }

    const seconds = elapsed / 1000;

    // 前5秒：快速启动期
    if (seconds <= 5) {
      return Math.min(30, (seconds / 5) * 30);
    }
    // 中10秒（5-15秒）：稳定增长期
    else if (seconds <= 15) {
      return 30 + ((seconds - 5) / 10) * 40; // 30% → 70%
    }
    // 后15秒（15-30秒）：收尾期
    else {
      return 70 + Math.min(25, ((seconds - 15) / 15) * 25); // 70% → 95%
    }
  }

  /**
   * 确定当前阶段
   */
  private determinePhase(progress: number): MockProgressState['phase'] {
    if (progress >= 100) return 'complete';
    if (progress < 30) return 'early';
    if (progress < 70) return 'middle';
    return 'late';
  }

  /**
   * 重置计时器
   */
  reset(): void {
    this.startTime = Date.now();
  }
}

/**
 * React Hook for mock progress
 */
export function useMockProgress(totalDurationSeconds: number = 30, enabled: boolean = true) {
  const [state, setState] = React.useState<MockProgressState>({
    progress: 0,
    estimatedSeconds: totalDurationSeconds,
    phase: 'early',
  });

  React.useEffect(() => {
    if (!enabled) return;

    const calculator = new MockProgressCalculator(totalDurationSeconds);
    const interval = setInterval(() => {
      const newState = calculator.getCurrentState();
      setState(newState);

      if (newState.phase === 'complete') {
        clearInterval(interval);
      }
    }, 200); // 每200ms更新一次

    return () => clearInterval(interval);
  }, [totalDurationSeconds, enabled]);

  return state;
}

// Import React for the hook
import React from 'react';
