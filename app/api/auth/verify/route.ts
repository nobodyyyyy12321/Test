import { NextResponse } from "next/server";
import { findUserByVerificationToken, updateUser } from "../../../../lib/users-supabase";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    
    // 取得基礎 URL（生產環境應該是 testtttt.io）
    // 優先使用 NEXTAUTH_URL，否則使用請求的 origin
    const baseUrl = process.env.NEXTAUTH_URL || url.origin;
    
    if (!token) {
      console.warn('Verify: missing token in request', { url: req.url });
      const location = new URL('/', baseUrl);
      location.searchParams.set('verified', '0');
      location.searchParams.set('error', 'missing_token');
      // In development return JSON for easier debugging
      if ((process.env.NODE_ENV || 'development') === 'development') {
        return NextResponse.json({ ok: false, error: 'missing_token' }, { status: 400 });
      }
      return NextResponse.redirect(location.toString());
    }

    console.log('Verify: received token', { token });
    const user = await findUserByVerificationToken(token);
    console.log('Verify: lookup user result', { userId: user?.id });
    if (!user) {
      console.warn('Verify: no user found for token', { token });
      const location = new URL('/', baseUrl);
      location.searchParams.set('verified', '0');
      location.searchParams.set('error', 'invalid_token');
      if ((process.env.NODE_ENV || 'development') === 'development') {
        return NextResponse.json({ ok: false, error: 'invalid_token' }, { status: 404 });
      }
      return NextResponse.redirect(location.toString());
    }

    // Check expiry
    if (user.verificationExpires && new Date(user.verificationExpires) < new Date()) {
      console.warn('Verify: token expired', { userId: user.id, expires: user.verificationExpires });
      const location = new URL('/', baseUrl);
      location.searchParams.set('verified', '0');
      location.searchParams.set('error', 'expired');
      if ((process.env.NODE_ENV || 'development') === 'development') {
        return NextResponse.json({ ok: false, error: 'expired' }, { status: 410 });
      }
      return NextResponse.redirect(location.toString());
    }

    try {
      await updateUser(user.id, { emailVerified: true, verificationToken: undefined, verificationExpires: undefined });
      console.log('Verify: updated user emailVerified=true', { userId: user.id });
    } catch (updateErr) {
      console.error('Verify: failed to update user', { userId: user.id, error: updateErr });
      const location = new URL('/', baseUrl);
      location.searchParams.set('verified', '0');
      location.searchParams.set('error', 'update_failed');
      if ((process.env.NODE_ENV || 'development') === 'development') {
        return NextResponse.json({ ok: false, error: 'update_failed', detail: String(updateErr) }, { status: 500 });
      }
      return NextResponse.redirect(location.toString());
    }

    const successLocation = new URL('/', baseUrl);
    successLocation.searchParams.set('verified', '1');
    return NextResponse.redirect(successLocation.toString());
  } catch (e) {
    console.error(e);
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const location = new URL('/', baseUrl);
    location.searchParams.set('verified', '0');
    location.searchParams.set('error', 'internal');
    return NextResponse.redirect(location.toString());
  }
}
