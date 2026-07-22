import { NextResponse } from "next/server";
import { findUserByEmail, updateUser } from "../../../../lib/users-supabase";
import bcrypt from "bcryptjs";

async function sendVerificationEmail(to: string, url: string) {
  try {
    if (process.env.RESEND_API_KEY) {
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY as string);
        const from = process.env.MAIL_FROM || `no-reply@${process.env.NEXTAUTH_URL?.replace(/^https?:\/\//, "") || "example.com"}`;
        await resend.emails.send({ from, to, subject: "請驗證您的Test帳號", html: `<p>請點擊下方連結完成驗證：</p><p><a href="${url}">${url}</a></p>` });
        return { sent: true as const, previewUrl: undefined };
      } catch (e) {
        console.error("Resend send error:", e);
      }
    }

    const nodemailer = await import("nodemailer");
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587,
        secure: process.env.SMTP_SECURE === "true",
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      const from = process.env.MAIL_FROM || process.env.SMTP_USER;
      const info = await transporter.sendMail({ from, to, subject: "請驗證您的Test帳號", html: `<p>請點擊下方連結完成驗證：</p><p><a href="${url}">${url}</a></p>` });

      return { sent: true as const, previewUrl: nodemailer.getTestMessageUrl ? nodemailer.getTestMessageUrl(info) : undefined };
    }

    console.log("Verification URL (no SMTP/Resend configured):", url);
    return { sent: false as const, previewUrl: undefined };
  } catch (err) {
    console.error("send email error:", err);
    console.log("Verification URL:", url);
    return { sent: false as const, previewUrl: undefined };
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email } = body;
    if (!email) return NextResponse.json({ error: "Missing email" }, { status: 400 });

    const user = await findUserByEmail(email as string);
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (user.emailVerified) return NextResponse.json({ ok: false, message: "already_verified" });

    // If token missing or expired, generate a new one
    let token = user.verificationToken;
    if (!token || (user.verificationExpires && new Date(user.verificationExpires) < new Date())) {
      token = crypto.randomUUID();
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await updateUser(user.id, { verificationToken: token, verificationExpires: expires });
    }

    const base = process.env.NEXTAUTH_URL || `http://localhost:3000`;
    const verificationUrl = `${base}/api/auth/verify?token=${token}`;

    const sendResult = await sendVerificationEmail(user.email as string, verificationUrl);

    return NextResponse.json({ ok: true, verificationSent: sendResult.sent, previewUrl: sendResult.previewUrl, verificationUrl: sendResult.sent ? undefined : verificationUrl });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
