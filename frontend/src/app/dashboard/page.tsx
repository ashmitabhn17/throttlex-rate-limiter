'use client';

import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { apiFetch } from '@/lib/api';
import { AnalyticsSummary, RequestLog, TimeSeriesPoint } from '@/lib/types';
import { StatCard, Badge, Spinner } from '@/components/ui';

export default function DashboardHome() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [series, setSeries] = useState<TimeSeriesPoint[]>([]);
  const [blocked, setBlocked] = useState<RequestLog[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const [s, t, b] = await Promise.all([
      apiFetch<AnalyticsSummary>('/admin/analytics/summary'),
      apiFetch<{ series: TimeSeriesPoint[] }>('/admin/analytics/requests-over-time?hours=24'),
      apiFetch<{ logs: RequestLog[] }>('/admin/logs?status=BLOCKED&limit=8'),
    ]);
    setSummary(s);
    setSeries(
      t.series.map((p) => ({
        ...p,
        time: new Date(p.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      })),
    );
    setBlocked(b.logs);
    setLoading(false);
  }

  useEffect(() => {
    load().catch(() => setLoading(false));
    const id = setInterval(() => load().catch(() => {}), 10000);
    return () => clearInterval(id);
  }, []);

  if (loading || !summary) return <Spinner />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Overview</h1>
        <p className="text-sm text-slate-500">Live traffic across your protected APIs (auto-refreshes every 10s).</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Requests" value={summary.totalRequests.toLocaleString()} accent="slate" />
        <StatCard label="Allowed" value={summary.allowedRequests.toLocaleString()} accent="green" />
        <StatCard label="Blocked" value={summary.blockedRequests.toLocaleString()} accent="red" />
        <StatCard label="Active API Keys" value={summary.activeApiKeys} accent="brand" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StatCard label="Avg Requests / min (1h)" value={summary.avgRequestsPerMinute} accent="slate" />
        <StatCard label="Total API Keys" value={summary.totalApiKeys} accent="slate" />
        <StatCard label="Top Limited Route" value={summary.topLimitedRoute ?? '—'} accent="red" hint="Most blocked route" />
      </div>

      <div className="card p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">Allowed vs Blocked (last 24h)</h2>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="allowed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="blocked" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="time" tick={{ fontSize: 12, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="allowed" stroke="#10b981" fill="url(#allowed)" name="Allowed" />
              <Area type="monotone" dataKey="blocked" stroke="#ef4444" fill="url(#blocked)" name="Blocked" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">Recent Blocked Requests</h2>
        {blocked.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">No blocked requests yet. Try hammering an endpoint in the Playground.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-400">
                  <th className="py-2">Route</th>
                  <th>Method</th>
                  <th>API Key</th>
                  <th>Retry After</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {blocked.map((log) => (
                  <tr key={log.id} className="border-t border-slate-100">
                    <td className="py-2 font-mono text-xs">{log.route}</td>
                    <td><Badge color="slate">{log.method}</Badge></td>
                    <td className="text-slate-600">{log.apiKey?.name ?? '—'}</td>
                    <td className="text-red-600">{log.retryAfter ?? 0}s</td>
                    <td className="text-slate-400">{new Date(log.createdAt).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
