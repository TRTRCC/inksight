"use client"

import { useEffect, useState } from 'react'

type Group = {
  id: number
  name: string
  description: string
  llm_provider: string
  llm_model: string
  monthly_quota: number
  member_count: number
  created_at: string
  updated_at: string
}

const LLM_PROVIDERS = [
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'dashscope', label: '阿里百炼' },
  { value: 'moonshot', label: '月之暗面' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'custom', label: '自定义' },
]

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<Group | null>(null)
  const [isNew, setIsNew] = useState(false)

  // 表单字段
  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formProvider, setFormProvider] = useState('deepseek')
  const [formModel, setFormModel] = useState('')
  const [formQuota, setFormQuota] = useState('0')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  async function load() {
    try {
      const res = await fetch('/api/admin/groups', { credentials: 'include' })
      if (!res.ok) throw new Error('加载失败')
      const data = await res.json()
      setGroups(data.items || [])
      setError('')
    } catch {
      setError('加载失败，请确认已登录')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function openNew() {
    setIsNew(true)
    setFormName(''); setFormDesc(''); setFormProvider('deepseek'); setFormModel(''); setFormQuota('0')
    setSaveError('')
    setEditing({} as Group)
  }

  function openEdit(g: Group) {
    setIsNew(false)
    setFormName(g.name); setFormDesc(g.description); setFormProvider(g.llm_provider); setFormModel(g.llm_model); setFormQuota(String(g.monthly_quota))
    setSaveError('')
    setEditing(g)
  }

  async function save() {
    if (!formName.trim()) { setSaveError('名称不能为空'); return }
    setSaving(true); setSaveError('')
    try {
      const body = { name: formName, description: formDesc, llm_provider: formProvider, llm_model: formModel, monthly_quota: parseInt(formQuota) || 0 }
      const url = isNew ? '/api/admin/groups' : `/api/admin/groups/${editing!.id}`
      const method = isNew ? 'POST' : 'PUT'
      const res = await fetch(url, { method, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '保存失败')
      }
      setEditing(null)
      await load()
    } catch (e: any) {
      setSaveError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteGroup(id: number) {
    if (!confirm('确定删除此分组？分组内的用户不会被删除，但会变为未分组状态。')) return
    try {
      const res = await fetch(`/api/admin/groups/${id}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) throw new Error()
      await load()
    } catch { alert('删除失败') }
  }

  async function resetQuota(id: number, currentQuota: number) {
    const input = prompt(`重置配额（留空使用分组默认值 ${currentQuota}）：`)
    if (input === null) return
    const quota = input.trim() === '' ? undefined : parseInt(input)
    try {
      const body: any = {}
      if (quota !== undefined) body.monthly_quota = quota
      const res = await fetch(`/api/admin/groups/${id}/reset-quota`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) throw new Error()
      alert('配额重置成功')
    } catch { alert('重置失败') }
  }

  function closeForm() { setEditing(null) }

  return (
    <div>
      <div className="header-row">
        <h2>用户分组</h2>
        <button onClick={openNew}>+ 新建分组</button>
      </div>

      {editing && (
        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>{isNew ? '新建分组' : '编辑分组'}</h3>
          <div style={{ display: 'grid', gap: 10, maxWidth: 500 }}>
            <label>
              <span style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>分组名称 *</span>
              <input value={formName} onChange={e => setFormName(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, boxSizing: 'border-box' }} />
            </label>
            <label>
              <span style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>描述</span>
              <input value={formDesc} onChange={e => setFormDesc(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, boxSizing: 'border-box' }} />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label>
                <span style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>AI 提供商</span>
                <select value={formProvider} onChange={e => setFormProvider(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }}>
                  {LLM_PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </label>
              <label>
                <span style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>模型</span>
                <input value={formModel} onChange={e => setFormModel(e.target.value)} placeholder="如 deepseek-chat（留空用默认）" style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, boxSizing: 'border-box' }} />
              </label>
            </div>
            <label>
              <span style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>每月配额（0 = 无限制）</span>
              <input type="number" value={formQuota} onChange={e => setFormQuota(e.target.value)} min="0" style={{ width: 200, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
            </label>
          </div>
          {saveError && <div style={{ color: '#b91c1c', marginTop: 8 }}>{saveError}</div>}
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button disabled={saving} onClick={save} style={{ padding: '8px 16px', border: 0, borderRadius: 6, background: '#111827', color: 'white', cursor: 'pointer' }}>{saving ? '保存中…' : '保存'}</button>
            <button onClick={closeForm} style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 6, background: 'white', cursor: 'pointer' }}>取消</button>
          </div>
        </div>
      )}

      <div className="table-wrap">
        {error ? <div>{error}</div> : loading ? <div>加载中…</div> : groups.length === 0 ? <div>暂无分组，点击上方按钮新建</div> : (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>名称</th>
                <th>描述</th>
                <th>AI 提供商</th>
                <th>模型</th>
                <th>每月配额</th>
                <th>用户数</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {groups.map(g => (
                <tr key={g.id}>
                  <td>{g.id}</td>
                  <td style={{ fontWeight: 600 }}>{g.name}</td>
                  <td>{g.description || '-'}</td>
                  <td>{g.llm_provider}</td>
                  <td>{g.llm_model || '-'}</td>
                  <td>{g.monthly_quota === 0 ? '无限制' : g.monthly_quota + ' 次/月'}</td>
                  <td>{g.member_count}</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => openEdit(g)}>编辑</button>
                    <button onClick={() => resetQuota(g.id, g.monthly_quota)}>重置配额</button>
                    <button onClick={() => deleteGroup(g.id)} style={{ color: '#b91c1c' }}>删除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
