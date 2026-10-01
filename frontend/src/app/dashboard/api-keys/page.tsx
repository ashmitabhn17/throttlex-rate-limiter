'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { ApiKey, Plan } from '@/lib/types';
import { Badge, Modal, Spinner } from '@/components/ui';

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [plan, setPlan] = useState<Plan>('FREE');
  const [newRawKey, setNewRawKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function load() {
    const res = await apiFetch<{ apiKeys: ApiKey[] }>('/admin/api-keys');
    setKeys(res.apiKeys);
    setLoading(false);
  }

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  async function create() {
    const res = await apiFetch<{ rawKey: string }>('/admin/api-keys', {
      method: 'POST',
      body: { name, plan },
    });
    setNewRawKey(res.rawKey);
    setShowCreate(false);
    setName('');
    await load();
  }

  async function toggleStatus(key: ApiKey) {
    await apiFetch(`/admin/api-keys/${key.id}`, {
      method: 'PATCH',
      body: { status: key.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' },
    });
    await load();
  }

  async function remove(key: ApiKey) {
    if (!confirm(`Delete API key "${key.name}"? This cannot be undone.`)) return;
    await apiFetch(`/admin/api-keys/${key.id}`, { method: 'DELETE' });
    await load();
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">API Keys</h1>
          <p className="text-sm text-slate-500">Create and manage keys used to access protected APIs.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>+ Create API Key</button>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-400">
                <th className="px-5 py-3">Name</th>
                <th>Prefix</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Last Used</th>
                <th className="text-right px-5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400">No API keys yet.</td></tr>
              )}
              {keys.map((k) => (
                <tr key={k.id} className="border-t border-slate-100">
                  <td className="px-5 py-3 font-medium text-slate-700">{k.name}</td>
                  <td className="font-mono text-xs text-slate-500">{k.keyPrefix}…</td>
                  <td><Badge color="brand">{k.plan}</Badge></td>
                  <td><Badge color={k.status === 'ACTIVE' ? 'green' : 'slate'}>{k.status}</Badge></td>
                  <td className="text-slate-400">{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : 'never'}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => toggleStatus(k)}>
                        {k.status === 'ACTIVE' ? 'Disable' : 'Enable'}
                      </button>
                      <button className="btn-danger !px-2 !py-1 text-xs" onClick={() => remove(k)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create API Key">
        <div className="space-y-4">
          <div>
            <label className="label">Key name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mobile app production" />
          </div>
          <div>
            <label className="label">Plan</label>
            <select className="input" value={plan} onChange={(e) => setPlan(e.target.value as Plan)}>
              <option value="FREE">Free</option>
              <option value="PRO">Pro</option>
              <option value="ENTERPRISE">Enterprise</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
            <button className="btn-primary" onClick={create} disabled={!name}>Create</button>
          </div>
        </div>
      </Modal>

      {/* Show-once raw key modal */}
      <Modal open={!!newRawKey} onClose={() => setNewRawKey(null)} title="Your new API key">
        <div className="space-y-4">
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Copy this key now — it will <strong>never be shown again</strong>. Only its hash is stored.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all rounded-lg bg-slate-900 px-3 py-2 font-mono text-sm text-emerald-300">{newRawKey}</code>
            <button className="btn-ghost" onClick={() => newRawKey && copy(newRawKey)}>{copied ? 'Copied!' : 'Copy'}</button>
          </div>
          <div className="flex justify-end">
            <button className="btn-primary" onClick={() => setNewRawKey(null)}>Done</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
