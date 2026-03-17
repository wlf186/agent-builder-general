# AC130 SubAgents Team Configuration

## 团队概述

AC130 是 Agent Builder 项目的核心开发团队，负责知识库（RAG）管理系统及动态挂载机制的开发与维护。

---

## 团队成员

### 1. Lead (兼 PM)
- **角色**: 产品经理 + 技术负责人
- **职责**:
  - PRD 输出与功能架构设计
  - 全局质量把关
  - 系统性风险防范
  - 确保产品美观、安全、可靠
  - 复杂需求调研（互联网 + GitHub 最佳实践）
- **模型**: 默认模型（当前会话模型）

### 2. Dev (开发者)
- **角色**: 全栈开发工程师
- **职责**:
  - 系统架构实现
  - 代码编写
  - 单元测试
  - 部署与运维
- **模型**: `glm-4.7` (强制约束)
- **创建命令**: `--model glm-4.7`

### 3. User Rep (用户代表)
- **角色**: 用户验收测试专员
- **职责**:
  - 按 PRD 设计 UAT 步骤
  - 使用 Playwright (headless模式) 模拟真实操作
  - 生成测试截图作为证据
  - **严禁**通过 curl 等后台命令进行 UAT
- **模型**: `glm-4.7` (强制约束)
- **创建命令**: `--model glm-4.7`

---

## 运作规范

### 1. 归档规范
- **路径**: `{{项目根目录}}/teams/AC130/iterations/{{YYYYMMDDhhmm}}/`
- **内容**: 方案、文档、测试截图、代码变更记录

### 2. 验收流程
```
1. Playwright (headless) 验证前端主页及核心功能
2. routine-demo 演示 (headed模式) - 验证存量功能
3. 本次迭代演示 (headed模式) - 用户确认 "yes" 后执行
4. 代码提交 - 用户确认 "ok" 后使用 CCGHTK Token 提交
```

### 3. 代码提交
- **Token 环境变量**: `CCGHTK`
- **提交条件**: 用户确认 "ok"

---

## 技术栈

### 后端
- FastAPI (Python 3.10+)
- LangGraph / LangChain
- ChromaDB (向量数据库)
- Unstructured / Marker (文档解析)

### 前端
- Next.js 15
- React 18
- Tailwind CSS
- shadcn/ui

### 测试
- Playwright (headless + headed)

---

## 通信协议

1. **任务派发**: Lead → 创建任务 → 派发给对应 teammate
2. **执行反馈**: teammate → 执行 → 交付 → Lead 验收
3. **问题上报**: teammate → 发现问题 → 上报 Lead → Lead 决策

---

## 质量标准

| 维度 | 标准 |
|------|------|
| 代码质量 | 遵循 CLAUDE.md 规范，流式输出不受影响 |
| 测试覆盖 | UAT 必须通过，截图留痕 |
| 文档完整性 | PRD、技术方案、测试报告齐全 |
| 演示验收 | headed 模式演示无异常 |

---

*最后更新: 2026-03-17*
