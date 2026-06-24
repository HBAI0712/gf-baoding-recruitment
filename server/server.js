import "dotenv/config";
import cors from "cors";
import express from "express";
import multer from "multer";
import nodemailer from "nodemailer";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const siteRoot = path.resolve(__dirname, "..");

const app = express();
const port = Number(process.env.PORT || 3000);
const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";
const resumeMaxSizeMB = Number(process.env.RESUME_MAX_SIZE_MB || 12);
const rateWindowMs = Number(process.env.RATE_WINDOW_MS || 15 * 60 * 1000);
const rateMax = Number(process.env.RATE_MAX || 20);
const rateStore = new Map();
const allowedOrigins =
  allowedOrigin === "*"
    ? ["*"]
    : allowedOrigin
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);

app.disable("x-powered-by");
if (String(process.env.TRUST_PROXY || "false") === "true") {
  app.set("trust proxy", 1);
}

app.use((req, res, next) => {
  const connectSrc = allowedOrigins.includes("*") ? "'self'" : ["'self'", ...allowedOrigins].join(" ");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "img-src 'self' data: https://cdn.gf.com.cn https://cdn.gfzq.cn",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline'",
      `connect-src ${connectSrc}`,
      "form-action 'self'"
    ].join("; ")
  );
  next();
});

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("不允许的访问来源。"));
    }
  })
);

app.use("/server", (_req, res) => {
  res.status(404).send("Not found");
});

app.use(
  express.static(siteRoot, {
    dotfiles: "ignore",
    index: "index.html"
  })
);

const allowedExtensions = [".pdf", ".doc", ".docx"];
const allowedMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/octet-stream"
]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: resumeMaxSizeMB * 1024 * 1024,
    files: 1,
    fields: 12,
    parts: 14
  },
  fileFilter: (_req, file, callback) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      callback(new Error("简历仅支持 PDF、DOC、DOCX 格式。"));
      return;
    }
    if (file.mimetype && !allowedMimeTypes.has(file.mimetype)) {
      callback(new Error("简历文件类型不正确，请上传 PDF、DOC 或 DOCX。"));
      return;
    }
    callback(null, true);
  }
});

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateStore.entries()) {
    if (record.resetAt <= now) rateStore.delete(ip);
  }
}, Math.max(rateWindowMs, 60 * 1000));
cleanupTimer.unref?.();

function sameOriginGuard(req, res, next) {
  if (allowedOrigins.includes("*")) {
    next();
    return;
  }

  const origin = req.get("origin");
  const referer = req.get("referer");
  let source = origin || "";
  if (!source && referer) {
    try {
      source = new URL(referer).origin;
    } catch {
      source = "";
    }
  }

  if (!source || allowedOrigins.includes(source)) {
    next();
    return;
  }

  res.status(403).json({ message: "提交来源不正确，请从招聘页面重新进入。" });
}

function rateLimit(req, res, next) {
  const now = Date.now();
  const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
  const record = rateStore.get(ip) || { count: 0, resetAt: now + rateWindowMs };

  if (record.resetAt <= now) {
    record.count = 0;
    record.resetAt = now + rateWindowMs;
  }

  record.count += 1;
  rateStore.set(ip, record);

  if (record.count > rateMax) {
    res.status(429).json({ message: "提交过于频繁，请稍后再试。" });
    return;
  }

  next();
}

function sanitizeFileName(name) {
  const ext = path.extname(name || "").toLowerCase();
  const base = path
    .basename(name || "resume", ext)
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9._-]/g, "_")
    .slice(0, 80);
  return `${base || "resume"}${allowedExtensions.includes(ext) ? ext : ".pdf"}`;
}

function fileLooksValid(file) {
  const ext = path.extname(file.originalname || "").toLowerCase();
  const buffer = file.buffer || Buffer.alloc(0);
  if (ext === ".pdf") return buffer.subarray(0, 4).toString() === "%PDF";
  if (ext === ".docx") return buffer[0] === 0x50 && buffer[1] === 0x4b;
  if (ext === ".doc") {
    return (
      buffer[0] === 0xd0 &&
      buffer[1] === 0xcf &&
      buffer[2] === 0x11 &&
      buffer[3] === 0xe0
    );
  }
  return false;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function mailHtml(fields) {
  const rows = [
    ["称谓 / 姓名", fields.applicantName],
    ["联系电话", fields.phone],
    ["应聘方向", fields.position],
    ["当前状态", fields.candidateStatus],
    ["提交时间", fields.submittedAt],
    ["来源页面", fields.branchName]
  ];

  const rowHtml = rows
    .map(
      ([label, value]) =>
        `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value || "未填写")}</td></tr>`
    )
    .join("");

  return `
    <div style="font-family:Arial,'Microsoft YaHei',sans-serif;color:#172033;line-height:1.7;">
      <h2 style="color:#0b2545;margin:0 0 12px;">广发证券保定营业部招聘申请</h2>
      <p style="margin:0 0 18px;color:#667085;">以下信息由招聘网页自动分类整理，简历文件见邮件附件。</p>

      <h3 style="color:#df1f2d;margin:24px 0 8px;">一、基本信息</h3>
      <table cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:720px;">
        ${rowHtml}
      </table>

      <h3 style="color:#df1f2d;margin:24px 0 8px;">二、补充说明</h3>
      <div style="padding:12px 14px;background:#f7f9fc;border:1px solid #d9e4f2;border-radius:6px;white-space:pre-wrap;">${escapeHtml(
        fields.message || "未填写"
      )}</div>

      <h3 style="color:#df1f2d;margin:24px 0 8px;">三、简历附件</h3>
      <p style="margin:0;">候选人上传的简历已作为附件随本邮件发送。</p>
    </div>
    <style>
      th { width: 120px; text-align: left; color: #0b2545; background: #f1f6fc; border: 1px solid #d9e4f2; }
      td { border: 1px solid #d9e4f2; }
    </style>
  `;
}

function createTransporter() {
  const required = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`邮件服务未配置完整，缺少：${missing.join(", ")}`);
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || "true") === "true",
    requireTLS: String(process.env.SMTP_REQUIRE_TLS || "false") === "true",
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS || 15000),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT_MS || 15000),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT_MS || 20000),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "gf-baoding-recruitment" });
});

app.post("/api/applications", sameOriginGuard, rateLimit, upload.single("resume"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ message: "请上传简历文件。" });
      return;
    }

    if (!fileLooksValid(req.file)) {
      res.status(400).json({ message: "简历文件内容与格式不匹配，请重新导出 PDF 或 Word 后上传。" });
      return;
    }

    const fields = req.body || {};
    if (String(fields.companyWebsite || "").trim()) {
      res.json({ ok: true, message: "提交成功。" });
      return;
    }

    const applicantName = String(fields.applicantName || "").trim();
    const phone = String(fields.phone || "").trim();
    const position = String(fields.position || "").trim();

    if (!applicantName || !phone || !position) {
      res.status(400).json({ message: "请填写称谓/姓名、联系电话和应聘方向。" });
      return;
    }

    if (!/^1[3-9]\d{9}$/.test(phone.replace(/\s/g, ""))) {
      res.status(400).json({ message: "请填写正确的 11 位手机号码。" });
      return;
    }

    const transporter = createTransporter();
    const recipient = process.env.MAIL_TO || "380704292@qq.com";
    const subject = `【招聘申请】${applicantName} - ${position} - ${phone}`;

    await transporter.sendMail({
      from: `"广发证券保定营业部招聘页" <${process.env.SMTP_USER}>`,
      to: recipient,
      subject,
      html: mailHtml({
        ...fields,
        applicantName,
        phone,
        position,
        submittedAt: fields.submittedAt || new Date().toISOString()
      }),
      attachments: [
        {
          filename: sanitizeFileName(req.file.originalname),
          content: req.file.buffer,
          contentType: req.file.mimetype
        }
      ]
    });

    res.json({ ok: true, message: "提交成功。" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "邮件服务暂时不可用，请稍后再试或直接联系招聘负责人。" });
  }
});

app.use((error, _req, res, next) => {
  if (!error) {
    next();
    return;
  }

  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    res.status(400).json({ message: `简历文件请控制在 ${resumeMaxSizeMB}MB 以内。` });
    return;
  }

  if (
    error.message &&
    (error.message.includes("简历仅支持") || error.message.includes("简历文件类型"))
  ) {
    res.status(400).json({ message: error.message });
    return;
  }

  console.error(error);
  res.status(500).json({ message: "提交失败，请稍后再试。" });
});

app.use((_req, res) => {
  res.sendFile(path.join(siteRoot, "index.html"));
});

app.listen(port, () => {
  console.log(`Recruitment site running at http://localhost:${port}`);
});