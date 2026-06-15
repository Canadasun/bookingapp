import { decryptProviderToken, encryptProviderToken } from './provider-token-crypto';

describe('provider token encryption', () => {
  const originalSecret = process.env.PROVIDER_TOKEN_ENCRYPTION_KEY;

  beforeAll(() => { process.env.PROVIDER_TOKEN_ENCRYPTION_KEY = 'test-provider-token-key'; });
  afterAll(() => {
    if (originalSecret === undefined) delete process.env.PROVIDER_TOKEN_ENCRYPTION_KEY;
    else process.env.PROVIDER_TOKEN_ENCRYPTION_KEY = originalSecret;
  });

  it('encrypts provider credentials with authenticated encryption', () => {
    const encrypted = encryptProviderToken('refresh-secret');
    expect(encrypted).toMatch(/^enc:v1:/);
    expect(encrypted).not.toContain('refresh-secret');
    expect(decryptProviderToken(encrypted)).toBe('refresh-secret');
  });

  it('reads legacy plaintext during migration', () => {
    expect(decryptProviderToken('legacy-token')).toBe('legacy-token');
  });
});
