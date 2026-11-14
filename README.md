<div align="center">

# ✉️ Cloud Mail

### 基于 Cloudflare 原生无服务器架构的云原生域名邮箱管理系统

轻量 • 安全 • 0 服务器运维成本 • 100% 依托 Cloudflare 免费生态

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Cloudflare D1](https://img.shields.io/badge/Database-Cloudflare_D1-blue?logo=sqlite&logoColor=white)](https://developers.cloudflare.com/d1/)
[![React](https://img.shields.io/badge/Frontend-React_18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Style-Tailwind_CSS-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

[在线体验与架构](#-系统运作架构) • [核心特性](#-核心功能特性) • [一键部署](#-部署方式-a命令行快速部署推荐) • [网页手动部署](#-部署方式-bcloudflare-网页控制台手动部署) • [常见问题](#-常见问题-faq)

</div>

---

## 📖 项目简介

**Cloud Mail** 是一套专为 Cloudflare 边缘计算平台打造的现代化全栈域名邮箱系统。

系统通过 **Cloudflare Email Routing** 捕获入站邮件，交由 **Cloudflare Worker** 执行流式 MIME 解析，将邮件内容及附件安全持久化至 **Cloudflare D1** 分布式数据库（并兼容 **R2** 对象存储），最后通过内置的现代 **React + Tailwind** Webmail 客户端与管理员控制台提供流畅直观的使用体验。

无需购买或维护云服务器，零端口封锁风险，完全基于 Serverless 架构即可拥有一套支持多域名、多别名、收发邮件与配额控制的企业级域名邮箱！

---

## 🚀 系统运作架构

```
┌──────────────┐       ┌──────────────┐       ┌──────────────────────┐
│ 1. 外部发件人 │ ───>  │ 2. DNS / MX  │ ───>  │ 3. CF Email Routing  │
│  发送邮件至   │       │ Cloudflare   │       │  边缘接收与通配路由  │
│  @00571.top  │       │ 自动解析托管 │       │  (Catch-all / 别名)  │
└──────────────┘       └──────────────┘       └──────────┬───────────┘
                                                         │ 触发事件
                                                         ▼
┌──────────────────┐       ┌─────────────────┐       ┌──────────────────┐
│ 6. 现代 Webmail   │ <─── │ 5. D1 / R2 存储  │ <─── │ 4. Worker 引擎   │
│ React+TailwindUI │       │ 结构化邮件数据  │       │ postal-mime 解析 │
│ 管理员控制后台   │       │ 附件 BLOB / R2  │       │ 别名匹配与容量统计│
└──────────────────┘       └─────────────────┘       └──────────────────┘
```

---

## ✨ 核心功能特性

### 1. 📬 现代 Webmail 邮件客户端
* **四维文件夹导航**：收件箱（实时未读数量徽标）、已发送箱、星标邮件收藏、垃圾箱；
* **安全沙箱阅读**：使用 `iframe sandbox` 隔离渲染 HTML 富文本邮件，彻底规避样式污染与 XSS 攻击，同时自动兼容纯文本优雅排版；
* **附件解析与下载**：自动提取邮件附件元信息（文件名、类型、体积），支持一键快速下载；
* **在线写信与一键回复**：
  * 支持多别名下拉切换发信身份（防伪造校验）；
  * 支持多个收件人、抄送（CC）、密送（BCC）；
  * 纯文本 / HTML 源码模式无缝切换；
  * 一键带引用原文与 `Re:` 前缀快速回复。

### 2. 👥 用户注册与多别名体系
* **自主注册 / 邀请码机制**：新用户可自主注册或通过邀请码注册；系统首位注册用户自动成为系统最高管理员；
* **多域名托管**：支持绑定多个自定义域名；
* **多邮箱别名管理**：单一用户账户可自由绑定并创建多个邮箱别名（如 `admin@`、`contact@`、`billing@`），收发邮件可在不同别名间随意切换；
* **空间配额限制**：为每个用户设定独立空间配额（默认 500MB），实时统计容量占用。

### 3. 🛡️ 强大的管理员控制后台 (Admin Dashboard)
* **实时数据看板**：注册用户总数、托管域名数、活跃邮箱数、总流转邮件、今日收发计数、系统存储占用；
* **域名管理 & DNS 解析向导**：
  * 添加、停用、删除托管域名，指定默认注册域名；
  * 内置 DNS 指南弹窗，一键复制 MX 收信解析、SPF 防伪认证、DKIM 签名密钥与 DMARC 策略；
* **用户与配额控制**：
  * 用户检索与分页列表；
  * 随时封禁/解禁用户；
  * 一键提升为管理员或降为普通用户；
  * 在线调整用户邮箱空间容量上限（MB）；
  * 管理员为用户一键重置密码；
* **发信通道与在线诊断**：
  * 原生支持主流 **Resend API**（每月免费 3000 封，专为 Cloudflare 优化，零端口封锁）及自定义 SMTP 网关；
  * **在线连通性测试发信**：在后台输入任意外部邮箱，一键点击实时验证出站发信是否正常；
* **发信审计日志**：完整追溯每笔外发邮件的时间、发信人、收件人、通道与投递成功/失败详情。

### 4. 💾 双存储引擎架构 (D1 + R2)
* **引擎 A：D1 BLOB（默认开箱即用）**：
  无需绑定信用卡开通 R2，日常邮件及常规小型附件（发票、合同、PDF、小图片等）直接以二进制存入 Cloudflare D1 数据库，零门槛零额外费用！
* **引擎 B：Cloudflare R2（企业级扩展）**：
  后续若需存储大附件，只需在控制台绑定 R2 存储桶（变量名填 `STORAGE`），系统代码自动无缝切换为 R2 对象存储！

---

## 🛠️ 目录结构

```
cfmail/
├── src/                         # Cloudflare Worker 后端核心
│   ├── index.ts                 # Worker 入口 (HTTP fetch 与 Email Routing 处理)
│   ├── email.ts                 # Cloudflare Email Routing 邮件接收解析逻辑
│   ├── types.ts                 # TypeScript 类型定义
│   ├── middleware/              # 鉴权中间件 (JWT 校验、管理员权限拦截)
│   ├── routes/                  # RESTful API 路由模块
│   │   ├── auth.ts              # 登录、注册、修改密码、当前用户
│   │   ├── mailboxes.ts         # 个人邮箱别名管理
│   │   ├── emails.ts            # 邮件列表、阅读、标记已读、星标、删除
│   │   ├── send.ts              # 在线写信与邮件投递
│   │   └── admin.ts             # 管理员看板、域名、用户、配置、测试发信
│   ├── services/                # 业务服务层
│   │   ├── emailSender.ts       # 出站发信服务 (Resend API / SMTP 网关)
│   │   └── storage.ts           # 附件存储服务 (兼容 R2 与 D1 BLOB)
│   └── utils/                   # 纯 Web Crypto 算法与数据库工具
├── frontend/                    # 现代单页前端应用 (React + Vite + Tailwind CSS)
│   ├── src/
│   │   ├── pages/               # 页面 (Auth.tsx, MailboxView.tsx, AdminView.tsx)
│   │   ├── components/          # 组件 (Navbar, ComposeModal, DnsGuideModal)
│   │   └── lib/api.ts           # 统一请求客户端与工具函数
│   └── dist/                    # 前端构建产物 (由 Worker Assets 原生托管)
├── schema.sql                   # Cloudflare D1 数据库初始化表结构
├── wrangler.jsonc               # Cloudflare Workers 配置文件
├── worker.bundle.js             # 预编译单文件 Worker (供纯网页控制台复制粘贴部署)
├── manual_deploy_guide.html     # 网页控制台手动部署高颜值教程 HTML
└── package.json                 # 依赖管理与快捷命令脚本
```

---

## 📦 部署方式 A：命令行快速部署（推荐）

### 1. 克隆项目并安装依赖
```bash
git clone https://github.com/xzal520/cfmail.git
cd cfmail

# 安装依赖
npm install
cd frontend && npm install && npm run build && cd ..
```

### 2. 登录 Cloudflare
```bash
npx wrangler login
```

### 3. 创建线上 D1 数据库
```bash
npx wrangler d1 create cfmail_db
```
复制终端输出的 `database_id`，替换到 `wrangler.jsonc` 的第 15 行中。

### 4. 初始化数据表结构
```bash
npm run db:init:remote
```

### 5. 一键发布到 Cloudflare
```bash
npm run deploy
```
部署成功后，终端会打印出您的公网访问地址，形如 `https://cfmail.<subdomain>.workers.dev`！

---

## 🖥️ 部署方式 B：Cloudflare 网页控制台手动部署

如果您不想在本地安装 Node.js 环境，我们特意为您制作了一套纯网页点选的部署教程：

👉 **双击打开项目自带的 [manual_deploy_guide.html](manual_deploy_guide.html) 即可查阅精美图文教程！**

1. **创建 D1 数据库**：在 Cloudflare 控制台进入「D1」，创建名为 `cfmail_db` 的数据库，在「控制台 (Console)」执行 [schema.sql](schema.sql) 的建表代码；
2. **创建 Worker**：在「Workers & Pages」创建名为 `cfmail` 的服务，在设置里添加 D1 绑定（变量名填大写的 **`DB`**）；
3. **粘贴代码**：点击「编辑代码」，全选复制项目根目录下的 [worker.bundle.js](worker.bundle.js) 粘贴并部署；
4. **配置收信**：在您的域名 Email Routing 中开启 Catch-all，选择「发送到 Worker: cfmail」即可！

---

## 📧 配置 Cloudflare Email Routing 收信

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/) ➔ 进入您的托管域名；
2. 点击左侧菜单 **「电子邮件 (Email Routing)」** ➔ 点击开启，按提示一键添加 MX 和 SPF 解析记录；
3. 切换到 **「路由规则 (Routing Rules)」** 标签页：
   * 找到 **「全部捕获 (Catch-all)」** 规则；
   * 操作选择：**发送到 Worker (Send to Worker)**；
   * 目标 Worker 选择：**`cfmail`**；
   * 保存并启用！
4. **至此，所有发送到 `@yourdomain.com` 的邮件均会被自动收入您的邮箱系统！**

> 💡 **特别提醒（避坑秘籍）**：  
> Cloudflare 官方规定：新域名的邮件路由在初始化阶段，如果页面上未显示 Catch-all 卡片，请先点击“创建规则”随便添加一条自定义规则（如前缀填 `admin`）并保存，保存后 Catch-all（全部捕获）卡片就会立即从页面上显现出来！

---

## 📤 配置出站发信渠道 (Resend API)

Cloudflare Workers 出站发信推荐接入官方推荐的 **Resend**（每月免费 3000 封发信额度，专为 Cloudflare 优化）：

1. 前往 [Resend 官网](https://resend.com) 免费注册账号，并在控制台创建一枚 API Key；
2. 打开并登录本系统的 **管理后台 ➔ 发信通道 & 设置**；
3. 在 Resend API Key 输入框中填入您的密钥并点击保存；
4. 在下方的「在线测试发信」输入您的常用邮箱（如 QQ 或 163 邮箱），点击「立即测试发信」即可验证连通性！

---

## ❓ 常见问题 (FAQ)

<details>
<summary><b>Q1: 谁是系统的管理员？初始密码是什么？</b></summary>
系统部署上线后，<b>首个注册的用户会被系统自动赋予最高管理员权限（admin 角色）</b>。因此部署完毕后请尽快打开网站注册您的主账号！
</details>

<details>
<summary><b>Q2: D1 数据库能存多大的附件？</b></summary>
针对常规日常办公邮件（发票、合同、PDF、Word、几兆内的图片），D1 BLOB 能够很好支持。单个附件建议在 2MB 以内。如果您平时经常传输几十兆到几百兆的超大附件，只需在 Cloudflare 控制台创建一个 R2 存储桶并在 Worker 设置中添加变量名为 <code>STORAGE</code> 的绑定，系统会自动无缝升级为 R2 存储模式！
</details>

<details>
<summary><b>Q3: 一个用户可以拥有多个邮箱前缀吗？</b></summary>
可以！登录 Webmail 后，点击左侧栏的「我的邮箱别名 ➔ 新建」，即可在已启用的域名下绑定任意合法前缀（如 <code>contact@</code>、<code>support@</code>），在线写信与收信时可在各个别名间自由切换。
</details>

---

## 📄 开源许可证

本项目基于 [MIT 许可证](LICENSE) 开源。欢迎 Star、Fork 与提 Issue！
