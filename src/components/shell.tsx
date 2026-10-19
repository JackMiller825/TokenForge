'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Layers } from 'lucide-react';
import { withBase } from '@/lib/format';
import { BackendProvider, BackendStatus } from './backend';

const LINKS = [
  ['/', 'Overview'],
  ['/download', 'Asset Downloader'],
  ['/analyze', 'Website Analyzer'],
  ['/replace', 'Replacement Studio'],
  ['/library', 'Project Library'],
  ['/help', 'Help'],
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname() || '/';
  return (
    <BackendProvider>
      <div className="relative z-10 min-h-screen">
        <header className="sticky top-0 z-20 border-b border-line/80 bg-ink/85 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <Link href={withBase('/')} className="flex items-center gap-3 font-semibold tracking-tight">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-lime text-ink"><Layers size={20} /></span>
              <span>TOKEN<span className="text-lime">FORGE</span></span>
            </Link>
            <nav className="order-3 flex w-full gap-1 overflow-x-auto text-sm md:order-none md:w-auto" aria-label="Primary">
              {LINKS.map(([href, label]) => {
                const current = path === href || (href !== '/' && path.startsWith(href));
                return <Link key={href} href={withBase(href)} className={`whitespace-nowrap rounded-lg px-3 py-2 ${current ? 'bg-lime text-ink' : 'text-muted hover:text-[#e7edf6]'}`} aria-current={current ? 'page' : undefined}>{label}</Link>;
              })}
            </nav>
            <BackendStatus />
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
      </div>
    </BackendProvider>
  );
}
