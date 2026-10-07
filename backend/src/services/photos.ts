// backend/src/services/photos.ts — sharp re-encode (1600px + 400px thumb,
// EXIF stripped by default [D-17]) then store in S3 or local disk.
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { config, s3Enabled } from '../config.js';

const s3 = s3Enabled
  ? new S3Client({
      region: config.s3.region,
      endpoint: config.s3.endpoint,
      credentials: { accessKeyId: config.s3.accessKeyId, secretAccessKey: config.s3.secretAccessKey },
    })
  : null;

let warnedLocal = false;

export function photoUrl(key: string): string {
  if (s3Enabled && config.s3.publicBaseUrl) return `${config.s3.publicBaseUrl.replace(/\/$/, '')}/${key}`;
  // absolute — the PWA is usually on a different origin than the API
  return `${config.apiPublicUrl.replace(/\/$/, '')}/uploads/${key}`;
}

export interface ProcessedPhoto {
  storage_key: string;
  thumb_key: string;
  content_type: 'image/webp';
  width: number;
  height: number;
  bytes: number;
}

async function store(key: string, buf: Buffer): Promise<void> {
  if (s3) {
    await s3.send(new PutObjectCommand({ Bucket: config.s3.bucket, Key: key, Body: buf, ContentType: 'image/webp' }));
    return;
  }
  if (!warnedLocal) {
    warnedLocal = true;
    console.warn(`[photos] S3_* not configured — storing under ${config.uploadDir}. Railway disks are ephemeral; set S3_* in production.`);
  }
  const dest = join(config.uploadDir, key);
  await mkdir(join(dest, '..'), { recursive: true });
  await writeFile(dest, buf);
}

/** Re-encode to webp at 1600px + 400px thumb. EXIF is dropped by default.
 *  Throws on undecodable input — callers map that to 415. */
export async function processPhoto(reportId: number, buf: Buffer): Promise<ProcessedPhoto> {
  const base = `reports/${reportId}/${randomUUID().slice(0, 8)}`;
  const img = sharp(buf).rotate(); // .rotate() applies EXIF orientation, then EXIF is stripped
  const [full, thumb] = await Promise.all([
    img.clone().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer({ resolveWithObject: true }),
    img.clone().resize({ width: 400, withoutEnlargement: true }).webp({ quality: 70 }).toBuffer(),
  ]);
  const storage_key = `${base}.webp`;
  const thumb_key = `${base}_t.webp`;
  await store(storage_key, full.data);
  await store(thumb_key, thumb);
  return { storage_key, thumb_key, content_type: 'image/webp', width: full.info.width, height: full.info.height, bytes: full.data.length };
}
