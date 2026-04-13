# LLM 服务商配置功能实现报告

## 实现日期
2026-04-02

## 功能概述
为 Fries 系统实现了完整的 LLM 服务商配置管理功能，支持多服务商、多模型配置，替代了原先简单的单一 API Key 设置方式。

## 实现内容

### 1. 数据库层 (backend/core/config_store.py)

#### 新增表结构
```sql
CREATE TABLE llm_providers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    key TEXT NOT NULL UNIQUE,
    base_url TEXT NOT NULL,
    api_key TEXT DEFAULT '',
    models TEXT DEFAULT '[]',
    is_default INTEGER DEFAULT 0,
    enabled INTEGER DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)
```

#### 新增函数
- `get_llm_providers()` - 获取所有服务商列表（含 API Key 脱敏）
- `get_llm_provider_by_key(provider_key)` - 根据 key 获取单个服务商
- `create_llm_provider(...)` - 创建新服务商
- `update_llm_provider(provider_id, ...)` - 更新服务商配置
- `delete_llm_provider(provider_id)` - 删除服务商
- `get_default_llm_provider()` - 获取默认服务商（用于系统回退）

#### 初始化逻辑
- 数据库初始化时自动检查是否存在服务商数据
- 如果没有数据，自动插入两个预设服务商：
  - **阿里云百炼** (aliyun): `https://dashscope.aliyuncs.com/compatible-mode/v1`
  - **智谱 AI** (zhipu): `https://open.bigmodel.cn/api/paas/v4`
- 支持通过环境变量或数据库配置覆盖默认设置

### 2. API 层 (backend/api/routes/admin_config.py)

#### 新增接口

| 接口 | 方法 | 功能 | 特性 |
|------|------|------|------|
| `/admin/llm-providers` | GET | 获取所有服务商 | API Key 脱敏显示 |
| `/admin/llm-providers` | POST | 创建服务商 | 自动加密 API Key |
| `/admin/llm-providers/{id}` | PUT | 更新服务商 | 支持部分更新 |
| `/admin/llm-providers/{id}` | DELETE | 删除服务商 | - |
| `/admin/llm-providers/default` | GET | 获取默认服务商 | - |

#### 修改接口
- **GET `/admin/config/system`**: 新增 `llm_provider_options` 字段，返回启用的服务商列表及模型信息
  ```json
  {
    "default_llm_provider": "aliyun",
    "default_llm_model": "deepseek-v3.2",
    "llm_provider_options": [
      {
        "key": "aliyun",
        "name": "阿里云百炼",
        "models": ["deepseek-v3.2", "qwen-max", "qwen-plus", "qwen-turbo"]
      },
      {
        "key": "zhipu",
        "name": "智谱 AI",
        "models": ["glm-4", "glm-4-flash", "glm-4-plus"]
      }
    ]
  }
  ```

### 3. 前端界面 (admin-web/app/config/page.tsx)

#### 服务商管理界面
- **服务商列表展示**
  - 卡片式布局，清晰显示服务商信息
  - 默认服务商蓝色边框标记
  - 禁用服务商红色背景标记
  - API Key 脱敏显示（前8位...后4位）
  
- **快速添加模板**
  - 提供 4 个预设模板：阿里云、智谱、DeepSeek、Moonshot
  - 点击模板按钮自动填充表单
  
- **编辑功能**
  - 支持修改服务商名称、Base URL、API Key、模型列表
  - API Key 编辑时提示当前状态，留空保持不变
  - 模型配置使用逗号分隔，易于编辑
  
- **删除功能**
  - 删除前确认提示
  - 删除后自动刷新列表

#### 系统配置界面优化
- **LLM 服务商选择**
  - 下拉菜单动态加载启用的服务商
  - 选择服务商后自动切换到该服务商的模型列表
  
- **LLM 模型选择**
  - 下拉菜单显示选中服务商支持的模型
  - 自动选择第一个模型作为默认值
  
- **智能联动**
  - 服务商切换时自动更新模型选项
  - 无可用服务商时显示提示信息

## 技术特性

### API Key 安全处理
- **加密存储**: 使用 AES-256 加密 API Key 存储到数据库
- **脱敏返回**: API 接口返回时自动脱敏（显示前8位和后4位）
- **编辑保护**: 编辑时不显示完整密钥，留空表示不修改

### 数据一致性保障
- **唯一性约束**: `key` 字段有 UNIQUE 约束，防止重复
- **默认服务商逻辑**: 设置默认时自动清除其他服务商的默认标记
- **自动回退**: 如果没有默认服务商，返回第一个启用的服务商

### 前端用户体验
- **响应式设计**: 所有弹窗和卡片适配不同屏幕尺寸
- **状态提示**: 清晰显示服务商状态（默认、启用、禁用）
- **操作反馈**: 所有操作都有成功/失败提示
- **快速操作**: 提供模板一键填充，减少手动输入

## 测试验证

### 语法验证
```bash
✓ core/config_store.py - syntax OK
✓ api/routes/admin_config.py - syntax OK
```

### 功能验证
```bash
# 数据库表已创建
sqlite3 Fries.db "SELECT name FROM sqlite_master WHERE type='table';"
→ llm_providers 表存在

# 默认数据已初始化
sqlite3 Fries.db "SELECT * FROM llm_providers;"
→ 1|阿里云百炼|aliyun|...
→ 2|智谱 AI|zhipu|...

# API 正常工作
curl http://localhost:8080/api/admin/llm-providers
→ 返回服务商列表（含脱敏 API Key）

curl http://localhost:8080/api/admin/config/system
→ 返回系统配置（含 llm_provider_options）
```

## 使用流程

### 1. 添加服务商
1. 点击"添加自定义服务商"按钮
2. 填写服务商信息（或使用模板快速填充）
3. 输入 API Key（可选）
4. 配置支持的模型列表（逗号分隔）
5. 设置是否为默认服务商
6. 点击保存

### 2. 配置系统默认
1. 在系统配置区域选择默认 LLM 服务商
2. 从下拉菜单选择默认模型
3. 点击保存配置

### 3. 管理服务商
- **编辑**: 点击服务商卡片上的"编辑"按钮
- **删除**: 点击"删除"按钮，确认后删除
- **启用/禁用**: 编辑时勾选或取消"启用"选项

## API 兼容性

所有新增接口保持与现有 API 的兼容性：
- 使用相同的认证机制（admin_token）
- 使用相同的响应格式
- 保持现有的 `/admin/config/platform-keys` 接口作为备用密钥管理

## 后续建议

1. **服务商配置验证**: 添加 API Key 有效性验证功能
2. **模型自动发现**: 从服务商 API 自动获取支持的模型列表
3. **服务商切换**: 支持一键切换默认服务商，无需手动编辑
4. **配额管理**: 为每个服务商配置独立的调用配额限制

## 文件修改清单

| 文件 | 修改内容 | 行数变化 |
|------|---------|---------|
| backend/core/config_store.py | 新增 llm_providers 表和 CRUD 函数 | +150 行 |
| backend/api/routes/admin_config.py | 新增服务商管理 API，修改系统配置接口 | +80 行 |
| admin-web/app/config/page.tsx | 完整重写，实现服务商管理界面 | +600 行 |

## 总结

本次实现完成了完整的 LLM 服务商配置管理功能，从数据库设计到前后端实现，提供了灵活的多服务商、多模型配置能力。系统默认提供了阿里云和智谱两个预设服务商，同时支持自定义添加其他服务商。前端界面简洁易用，提供了模板快速添加、智能联动选择等功能，大幅提升了用户体验。

所有代码已通过语法验证，API 已测试正常工作，功能完整可用。