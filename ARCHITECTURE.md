# ThrottleX — Architecture

This document explains the internal design of ThrottleX: the request flow, the Redis key design, the database schema, the failure strategy, and the Token Bucket algorithm.

---

## 1. Request flow

### Protected API request (`/api/*`)

```
Client ──(x-api-key)──► Express
   │
   ├─ 1. Read x-api-key header            → 401 if missing
   ├─ 2. SHA-256 hash the key
   ├─ 3. Look up ApiKey by keyHash        → 401 if not found
   ├─ 4. Check status                     → 403 if DISABLED
   ├─ 5. Resolve rule (plan,method,route) → fall back to plan defaults
   ├─ 6. Build Redis key rl:{keyId}:plan:routeHash
   ├─ 7. EVAL token-bucket Lua (atomic)   → { allowed, remaining, retryAfter, reset }
   ├─ 8. Set X-RateLimit-* headers
   ├─ 9. Write RequestLog + bump lastUsedAt (async)
   └─ 10. allowed ? next() : 429 + Retry-After
```

The key property: steps 6–7 are the only place shared state is touched, and that touch is a single atomic Redis script. Everything else is per-request local work.

### Admin API request (`/auth`, `/admin/*`)

```
Dashboard ──(Bearer JWT / cookie)──► Express
   ├─ requireAuth verifies JWT
   └─ handler queries Postgres via Prisma
```

---

## 2. Redis key design

```
rl:{apiKeyHash}:plan:routeHash
   │  │            │     │
   │  │            │     └── short SHA-256 of "METHOD:/route" (compact, opaque)
   │  │            └──────── FREE | PRO | ENTERPRISE
   │  └───────────────────── truncated SHA-256 of the raw key (never the raw key)
   └──────────────────────── namespace prefix
```

### Why this shape

**Hot-key avoidance.** A single global key (`rl:global`) would funnel the entire fleet's traffic through one Redis key — one CPU, one cluster slot — capping throughput and creating a single point of contention. By leading with the per-tenant `{apiKeyHash}`, each API key gets an independent bucket and load naturally fans out across keys.

**Cluster hash tags.** The braces around `{apiKeyHash}` make it a Redis Cluster *hash tag*: only the braced substring is hashed to choose the slot. So all keys for one API key co-locate on one slot (handy for future multi-key MULTI/pipeline ops), while different API keys distribute across slots and nodes.

**Per-route isolation.** Appending `:plan:routeHash` gives each route its own bucket, so a spike on `/api/search` cannot consume the budget for `/api/login-demo`.

**No secret leakage.** Only a truncated hash-derived identity is used. The raw key never appears in Redis keys, database columns, or logs.

### Bucket state

Each bucket is a Redis hash with a TTL:

```
HSET rl:{...}  tokens <float>  ts <lastRefillMs>
EXPIRE rl:{...} <ttl>
```

TTL = `max(windowSeconds * 2, 120)` so idle buckets self-evict.

---

## 3. Database schema

PostgreSQL holds durable state; Redis holds volatile counters.

| Model | Purpose | Notes |
|---|---|---|
| `User` | Admin login | `passwordHash` (bcrypt) only |
| `ApiKey` | Issued keys | `keyHash` (SHA-256, unique) + `keyPrefix` for display; raw key never stored |
| `RateLimitRule` | Per `(plan, method, route)` config | unique on `(plan, method, route)`; `capacity`, `refillRatePerSecond`, `windowSeconds`, `algorithm`, `enabled` |
| `RequestLog` | Audit of every protected request | `status` ALLOWED/BLOCKED, `limit`, `remaining`, `retryAfter`, `ip`, `userAgent`; indexed on status/apiKeyId/route/createdAt |

Enums: `Plan (FREE|PRO|ENTERPRISE)`, `ApiKeyStatus (ACTIVE|DISABLED)`, `RateLimitAlgorithm (TOKEN_BUCKET|FIXED_WINDOW)`, `RequestStatus (ALLOWED|BLOCKED)`.

`RequestLog.apiKeyId` uses `onDelete: SetNull` so deleting a key preserves its historical logs.

---

## 4. Fail-open vs fail-closed

When Redis is unreachable the limiter can't consult bucket state. Two policies:

- **Fail-open** (`RATE_LIMIT_FAIL_OPEN=true`, default in production): allow the request through. Prioritises **availability** — a Redis blip shouldn't take down your APIs. Risk: temporary loss of enforcement, so abuse could slip through during an outage.
- **Fail-closed** (`false`, default in tests): block with `429`. Prioritises **protection** — nothing gets through unmetered. Risk: a Redis outage becomes a full API outage.

ThrottleX makes this a config flag because the right choice is domain-specific: a public content API usually wants fail-open; a login or payments endpoint may want fail-closed. Degraded responses set `X-RateLimit-Degraded: true` so clients/observability can tell enforcement was bypassed.

---

## 5. Token Bucket algorithm

State per bucket: `tokens` (current count) and `ts` (last refill time, ms).

On each request the Lua script does:

```
elapsed  = max(0, now - ts) / 1000
tokens   = min(capacity, tokens + elapsed * refillRatePerSecond)   -- refill
ts       = now
if tokens >= 1 then
  allowed = true
  tokens  = tokens - 1                                             -- consume
else
  allowed = false
  retryAfter = ceil((1 - tokens) / refillRatePerSecond)
end
reset = ceil((capacity - tokens) / refillRatePerSecond)            -- time to full
HSET tokens, ts ; EXPIRE ttl
```

### Properties

- **Burst tolerance**: a full bucket allows up to `capacity` immediate requests.
- **Sustained rate**: long-run throughput converges to `refillRatePerSecond`.
- **Continuous refill**: tokens accrue proportionally to elapsed time — no thundering-herd reset boundary like fixed windows have.
- **Atomicity**: the entire refill-check-consume-write happens inside one Redis script, so concurrent requests can never both observe the same stale token count. This is the core guarantee the concurrency test exercises (50 parallel → exactly `capacity` allowed).

### Why Token Bucket over Fixed Window

Fixed Window (also implemented, in [`backend/src/lua/fixedWindow.ts`](backend/src/lua/fixedWindow.ts)) is simpler but suffers **boundary bursts**: a client can send `capacity` requests at the end of one window and `capacity` more at the start of the next — up to `2× capacity` in a short span. Token Bucket smooths this by refilling continuously, which is why it's the recommended default here.

---

## 6. Component map

```
backend/src
├── config/        env, prisma client, redis client, default plan limits
├── lua/           tokenBucket.ts, fixedWindow.ts  (annotated Lua)
├── services/      rateLimiter.ts   (key building + EVAL + fail policy)
├── middleware/    rateLimit.ts, requireAuth.ts, errorHandler.ts
├── routes/        auth, apiKeys, rules, analytics, logs, protected
├── utils/         apiKey (hash/generate), jwt, password, httpError
├── app.ts         express wiring
└── index.ts       server bootstrap

frontend/src
├── app/           App Router pages (login, dashboard/*)
├── components/     shared UI (StatCard, Badge, Modal, Spinner)
└── lib/            api client, shared types
```

---

## 7. Cloud Deployment Architecture (AWS EC2 + ECR + Docker)

```
[External Clients / Consumers]
              │
              │  HTTP requests on port 4000 (x-api-key)
              ▼
    [AWS Internet Gateway]
              │
              ▼
    [AWS VPC / EC2 Security Group] (Port 22 SSH, 4000 API, 3000 Dashboard)
              │
              ▼
   ┌─────────────────────────────────────────────────────────────┐
   │ AWS EC2 Host (Ubuntu 24.04 LTS / t2.micro)                  │
   │                                                             │
   │  ┌────────────────────────────── Docker Runtime ──────────┐  │
   │  │                                                        │  │
   │  │  ┌───────────────────┐        ┌───────────────────┐    │  │
   │  │  │ throttlex-backend │<──────>│  throttlex-redis  │    │  │
   │  │  │ (Express / Node20)│        │   (Redis 7 Alpine)│    │  │
   │  │  └─────────┬─────────┘        └───────────────────┘    │  │
   │  │            │                                           │  │
   │  │            ▼                                           │  │
   │  │  ┌───────────────────┐                                 │  │
   │  │  │throttlex-postgres │                                 │  │
   │  │  │(PostgreSQL 16)    │                                 │  │
   │  │  └───────────────────┘                                 │  │
   │  └────────────────────────────────────────────────────────┘  │
   └─────────────────────────────────────────────────────────────┘
                               ▲
                               │ docker pull
                               │
               [Amazon ECR Container Registry]
```

### Key Architectural Characteristics
- **Immutable Container Artifacts**: Multi-stage Docker builds isolate compilation from the lightweight production runner.
- **Image Registry**: Images are versioned and stored in Amazon ECR with commit SHA and `latest` tags.
- **Single-Host Isolation**: On the EC2 host, services communicate over a private Docker bridge network (`postgres:5432`, `redis:6379`), exposing only the public ingress ports (4000 / 3000) to the internet.

