'use client'

import { useState, useEffect } from 'react'
import { HardDrive, Upload, Trash2, FolderPlus, Download, FileIcon, RefreshCw, Folder, AlertTriangle, CheckCircle } from 'lucide-react'

interface FirmwareFile {
  name: string
  size: number
  size_kb: number
  modified: string
  type: string
  download_url: string
}

interface Version {
  name: string
  file_count: number
  total_size_kb: number
  files: FirmwareFile[]
}

interface FirmwareListResponse {
  base_dir: string
  version_count: number
  file_count: number
  versions: Version[]
}

export default function FirmwareManagement() {
  const [data, setData] = useState<FirmwareListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [uploadVersion, setUploadVersion] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [newVersionName, setNewVersionName] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/firmware/list', {
        headers: { 'Authorization': 'Bearer admin-token' }
      })
      const json = await res.json()
      setData(json)
    } catch (e) {
      setMessage({ type: 'error', text: '加载失败' })
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleUpload = async () => {
    if (!uploadVersion || !uploadFile) {
      setMessage({ type: 'error', text: '请选择版本和文件' })
      return
    }

    setUploading(true)
    const formData = new FormData()
    formData.append('version', uploadVersion)
    formData.append('file', uploadFile)

    try {
      const res = await fetch('/api/admin/firmware/upload', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer admin-token' },
        body: formData
      })
      const json = await res.json()
      if (json.success) {
        setMessage({ type: 'success', text: `上传成功: ${json.filename}` })
        setShowUploadModal(false)
        setUploadVersion('')
        setUploadFile(null)
        fetchData()
      } else {
        setMessage({ type: 'error', text: json.message || '上传失败' })
      }
    } catch (e) {
      setMessage({ type: 'error', text: '上传失败' })
    }
    setUploading(false)
  }

  const handleCreateVersion = async () => {
    if (!newVersionName) {
      setMessage({ type: 'error', text: '请输入版本名称' })
      return
    }

    const formData = new FormData()
    formData.append('version', newVersionName)

    try {
      const res = await fetch('/api/admin/firmware/create-version', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer admin-token' },
        body: formData
      })
      const json = await res.json()
      if (json.success) {
        setMessage({ type: 'success', text: `版本目录创建成功: ${newVersionName}` })
        setShowCreateModal(false)
        setNewVersionName('')
        fetchData()
      } else {
        setMessage({ type: 'error', text: json.message || '创建失败' })
      }
    } catch (e) {
      setMessage({ type: 'error', text: '创建失败' })
    }
  }

  const handleDeleteFile = async (version: string, filename: string) => {
    if (!confirm(`确定删除文件 ${filename}？`)) return

    try {
      const res = await fetch(`/api/admin/firmware/delete?version=${version}&filename=${filename}`, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer admin-token' }
      })
      const json = await res.json()
      if (json.success) {
        setMessage({ type: 'success', text: '删除成功' })
        fetchData()
      } else {
        setMessage({ type: 'error', text: json.message || '删除失败' })
      }
    } catch (e) {
      setMessage({ type: 'error', text: '删除失败' })
    }
  }

  const handleDeleteVersion = async (version: string) => {
    if (!confirm(`确定删除整个版本 ${version} 及其所有文件？`)) return

    try {
      const res = await fetch(`/api/admin/firmware/delete-version?version=${version}`, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer admin-token' }
      })
      const json = await res.json()
      if (json.success) {
        setMessage({ type: 'success', text: `版本 ${version} 已删除` })
        fetchData()
      } else {
        setMessage({ type: 'error', text: json.message || '删除失败' })
      }
    } catch (e) {
      setMessage({ type: 'error', text: '删除失败' })
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case '.bin': return 'bg-blue-100 text-blue-700'
      case '.ipk': return 'bg-green-100 text-green-700'
      case '.img': return 'bg-orange-100 text-orange-700'
      case '.tar.gz': return 'bg-purple-100 text-purple-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const getTypeName = (type: string) => {
    switch (type) {
      case '.bin': return '固件'
      case '.ipk': return 'IPK包'
      case '.img': return '镜像'
      case '.tar.gz': return '压缩包'
      default: return type
    }
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <HardDrive size={24} className="text-gray-700" />
          <h1 className="text-xl font-semibold text-gray-900">固件管理</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchData}
            className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-1"
          >
            <RefreshCw size={14} />
            刷新
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-1"
          >
            <FolderPlus size={14} />
            新建版本
          </button>
          <button
            onClick={() => setShowUploadModal(true)}
            className="px-3 py-1.5 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg flex items-center gap-1"
          >
            <Upload size={14} />
            上传固件
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {message.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
          {message.text}
        </div>
      )}

      {/* Stats */}
      {data && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 border border-gray-100">
            <div className="text-sm text-gray-500 mb-1">版本数量</div>
            <div className="text-2xl font-semibold text-gray-900">{data.version_count}</div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-100">
            <div className="text-sm text-gray-500 mb-1">文件总数</div>
            <div className="text-2xl font-semibold text-gray-900">{data.file_count}</div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-100">
            <div className="text-sm text-gray-500 mb-1">总大小</div>
            <div className="text-2xl font-semibold text-gray-900">
              {Math.round(data.versions.reduce((sum, v) => sum + v.total_size_kb, 0) / 1024)} MB
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">加载中...</div>
      ) : !data?.versions.length ? (
        <div className="bg-white rounded-lg p-12 text-center border border-gray-100">
          <Folder size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">暂无固件文件</p>
          <p className="text-sm text-gray-400 mt-2">点击"新建版本"创建版本目录，然后上传固件</p>
        </div>
      ) : (
        <div className="space-y-4">
          {data.versions.map((version) => (
            <div key={version.name} className="bg-white rounded-lg border border-gray-100">
              {/* Version Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-50">
                <div className="flex items-center gap-3">
                  <Folder size={20} className="text-gray-400" />
                  <span className="font-medium text-gray-900">{version.name}</span>
                  <span className="text-sm text-gray-500">{version.file_count} 个文件</span>
                  <span className="text-sm text-gray-400">{version.total_size_kb} KB</span>
                </div>
                <button
                  onClick={() => handleDeleteVersion(version.name)}
                  className="text-red-500 hover:text-red-600 p-1"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {/* Files */}
              <div className="p-4">
                <table className="w-full">
                  <thead>
                    <tr className="text-sm text-gray-500">
                      <th className="text-left pb-2">文件名</th>
                      <th className="text-left pb-2">类型</th>
                      <th className="text-right pb-2">大小</th>
                      <th className="text-left pb-2">修改时间</th>
                      <th className="text-right pb-2">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {version.files.map((file) => (
                      <tr key={file.name} className="border-t border-gray-50">
                        <td className="py-2 flex items-center gap-2">
                          <FileIcon size={16} className="text-gray-400" />
                          <span className="text-gray-900">{file.name}</span>
                        </td>
                        <td className="py-2">
                          <span className={`px-2 py-0.5 rounded text-xs ${getTypeColor(file.type)}`}>
                            {getTypeName(file.type)}
                          </span>
                        </td>
                        <td className="py-2 text-right text-sm text-gray-500">{file.size_kb} KB</td>
                        <td className="py-2 text-sm text-gray-400">
                          {new Date(file.modified).toLocaleString('zh-CN')}
                        </td>
                        <td className="py-2 text-right">
                          <div className="flex justify-end gap-2">
                            <a
                              href={file.download_url}
                              download
                              className="text-blue-500 hover:text-blue-600 p-1"
                            >
                              <Download size={16} />
                            </a>
                            <button
                              onClick={() => handleDeleteFile(version.name, file.name)}
                              className="text-red-500 hover:text-red-600 p-1"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-md max-w-md">
            <h2 className="text-lg font-semibold mb-4">上传固件</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">版本目录</label>
                <select
                  value={uploadVersion}
                  onChange={(e) => setUploadVersion(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="">选择版本...</option>
                  {data?.versions.map((v) => (
                    <option key={v.name} value={v.name}>{v.name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">或先点击"新建版本"创建新目录</p>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">固件文件</label>
                <input
                  type="file"
                  accept=".bin,.ipk,.img,.tar.gz"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full border rounded-lg px-3 py-2"
                />
                <p className="text-xs text-gray-400 mt-1">支持: .bin, .ipk, .img, .tar.gz</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowUploadModal(false)}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                取消
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg disabled:opacity-50"
              >
                {uploading ? '上传中...' : '上传'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Version Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-md max-w-md">
            <h2 className="text-lg font-semibold mb-4">新建版本目录</h2>
            
            <div>
              <label className="block text-sm text-gray-600 mb-1">版本名称</label>
              <input
                type="text"
                value={newVersionName}
                onChange={(e) => setNewVersionName(e.target.value)}
                placeholder="例如: 1.0.3"
                className="w-full border rounded-lg px-3 py-2"
              />
              <p className="text-xs text-gray-400 mt-1">建议格式: X.X.X</p>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                取消
              </button>
              <button
                onClick={handleCreateVersion}
                className="px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}