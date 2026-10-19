import type { Metadata } from 'next';
import { IBM_Plex_Mono, Outfit } from 'next/font/google';
import './globals.css';

const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit', display: 'swap' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-ibm', display: 'swap' });

export const metadata: Metadata = {
  title: 'TokenForge — Reference Asset Downloader',
  description: 'Scan a public reference website, inspect discovered assets, and export an organized archive with original filenames.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${outfit.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
