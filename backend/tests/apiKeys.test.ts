import { prisma } from '../src/config/prisma';
import { hashApiKey, generateApiKey } from '../src/utils/apiKey';
import { resetData, closeConnections } from './helpers';

describe('API key storage', () => {
  beforeEach(async () => {
    await resetData();
  });

  afterAll(async () => {
    await closeConnections();
  });

  it('stores only the hashed key, never the raw key', async () => {
    const { raw, keyHash, keyPrefix } = generateApiKey();
    const created = await prisma.apiKey.create({
      data: { name: 'k', keyHash, keyPrefix, plan: 'FREE' },
    });

    const row = await prisma.apiKey.findUnique({ where: { id: created.id } });
    expect(row).not.toBeNull();
    // The raw key must never be equal to anything persisted.
    expect(row!.keyHash).toBe(hashApiKey(raw));
    expect(row!.keyHash).not.toBe(raw);
    // Prefix is display-safe and does not reveal the secret portion.
    expect(raw.startsWith(row!.keyPrefix)).toBe(true);
    expect(row!.keyPrefix.length).toBeLessThan(raw.length);
  });

  it('produces unique keys and hashes', () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.raw).not.toBe(b.raw);
    expect(a.keyHash).not.toBe(b.keyHash);
    expect(a.raw).toMatch(/^tx_live_[0-9a-f]{32}$/);
  });
});
