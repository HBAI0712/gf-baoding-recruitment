# 招聘表单后端部署说明

这个后端用于接收 `apply.html` 提交的候选人信息和简历附件，并发送到招聘负责人邮箱：

`380704292@qq.com`

## 1. 为什么需要后端

网页本身不能直接把简历附件发到邮箱。  
上传文件和发送邮件必须通过服务器完成。

## 2. 准备工作

需要一台可以运行 Node.js 的服务器，或公司现有服务器。

需要准备一个“发件邮箱”，例如 QQ 邮箱。  
QQ 邮箱必须开启 SMTP，并生成 SMTP 授权码。注意：这里用的是授权码，不是邮箱登录密码。

正式对公网开放时，建议使用公司认可的服务器、域名和 HTTPS 证书，并由公司技术或信息安全人员确认部署方式。

## 3. 安装步骤

进入 `server` 文件夹后执行：

```bash
npm install
```

复制环境变量示例文件：

```bash
cp .env.example .env
```

打开 `.env`，填写：

```text
PORT=3000
ALLOWED_ORIGIN=https://你的正式网站域名
SMTP_USER=发件邮箱@qq.com
SMTP_PASS=SMTP授权码
MAIL_TO=380704292@qq.com
```

如果正式网站有固定域名，建议把：

```text
ALLOWED_ORIGIN=*
```

改成你的正式网址，例如：

```text
ALLOWED_ORIGIN=https://你的招聘网页域名
```

## 4. 启动服务

```bash
npm start
```

启动后访问：

```text
http://服务器地址:3000
```

如果页面和后端部署在同一个域名下，`site-data.js` 中的：

```text
applyEndpoint: "/api/applications"
```

不需要修改。

如果后端是单独域名，例如：

```text
https://api.example.com/api/applications
```

则需要把 `site-data.js` 中的 `applyEndpoint` 改成完整地址。

## 4.1 Docker 启动方式

如果服务器使用 Docker，请回到 `recruitment-site` 根目录，确认 `server/.env` 已填写完整后执行：

```bash
docker compose up -d --build
```

停止服务：

```bash
docker compose down
```

## 5. 健康检查

部署后访问：

```text
https://你的域名/api/health
```

如果返回：

```json
{ "ok": true, "service": "gf-baoding-recruitment" }
```

说明后端正在运行。

## 6. 邮件内容会如何分类

系统会把候选人信息整理成三部分发送：

- 基本信息：称谓/姓名、联系电话、应聘方向、当前状态、提交时间
- 补充说明：候选人填写的备注
- 简历附件：PDF、DOC、DOCX 文件

邮件标题格式：

```text
【招聘申请】候选人姓名 - 应聘方向 - 手机号
```

## 7. 安全提醒

- 不要把 `.env` 文件发给无关人员。
- 不要把 SMTP 授权码写到网页里。
- 正式域名上线后，建议把 `ALLOWED_ORIGIN=*` 改成正式网站域名。
- 后端已默认屏蔽 `/server` 目录访问，并加入基础频率限制、来源校验、安全响应头、简历格式和文件头校验。
- 正式上线仍建议放在公司反向代理、WAF 或云服务安全策略后面。
- 正式上线前建议由公司技术、合规和信息安全人员确认部署方式。
