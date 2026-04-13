# Fries 管理后台前端配置文档

## 问题历史

### 2026-04-02：样式不生效问题

**问题现象**：管理后台页面样式简陋，Tailwind CSS 类名不生效。

**根本原因**：项目缺少 Tailwind CSS 配置：
1. `package.json` 没有 `tailwindcss` 依赖
2. 没有 `tailwind.config.js` 配置文件
3. 没有 `postcss.config.js` 配置文件
4. `globals.css` 的 `@tailwind base;` 等指令无法被处理

**修复步骤**：
1. 安装依赖：
   ```bash
   cd /root/.openclaw/workspace/Fries/admin-web
   npm install -D tailwindcss @tailwindcss/postcss autoprefixer
   ```

2. 创建 `tailwind.config.js`：
   ```javascript
   /** @type {import('tailwindcss').Config} */
   module.exports = {
     content: [
       './app/**/*.{js,ts,jsx,tsx,mdx}',
       './components/**/*.{js,ts,jsx,tsx,mdx}',
     ],
     theme: {
       extend: {},
     },
     plugins: [],
   }
   ```

3. 创建 `postcss.config.js`：
   ```javascript
   module.exports = {
     plugins: {
       '@tailwindcss/postcss': {},
     },
   }
   ```

4. 重新构建：
   ```bash
   npm run build
   pm2 restart Fries-admin
   ```

**注意**：Tailwind CSS v4 需要使用 `@tailwindcss/postcss` 包，不能直接用 `tailwindcss` 作为 PostCSS 插件。

---

## 项目结构

```
admin-web/
├── app/
│   ├── globals.css          # 全局样式 + Tailwind 引入
│   ├── layout.tsx           # 根布局（侧边栏 + 认证检查）
│   ├── admin-login/
│   │   └── page.tsx         # 登录页
│   ├── dashboard/
│   │   └── page.tsx         # 仪表盘
│   ├── devices/
│   │   └── page.tsx         # 设备管理
│   ├── users/
│   │   └── page.tsx         # 用户管理
│   ├── security/
│   │   └── page.tsx         # 安全风控
│   ├── logs/
│   │   └── page.tsx         # 日志中心
│   ├── firmware/
│   │   └── page.tsx         # 固件管理
│   ├── config/
│   │   └── page.tsx         # 系统配置
│   ├── groups/
│   │   └── page.tsx         # 用户分组
│   └── openwrt/
│       └── page.tsx         # OpenWrt 监控
├── tailwind.config.js       # Tailwind 配置
├── postcss.config.js        # PostCSS 配置
├── package.json
└── next.config.ts
```

---

## 常用命令

```bash
# 开发模式
cd /root/.openclaw/workspace/Fries/admin-web
npm run dev

# 构建生产版本
npm run build

# 重启服务
pm2 restart Fries-admin

# 查看服务状态
pm2 list
```

---

## 域名映射

- 管理后台：`https://aaa.993636.xyz` → 3001 端口
- 用户网站：`https://ink.993636.xyz` → 3000 端口
- 后端 API：同上两个域名 `/api/*` 路径

---

## 认证流程

1. 用户访问 `https://aaa.993636.xyz/`
2. `layout.tsx` 调用 `/api/admin/auth/me` 检查登录状态
3. 未登录返回 401 → 自动跳转到 `/admin-login`
4. 登录页调用 `/api/admin/auth/login` 完成认证
5. 认证成功后设置 cookie → 显示完整后台界面

---

## 注意事项

1. **Cloudflare 缓存**：前端更新后可能被缓存，需要强制刷新（Ctrl+F5）或清除缓存
2. **Tailwind 版本**：v4 需要用 `@tailwindcss/postcss`，不能用 `tailwindcss` 直接作为 PostCSS 插件
3. **认证 API 路径**：`/api/admin/auth/me` 和 `/api/admin/auth/login`