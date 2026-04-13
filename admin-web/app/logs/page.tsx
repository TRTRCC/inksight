"use client"

import { useEffect, useState } from 'react'
import { FileText, AlertCircle, CheckCircle, Clock, Filter } from 'lucide-react'

type LogLine = {
  line: string
  level: string
  time: string
}

type ErrorLog = {
  mac: string
  error_type: string
  error_msg: string
  count: number
  last_time: string
}

type RenderLog = {
  mac: string
  mode: string
  success: boolean
  time: string
  error: string
}

export default function LogsPage() {
  const [backendLogs, setBackendLogs] = useState<LogLine[]>([])
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([])
  const [renderLogs, setRenderLogs] = useState<RenderLog[]>([])
  const [logLevel, setLogLevel] = useState('all')
  const [activeTab, setActiveTab] = useState('backend')
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(false)

  useEffect(() => {
    loadLogs()
  }, [logLevel])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(loadLogs, 5000)
    return () => clearInterval(interval)
  }, [autoRefresh, logLevel])

  async function loadLogs() {
    setLoading(true)
    try {
      const [backendRes, errorsRes, rendersRes] = await Promise.all([
        fetch(`/api/admin/logs/backend?lines=200&level=${logLevel}`, { credentials: 'include' }),
        fetch('/api/admin/logs/errors?hours=24', { credentials: 'include' }),
        fetch('/api/admin/logs/render-history?hours=24', { credentials: 'include' }),
      ])

      const backendData = await backendRes.json()
      setBackendLogs(backendData.items || [])

      const errorsData = await errorsRes.json()
      setErrorLogs(errorsData.items || [])

      const rendersData = await rendersRes.json()
      setRenderLogs(rendersData.items || [])
    } catch {}
    finally {
      setLoading(false)
    }
  }

  const tabs = [
    { id: 'backend', label: '系统日志', icon: FileText },
    { id: 'errors', label: '错误汇总', icon: AlertCircle },
    { id: 'renders', label: '渲染记录', icon: CheckCircle },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">日志管理</h1>
          <p className="text-gray-500 mt-1">实时监控与错误追踪</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={e => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            自动刷新
          </label>
          <button
            onClick={loadLogs}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm"
          >
            <Clock size={16} />
            刷新
          </button>
        </div>
      </div>

      {/* Tab 导航 */}
      <div className="flex gap-2 border-b border-gray-200">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-1 transition ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* 系统日志 */}
      {activeTab === 'backend' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          {/* 日志级别筛选 */}
          <div className="p-4 border-b border-gray-100 flex items-center gap-4">
            <Filter size={16} className="text-gray-400" />
            <span className="text-sm text-gray-500">日志级别:</span>
            <div className="flex gap-2">
              {['all', 'ERROR', 'WARN', 'INFO'].map(level => (
                <button
                  key={level}
                  onClick={() => setLogLevel(level)}
                  className={`px-3 py-1 rounded text-xs ${
                    logLevel === level
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {level === 'all' ? '全部' : level}
                </button>
              ))}
            </div>
          </div>

          {/* 日志内容 */}
          <div className="p-4 max-h-[500px] overflow-y-auto font-mono text-xs">
            {loading ? (
              <div className="text-gray-400">加载中...</div>
            ) : backendLogs.length === 0 ? (
              <div className="text-gray-400">无日志记录</div>
            ) : (
              backendLogs.map((log, i) => (
                <div
                  key={i}
                  className={`py-1 ${
                    log.level === 'ERROR' ? 'text-red-600 bg-red-50' :
                    log.level === 'WARN' ? 'text-orange-600 bg-orange-50' :
                    'text-gray-700'
                  }`}
                >
                  <span className="text-gray-400 mr-2">{log.time}</span>
                  <span className={`font-medium ${
                    log.level === 'ERROR' ? 'text-red-700' :
                    log.level === 'WARN' ? 'text-orange-700' :
                    'text-gray-500'
                  }`}>[{log.level}]</span>
                  <span className="ml-2">{log.line.split(' ').slice(2).join(' ')}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 错误汇总 */}
      {activeTab === 'errors' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-red-50 text-xs text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">设备 MAC</th>
                <th className="px-4 py-3 text-left">错误类型</th>
                <th className="px-4 py-3 text-left">错误信息</th>
                <th className="px-4 py-3 text-left">次数</th>
                <th className="px-4 py-3 text-left">最后发生</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {errorLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    最近24小时无错误记录 🎉
                  </td>
                </tr>
              ) : (
                errorLogs.map((e, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-sm">{e.mac}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">
                        {e.error_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{e.error_msg}</td>
                    <td className="px-4 py-3 font-medium">{e.count}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{e.last_time}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 渲染记录 */}
      {activeTab === 'renders' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">设备 MAC</th>
                <th className="px-4 py-3 text-left">模式</th>
                <th className="px-4 py-3 text-left">状态</th>
                <th className="px-4 py-3 text-left">时间</th>
                <th className="px-4 py-3 text-left">错误</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {renderLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    最近24小时无渲染记录
                  </td>
                </tr>
              ) : (
                renderLogs.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-sm">{r.mac}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                        {r.mode}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {r.success ? (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle size={14} />
                          成功
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-600">
                          <AlertCircle size={14} />
                          失败
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{r.time}</td>
                    <td className="px-4 py-3 text-sm text-red-500">{r.error || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}