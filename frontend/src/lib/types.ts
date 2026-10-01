export type Plan = 'FREE' | 'PRO' | 'ENTERPRISE';
export type ApiKeyStatus = 'ACTIVE' | 'DISABLED';
export type Algorithm = 'TOKEN_BUCKET' | 'FIXED_WINDOW';
export type RequestStatusT = 'ALLOWED' | 'BLOCKED';

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  plan: Plan;
  status: ApiKeyStatus;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
}

export interface RateLimitRule {
  id: string;
  route: string;
  method: string;
  algorithm: Algorithm;
  plan: Plan;
  capacity: number;
  refillRatePerSecond: number;
  windowSeconds: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RequestLog {
  id: string;
  apiKeyId: string | null;
  route: string;
  method: string;
  status: RequestStatusT;
  ip: string | null;
  userAgent: string | null;
  limit: number;
  remaining: number;
  retryAfter: number | null;
  createdAt: string;
  apiKey?: { id: string; name: string; keyPrefix: string; plan: Plan } | null;
}

export interface AnalyticsSummary {
  totalRequests: number;
  allowedRequests: number;
  blockedRequests: number;
  activeApiKeys: number;
  totalApiKeys: number;
  avgRequestsPerMinute: number;
  topLimitedRoute: string | null;
}

export interface TimeSeriesPoint {
  time: string;
  allowed: number;
  blocked: number;
}
