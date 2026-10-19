import type { Metadata } from 'next';
import { IBM_Plex_Mono, Outfit } from 'next/font/google';
import { Shell } from '@/components/shell';
import './globals.css';

const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit', display: 'swap' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-ibm', display: 'swap' });

export const metadata: Metadata = {
  title: 'TokenForge — Reference Website Intelligence',
  description: 'Download reference assets and analyze an authorized website into a structured visual blueprint.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${outfit.variable} ${mono.variable}`}>
      <body><Shell>{children}</Shell></body>
    </html>
  );
}
