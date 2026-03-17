# 产品需求规格说明书 (PRD)

## 项目名称：Agent Builder 知识库（RAG）管理系统及动态挂载机制

**版本**: v1.0
**迭代代号**: AC130-202603170949
**负责人**: Lead (PM)
**日期**: 2026-03-17

---

## 1. 需求背景与目标

### 1.1 背景
目前 Agent Builder 系统中的智能体仅依赖 Prompt 和外部 API（MCP/Skills），缺乏对企业私有文档的深度理解能力。这导致智能体无法回答基于企业内部知识的问题。

### 1.2 目标
在系统层面建立统一的知识库管理模块，并将 RAG（检索增强生成）抽象为一种可插拔的"工具"，由智能体根据任务需求自主触发。

### 1.3 成功指标
- 智能体能够基于上传的文档准确回答问题
- 检索结果带有引用溯源（文档名+片段）
- 未挂载知识库的智能体不会触发检索

---

## 2. 功能模块拆解

### 2.1 A. 全局知识库管理（系统主页新增菜单）

**位置**: 系统主页，与 MCP 服务、技能货架等平级

#### 2.1.1 库级管理
- 支持创建多个独立的知识库
- **元数据字段**:
  - `id`: UUID，唯一标识
  - `name`: 知识库名称（必填，唯一）
  - `description`: 描述（必填，**至关重要**，作为 LLM 判断是否调用该库的核心依据）
  - `created_at`: 创建时间
  - `updated_at`: 更新时间
  - `document_count`: 文档数量
  - `status`: 状态（active/indexing/error）

#### 2.1.2 文档管理
- **支持格式**: PDF、DOCX
- **文档元数据**:
  - `id`: UUID
  - `filename`: 原始文件名
  - `file_size`: 文件大小
  - `chunk_count`: 分块数量
  - `status`: 状态（pending/processing/indexed/error）
  - `created_at`: 上传时间
- **操作**: 上传、删除、重新索引

#### 2.1.3 预处理流水线（后端）
1. **文本提取**: 使用 `unstructured` 库解析 PDF/DOCX
2. **智能分块**: 采用 by_title 策略，保持段落完整性
   - 推荐块大小: 1000 字符
   - 块重叠: 100 字符
3. **向量化**: 使用 Embedding 模型生成向量
4. **存储**: 存入 ChromaDB 向量数据库

### 2.2 B. 智能体配置关联（每个智能体内部配置页）

#### 2.2.1 工具化挂载
- 在智能体的"工具/技能"配置区，新增 **"RAG 知识库"** 分类
- 支持多选知识库（多对多关系）

#### 2.2.2 可见性控制
- 只有被勾选的知识库，其描述信息才会进入该智能体的 `Tools Definition`
- 未勾选的库对智能体完全不可见，确保数据隔离

### 2.3 C. 动态触发逻辑（运行时）

#### 2.3.1 自主决策
- 智能体在 Planning 阶段，根据用户问题判断
- 示例：用户问"公司报销制度"，智能体识别到"财务知识库"的描述匹配，则触发 RAG 检索

#### 2.3.2 工具定义
```json
{
  "name": "query_knowledge_base",
  "description": "查询知识库获取内部文档信息。描述：{kb_description}",
  "parameters": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "搜索查询语句"
      },
      "kb_name": {
        "type": "string",
        "description": "知识库名称"
      }
    },
    "required": ["query", "kb_name"]
  }
}
```

#### 2.3.3 结果闭环
- 检索出的 Context 连同原始问题一起喂给 LLM
- 回答时需标明引用了知识库中的哪份文档及具体片段

---

## 3. 技术实现要点

### 3.1 解析引擎
- **库选择**: `unstructured` (Python)
- **原因**:
  - 支持 PDF/DOCX 多种格式
  - 智能分块（by_title 策略）保持段落完整性
  - 表格提取能力强
- **安装**: `pip install unstructured[pdf,docx]`

### 3.2 向量检索
- **向量库**: ChromaDB（本地部署）
- **检索模式**: 语义检索（向量相似度）
- **备选**: Hybrid Search（向量 + BM25），后期优化

### 3.3 Embedding 模型
- **选项 A**: ZhipuAI Embedding API（推荐，与现有 LLM 供应商一致）
- **选项 B**: 本地模型 `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`

### 3.4 Prompt 注入
当智能体挂载了知识库时，系统自动在 System Prompt 中加入：
```
你可以使用 query_knowledge_base 工具来查询内部文档。只有当用户问题涉及到内部文档内容时才调用此工具。

可用知识库：
{kb_name}: {kb_description}
```

### 3.5 引用溯源
智能体回答时，在文末标明引用：
```
参考来源：
1. 《员工手册.pdf》第 3 页 - 年假制度章节
```

---

## 4. 数据模型设计

### 4.1 知识库表 (knowledge_bases)
```python
class KnowledgeBase:
    id: str  # UUID
    name: str  # 唯一名称
    description: str  # 描述（用于 LLM 判断）
    created_at: datetime
    updated_at: datetime
    document_count: int = 0
    status: str = "active"  # active/indexing/error
```

### 4.2 文档表 (documents)
```python
class Document:
    id: str  # UUID
    kb_id: str  # 所属知识库 ID
    filename: str
    file_path: str  # 存储路径
    file_size: int
    chunk_count: int = 0
    status: str = "pending"  # pending/processing/indexed/error
    created_at: datetime
    error_message: str | None = None
```

### 4.3 智能体-知识库关联 (agent_kb_bindings)
```python
class AgentKBBinding:
    agent_name: str
    kb_id: str
    created_at: datetime
```

### 4.4 向量存储 (ChromaDB)
- Collection: 每个 KnowledgeBase 一个 Collection
- Document Schema:
  ```python
  {
      "id": "chunk_uuid",
      "embedding": [float, ...],
      "metadata": {
          "doc_id": "document_uuid",
          "filename": "原始文件名",
          "page": 页码,
          "chunk_index": 块索引
      },
      "document": "文本内容"
  }
  ```

---

## 5. API 端点设计

### 5.1 知识库管理
| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/knowledge-bases` | 获取所有知识库 |
| POST | `/api/knowledge-bases` | 创建知识库 |
| GET | `/api/knowledge-bases/{kb_id}` | 获取知识库详情 |
| PUT | `/api/knowledge-bases/{kb_id}` | 更新知识库 |
| DELETE | `/api/knowledge-bases/{kb_id}` | 删除知识库（级联删除文档和向量） |

### 5.2 文档管理
| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/knowledge-bases/{kb_id}/documents` | 获取知识库下的文档 |
| POST | `/api/knowledge-bases/{kb_id}/documents` | 上传文档 |
| GET | `/api/knowledge-bases/{kb_id}/documents/{doc_id}` | 获取文档详情 |
| DELETE | `/api/knowledge-bases/{kb_id}/documents/{doc_id}` | 删除文档 |

### 5.3 检索接口
| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/knowledge-bases/{kb_id}/search` | 搜索知识库 |

### 5.4 智能体关联
| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/agents/{name}/knowledge-bases` | 获取智能体关联的知识库 |
| PUT | `/api/agents/{name}/knowledge-bases` | 更新智能体关联的知识库 |

---

## 6. 前端界面设计

### 6.1 系统主页 - 知识库菜单
- 位置：左侧导航栏，MCP 服务下方
- 图标：书本/数据库图标
- 点击后显示知识库列表页

### 6.2 知识库列表页
- 顶部：创建知识库按钮
- 列表项：
  - 知识库名称
  - 描述（截断显示）
  - 文档数量
  - 状态
  - 操作按钮（编辑、删除、管理文档）

### 6.3 知识库详情页
- 基本信息：名称、描述
- 文档列表：
  - 文件名
  - 大小
  - 分块数
  - 状态
  - 操作（删除、重新索引）
- 上传区域：拖拽或点击上传

### 6.4 智能体配置页 - 知识库挂载
- 位置：工具/技能配置区下方
- 标题："RAG 知识库"
- 组件：多选复选框列表
  - 每项显示：知识库名称 + 描述（用于理解用途）

---

## 7. 验收标准

### 7.1 功能验收
1. **知识库创建**: 成功创建"人力资源库"，描述为"包含公司员工手册、规章制度等HR相关文档"
2. **文档上传**: 上传《Cyberpunk公司代码规范.pdf》和《Cyberpunk公司2026员工手册.pdf》（每份约 800 字）
3. **向量化**: 文档上传后自动完成解析、分块、向量化
4. **智能体挂载**: 在"行政助手"Agent 中勾选"人力资源库"
5. **对话测试**:
   - 问"公司有几天年假？"，Agent 显示"正在检索人力资源库..."，并给出基于手册的准确回答
   - 回答包含引用溯源（文档名 + 片段）
6. **隔离测试**: 在未挂载该库的"技术支持"Agent 中询问相同问题，Agent 回答"不知道"或不触发检索

### 7.2 性能验收
- 文档上传后 30 秒内完成索引
- 检索响应时间 < 2 秒

### 7.3 兼容性验收
- 流式输出功能不受影响
- 现有 MCP 服务和 Skills 功能正常

---

## 8. 技术风险与缓解措施

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| PDF 解析失败 | 文档无法索引 | 使用 unstructured 多种解析模式回退 |
| 向量库内存占用大 | 系统资源紧张 | 限制单个知识库文档数量，定期清理 |
| Embedding API 限流 | 批量上传慢 | 实现队列和重试机制 |
| 检索结果不准确 | 回答质量差 | 优化分块策略，后续支持 Hybrid Search |

---

## 9. 开发计划

| 阶段 | 任务 | 负责人 | 产出 |
|------|------|--------|------|
| Phase 1 | 后端核心模块 | Dev | 知识库 CRUD、文档处理、向量存储 |
| Phase 2 | 前端管理界面 | Dev | 知识库列表、文档上传 |
| Phase 3 | 智能体关联 | Dev | 配置页挂载、工具注入 |
| Phase 4 | 动态触发 | Dev | 运行时检索、引用溯源 |
| Phase 5 | UAT 验收 | User Rep | Playwright 测试 + 截图 |

---

## 10. 附录

### 10.1 测试文档内容

#### Cyberpunk公司2026员工手册.pdf
```
Cyberpunk公司2026员工手册

第一章 公司简介
Cyberpunk公司成立于2020年，是一家专注于人工智能技术研发的高科技企业。公司总部位于赛博城，现有员工500余人。

第二章 考勤制度
工作时间为周一至周五，上午9:00至下午6:00，午休时间为12:00-13:00。
员工需在上班时间前完成打卡，迟到超过15分钟需向主管说明情况。
每月迟到超过3次将扣除当月绩效奖金的10%。

第三章 年假制度
入职满一年的员工享有5天带薪年假。
入职满三年的员工享有10天带薪年假。
入职满五年的员工享有15天带薪年假。
年假需提前5个工作日申请，经部门主管批准后方可休假。
未使用的年假可在次年3月底前结转，逾期作废。

第四章 报销制度
差旅费报销需在出差结束后7个工作日内提交，附原始发票。
餐饮补贴标准为：早餐30元，午餐50元，晚餐50元。
交通费实报实销，需提供正规发票。
报销审批流程：员工提交→部门主管审核→财务复核→财务总监批准→打款。

第五章 离职规定
员工离职需提前30天书面通知公司。
离职前需完成工作交接，归还公司资产。
最后工资在离职后15个工作日内发放。
```

#### Cyberpunk公司代码规范.pdf
```
Cyberpunk公司代码规范 v2.0

1. 命名规范
1.1 变量命名
- 使用有意义的名称，禁止使用 a, b, c 等无意义命名
- 驼峰命名法：userName, orderList
- 常量全大写：MAX_RETRY_COUNT

1.2 函数命名
- 动词开头：getUserInfo(), calculateTotal()
- 布尔返回值用 is/has/can 开头：isValid(), hasPermission()

2. 代码结构
2.1 单一职责
每个函数只做一件事，函数长度不超过50行。

2.2 注释规范
- 复杂逻辑必须添加注释说明
- 使用中文注释，方便团队理解
- 函数头部说明参数和返回值

3. Git提交规范
3.1 提交信息格式
feat: 新功能
fix: 修复bug
docs: 文档更新
refactor: 代码重构

3.2 分支管理
- main: 生产环境代码
- develop: 开发环境代码
- feature/*: 功能分支
- hotfix/*: 紧急修复分支

4. 代码审查
所有代码合并前必须经过至少一人审查。
审查重点：逻辑正确性、代码规范、性能优化。
```

---

*文档结束*
