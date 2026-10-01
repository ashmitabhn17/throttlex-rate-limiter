'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { ApiKey, RequestLog } from '@/lib/types';
import { Badge, Spinner } from '@/components/ui';

export default function LogsPage() {
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [apiKeyId, setApiKeyId] = useState('');
  const [route, setRoute] = useState('');
  const [method, setMethod] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (apiKeyId) params.set('apiKeyId', apiKeyId);
    if (route) params.set('route', route);
    if (method) params.set('method', method);
    params.set('limit', '100');
    const res = await apiFetch<{ logs: RequestLog[] }>(`/admin/logs?${params.toString()}`);
    setLogs(res.logs);
    setLoading(false);
  }, [status, apiKeyId, route, method]);

  useEffect(() => {
    apiFetch<{ apiKeys: ApiKey[] }>('/admin/api-keys').then((r) => setKeys(r.apiKeys)).catch(() => {});
  }, []);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Request Logs</h1>
        <p className="text-sm text-slate-500">Every protected API request, allowed or blocked.</p>
      </div>

      <div className="card flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="label">Status</label>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            <option value="ALLOWED">Allowed</option>
            <option value="BLOCKED">Blocked</option>
          </select>
        </div>
        <div>
          <label className="label">API Key</label>
          <select className="input" value={apiKeyId} onChange={(e) => setApiKeyId(e.target.value)}>
            <option value="">All</option>
            {keys.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Route</label>
          <input className="input" value={route} onChange={(e) => setRoute(e.target.value)} placeholder="/api/search" />
        </div>
        <div>
          <label className="label">Method</label>
          <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="">All</option>
            {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-400">
                <th className="px-5 py-3">Time</th>
                <th>Status</th>
                <th>Method</th>
                <th>Route</th>
                <th>API Key</th>
                <th>Remaining</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-slate-400">No logs match these filters.</td></tr>
              )}
              {logs.map((log) => (
                <tr key={log.id} className="border-t border-slate-100">
                  <td className="px-5 py-2 text-slate-400">{new Date(log.createdAt).toLocaleTimeString()}</td>
                  <td><Badge color={log.status === 'ALLOWED' ? 'green' : 'red'}>{log.status}</Badge></td>
                  <td><Badge color="slate">{log.method}</Badge></td>
                  <td className="font-mono text-xs">{log.route}</td>
                  <td className="text-slate-600">{log.apiKey?.name ?? '—'}</td>
                  <td className="text-slate-600">{log.remaining}/{log.limit}</td>
                  <td className="font-mono text-xs text-slate-400">{log.ip ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
