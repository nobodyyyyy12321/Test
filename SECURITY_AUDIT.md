# Security Audit

Findings from a scan of the Next.js app, NextAuth setup, API routes, and Supabase integration. Grouped by severity with file/line references.

## High

### 1. Verification URL leaked in the API response when email isn't configured
[app/api/auth/register/route.ts:113-115](app/api/auth/register/route.ts#L113-L115) and [app/api/auth/resend/route.ts:66](app/api/auth/resend/route.ts#L66) both return `verificationUrl` in the JSON body when `RESEND_API_KEY`/SMTP aren't set. If a production deploy is ever missing those envs, anyone can register with someone else's email, read the response, and verify the account themselves. The branch is also reachable via misconfiguration on Vercel previews.

### 2. Email address leaked via profile lookup by id
[app/api/user/profile/route.ts:13-20](app/api/user/profile/route.ts#L13-L20) — when called with `?id=`, the route returns `email` unconditionally. The `?name=` branch respects `emailPublic`, but `?id=` does not. Anyone who knows a user id can read that user's email.

### 3. SVG uploads allowed to a public bucket
[app/api/upload/image/route.ts:7](app/api/upload/image/route.ts#L7) accepts `image/svg+xml` and trusts the client-declared MIME type and filename extension. The file is stored in a public bucket and served with the uploader-supplied content type. An SVG containing `<script>` opened directly from the storage URL executes in the storage origin — usable for phishing or for stealing tokens if the storage origin is ever made same-site.

### 4. No rate limiting / CAPTCHA on auth or feedback endpoints
`/api/auth/register`, `/api/auth/resend`, NextAuth credentials login, and `/api/feedback` have no throttling. This enables:
- Password brute force against the Credentials provider ([auth.ts:25-35](auth.ts#L25-L35))
- Bulk user enumeration via [register's 409 messages](app/api/auth/register/route.ts#L81-L87)
- Mass spam through `/api/feedback` (it relays to your support inbox via Resend with attacker-controlled `replyTo`)

## Medium

### 5. User enumeration
- `/api/auth/register` returns distinct 409s: "Email already registered" vs "Name already registered" ([register/route.ts:81-87](app/api/auth/register/route.ts#L81-L87))
- `/api/auth/resend` returns 404 when the email isn't found ([resend/route.ts:49](app/api/auth/resend/route.ts#L49))
- NextAuth callback redirects to `/auth/login?error=email_registered` on Google sign-in for an existing password account ([auth.ts:83-84](auth.ts#L83-L84))

### 6. `signIn` callback fails open
[auth.ts:105-108](auth.ts#L105-L108) — any thrown error inside `signIn` is swallowed and returns `true`, granting a session. A transient DB error during OAuth onboarding can let an unprovisioned user in.

### 7. Missing security headers
[next.config.ts:9-37](next.config.ts#L9-L37) configures only cache headers. No `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`, or `Permissions-Policy`. The site is clickjackable and has no CSP defense-in-depth against stored XSS (e.g. via uploaded SVGs, KaTeX/markdown rendering paths).

### 8. `avatarUrl` accepts any string
[app/api/user/profile/route.ts:98](app/api/user/profile/route.ts#L98) — the PATCH handler stores whatever string the client sends as `avatarUrl`. No URL allow-list, no scheme check. Renders that use `<img src>` are safe; any place that uses the URL inside `<object>`, `srcset`, CSS `url()`, or as an `<a href>` is not.

### 9. Verification tokens written to server logs
[app/api/auth/verify/route.ts:25](app/api/auth/verify/route.ts#L25) logs the raw token, and [register/route.ts:64](app/api/auth/register/route.ts#L64) / [resend/route.ts:33](app/api/auth/resend/route.ts#L33) log the full verification URL when email isn't configured. Anyone with log access (Vercel function logs, console viewers) can complete email verification for arbitrary users.

## Low / observations

### 10. Service-role key is the universal DB credential
Every server route in `lib/*-supabase.ts` and `lib/supabase-admin.ts` uses `TEST_SUPABASE_SERVICE_ROLE_KEY`, bypassing RLS. This is a valid pattern, but it means **every** route is the only thing standing between the public internet and full DB write access — a missed `auth()` check anywhere becomes a full-table write. Worth a one-time audit confirming every route under `/app/api/**` either calls `auth()` or is intentionally public.

### 11. Name-change cooldown comment is dead
[app/api/user/profile/route.ts:99-107](app/api/user/profile/route.ts#L99-L107) comment claims "only allow changing display name once per 7 days" but the code never checks `nameUpdatedAt` — it just overwrites the field. Either implement the cooldown or remove the comment.

### 12. OAuth-only accounts are auto-linked by email
[auth.ts:88-90](auth.ts#L88-L90) — if a user record was created via Google and the same Google account signs in again with a different `providerAccountId`, the new id is silently written. Unlikely to be exploitable but worth knowing.

---

## Recommended fix order

The three highest-leverage, lowest-effort fixes:

1. **#1** — drop the leaked URL from the register/resend response bodies.
2. **#2** — strip `email` from the id-lookup path in `/api/user/profile`.
3. **#3** — remove `image/svg+xml` from the allowed upload types, or force-store SVGs as `text/plain`.
