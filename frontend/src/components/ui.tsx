'use client';

import { ReactNode } from 'react';

export function StatCard({
  label,
  value,
  hint,
  accent = 'brand',
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  accent?: 'brand' | 'green' | 'red' | 'slate';
}) {
  const accentMap: Record<string, string> = {
    brand: 'text-brand-600',
    green: 'text-emerald-600',
    red: 'text-red-600',
    slate: 'text-slate-700',
  };
  return (
    <div className="card p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${accentMap[accent]}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function Badge({ children, color }: { children: ReactNode; color: 'green' | 'red' | 'slate' | 'brand' | 'amber' }) {
  const map: Record<string, string> = {
    green: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-700',
    slate: 'bg-slate-100 text-slate-600',
    brand: 'bg-brand-50 text-brand-700',
    amber: 'bg-amber-50 text-amber-700',
  };
  return <span className={`badge ${map[color]}`}>{children}</span>;
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="card w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-10 text-slate-400">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
    </div>
  );
}
