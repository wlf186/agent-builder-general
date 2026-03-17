# 知识库管理系统后端实现总结

**迭代**: AC130-202603161918
**日期**: 2026-03-16
**开发者**: Dev (AC130 Team)

---

## 实现概览

根据 `产品需求规格说明书.md` 完成了知识库（RAG）管理系统的后端开发，实现了文档上传、解析、向量化、检索和智能体集成等完整功能。

---

## 核心模块

### 1. KnowledgeBaseManager (`src/knowledge_base_manager.py`)

**功能**:
- 知识库 CRUD 操作（创建、读取、更新、删除）
- 文档管理（上传、删除、状态查询）
- ChromaDB 向量集合管理
- 统计信息更新（文档数、块数、总大小）

**关键方法**:
- `create_kb()` - 创建知识库
- `delete_kb()` - 删除知识库（含向量数据）
- `add_document()` - 添加文档并处理
- `get_retriever()` - 获取检索器实例

### 2. DocumentProcessor (`src/document_processor.py`)

**功能**:
- PDF 解析（使用 pypdfium2）
- DOCX 解析（使用 python-docx）
- 纯文本文件解析（自动检测编码）
- 文本分块（RecursiveCharacterTextSplitter，chunk_size=500, overlap=50）

**支持格式**: `.pdf`, `.docx`, `.txt`, `.md`

### 3. Embedder (`src/embedder.py`)

**功能**:
- 延迟加载 sentence-transformers 模型
- 批量文本编码
- 向量归一化（支持余弦相似度）

**默认模型**: `BAAI/bge-small-zh-v1.5`
- 向量维度: 512
- 支持中英文

### 4. Retriever (`src/retriever.py`)

**功能**:
- ChromaDB 语义检索
- Top-K 结果返回
- 相似度阈值过滤
- 结果格式化（含来源标注）

**参数**:
- `top_k`: 默认 3，范围 1-10
- `score_threshold`: 默认 0.6，范围 0-1

---

## API 端点

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/knowledge-bases` | 列出所有知识库 |
| POST | `/api/knowledge-bases` | 创建知识库 |
| GET | `/api/knowledge-bases/{id}` | 获取知识库详情 |
| DELETE | `/api/knowledge-bases/{id}` | 删除知识库 |
| GET | `/api/knowledge-bases/{id}/documents` | 列出文档 |
| POST | `/api/knowledge-bases/{id}/documents` | 上传文档 |
| DELETE | `/api/knowledge-bases/{id}/documents/{doc_id}` | 删除文档 |
| POST | `/api/knowledge-bases/{id}/search` | 检索知识库 |
| GET | `/api/knowledge-bases/{id}/stats` | 获取统计信息 |

---

## AgentEngine 集成

### 新增工具: `rag_retrieve`

**工具定义**:
```python
{
  "name": "rag_retrieve",
  "description": "从挂载的知识库中检索相关文档内容...",
  "parameters": {
    "query": "检索查询语句",
    "top_k": "返回结果数量（1-5）"
  }
}
```

**工作流程**:
1. 用户发送消息
2. LLM 决定是否需要检索知识库
3. 调用 `rag_retrieve` 工具
4. 显示"正在检索知识库..."状态
5. 返回检索结果（含来源标注）
6. LLM 基于检索结果生成回答

### 流式事件

新增事件类型:
- `rag_retrieve` - 检索开始事件
- 服务显示名称: `knowledge-base`

---

## 数据模型扩展

### AgentConfig 新增字段

```python
class AgentConfig:
    # ... 现有字段 ...
    knowledge_bases: List[str] = []  # 挂载的知识库 ID 列表
    retrieval_config: Optional[RetrievalConfig] = None  # 检索配置

class RetrievalConfig:
    top_k: int = 3
    score_threshold: float = 0.6
    prompt_template: str = DEFAULT_RAG_PROMPT_TEMPLATE
```

---

## 数据存储

```
data/
├── knowledge_bases/
│   ├── knowledge_bases.json    # 知识库配置
│   ├── {kb_id}/
│   │   ├── metadata.json       # 知识库元数据
│   │   ├── documents/          # 存储的文档文件
│   │   └── vectordb/           # ChromaDB 持久化目录
│   │       └── chroma.sqlite3
```

---

## 前端组件

| 组件 | 路径 | 功能 |
|------|------|------|
| 知识库管理页 | `/knowledge-bases/page.tsx` | 列表、创建、删除知识库 |
| 知识库详情页 | `/knowledge-bases/[id]/page.tsx` | 查看详情、上传文档 |
| 选择器组件 | `components/KnowledgeBaseSelector.tsx` | 多选知识库 |
| API 客户端 | `lib/kbApi.ts` | 封装 API 调用 |

---

## 依赖项

已添加到 `requirements.txt`:

```
chromadb>=0.4.0
sentence-transformers>=2.2.0
pypdfium2>=4.0.0
python-docx>=1.0.0
langchain-text-splitters>=0.0.1
```

---

## 测试建议

### 功能测试
1. 创建知识库
2. 上传 PDF/DOCX 文档
3. 验证文档处理状态（块数、字符数）
4. 在智能体中挂载知识库
5. 测试 `rag_retrieve` 工具调用
6. 验证检索结果相关性

### 性能测试
- 文档上传处理时间（< 30s/MB）
- 检索响应时间（< 2s）
- 向量化内存占用

---

## 遗留问题

无

---

## 下一步

1. 前端 UAT 测试
2. 性能优化（大文件处理）
3. 混合检索实现（BM25 + 向量）
4. 多模态支持（图片、表格）
