# 知识库（RAG）管理系统 - 迭代 202603161542

## 迭代信息

| 属性 | 值 |
|------|-----|
| 迭代 ID | 202603161542 |
| 开始日期 | 2026-03-16 |
| 负责人 | AC130 Team Lead |
| 状态 | 设计完成，待开发 |

## 交付文档

| 文档 | 路径 |
|------|------|
| 产品需求规格说明书 | `01-产品需求规格说明书.md` |
| 技术方案选型报告 | `02-技术方案选型报告.md` |
| 系统架构设计文档 | `03-系统架构设计文档.md` |

## 核心技术选型

| 组件 | 选择 | 理由 |
|------|------|------|
| 向量数据库 | ChromaDB | 轻量级、嵌入式、零配置 |
| 嵌入模型 | BGE-Small-ZH v1.5 | 中文效果好、体积小 (~400MB) |
| 文档解析 | pypdfium2 + python-docx | 稳定、支持主流格式 |
| 文本分块 | LangChain RecursiveCharacterTextSplitter | 智能分割、保持语义 |

## 开发任务清单

### 后端开发

- [ ] `src/knowledge_base_manager.py` - 知识库管理器
- [ ] `src/document_processor.py` - 文档处理器
- [ ] `src/embedder.py` - 向量化器
- [ ] `src/retriever.py` - 向量检索器
- [ ] `backend.py` - API 端点扩展
- [ ] `src/models.py` - 数据模型扩展
- [ ] `src/agent_engine.py` - AgentEngine 集成

### 前端开发

- [ ] `frontend/src/app/knowledge-bases/page.tsx` - 知识库管理页面
- [ ] `frontend/src/app/knowledge-bases/[id]/page.tsx` - 知识库详情页
- [ ] `frontend/src/components/KnowledgeBaseSelector.tsx` - 知识库选择器
- [ ] `frontend/src/lib/kbApi.ts` - 知识库 API 客户端

### 测试

- [ ] 单元测试
- [ ] UAT 测试用例
- [ ] UAT 验收报告

## 验收标准

### 功能验收

- [ ] TC-01: 创建知识库并上传 PDF
- [ ] TC-02: 智能体挂载知识库后基于知识库回答
- [ ] TC-03: 删除知识库
- [ ] TC-04: 检索参数调整生效
- [ ] TC-05: 批量上传文档

### UAT 场景

**场景：员工制度助手**
1. 创建"公司制度"知识库
2. 上传员工手册 PDF
3. 创建智能体"制度助手"
4. 挂载知识库
5. 提问"年假几天？"
6. 验收：回答基于文档内容，准确无误

## 参考资料

- [ChromaDB 文档](https://docs.trychroma.com/)
- [BGE 模型家族](https://github.com/FlagOpen/FlagEmbedding)
- [LangChain RAG 教程](https://python.langchain.com/docs/use_cases/question_answering/)
