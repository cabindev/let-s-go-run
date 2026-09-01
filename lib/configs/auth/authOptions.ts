// lib/configs/auth/authOptions.ts
import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { Role } from '@prisma/client';
import { compare } from 'bcryptjs';
import { prisma } from '@/lib/prisma';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: Role;
    };
  }

  interface User {
    id: string;
    role: Role;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: Role;
    picture?: string | null;
  }
}

const authOptions: NextAuthOptions = {
  // ไม่ใช้ PrismaAdapter เพราะ schema นี้ไม่มี model Account / Session / VerificationToken
  // (credentials + jwt ไม่ต้องใช้ adapter)
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'you@example.com' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.password) return null;

        const isValidPassword = await compare(credentials.password, user.password);
        if (!isValidPassword) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/auth/signin',
  },
  callbacks: {
    // ไม่ใช้ PrismaAdapter จึงต้อง find-or-create User เองตอน Google ยืนยันตัวตนสำเร็จ
    // ผูกกับบัญชี credentials เดิมอัตโนมัติถ้า email ตรงกัน (Google ยืนยัน email มาแล้วว่าเป็นเจ้าของจริง)
    signIn: async ({ user, account }) => {
      if (account?.provider === 'google') {
        if (!user.email) return false;

        const dbUser = await prisma.user.upsert({
          where: { email: user.email },
          update: { name: user.name ?? undefined, image: user.image ?? undefined },
          create: { email: user.email, name: user.name, image: user.image, role: 'USER' },
        });

        user.id = dbUser.id;
        user.role = dbUser.role;
      }
      return true;
    },
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.picture = user.image;
        return token;
      }
      // เช็ค role ล่าสุดจาก DB ทุกครั้งที่ไม่ใช่ตอน sign-in — กัน session เก่าค้างสิทธิ์เดิม
      // (เช่นถูกลดสิทธิ์จาก ADMIN เป็น USER แล้ว แต่ยังไม่ได้ออกจากระบบ token เดิมจะยังอ้าง role เก่าตลอดอายุ JWT)
      if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id },
          select: { role: true },
        });
        token.role = dbUser?.role ?? 'USER';
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.image = token.picture;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      else if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
};

export default authOptions;
