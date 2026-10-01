import crypto from 'crypto';

const KEY_PREFIX = 'tx_live_';

export interface GeneratedApiKey {
  /** The full raw key. Shown to the admin exactly once, never stored. */
  raw: string;
  /** SHA-256 hash of the raw key. This is what we persist and look up by. */
  keyHash: string;
  /** A short, non-secret prefix used purely for display in the dashboard. */
  keyPrefix: string;
}

/**
 * Generate a new API key. Format: tx_live_<32 hex chars>.
 *
 * We hash the raw key with SHA-256 (fast, deterministic) rather than bcrypt
 * because we need to look keys up by hash on every protected request — a
 * deterministic hash lets us do an indexed equality lookup. The raw key has
 * 128 bits of entropy, so a plain cryptographic hash is appropriate here.
 */
export function generateApiKey(): GeneratedApiKey {
  const random = crypto.randomBytes(16).toString('hex'); // 32 hex chars
  const raw = `${KEY_PREFIX}${random}`;
  return {
    raw,
    keyHash: hashApiKey(raw),
    keyPrefix: raw.slice(0, KEY_PREFIX.length + 6), // e.g. tx_live_8f72a9
  };
}

/** Deterministic hash used both for storage and lookup. */
export function hashApiKey(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * Short, opaque identity derived from the key hash, used inside Redis keys.
 * Never exposes the raw key. Truncated to keep Redis keys compact.
 */
export function apiKeyRedisIdentity(keyHash: string): string {
  return keyHash.slice(0, 16);
}

/** Stable short hash of a route string, used in Redis key composition. */
export function routeHash(route: string, method: string): string {
  return crypto.createHash('sha256').update(`${method}:${route}`).digest('hex').slice(0, 10);
}
