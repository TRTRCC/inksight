"use client"

import { useEffect, useState } from 'react'
import { Shield, AlertTriangle, UserX, Activity, TrendingUp, Ban } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

type RiskUser = {
  user_id: number
  username: string
  risk_score: number
  risk_factors: string[]
  device_count: number
  api_calls: number
  created_at: string
  status: string
}

type BehaviorData = {
  user: {
    id: number
    username: string
    email: string
    role: string
    status: string
    created_at: string
  }
  stats: {
    device_count: number
    render_count: number
    api_calls: number
    quota_remaining: number
    last_active: string
  }
}

export default function SecurityPage() {
  const [riskUsers, setRiskUsers] = useState<RiskUser[]>([])
  const [selectedUser, setSelectedUser] = useState<BehaviorData | null>(null)
  const [loading, setLoading] = useState(true)
  const [banning, setBanning] = useState<number | null>(null)

  useEffect(() => {
    loadRiskUsers()
  }, [])

  async function loadRiskUsers() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/security/risk-users', { credentials: 'include' })
      if (!res.ok) throw new Error('请先登录')
      const data = await res.json()
      setRiskUsers(data.items || [])
    } catch {}
    finally {
      setLoading(false)
    }
  }

  async function viewUserBehavior(userId: number) {
    try {
      const res = await fetch(`/api/admin/users/${userId}/behavior`, { credentials: 'include' })
      const data = await res.json()
      setSelectedUser(data)
    } catch {}
  }

  async function banUser(userId: number) {
    if (!confirm('确定封禁此用户？此操作不可撤销。')) return
    setBanning(userId)
    try {
      await fetch(`/api/admin/security/ban-user/${userId}`, {
        method: 'POST',
        credentials: 'include',
      })
      loadRiskUsers()
      setSelectedUser(null)
    } catch {}
    finally {
      setBanning(null)
    }
  }

  async function freezeUser(userId: number) {
    if (!confirm('确定冻结此用户？')) return
    setBanning(userId)
    try {
      await fetch(`/api/admin/users/${userId}/set-status`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'frozen' }),
      })
      loadRiskUsers()
    } catch {}
    finally {
      setBanning(null)
    }
  }

  // 风险分数分布图数据
  const riskDistribution = [
    { range: '0-20', count: riskUsers.filter(u => u.risk_score < 20).length, color: '#10b981' },
    { range: '20-40', count: riskUsers.filter(u => u.risk_score >= 20 && u.risk_score < 40).length, color: '#f59e0b' },
    { range: '40-60', count: riskUsers.filter(u => u.risk_score >= 40 && u.risk_score < 60).length, color: '#f97316' },
    { range: '60+', count: riskUsers.filter(u => u.risk_score >= 60).length, color: '#ef4444' },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="text-blue-500" size={24} />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">安全风控</h1>
            <p className="text-gray-500 mt-1">恶意用户识别与自动防护</p>
          </div>
        </div>
        <button
          onClick={loadRiskUsers}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm"
        >
          <Activity size={16} />
          刷新检测
        </button>
      </div>

      {/* 风险概览 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 风险分布图 */}
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-gray-400" />
            <h3 className="font-semibold text-gray-900">风险分数分布</h3>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={riskDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="range" stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 text-sm text-gray-500">
            风险分数越高，用户行为越可疑
          </div>
        </div>

        {/* 检测规则说明 */}
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">自动检测规则</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="text-orange-500 mt-0.5" />
              <div>
                <span className="font-medium text-gray-900">设备绑定异常</span>
                <p className="text-gray-500">新用户短时间内绑定大量设备 (+20分)</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="text-orange-500 mt-0.5" />
              <div>
                <span className="font-medium text-gray-900">API调用高频</span>
                <p className="text-gray-500">短时间内大量 API 请求 (+25分)</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="text-orange-500 mt-0.5" />
              <div>
                <span className="font-medium text-gray-900">额度耗尽持续请求</span>
                <p className="text-gray-500">免费额度用完后继续请求 (+15分)</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="text-orange-500 mt-0.5" />
              <div>
                <span className="font-medium text-gray-900">用户名可疑</span>
                <p className="text-gray-500">用户名含 test/spam/bot 等关键词 (+10分)</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 风险用户列表 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ban size={18} className="text-red-500" />
            <h3 className="font-semibold text-gray-900">可疑用户列表</h3>
            <span className="ml-2 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">
              {riskUsers.length} 个风险用户
            </span>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400">检测中...</div>
        ) : riskUsers.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <Shield size={32} className="mx-auto mb-2 text-green-500" />
            <p className="text-green-600 font-medium">系统安全，无可疑用户</p>
            <p className="text-sm text-gray-500 mt-1">所有用户行为正常</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">用户</th>
                <th className="px-4 py-3 text-left">风险分数</th>
                <th className="px-4 py-3 text-left">风险因素</th>
                <th className="px-4 py-3 text-left">设备数</th>
                <th className="px-4 py-3 text-left">API调用</th>
                <th className="px-4 py-3 text-left">状态</th>
                <th className="px-4 py-3 text-left">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {riskUsers.map((u) => (
                <tr key={u.user_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div>
                      <span className="font-medium">{u.username}</span>
                      <span className="text-xs text-gray-400 ml-2">ID: {u.user_id}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        u.risk_score >= 50 ? 'bg-red-100 text-red-700' :
                        u.risk_score >= 30 ? 'bg-orange-100 text-orange-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {u.risk_score}
                      </span>
                      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${u.risk_score >= 50 ? 'bg-red-500' : u.risk_score >= 30 ? 'bg-orange-500' : 'bg-yellow-500'}`}
                          style={{ width: `${Math.min(u.risk_score, 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                    {u.risk_factors.join(', ')}
                  </td>
                  <td className="px-4 py-3">{u.device_count}</td>
                  <td className="px-4 py-3">{u.api_calls}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs ${
                      u.status === 'banned' ? 'bg-red-100 text-red-700' :
                      u.status === 'frozen' ? 'bg-orange-100 text-orange-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => viewUserBehavior(u.user_id)}
                        className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-xs"
                      >
                        详情
                      </button>
                      {u.status !== 'banned' && (
                        <>
                          <button
                            onClick={() => freezeUser(u.user_id)}
                            disabled={banning === u.user_id}
                            className="px-2 py-1 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded text-xs"
                          >
                            冻结
                          </button>
                          <button
                            onClick={() => banUser(u.user_id)}
                            disabled={banning === u.user_id}
                            className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs"
                          >
                            封禁
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 用户详情弹窗 */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-[400px] max-w-[90vw]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">{selectedUser.user.username} 行为分析</h3>
              <button onClick={() => setSelectedUser(null)} className="text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500">设备数</div>
                  <div className="text-lg font-bold">{selectedUser.stats.device_count}</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500">渲染次数</div>
                  <div className="text-lg font-bold">{selectedUser.stats.render_count}</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500">API调用</div>
                  <div className="text-lg font-bold">{selectedUser.stats.api_calls}</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500">剩余额度</div>
                  <div className="text-lg font-bold">{selectedUser.stats.quota_remaining}</div>
                </div>
              </div>
              <div className="text-sm text-gray-500">
                最近活跃: {selectedUser.stats.last_active}
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setSelectedUser(null)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg">
                关闭
              </button>
              {selectedUser.user.status !== 'banned' && (
                <button 
                  onClick={() => banUser(selectedUser.user.id)}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg"
                >
                  封禁用户
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}