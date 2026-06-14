import { createHmac, timingSafeEqual } from 'crypto';

type PublicClientPayload = {
  businessId: string;
  clientId: string;
  exp: number;
};

function secret() {
  const value = process.env.JWT_SECRET;
  if (!value) throw new Error('JWT_SECRET is required for public client tokens');
  return value;
}

export function signPublicClientToken(businessId: string, clientId: string): string {
  const payload: PublicClientPayload = {
    businessId,
    clientId,
    exp: Date.now() + 15 * 60_000,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', secret()).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

export function verifyPublicClientToken(token: string | undefined, businessId: string): string | null {
  if (!token) return null;
  const [encoded, signature, extra] = token.split('.');
  if (!encoded || !signature || extra) return null;
  const expected = createHmac('sha256', secret()).update(encoded).digest('base64url');
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as PublicClientPayload;
    if (payload.businessId !== businessId || !payload.clientId || payload.exp < Date.now()) return null;
    return payload.clientId;
  } catch {
    return null;
  }
}
