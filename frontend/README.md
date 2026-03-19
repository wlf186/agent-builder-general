# Agent Builder Frontend

通用 AI 智能体构建平台的前端应用。

## 技术栈

- **框架**: Next.js 15 (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS + Shadcn/UI
- **动画**: Framer Motion
- **测试**: Playwright
- **构建**: Vite (通过 Next.js)

## 开发指南

### 启动开发服务器

```bash
cd frontend
npm run dev
```

访问 http://localhost:20880

### 构建生产版本

```bash
npm run build
npm run start
```

### 运行测试

```bash
npm run test          # 单元测试
npm run test:e2e      # E2E 测试 (Playwright)
```

## 目录结构

```
frontend/
├── src/
│   ├── app/              # Next.js App Router 页面
│   ├── components/       # React 组件
│   │   ├── AgentChat.tsx         # 聊天界面 + 流式渲染
│   │   ├── SubAgentSelector.tsx  # 子智能体选择器
│   │   ├── MCPServiceDialog.tsx  # MCP 服务配置
│   │   ├── ModelServiceDialog.tsx # 模型服务配置
│   │   ├── KnowledgeBaseDialog.tsx # 知识库管理
│   │   ├── DocumentUploader.tsx  # 文档上传
│   │   └── ... (20+ 组件)
│   ├── hooks/            # 自定义 React Hooks
│   ├── lib/              # 工具函数和 API 客户端
│   └── types/            # TypeScript 类型定义
├── tests/                # Playwright UAT 测试
├── public/               # 静态资源
└── next.config.ts        # Next.js 配置
```

## 核心组件

### AgentChat
主要的聊天界面组件，支持：
- SSE 流式输出
- 打字机效果 (flushSync)
- Thinking/Tool_call 实时展示
- Markdown 渲染
- 代码高亮

### KnowledgeBaseDialog
知识库管理对话框，支持：
- 创建/编辑/删除知识库
- 文档上传和管理
- 向量化状态显示

### MCPServiceDialog
MCP 服务配置，支持：
- stdio 和 SSE 连接模式
- 服务状态监控
- 工具列表展示

## API 代理配置

前端通过 Next.js API 代理连接后端（端口 20881）：

```typescript
// next.config.ts
async rewrites() {
  return [
    { source: '/api/:path*', destination: 'http://localhost:20881/api/:path*' }
  ];
}
```

## 注意事项

1. **流式输出**：修改 AgentChat.tsx 时必须保留 flushSync 逻辑，否则打字机效果会失效
2. **选择器**：测试时使用 `input[type="text"][placeholder]` 而非 `textarea`（后者是人设编辑框）
3. **开发后清理**：修改后需执行 `rm -rf .next` 清理缓存

## 相关文档

- [测试指南](../docs/references/testing-guide.md)
- [API 参考](../docs/references/api-reference.md)
- [流式协议](../docs/design-docs/streaming-protocol.md)
