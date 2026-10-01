'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { apiFetch, clearToken, getToken } from '@/lib/api';

const NAV = [
  { href: '/dashboard', label: 'Overview', icon: '▚' },
  { href: '/dashboard/api-keys', label: 'API Keys', icon: '🔑' },
  { href: '/dashboard/rules', label: 'Rate Limits', icon: '🎚' },
  { href: '/dashboard/logs', label: 'Request Logs', icon: '📜' },
  { href: '/dashboard/playground', label: 'Playground', icon: '🧪' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    setReady(true);
  }, [router]);

  async function logout() {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      /* ignore */
    }
    clearToken();
    router.replace('/login');
  }

  if (!ready) return null;

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-64 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex items-center gap-2 px-6 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">⚡</div>
          <span className="text-lg font-bold text-slate-800">ThrottleX</span>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3">
          <button onClick={logout} className="btn-ghost w-full">
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 bg-slate-50">
        {/* Mobile top nav */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <span className="font-bold text-slate-800">⚡ ThrottleX</span>
          <button onClick={logout} className="text-sm text-slate-500">Sign out</button>
        </div>
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-8">{children}</div>
      </div>
    </div>
  );
}
