"use client"

import { useEffect, useState } from 'react'

type SystemConfig = {
  default_city: string
  default_language: string
  default_refresh_interval: number
  default_modes: string
  default_llm_provider: string
  default_llm_model: string
  default_image_provider: string
  default_image_model: string
  llm_provider_options?: ProviderOption[]
}

type ProviderOption = {
  key: string
  name: string
  models: string[]
}

type LLMProvider = {
  id: number
  name: string
  key: string
  base_url: string
  api_key: string
  api_key_set: boolean
  api_key_masked?: string
  models: string[]
  is_default: boolean
  enabled: boolean
  created_at: string
}

type PlatformKeys = {
  llm_api_key_masked: string
  image_api_key_masked: string
  llm_api_key_set: boolean
  image_api_key_set: boolean
  source: string
}

// 预设模板
const PROVIDER_TEMPLATES: Record<string, Partial<LLMProvider>> = {
  aliyun: {
    name: "阿里云百炼",
    key: "aliyun",
    base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    models: ["deepseek-v3.2", "qwen-max", "qwen-plus", "qwen-turbo"],
  },
  zhipu: {
    name: "智谱 AI",
    key: "zhipu",
    base_url: "https://open.bigmodel.cn/api/paas/v4",
    models: ["glm-4", "glm-4-flash", "glm-4-plus"],
  },
  deepseek: {
    name: "DeepSeek",
    key: "deepseek",
    base_url: "https://api.deepseek.com/v1",
    models: ["deepseek-chat", "deepseek-coder"],
  },
  moonshot: {
    name: "Moonshot",
    key: "moonshot",
    base_url: "https://api.moonshot.cn/v1",
    models: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"],
  },
  openai: {
    name: "OpenAI",
    key: "openai",
    base_url: "https://api.openai.com/v1",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"],
  },
}

export default function ConfigPage() {
  const [config, setConfig] = useState<SystemConfig | null>(null)
  const [platformKeys, setPlatformKeys] = useState<PlatformKeys | null>(null)
  const [providers, setProviders] = useState<LLMProvider[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showKeyModal, setShowKeyModal] = useState(false)
  const [newLlmKey, setNewLlmKey] = useState('')
  const [newImageKey, setNewImageKey] = useState('')
  const [savingKeys, setSavingKeys] = useState(false)
  
  // 服务商管理弹窗状态
  const [showProviderModal, setShowProviderModal] = useState(false)
  const [editingProvider, setEditingProvider] = useState<LLMProvider | null>(null)
  const [providerForm, setProviderForm] = useState<Partial<LLMProvider>>({
    name: '',
    key: '',
    base_url: '',
    api_key: '',
    models: [],
    is_default: false,
    enabled: true,
  })
  const [modelsInput, setModelsInput] = useState('')
  const [savingProvider, setSavingProvider] = useState(false)
  const [showTemplateSelector, setShowTemplateSelector] = useState(false)

  useEffect(() => {
    loadConfig()
    loadPlatformKeys()
    loadProviders()
  }, [])

  async function loadConfig() {
    try {
      const res = await fetch('/api/admin/config/system', { credentials: 'include' })
      if (!res.ok) throw new Error('加载失败')
      setConfig(await res.json())
    } catch (e) {
      setError('无法加载系统配置')
    }
  }

  async function loadPlatformKeys() {
    try {
      const res = await fetch('/api/admin/config/platform-keys', { credentials: 'include' })
      if (!res.ok) throw new Error('加载失败')
      setPlatformKeys(await res.json())
    } catch (e) {
      // ignore
    }
  }

  async function loadProviders() {
    try {
      const res = await fetch('/api/admin/llm-providers', { credentials: 'include' })
      if (!res.ok) throw new Error('加载失败')
      const data = await res.json()
      setProviders(data.providers || [])
    } catch (e) {
      setError('无法加载服务商列表')
    }
  }

  async function saveConfig() {
    if (!config) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/config/system', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (!res.ok) throw new Error('保存失败')
      setError('')
      alert('配置已保存')
    } catch (e) {
      setError('保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function saveKeys() {
    setSavingKeys(true)
    try {
      const res = await fetch('/api/admin/config/platform-keys', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          llm_api_key: newLlmKey,
          image_api_key: newImageKey,
        }),
      })
      if (!res.ok) throw new Error('保存失败')
      setShowKeyModal(false)
      loadPlatformKeys()
      alert('API Key 已保存')
    } catch (e) {
      setError('保存 Key 失败')
    } finally {
      setSavingKeys(false)
    }
  }

  // 打开添加服务商弹窗
  function openAddProviderModal() {
    setEditingProvider(null)
    setProviderForm({
      name: '',
      key: '',
      base_url: '',
      api_key: '',
      models: [],
      is_default: false,
      enabled: true,
    })
    setModelsInput('')
    setShowTemplateSelector(true)
  }

  // 选择模板
  function selectTemplate(templateKey: string) {
    const template = PROVIDER_TEMPLATES[templateKey]
    if (template) {
      setProviderForm({
        ...template,
        api_key: '',
        is_default: false,
        enabled: true,
      } as Partial<LLMProvider>)
      setModelsInput(template.models?.join(', ') || '')
    }
    setShowTemplateSelector(false)
    setShowProviderModal(true)
  }

  // 打开编辑服务商弹窗
  function openEditProviderModal(provider: LLMProvider) {
    setEditingProvider(provider)
    setProviderForm({ ...provider })
    setModelsInput(provider.models.join(', '))
    setShowProviderModal(true)
  }

  // 保存服务商
  async function saveProvider() {
    setSavingProvider(true)
    try {
      const models = modelsInput.split(',').map(m => m.trim()).filter(m => m)
      const body = {
        ...providerForm,
        models,
      }

      const url = editingProvider 
        ? `/api/admin/llm-providers/${editingProvider.id}`
        : '/api/admin/llm-providers'
      
      const res = await fetch(url, {
        method: editingProvider ? 'PUT' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      
      if (!res.ok) throw new Error('保存失败')
      const data = await res.json()
      
      if (!data.ok) {
        throw new Error(data.error || '保存失败')
      }
      
      setShowProviderModal(false)
      await loadProviders()
      await loadConfig() // 刷新配置中的服务商选项
      alert(editingProvider ? '服务商已更新' : '服务商已创建')
    } catch (e: any) {
      setError(e.message || '保存服务商失败')
    } finally {
      setSavingProvider(false)
    }
  }

  // 删除服务商
  async function deleteProvider(id: number) {
    if (!confirm('确定要删除这个服务商吗？')) return
    
    try {
      const res = await fetch(`/api/admin/llm-providers/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      
      if (!res.ok) throw new Error('删除失败')
      const data = await res.json()
      
      if (!data.ok) {
        throw new Error(data.error || '删除失败')
      }
      
      await loadProviders()
      await loadConfig()
      alert('服务商已删除')
    } catch (e: any) {
      setError(e.message || '删除服务商失败')
    }
  }

  // 获取可用的服务商选项（用于系统配置下拉框）
  const availableProviders = config?.llm_provider_options || providers.filter(p => p.enabled).map(p => ({
    key: p.key,
    name: p.name,
    models: p.models,
  }))

  // 获取当前选中服务商的模型列表
  const currentProviderModels = availableProviders.find(p => p.key === config?.default_llm_provider)?.models || []

  return (
    <div>
      <div className="header-row"><h2>系统配置</h2></div>
      
      {error && <div className="card" style={{ color: '#dc2626', marginBottom: 16 }}>{error}</div>}
      
      {/* LLM 服务商管理 */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>LLM 服务商管理</h3>
          <button onClick={openAddProviderModal}>+ 添加服务商</button>
        </div>
        
        {providers.length === 0 ? (
          <div style={{ color: '#6b7280', padding: '20px 0', textAlign: 'center' }}>
            暂无服务商配置，请点击"添加服务商"
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {providers.map(provider => (
              <div 
                key={provider.id} 
                style={{ 
                  border: '1px solid #e5e7eb', 
                  borderRadius: 8, 
                  padding: 12,
                  background: provider.enabled ? '#fff' : '#f3f4f6',
                  opacity: provider.enabled ? 1 : 0.7,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <strong>{provider.name}</strong>
                      <code style={{ 
                        background: '#f3f4f6', 
                        padding: '2px 6px', 
                        borderRadius: 4,
                        fontSize: 12,
                      }}>
                        {provider.key}
                      </code>
                      {provider.is_default && (
                        <span style={{ 
                          background: '#dbeafe', 
                          color: '#1e40af',
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: 12,
                        }}>
                          默认
                        </span>
                      )}
                      {!provider.enabled && (
                        <span style={{ 
                          background: '#fee2e2', 
                          color: '#991b1b',
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: 12,
                        }}>
                          已禁用
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>
                      {provider.base_url}
                    </div>
                    <div style={{ fontSize: 13, color: '#374151' }}>
                      API Key: {provider.api_key_masked || '未设置'} | 
                      模型: {provider.models.slice(0, 3).join(', ')}{provider.models.length > 3 ? ` 等${provider.models.length}个` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button 
                      onClick={() => openEditProviderModal(provider)}
                      style={{ padding: '4px 12px', fontSize: 13 }}
                    >
                      编辑
                    </button>
                    <button 
                      onClick={() => deleteProvider(provider.id)}
                      style={{ 
                        padding: '4px 12px', 
                        fontSize: 13, 
                        background: '#dc2626',
                      }}
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 平台 API Key */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 12px 0' }}>平台 API Key（全局）</h3>
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>LLM API Key:</span>
            <span style={{ color: platformKeys?.llm_api_key_set ? '#059669' : '#9ca3af' }}>
              {platformKeys?.llm_api_key_masked || '未设置'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Image API Key:</span>
            <span style={{ color: platformKeys?.image_api_key_set ? '#059669' : '#9ca3af' }}>
              {platformKeys?.image_api_key_masked || '未设置'}
            </span>
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
            来源: {platformKeys?.source === 'database' ? '数据库配置' : '环境变量'}
          </div>
          <button onClick={() => setShowKeyModal(true)} style={{ marginTop: 8 }}>
            设置 API Key
          </button>
        </div>
      </div>

      {/* 系统默认配置 */}
      {!config ? <div className="card">加载中...</div> : (
        <div className="card">
          <h3 style={{ margin: '0 0 16px 0' }}>默认配置</h3>
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label>默认城市:</label>
              <input
                value={config.default_city}
                onChange={e => setConfig({ ...config, default_city: e.target.value })}
                style={{ width: 200 }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label>默认语言:</label>
              <select
                value={config.default_language}
                onChange={e => setConfig({ ...config, default_language: e.target.value })}
                style={{ width: 200 }}
              >
                <option value="zh">中文</option>
                <option value="en">英文</option>
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label>默认刷新间隔 (分钟):</label>
              <input
                type="number"
                value={config.default_refresh_interval}
                onChange={e => setConfig({ ...config, default_refresh_interval: parseInt(e.target.value) || 60 })}
                style={{ width: 200 }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label>默认模式:</label>
              <input
                value={config.default_modes}
                onChange={e => setConfig({ ...config, default_modes: e.target.value })}
                style={{ width: 200 }}
                placeholder="STOIC,DAILY"
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label>LLM 服务商:</label>
              <select
                value={config.default_llm_provider}
                onChange={e => {
                  const newProvider = e.target.value
                  const provider = availableProviders.find(p => p.key === newProvider)
                  setConfig({ 
                    ...config, 
                    default_llm_provider: newProvider,
                    default_llm_model: provider?.models?.[0] || '',
                  })
                }}
                style={{ width: 200 }}
              >
                {availableProviders.map(p => (
                  <option key={p.key} value={p.key}>{p.name}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label>LLM 模型:</label>
              <select
                value={config.default_llm_model}
                onChange={e => setConfig({ ...config, default_llm_model: e.target.value })}
                style={{ width: 200 }}
              >
                {currentProviderModels.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label>Image 服务商:</label>
              <select
                value={config.default_image_provider}
                onChange={e => setConfig({ ...config, default_image_provider: e.target.value })}
                style={{ width: 200 }}
              >
                <option value="aliyun">阿里云百炼</option>
                <option value="openai">OpenAI</option>
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label>Image 模型:</label>
              <input
                value={config.default_image_model}
                onChange={e => setConfig({ ...config, default_image_model: e.target.value })}
                style={{ width: 200 }}
              />
            </div>
          </div>
          <button onClick={saveConfig} disabled={saving} style={{ marginTop: 16 }}>
            {saving ? '保存中...' : '保存配置'}
          </button>
        </div>
      )}

      {/* 模板选择弹窗 */}
      {showTemplateSelector && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: '#fff',
            padding: 24,
            borderRadius: 8,
            width: 400,
            maxWidth: '90vw',
          }}>
            <h3 style={{ margin: '0 0 16px 0' }}>选择服务商模板</h3>
            <div style={{ display: 'grid', gap: 8 }}>
              {Object.entries(PROVIDER_TEMPLATES).map(([key, template]) => (
                <button
                  key={key}
                  onClick={() => selectTemplate(key)}
                  style={{
                    padding: 12,
                    textAlign: 'left',
                    background: '#f9fafb',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{template.name}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{template.base_url}</div>
                </button>
              ))}
              <button
                onClick={() => {
                  setShowTemplateSelector(false)
                  setShowProviderModal(true)
                }}
                style={{
                  padding: 12,
                  textAlign: 'center',
                  background: '#fff',
                  border: '2px dashed #d1d5db',
                  borderRadius: 8,
                  cursor: 'pointer',
                  marginTop: 8,
                }}
              >
                + 自定义服务商
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button 
                onClick={() => setShowTemplateSelector(false)}
                style={{ background: '#6b7280', flex: 1 }}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 服务商编辑弹窗 */}
      {showProviderModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: '#fff',
            padding: 24,
            borderRadius: 8,
            width: 500,
            maxWidth: '90vw',
            maxHeight: '90vh',
            overflow: 'auto',
          }}>
            <h3 style={{ margin: '0 0 16px 0' }}>
              {editingProvider ? '编辑服务商' : '添加服务商'}
            </h3>
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 4 }}>名称:</label>
                <input
                  value={providerForm.name || ''}
                  onChange={e => setProviderForm({ ...providerForm, name: e.target.value })}
                  placeholder="如：阿里云百炼"
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4 }}>Key (唯一标识):</label>
                <input
                  value={providerForm.key || ''}
                  onChange={e => setProviderForm({ ...providerForm, key: e.target.value })}
                  placeholder="如：aliyun"
                  disabled={!!editingProvider}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4 }}>Base URL:</label>
                <input
                  value={providerForm.base_url || ''}
                  onChange={e => setProviderForm({ ...providerForm, base_url: e.target.value })}
                  placeholder="https://..."
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4 }}>
                  API Key: {editingProvider?.api_key_set ? '(已设置)' : ''}
                </label>
                <input
                  type="password"
                  value={providerForm.api_key || ''}
                  onChange={e => setProviderForm({ ...providerForm, api_key: e.target.value })}
                  placeholder={editingProvider ? "留空保持原值，输入新值覆盖" : "输入 API Key"}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4 }}>模型列表 (逗号分隔):</label>
                <textarea
                  value={modelsInput}
                  onChange={e => setModelsInput(e.target.value)}
                  placeholder="deepseek-v3.2, qwen-max, qwen-plus"
                  style={{ width: '100%', minHeight: 60 }}
                />
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={providerForm.is_default || false}
                    onChange={e => setProviderForm({ ...providerForm, is_default: e.target.checked })}
                  />
                  设为默认服务商
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={providerForm.enabled !== false}
                    onChange={e => setProviderForm({ ...providerForm, enabled: e.target.checked })}
                  />
                  启用
                </label>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={saveProvider} disabled={savingProvider} style={{ flex: 1 }}>
                {savingProvider ? '保存中...' : '保存'}
              </button>
              <button 
                onClick={() => setShowProviderModal(false)} 
                style={{ background: '#6b7280' }}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* API Key 设置弹窗 */}
      {showKeyModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: '#fff',
            padding: 24,
            borderRadius: 8,
            width: 400,
            maxWidth: '90vw',
          }}>
            <h3 style={{ margin: '0 0 16px 0' }}>设置平台 API Key</h3>
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 4 }}>LLM API Key:</label>
                <input
                  type="password"
                  value={newLlmKey}
                  onChange={e => setNewLlmKey(e.target.value)}
                  placeholder="留空则清除数据库中的 Key"
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4 }}>Image API Key:</label>
                <input
                  type="password"
                  value={newImageKey}
                  onChange={e => setNewImageKey(e.target.value)}
                  placeholder="留空则清除数据库中的 Key"
                  style={{ width: '100%' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={saveKeys} disabled={savingKeys}>
                {savingKeys ? '保存中...' : '保存'}
              </button>
              <button onClick={() => setShowKeyModal(false)} style={{ background: '#6b7280' }}>
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
