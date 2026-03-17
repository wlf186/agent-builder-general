# Cyberpunk公司代码规范

## 1. 总则

### 1.1 目的
本规范旨在统一公司代码风格，提高代码可读性、可维护性和团队协作效率。

### 1.2 适用范围
本规范适用于公司所有项目的代码开发工作，包括但不限于：
- 前端开发（React, Vue, Angular等）
- 后端开发（Python, Java, Go等）
- 移动端开发（iOS, Android）
- 数据分析脚本

## 2. 通用规范

### 2.1 编码风格
- 使用UTF-8编码
- 缩进使用4个空格（Python）或2个空格（前端）
- 每行代码不超过120个字符
- 文件末尾保留一个空行

### 2.2 命名规范
- **变量名**：使用小驼峰命名法（camelCase）
- **函数名**：使用小驼峰命名法（camelCase）
- **类名**：使用大驼峰命名法（PascalCase）
- **常量名**：使用全大写下划线命名法（UPPER_SNAKE_CASE）
- **文件名**：使用小写中划线命名法（kebab-case）

### 2.3 注释规范
- 所有公共函数必须有文档注释
- 复杂逻辑必须有行内注释说明
- 注释使用英文，保持简洁明了

```python
def calculate_total_price(items: list, discount: float = 0.0) -> float:
    """
    Calculate the total price of items with optional discount.

    Args:
        items: List of item objects with 'price' attribute
        discount: Discount rate (0.0 to 1.0), default is 0.0

    Returns:
        Total price after applying discount
    """
    subtotal = sum(item.price for item in items)
    return subtotal * (1 - discount)
```

## 3. Python规范

### 3.1 代码风格
- 遵循PEP 8规范
- 使用Black格式化工具
- 使用isort进行import排序

### 3.2 类型注解
- 所有函数参数和返回值必须有类型注解
- 使用typing模块提供的类型

```python
from typing import List, Optional, Dict

def process_data(
    data: List[Dict[str, any]],
    filter_key: Optional[str] = None
) -> List[Dict[str, any]]:
    if filter_key:
        return [item for item in data if filter_key in item]
    return data
```

### 3.3 异常处理
- 不要使用裸except
- 指定具体的异常类型
- 异常信息要有意义

```python
# Good
try:
    result = parse_json(data)
except json.JSONDecodeError as e:
    logger.error(f"Failed to parse JSON: {e}")
    raise ValueError("Invalid JSON format") from e

# Bad
try:
    result = parse_json(data)
except:
    pass
```

## 4. JavaScript/TypeScript规范

### 4.1 代码风格
- 使用ESLint进行代码检查
- 使用Prettier进行代码格式化
- 优先使用const，其次是let，避免使用var

### 4.2 TypeScript类型
- 避免使用any类型
- 使用interface定义对象类型
- 使用type定义联合类型和工具类型

```typescript
// Good
interface User {
  id: string;
  name: string;
  email: string;
}

type UserRole = 'admin' | 'user' | 'guest';

function getUserById(id: string): Promise<User | null> {
  // implementation
}
```

### 4.3 异步处理
- 使用async/await代替.then()链
- 统一错误处理方式

```typescript
// Good
async function fetchData(url: string): Promise<Data> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    logger.error('Failed to fetch data:', error);
    throw error;
  }
}
```

## 5. Git规范

### 5.1 分支命名
- `main`: 主分支，生产环境代码
- `develop`: 开发分支
- `feature/xxx`: 功能分支
- `bugfix/xxx`: 修复分支
- `hotfix/xxx`: 紧急修复分支

### 5.2 Commit消息格式
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type类型**：
- `feat`: 新功能
- `fix`: 修复bug
- `docs`: 文档更新
- `style`: 代码格式调整
- `refactor`: 代码重构
- `test`: 测试相关
- `chore`: 构建/工具链相关

**示例**：
```
feat(auth): add OAuth2.0 authentication

- Add Google OAuth provider
- Add session management
- Add login/logout endpoints

Closes #123
```

### 5.3 代码审查
- 所有代码合并前必须经过Code Review
- 至少需要1位Reviewer批准
- Reviewer应关注：
  - 代码逻辑正确性
  - 代码风格符合规范
  - 测试覆盖率
  - 潜在的安全问题

## 6. 测试规范

### 6.1 单元测试
- 所有公共函数必须有单元测试
- 测试覆盖率不低于80%
- 使用pytest（Python）或Jest（JavaScript）

### 6.2 测试命名
```python
# Python
def test_should_return_sum_when_adding_two_numbers():
    assert add(2, 3) == 5

# JavaScript
describe('add function', () => {
  it('should return sum when adding two numbers', () => {
    expect(add(2, 3)).toBe(5);
  });
});
```

## 7. 安全规范

### 7.1 敏感信息
- 不要在代码中硬编码敏感信息
- 使用环境变量存储密钥和配置
- 不要将.env文件提交到版本控制

### 7.2 输入验证
- 所有外部输入必须进行验证
- 使用参数化查询防止SQL注入
- 对用户输入进行XSS过滤

## 8. 文档规范

### 8.1 README文件
每个项目必须包含README.md，内容应包括：
- 项目简介
- 环境要求
- 安装步骤
- 使用方法
- 测试方法
- 部署说明

### 8.2 API文档
- 使用OpenAPI/Swagger规范
- 所有API端点必须有文档说明
- 包含请求/响应示例

## 9. 版本控制

### 9.1 版本号规范
遵循语义化版本规范（Semantic Versioning）：
- 主版本号：不兼容的API变更
- 次版本号：向下兼容的功能新增
- 修订号：向下兼容的问题修复

示例：1.2.3
- 1: 主版本号
- 2: 次版本号
- 3: 修订号

## 10. 附录

### 10.1 推荐工具
- Python: Black, isort, mypy, pylint
- JavaScript: ESLint, Prettier, TypeScript
- Git: GitLab, GitHub
- CI/CD: GitLab CI, GitHub Actions

### 10.2 参考资源
- [PEP 8 -- Style Guide for Python Code](https://www.python.org/dev/peps/pep-0008/)
- [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript)
- [Conventional Commits](https://www.conventionalcommits.org/)

---
*版本：v1.0*
*发布日期：2026年1月1日*
*维护团队：技术委员会*
