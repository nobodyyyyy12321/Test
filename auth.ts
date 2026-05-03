import NextAuth from "next-auth";
import GithubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { findUserByEmail, saveUser, updateUser } from "./lib/users";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? process.env.GOOGLE_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? process.env.GOOGLE_SECRET ?? "",
    }),
    GithubProvider({
      clientId: process.env.GITHUB_ID ?? "",
      clientSecret: process.env.GITHUB_SECRET ?? "",
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials: any) {
        if (!credentials || !credentials.email || !credentials.password) return null;
        const user = await findUserByEmail(credentials.email);
        if (!user || !user.passwordHash) return null;
        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;
        if (!user.emailVerified) {
          throw new Error("請先完成電子郵件驗證");
        }
        return { id: user.id, name: user.name, email: user.email } as any;
      },
    }),
  ],
  trustHost: true,
  session: { strategy: "jwt" as const },
  callbacks: {
    async jwt({ token, user, account }: any) {
      if (user) {
        // On first sign-in, resolve DB user id so it persists in token.
        if (account?.provider === "google" || account?.provider === "github") {
          const dbUser = await findUserByEmail(user.email);
          token.userId = dbUser ? dbUser.id : user.id;
        } else {
          // Credentials: authorize() already returns DB id.
          token.userId = user.id;
        }
      }
      return token;
    },
    async session({ session, token }: any) {
      if (token?.userId) (session.user as any).id = token.userId;
      return session;
    },
    async signIn({ user, account, profile }: any) {
      try {
        if (!account) return true;
        if (account.provider === "google" || account.provider === "github") {
          const email = (user?.email || profile?.email)?.toString();
          if (!email) return true;
          const existing = await findUserByEmail(email);
          if (existing) {
            if (existing.passwordHash) {
              // Already linked to this Google account → allow login.
              if (existing.googleId === account.providerAccountId) return true;

              // Pending link intent and not expired → complete the link.
              if (
                existing.pendingGoogleLinkExpires &&
                new Date(existing.pendingGoogleLinkExpires) > new Date()
              ) {
                await updateUser(existing.id, {
                  googleId: account.providerAccountId,
                  pendingGoogleLinkExpires: undefined,
                });
                return true;
              }

              // No link — block and redirect back to login page.
              const base = process.env.NEXTAUTH_URL || "http://localhost:3000";
              return `${base}/auth/login?error=email_registered`;
            }

            // OAuth-created account logged in with Google again: backfill link if missing.
            if (account.provider === "google" && existing.googleId !== account.providerAccountId) {
              await updateUser(existing.id, { googleId: account.providerAccountId });
            }
          } else {
            const id = uuidv4();
            const newUser = {
              id,
              name: user.name || profile?.name || email.split("@")[0],
              email,
              emailVerified: true,
              googleId: account.provider === "google" ? account.providerAccountId : undefined,
              avatarUrl: (user as any).image || profile?.picture || null,
            } as any;
            await saveUser(newUser);
          }
        }
        return true;
      } catch (e) {
        console.error("signIn callback error:", e);
        return true;
      }
    },
  },
  pages: { error: "/auth/error" },
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
};

const { handlers, auth } = NextAuth(authOptions as any);

export { auth, handlers };