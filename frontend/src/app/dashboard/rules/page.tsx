'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Plan, RateLimitRule } from '@/lib/types';
import { Badge, Modal, Spinner } from '@/components/ui';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const ROUTES = ['/api/public', '/api/search', '/api/login-demo', '/api/orders'];

interface Draft {
  id?: string;
  route: string;
  method: string;
  plan: Plan;
  capacity: number;
  refillRatePerSecond: number;
  windowSeconds: number;
  enabled: boolean;
}

const emptyDraft: Draft = {
  route: '/api/search',
  method: 'GET',
  plan: 'FREE',
  capacity: 20,
  refillRatePerSecond: 2,
  windowSeconds: 60,
  enabled: true,
};

export default function RulesPage() {
  const [rules, setRules] = useState<RateLimitRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');

  async function load() {
    const res = await apiFetch<{ rules: RateLimitRule[] }>('/admin/rules');
    setRules(res.rules);
    setLoading(false);
  }

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  async function save() {
    if (!draft) return;
    setError('');
    try {
      if (draft.id) {
        await apiFetch(`/admin/rules/${draft.id}`, { method: 'PATCH', body: stripId(draft) });
      } else {
        await apiFetch('/admin/rules', { method: 'POST', body: stripId(draft) });
      }
      setDraft(null);
      await load();
    } catch (e) {
      setError((e as { message?: string }).message ?? 'Failed to save rule');
    }
  }

  async function toggle(rule: RateLimitRule) {
    await apiFetch(`/admin/rules/${rule.id}`, { method: 'PATCH', body: { enabled: !rule.enabled } });
    await load();
  }

  async function remove(rule: RateLimitRule) {
    if (!confirm('Delete this rule?')) return;
    await apiFetch(`/admin/rules/${rule.id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Rate Limit Rules</h1>
          <p className="text-sm text-slate-500">Route + method + plan → token bucket configuration.</p>
        </div>
        <button className="btn-primary" onClick={() => { setDraft({ ...emptyDraft }); setError(''); }}>+ Create Rule</button>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-400">
                <th className="px-5 py-3">Route</th>
                <th>Method</th>
                <th>Plan</th>
                <th>Capacity</th>
                <th>Refill /s</th>
                <th>Status</th>
                <th className="px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-slate-400">No rules yet.</td></tr>
              )}
              {rules.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-5 py-3 font-mono text-xs">{r.route}</td>
                  <td><Badge color="slate">{r.method}</Badge></td>
                  <td><Badge color="brand">{r.plan}</Badge></td>
                  <td className="text-slate-700">{r.capacity}</td>
                  <td className="text-slate-700">{r.refillRatePerSecond}</td>
                  <td><Badge color={r.enabled ? 'green' : 'slate'}>{r.enabled ? 'Enabled' : 'Disabled'}</Badge></td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => setDraft({ ...r })}>Edit</button>
                      <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => toggle(r)}>{r.enabled ? 'Disable' : 'Enable'}</button>
                      <button className="btn-danger !px-2 !py-1 text-xs" onClick={() => remove(r)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? 'Edit Rule' : 'Create Rule'}>
        {draft && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Route</label>
                <select className="input" value={draft.route} onChange={(e) => setDraft({ ...draft, route: e.target.value })}>
                  {ROUTES.map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Method</label>
                <select className="input" value={draft.method} onChange={(e) => setDraft({ ...draft, method: e.target.value })}>
                  {METHODS.map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Plan</label>
                <select className="input" value={draft.plan} onChange={(e) => setDraft({ ...draft, plan: e.target.value as Plan })}>
                  <option value="FREE">Free</option>
                  <option value="PRO">Pro</option>
                  <option value="ENTERPRISE">Enterprise</option>
                </select>
              </div>
              <div>
                <label className="label">Capacity (burst)</label>
                <input className="input" type="number" min={1} value={draft.capacity} onChange={(e) => setDraft({ ...draft, capacity: Number(e.target.value) })} />
              </div>
              <div>
                <label className="label">Refill / second</label>
                <input className="input" type="number" min={0} step={0.1} value={draft.refillRatePerSecond} onChange={(e) => setDraft({ ...draft, refillRatePerSecond: Number(e.target.value) })} />
              </div>
              <div>
                <label className="label">Window (seconds)</label>
                <input className="input" type="number" min={1} value={draft.windowSeconds} onChange={(e) => setDraft({ ...draft, windowSeconds: Number(e.target.value) })} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
              Enabled
            </label>
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setDraft(null)}>Cancel</button>
              <button className="btn-primary" onClick={save}>Save</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function stripId(draft: Draft) {
  const { id: _id, ...rest } = draft;
  return rest;
}
