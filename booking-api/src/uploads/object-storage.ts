import { randomBytes } from 'crypto';
import {
  S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand,
} from '@aws-sdk/client-s3';

// S3-compatible object storage (AWS S3, Cloudflare R2, Backblaze B2, MinIO,
// DO Spaces). Active ONLY when the bucket + credentials are configured; otherwise
// uploads fall back to in-DB bytes. Required env to enable:
//   S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY
// Optional: S3_REGION (default "auto"), S3_ENDPOINT (R2/MinIO), S3_FORCE_PATH_STYLE,
//   S3_PUBLIC_BASE_URL (serve a 302 redirect to a CDN/public bucket instead of streaming).

export function objectStorageEnabled(): boolean {
  return !!(process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY);
}

let client: S3Client | null = null;
function s3(): S3Client {
  if (!client) {
    client = new S3Client({
      region: process.env.S3_REGION || 'auto',
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      },
    });
  }
  return client;
}

export function newStorageKey(businessId: string): string {
  const prefix = (process.env.S3_UPLOAD_PREFIX || 'Uploads').replace(/^\/+|\/+$/g, '') || 'Uploads';
  return `${prefix}/${businessId}/${randomBytes(16).toString('hex')}`;
}

export async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
  cacheControl = 'public, max-age=31536000, immutable',
): Promise<void> {
  await s3().send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
    CacheControl: cacheControl,
  }));
}

export async function getObjectBytes(key: string): Promise<{ buffer: Buffer; contentType?: string } | null> {
  try {
    const res = await s3().send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
    if (!res.Body) return null;
    const bytes = await res.Body.transformToByteArray();
    return { buffer: Buffer.from(bytes), contentType: res.ContentType };
  } catch {
    return null;
  }
}

export async function deleteObject(key: string): Promise<void> {
  try {
    await s3().send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
  } catch {
    /* best-effort */
  }
}

// If a public/CDN base URL is set, callers can 302-redirect to it instead of
// streaming bytes through the API.
export function publicUrlFor(key: string): string | null {
  const base = process.env.S3_PUBLIC_BASE_URL;
  return base ? `${base.replace(/\/$/, '')}/${key}` : null;
}
