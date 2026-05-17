import { NextResponse } from "next/server";
import { findUserByName, findUserByEmail, saveUser } from "../../../../lib/users";
import bcrypt from "bcryptjs";
import { Resend } from "resend";




async function trySendVerificationEmail(to: string, url: string) {
  // Try to send email via nodemailer. If SMTP env not configured and
  // we're in development, create an Ethereal test account and send a preview email.
  try {
    // Prefer Resend (resend.com) if API key provided
    if (process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const from = process.env.MAIL_FROM || `onboarding@resend.dev`;
        const result = await resend.emails.send({
          from: from,
          to: to,
          subject: "請驗證您的Exam帳號",
          html: `<p>請點擊下方連結完成驗證：</p><p><a href="${url}">${url}</a></p>`,
        });
        
        if (result.error) {
          console.error("Resend send error:", result.error);
          // fallthrough to other methods
        } else {
          console.log("Email sent successfully via Resend to:", to);
          return { sent: true as const, previewUrl: undefined };
        }
      } catch (e) {
        console.error("Resend send error:", e);
        // fallthrough to other methods
      }
    }
    const nodemailer = await import("nodemailer");

    // If SMTP is configured, use it.
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587,
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const from = process.env.MAIL_FROM || process.env.SMTP_USER;
      await transporter.sendMail({
        from,
        to,
        subject: "請驗證您的帳號",
        html: `<p>請點擊下方連結完成驗證：</p><p><a href="${url}">${url}</a></p>`,
      });

      return { sent: true as const, previewUrl: undefined };
    }

    // No SMTP or Resend configured — log the verification URL so developers
    // can copy it manually. Do not create or send Ethereal test emails.
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
    const { name, email, password } = body;
    if (!name || !email || !password) {
      return NextResponse.json({ error: "Missing name, email or password" }, { status: 400 });
    }

    if (await findUserByEmail(email)) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    if (await findUserByName(name)) {
      return NextResponse.json({ error: "Name already registered" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomUUID();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const user = {
      id: crypto.randomUUID(),
      name,
      email,
      passwordHash,
      emailVerified: false,
      verificationToken,
      verificationExpires,
    };

    await saveUser(user as any);

    const base = process.env.NEXTAUTH_URL || `http://localhost:3000`;
    const verificationUrl = `${base}/api/auth/verify?token=${verificationToken}`;

    const sendResult = await trySendVerificationEmail(email, verificationUrl);

    return NextResponse.json({
      ok: true,
      userId: user.id,
      verificationSent: sendResult.sent,
      verificationUrl: sendResult.sent ? undefined : verificationUrl,
      previewUrl: sendResult.previewUrl,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
