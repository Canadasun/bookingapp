import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const PREFIX = 'enc:v1:';

function keyFrom(secret: string): Buffer {
  return createHash('sha256').update(secret).digest();
}

function encryptionSecrets(): string[] {
  const secret = process.env.PROVIDER_TOKEN_ENCRYPTION_KEY ?? process.env.JWT_SECRET;
  if (!secret) throw new Error('PROVIDER_TOKEN_ENCRYPTION_KEY or JWT_SECRET is required');
  return [...new Set([secret, process.env.JWT_SECRET].filter((value): value is string => !!value))];
}

export function encryptProviderToken(value: string): string {
  if (value.startsWith(PREFIX)) return value;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFrom(encryptionSecrets()[0]), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64url')}.${tag.toString('base64url')}.${ciphertext.toString('base64url')}`;
}

export function decryptProviderToken(value: string): string {
  if (!value.startsWith(PREFIX)) return value;
  const [ivEncoded, tagEncoded, ciphertextEncoded] = value.slice(PREFIX.length).split('.');
  if (!ivEncoded || !tagEncoded || !ciphertextEncoded) throw new Error('Invalid encrypted provider token');
  for (const secret of encryptionSecrets()) {
    try {
      const decipher = createDecipheriv('aes-256-gcm', keyFrom(secret), Buffer.from(ivEncoded, 'base64url'));
      decipher.setAuthTag(Buffer.from(tagEncoded, 'base64url'));
      return Buffer.concat([
        decipher.update(Buffer.from(ciphertextEncoded, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      // Try the previous JWT-derived key during key separation/rotation.
    }
  }
  throw new Error('Unable to decrypt provider token');
}
