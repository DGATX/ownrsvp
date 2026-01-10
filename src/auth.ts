import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { getOrCreateAuthSecret } from '@/lib/auth-secret';

const loginSchema = z.object({
  email: z.string().min(1), // This field accepts either email or username
  password: z.string().min(1),
});

// Get or auto-generate AUTH_SECRET for one-click Docker deployment
const authSecret = getOrCreateAuthSecret();

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: authSecret,
  // Trust proxy host - required for reverse proxy setups
  trustHost: true,
  // Use AUTH_URL for callbacks when behind reverse proxy
  ...(process.env.AUTH_URL && {
    basePath: undefined, // Let NextAuth determine base path
  }),
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email or Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        try {
          const parsed = loginSchema.safeParse(credentials);
          if (!parsed.success) return null;

          const { email: identifier, password } = parsed.data;

          // Try to find user by email first, then by username
          const user = await prisma.user.findFirst({
            where: {
              OR: [
                { email: identifier },
                { username: identifier },
              ],
            },
          });

          if (!user || !user.password) return null;

          const isValid = await bcrypt.compare(password, user.password);
          if (!isValid) return null;

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            role: user.role,
          };
        } catch (error) {
          logger.error('Auth error', error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
  events: {
    async signIn() {
      // Suppress expected credential errors
    },
  },
});

