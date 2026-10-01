'use client';

import { useState } from 'react';
import { API_URL } from '@/lib/api';
import { Badge } from '@/components/ui';

const ENDPOINTS = [
  { path: '/api/public', method: 'GET' },
  { path: '/api/search', method: 'GET' },
  { path: '/api/login-demo', method: 'POST' },
  { path: '/api/orders', method: 'GET' },
];

const RL_HEADERS = ['x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset', 'x-ratelimit-policy', 'retry-after'];

interface Result {
  status: number;
  ok: boolean;
  body: unknown;
  headers: Record<string, string>;
  durationMs: number;
}

export default function PlaygroundPage() {
  const [apiKey, setApiKey] = useState('');
  const [endpointIdx, setEndpointIdx] = useState(1);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [burst, setBurst] = useState(1);

  const endpoint = ENDPOINTS[endpointIdx];

  async function sendOne(): Promise<Result> {
    const started = performance.now();
    const res = await fetch(`${API_URL}${endpoint.path}`, {
      method: endpoint.method,
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: endpoint.method === 'POST' ? JSON.stringify({ username: 'demo' }) : undefined,
    });
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => (headers[k] = v));
    const text = await res.text();
    let body: unknown = text;
    try { body = JSON.parse(text); } catch { /* keep text */ }
    return { status: res.status, ok: res.ok, body, headers, durationMs: Math.round(performance.now() - started) };
  }

  async function send() {
    if (!apiKey) return;
    setLoading(true);
    try {
      if (burst <= 1) {
        setResult(await sendOne());
      } else {
        // Fire a burst in parallel to demonstrate the rate limiter blocking.
        const results = await Promise.all(Array.from({ length: burst }, () => sendOne()));
        const allowed = results.filter((r) => r.status === 200).length;
        const blocked = results.filter((r) => r.status === 429).length;
        const last = results[results.length - 1];
        setResult({
          ...last,
          body: { burst: true, sent: burst, allowed, blocked, lastResponse: last.body },
        });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Playground</h1>
        <p className="text-sm text-slate-500">Test protected endpoints with a real API key and watch the rate limiter respond.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Request builder */}
        <div className="card space-y-4 p-5">
          <div>
            <label className="label">API Key (paste the raw key shown at creation)</label>
            <input className="input font-mono" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="tx_live_…" />
          </div>
          <div>
            <label className="label">Endpoint</label>
            <select className="input" value={endpointIdx} onChange={(e) => setEndpointIdx(Number(e.target.value))}>
              {ENDPOINTS.map((ep, i) => (
                <option key={ep.path} value={i}>{ep.method} {ep.path}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Burst size (parallel requests): {burst}</label>
            <input type="range" min={1} max={50} value={burst} onChange={(e) => setBurst(Number(e.target.value))} className="w-full" />
            <p className="mt-1 text-xs text-slate-400">Raise this above the rule capacity to trigger 429s.</p>
          </div>
          <button className="btn-primary w-full" onClick={send} disabled={!apiKey || loading}>
            {loading ? 'Sending…' : `Send ${burst > 1 ? `${burst} requests` : 'request'}`}
          </button>
        </div>

        {/* Response viewer */}
        <div className="card space-y-4 p-5">
          {!result ? (
            <p className="py-10 text-center text-sm text-slate-400">Send a request to see the response.</p>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <Badge color={result.status === 200 ? 'green' : result.status === 429 ? 'red' : 'amber'}>
                  {result.status === 200 ? 'ALLOWED' : result.status === 429 ? 'BLOCKED (429)' : `HTTP ${result.status}`}
                </Badge>
                <span className="text-xs text-slate-400">{result.durationMs}ms</span>
              </div>

              <div>
                <p className="label">Rate-limit headers</p>
                <div className="space-y-1 rounded-lg bg-slate-50 p-3 font-mono text-xs">
                  {RL_HEADERS.filter((h) => result.headers[h] !== undefined).map((h) => (
                    <div key={h} className="flex justify-between gap-4">
                      <span className="text-slate-500">{h}</span>
                      <span className="text-slate-800">{result.headers[h]}</span>
                    </div>
                  ))}
                  {RL_HEADERS.every((h) => result.headers[h] === undefined) && (
                    <span className="text-slate-400">No rate-limit headers returned.</span>
                  )}
                </div>
              </div>

              <div>
                <p className="label">Response body</p>
                <pre className="max-h-64 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-emerald-300">
{JSON.stringify(result.body, null, 2)}
                </pre>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
