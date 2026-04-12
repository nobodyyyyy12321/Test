import NextAuth from "next-auth";
import GithubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { findUserByEmail, saveUser } from "./lib/users";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
//test
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
    async signIn({ user, account, profile }: any) {
      try {
        if (!account) return true;
        if (account.provider === "google" || account.provider === "github") {
          const email = (user?.email || profile?.email)?.toString();
          if (!email) return true;
          const existing = await findUserByEmail(email);
          if (!existing) {
            const id = uuidv4();
            const newUser = {
              id,
              name: user.name || profile?.name || email.split("@")[0],
              email,
              emailVerified: true,
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