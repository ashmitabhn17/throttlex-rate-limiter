/**
 * Atomic Token Bucket, implemented as a Redis Lua script.
 *
 * WHY LUA?
 * A naive rate limiter does GET -> check -> INCR as three separate round trips.
 * Under concurrency, N requests can all read the same "count" before any of them
 * writes it back, so all N are allowed even though only 1 slot was free. That's a
 * classic read-modify-write race (a TOCTOU bug).
 *
 * Redis executes a Lua script atomically: the whole refill-check-consume-write
 * sequence runs as a single indivisible operation with no interleaving from other
 * clients. So even with thousands of parallel requests hitting the same bucket,
 * the token accounting is exact and never oversells capacity.
 *
 * TOKEN BUCKET MODEL
 * - The bucket holds up to `capacity` tokens.
 * - It refills continuously at `refillRatePerSecond` tokens/second (fractional ok).
 * - Each allowed request consumes `requested` tokens (1 here).
 * - A request is allowed iff there are >= `requested` tokens after refilling.
 * - Bursts up to `capacity` are permitted; sustained rate is the refill rate.
 *
 * State is stored in a single Redis hash per bucket:
 *   tokens -> current token count (float)
 *   ts     -> last refill timestamp in milliseconds
 *
 * KEYS[1] = bucket key (e.g. rl:{apiKeyHash}:FREE:routeHash)
 *           Note on Hashing: We use apiKeyHash instead of the raw API key to ensure
 *           the raw key is never logged or exposed if Redis is compromised.
 * ARGV[1] = capacity            (max tokens)
 * ARGV[2] = refillRatePerSecond (tokens added per second)
 * ARGV[3] = nowMs               (caller's current time, ms)
 * ARGV[4] = requested           (tokens to consume, usually 1)
 * ARGV[5] = ttlSeconds          (expiry so idle buckets self-clean)
 *
 * Returns: { allowed(1/0), remaining(int), retryAfterSeconds(int), resetSeconds(int) }
 */
export const TOKEN_BUCKET_LUA = `
local key       = KEYS[1]
local capacity  = tonumber(ARGV[1])
local refill    = tonumber(ARGV[2])
local now       = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])
local ttl       = tonumber(ARGV[5])

-- Load existing bucket state, defaulting to a full bucket for first contact.
local data   = redis.call('HMGET', key, 'tokens', 'ts')
local tokens = tonumber(data[1])
local ts     = tonumber(data[2])

if tokens == nil then
  tokens = capacity
  ts = now
end

-- Refill based on elapsed time since the last update (never above capacity).
local elapsed = math.max(0, now - ts) / 1000.0
tokens = math.min(capacity, tokens + (elapsed * refill))
ts = now

local allowed = 0
if tokens >= requested then
  allowed = 1
  tokens = tokens - requested
end

-- Persist new state and set a TTL so buckets for idle keys evict themselves.
redis.call('HSET', key, 'tokens', tokens, 'ts', ts)
redis.call('EXPIRE', key, ttl)

-- retryAfter: seconds until enough tokens exist to serve this request.
local retry_after = 0
if allowed == 0 then
  if refill > 0 then
    retry_after = math.ceil((requested - tokens) / refill)
  else
    retry_after = ttl
  end
end

-- reset: seconds until the bucket is completely full again.
local reset = 0
if refill > 0 then
  reset = math.ceil((capacity - tokens) / refill)
end

return { allowed, math.floor(tokens), retry_after, reset }
`;
