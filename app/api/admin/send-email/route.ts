import { auth } from "@/auth";

const SUPPORT_FROM = "support@testtttt.io";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isAdmin(email?: string | null): boolean {
  if (!email) return false;
  const allowed = (process.env.ADMIN_EMAILS ?? "").split(",").map(s => s.trim()).filter(Boolean);
  return allowed.includes(email);
}

function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseRecipients(value: unknown): string[] {
  const raw = Array.isArray(value) ? value.join(",") : String(value ?? "");
  const seen = new Set<string>();
  return raw
    .split(/[,\n;]/)
    .map(email => email.trim())
    .filter(email => {
      if (!email || seen.has(email)) return false;
      seen.add(email);
      return true;
    });
}

async function sendEmail(params: {
  to: string[];
  cc: string[];
  bcc: string[];
  replyTo?: string;
  subject: string;
  text: string;
}) {
  const html = `<div style="white-space:pre-wrap;line-height:1.6">${escapeHtml(params.text)}</div>`;

  if (process.env.RESEND_API_KEY) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      const result = await resend.emails.send({
        from: SUPPORT_FROM,
        to: params.to,
        cc: params.cc.length ? params.cc : undefined,
        bcc: params.bcc.length ? params.bcc : undefined,
        replyTo: params.replyTo,
        subject: params.subject,
        text: params.text,
        html,
      });

      if (!result.error) return { sent: true as const, provider: "resend" as const };
      console.error("admin email resend error:", result.error);
    } catch (error) {
      console.error("admin email resend exception:", error);
    }
  }

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: SUPPORT_FROM,
        to: params.to,
        cc: params.cc.length ? params.cc : undefined,
        bcc: params.bcc.length ? params.bcc : undefined,
        replyTo: params.replyTo,
        subject: params.subject,
        text: params.text,
        html,
      });

      return { sent: true as const, provider: "smtp" as const };
    } catch (error) {
      console.error("admin email smtp error:", error);
    }
  }

  return { sent: false as const };
}

export async function POST(request: Request) {
  const session = await auth();
  const adminEmail = (session?.user as any)?.email as string | undefined;
  if (!isAdmin(adminEmail)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const to = parseRecipients(body?.to);
  const cc = parseRecipients(body?.cc);
  const bcc = parseRecipients(body?.bcc);
  const subject = String(body?.subject ?? "").trim();
  const text = String(body?.message ?? "").trim();
  const replyTo = String(body?.replyTo ?? "").trim();
  const allRecipients = [...to, ...cc, ...bcc];

  if (to.length === 0) return Response.json({ error: "請填寫收件人" }, { status: 400 });
  if (!subject) return Response.json({ error: "請填寫主旨" }, { status: 400 });
  if (!text) return Response.json({ error: "請填寫內容" }, { status: 400 });
  if (allRecipients.length > 100) return Response.json({ error: "一次最多 100 位收件人" }, { status: 400 });
  if (subject.length > 200) return Response.json({ error: "主旨過長" }, { status: 400 });
  if (text.length > 20000) return Response.json({ error: "內容過長" }, { status: 400 });
  if (!allRecipients.every(email => EMAIL_PATTERN.test(email))) {
    return Response.json({ error: "收件人 Email 格式不正確" }, { status: 400 });
  }
  if (replyTo && !EMAIL_PATTERN.test(replyTo)) {
    return Response.json({ error: "Reply-To Email 格式不正確" }, { status: 400 });
  }

  const result = await sendEmail({
    to,
    cc,
    bcc,
    replyTo: replyTo || adminEmail,
    subject,
    text,
  });

  if (!result.sent) {
    return Response.json({ error: "寄送失敗，請確認 RESEND_API_KEY 或 SMTP 設定，以及 support@testtttt.io 是否可用" }, { status: 502 });
  }

  return Response.json({ ok: true, provider: result.provider, from: SUPPORT_FROM });
}
