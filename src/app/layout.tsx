import type { Metadata } from 'next';
import { Fraunces, Hanken_Grotesk, Spline_Sans_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { Providers } from '@/components/providers';

// Editorial display serif — high contrast, characterful. Used for headlines.
const fontDisplay = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '500', '600', '700', '900'],
  style: ['normal', 'italic'],
});

// Clean grotesque body — readable, slightly characterful.
const fontBody = Hanken_Grotesk({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '600', '700'],
});

// Monospace for printed-ticket metadata: dates, times, RSVP codes, labels.
const fontMono = Spline_Sans_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'OwnRSVP — Event Invitations Made Simple',
  description: 'Create beautiful event invitations and manage RSVPs with ease.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${fontDisplay.variable} ${fontBody.variable} ${fontMono.variable} font-sans antialiased`}
      >
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
