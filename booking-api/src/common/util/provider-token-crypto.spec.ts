import { decryptProviderToken, encryptProviderToken } from './provider-token-crypto';

describe('provider token encryption', () => {
  const originalSecret = process.env.PROVIDER_TOKEN_ENCRYPTION_KEY;
  const originalJwtSecret = process.env.JWT_SECRET;

  beforeAll(() => {
    process.env.PROVIDER_TOKEN_ENCRYPTION_KEY = 'test-provider-token-key';
    process.env.JWT_SECRET = 'test-jwt-key';
  });
  afterAll(() => {
    if (originalSecret === undefined) delete process.env.PROVIDER_TOKEN_ENCRYPTION_KEY;
    else process.env.PROVIDER_TOKEN_ENCRYPTION_KEY = originalSecret;
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;
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

  it('decrypts ciphertext written with the prior JWT-derived key', () => {
    delete process.env.PROVIDER_TOKEN_ENCRYPTION_KEY;
    const encrypted = encryptProviderToken('legacy-encrypted-token');
    process.env.PROVIDER_TOKEN_ENCRYPTION_KEY = 'new-dedicated-key';
    expect(decryptProviderToken(encrypted)).toBe('legacy-encrypted-token');
  });
});
