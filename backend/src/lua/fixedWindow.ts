/**
 * Atomic Fixed Window counter (optional second algorithm).
 *
 * Counts requests within a fixed time window of `windowSeconds`. The first
 * request in a window creates the counter with a TTL equal to the window, so
 * the whole thing self-resets. Also atomic via Lua — a plain INCR + EXPIRE pair
 * can lose the EXPIRE under a crash, and GET/INCR races the same way the token
 * bucket note describes.
 *
 * KEYS[1] = counter key
 * ARGV[1] = capacity       (max requests per window)
 * ARGV[2] = windowSeconds
 *
 * Returns: { allowed(1/0), remaining(int), retryAfterSeconds(int), resetSeconds(int) }
 */
export const FIXED_WINDOW_LUA = `
local key      = KEYS[1]
local capacity = tonumber(ARGV[1])
local window   = tonumber(ARGV[2])

local current = redis.call('INCR', key)
if current == 1 then
  redis.call('EXPIRE', key, window)
end

local ttl = redis.call('TTL', key)
if ttl < 0 then ttl = window end

local allowed = 0
local remaining = 0
if current <= capacity then
  allowed = 1
  remaining = capacity - current
end

local retry_after = 0
if allowed == 0 then
  retry_after = ttl
end

return { allowed, remaining, retry_after, ttl }
`;
